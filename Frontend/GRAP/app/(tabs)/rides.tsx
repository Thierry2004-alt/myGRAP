import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import GoogleDriverMap from '../../components/GoogleDriverMap';
import { api } from '../../services/api';
import { activeRideStorage, loyaltyStorage } from '../../services/storage';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useResponsive, responsiveContainerStyle } from '../../utils/responsive';
import { useWebSocket } from '../../hooks/useWebSocket';

interface AlternativeDriverProposal {
  id: string;
  category: string;
  catBadgeColor: string;
  fare: string;
  driverName: string;
  vehicleInfo: string;
  rating: string;
  eta: string;
  distance: string;
  vehicleType: 'MOTO' | 'CAR';
}

export default function PassengerRidesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { horizontalScale, verticalScale, moderateScale, fontScale, isWeb } = useResponsive();

  const paramRideId = params.ride_id as string;
  const paramPay = (params.pay as string) || 'CASH';
  const paramPickup = (params.pickup as string) || 'Current Location';
  const paramDest = (params.dest as string) || 'Bastos Ambassades';
  const paramPickupLat = parseFloat(params.pickup_lat as string) || 3.8400;
  const paramPickupLng = parseFloat(params.pickup_lng as string) || 11.5000;
  const paramDestLat = parseFloat(params.dest_lat as string) || 3.8750;
  const paramDestLng = parseFloat(params.dest_lng as string) || 11.5180;

  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [completedRides, setCompletedRides] = useState<any[]>([]);
  const [sharedHistory, setSharedHistory] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  // EXPLICIT PASSENGER ACCEPTANCE & TRIP STAGE STATE
  const [passengerAccepted, setPassengerAccepted] = useState(false);
  const [acceptedRideId, setAcceptedRideId] = useState<string | null>(null);
  const [noDriverAvailable, setNoDriverAvailable] = useState(false);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);

  const [cashPin, setCashPin] = useState('4892');
  const [inputPin, setInputPin] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // CROSS-CATEGORY ALTERNATIVE DRIVER PROPOSALS
  const alternativeDrivers: AlternativeDriverProposal[] = [
    {
      id: 'alt-moto',
      category: 'Moto (Motorcycle Taxi)',
      catBadgeColor: '#00E676',
      fare: '700 FCFA',
      driverName: 'Eric Nseng',
      vehicleInfo: 'TVS HLX 150 • CE-441-XY',
      rating: '4.8 (38 rides)',
      eta: '2 mins away',
      distance: '1.2 km',
      vehicleType: 'MOTO',
    },
    {
      id: 'alt-comfort',
      category: 'Comfort Sedan',
      catBadgeColor: '#0288D1',
      fare: '1,850 FCFA',
      driverName: 'Alain Manga',
      vehicleInfo: 'Toyota Corolla • CE-882-ZZ',
      rating: '4.95 (96 rides)',
      eta: '3 mins away',
      distance: '0.8 km',
      vehicleType: 'CAR',
    },
    {
      id: 'alt-comfort-plus',
      category: 'Comfort+ Executive VIP',
      catBadgeColor: '#FFD600',
      fare: '2,650 FCFA',
      driverName: 'Samuel Eto\'o',
      vehicleInfo: 'Hyundai Santa Fe • CE-001-VIP',
      rating: '5.0 (140 rides)',
      eta: '4 mins away',
      distance: '1.5 km',
      vehicleType: 'CAR',
    },
  ];

  useEffect(() => {
    fetchLiveActiveRide();
  }, [paramRideId]);

  useEffect(() => {
    if (activeRide?.pickup_lat && activeRide?.pickup_lng) {
      setDriverPosition({ lat: activeRide.pickup_lat + 0.005, lng: activeRide.pickup_lng + 0.005 });
    }
  }, [activeRide?.pickup_lat, activeRide?.pickup_lng]);

  useEffect(() => {
    if (activeRide && params.shared === '1' && !passengerAccepted) {
      setPassengerAccepted(true);
      setAcceptedRideId(String(activeRide.id));
      activeRideStorage.save({ ...activeRide, passengerAccepted: true });
    }
  }, [activeRide?.id, passengerAccepted, params.shared]);

  useEffect(() => {
    const loadParticipants = async () => {
      if (!activeRide?.id) {
        setParticipants([]);
        return;
      }
      try {
        const shared = await api.getMySharedRides().catch(() => ({ joined: [], initiated: [] }));
        const initiated = shared.initiated || [];
        const rideId = Number(activeRide.id);
        console.log('Loading participants for rideId:', rideId, 'initiated count:', initiated.length, 'initiated sample:', JSON.stringify(initiated[0]).slice(0, 200));
        const match = initiated.find((item: any) => {
          const itemSharedId = Number(item?.shared_ride_id || 0);
          const primaryRideId = Number(item?.primary_ride?.id || item?.primary_ride_id || 0);
          const rideIdField = Number(item?.ride_id || 0);
          const sample = initiated[0] ? JSON.stringify(initiated[0]).slice(0, 200) : 'N/A';
          console.log('Checking item:', itemSharedId, primaryRideId, rideIdField, 'vs', rideId, 'initiated sample:', sample);
          return itemSharedId === rideId || primaryRideId === rideId || rideIdField === rideId;
        });
        console.log('Shared ride match:', match);
        if (match?.shared_ride_id) {
          const status = await api.getSharedRideStatus(match.shared_ride_id);
          console.log('Shared ride status participants:', status?.participants);
          const list = status?.participants || [];
          setParticipants(list);
          if (list.length === 0 && status?.shared_ride_id) {
            console.log('Shared ride exists but no participants yet');
          }
        } else {
          console.log('No shared ride match found for rideId:', rideId, 'available ids:', initiated.map((i: any) => ({ shared_ride_id: i?.shared_ride_id, primary_ride_id: i?.primary_ride?.id, ride_id: i?.ride_id })));
          setParticipants([]);
        }
      } catch (e) {
        console.log('Failed to load participants:', e);
        setParticipants([]);
      }
    };

    loadParticipants();
    const interval = setInterval(loadParticipants, 5000);
    return () => clearInterval(interval);
  }, [activeRide?.id]);

  useWebSocket({
    rideId: activeRide?.id,
    onMessage: (data) => {
      if (data.type === 'participant_joined') {
        setParticipants((prev) => [...prev, data.data]);
      } else if (data.type === 'ride_cancelled') {
        Alert.alert('Ride Cancelled', 'This ride has been cancelled.');
        setActiveRide(null);
        setPassengerAccepted(false);
        router.replace('/');
      }
    },
    reconnectInterval: 2000,
  });

  // SAVE ACTIVE RIDE TO STORAGE EVERY TIME IT UPDATES (PERSISTENT ACROSS TAB SWITCHES)
  useEffect(() => {
    if (activeRide) {
      activeRideStorage.save({
        ...activeRide,
        passengerAccepted,
      });
    }
  }, [activeRide, passengerAccepted]);

  useEffect(() => {
    const restoreAccepted = async () => {
      try {
        const stored = await activeRideStorage.get();
        if (stored?.passengerAccepted && activeRide && String(stored.id) === String(activeRide.id)) {
          setPassengerAccepted(true);
          setAcceptedRideId(String(stored.id));
        } else if (stored?.passengerAccepted && !activeRide) {
          setPassengerAccepted(true);
          setAcceptedRideId(stored.id ? String(stored.id) : null);
        }
      } catch (e) {
        console.log('Failed to restore passengerAccepted:', e);
      } finally {
        setStorageReady(true);
      }
    };
    restoreAccepted();
  }, []);

  const fetchLiveActiveRide = async () => {
    setLoading(true);
    try {
      const storedRide = await activeRideStorage.get();
      const myRides = await api.getMyRides();
      setCompletedRides(Array.isArray(myRides) ? myRides.filter((ride) => ride.status === 'COMPLETED') : []);
      const shared = await api.getMySharedRides().catch(() => ({ joined: [], initiated: [] }));
      setSharedHistory(shared.joined || []);

      // The API is authoritative. Do not show a locally cached ride that was
      // deleted, cancelled, or no longer belongs to the current account.
      const storedRideId = storedRide?.id ? Number(storedRide.id) : null;
      const serverRide = Array.isArray(myRides) && storedRideId
        ? myRides.find((ride) => Number(ride.id) === storedRideId)
        : null;

      if (storedRide && storedRide.status !== 'COMPLETED' && !storedRide.status.startsWith('CANCELLED')) {
        if (!serverRide || serverRide.status === 'COMPLETED' || serverRide.status.startsWith('CANCELLED')) {
          await activeRideStorage.clear();
          setActiveRide(null);
          setPassengerAccepted(false);
        } else {
          setActiveRide({ ...serverRide, ...storedRide });
          if (storedRide.passengerAccepted) {
            setPassengerAccepted(true);
          }
          setLoading(false);
          return;
        }
      }

      setCompletedRides(Array.isArray(myRides) ? myRides.filter((ride) => ride.status === 'COMPLETED') : []);
      if (Array.isArray(myRides) && myRides.length > 0) {
        const pending = myRides.find((r) => r.status !== 'COMPLETED' && !r.status.startsWith('CANCELLED'));
        if (pending) {
          setActiveRide(pending);
        } else {
          setActiveRide(null);
        }
      } else       if (paramRideId) {
        const newRideObj = {
          id: paramRideId,
          status: 'ACCEPTED',
          driver_name: 'Paul Nkoa',
          vehicle_info: 'Toyota Yaris • CE-992-AA',
          pickup_name: paramPickup,
          pickup_lat: paramPickupLat,
          pickup_lng: paramPickupLng,
          destination_name: paramDest,
          destination_lat: paramDestLat,
          destination_lng: paramDestLng,
          payment_method: paramPay,
        };
        setActiveRide(newRideObj);
        await activeRideStorage.save(newRideObj);
      } else {
        setActiveRide(null);
      }
    } catch (e) {
      if (paramRideId) {
        const fallbackObj = {
          id: paramRideId,
          status: 'ACCEPTED',
          driver_name: 'Paul Nkoa',
          vehicle_info: 'Toyota Yaris • CE-992-AA',
          pickup_name: paramPickup,
          pickup_lat: paramPickupLat,
          pickup_lng: paramPickupLng,
          destination_name: paramDest,
          destination_lat: paramDestLat,
          destination_lng: paramDestLng,
          payment_method: paramPay,
        };
        setActiveRide(fallbackObj);
        await activeRideStorage.save(fallbackObj);
      } else {
        setActiveRide(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // EXPLICIT PASSENGER ACTION: ACCEPT DRIVER TO START TRIP SIMULATION
  const handlePassengerAcceptDriver = () => {
    if (!activeRide) return;
    setPassengerAccepted(true);
    setAcceptedRideId(String(activeRide.id));
    setNoDriverAvailable(false);
    setActiveRide((prev: any) => {
      const updated = prev ? { ...prev, status: 'ACCEPTED' } : null;
      activeRideStorage.save(updated);
      return updated;
    });

    Alert.alert(
      'Driver Accepted!',
      `Driver ${activeRide?.driver_name || 'Paul Nkoa'} confirmed. Stage 1: En route to pick you up!`
    );
  };

  // AUTOMATED SIGNAL: DRIVER ARRIVED AT PICKUP -> AUTO-TRANSITION TO DESTINATION (STAGE 2)
  const handleAutomatedPickupArrival = () => {
    setActiveRide((prev: any) => {
      if (prev && prev.status === 'ACCEPTED') {
        const updated = { ...prev, status: 'IN_PROGRESS' };
        activeRideStorage.save(updated);
        return updated;
      }
      return prev;
    });
  };

  // AUTOMATED SIGNAL: DRIVER ARRIVED AT DESTINATION -> AUTO-TRIGGER PAYMENT MODAL
  const handleAutomatedDestinationArrival = () => {
    setShowPaymentPrompt(true);
  };

  // WHATSAPP / SECURITY CONTACT LIVE TRIP SHARING
  const handleShareTripWhatsApp = async () => {
    if (!activeRide) return;
    const dName = activeRide.driver_name || 'Paul Nkoa';
    const vInfo = activeRide.vehicle_info || 'Toyota Yaris CE-992-AA';
    const pName = activeRide.pickup_name || paramPickup;
    const dDest = activeRide.destination_name || paramDest;

    const message = `🚕 Live GRAP Security Ride Tracking:\n\n` +
      `I am on a trip with driver ${dName} (${vInfo}).\n` +
      `📍 From: ${pName}\n` +
      `🎯 To: ${dDest}\n` +
      `🔒 Live Tracking Link: https://grap.cm/track/${activeRide.id || '4892'}`;

    try {
      await Share.share({ message });
    } catch (e) {
      console.log('Error sharing ride:', e);
    }
  };

  // DECLINE ACTION: TRANSITION TO NO DRIVER AVAILABLE & SHOW OTHER CATEGORIES
  const handleDeclineDriver = () => {
    setNoDriverAvailable(true);
    setPassengerAccepted(false);
  };

  // SWITCH TO ALTERNATIVE CATEGORY DRIVER
  const handleSwitchCategoryDriver = (alt: AlternativeDriverProposal) => {
    const updated = {
      ...activeRide,
      driver_name: alt.driverName,
      vehicle_info: alt.vehicleInfo,
      status: 'ACCEPTED',
      vehicleType: alt.vehicleType,
    };
    setActiveRide(updated);
    activeRideStorage.save(updated);
    setNoDriverAvailable(false);
    setPassengerAccepted(true);
    Alert.alert(
      'Category Switched!',
      `Switched to ${alt.category} (${alt.fare}). Driver ${alt.driverName} is en route to pick you up!`
    );
  };

  const handleCancelRide = async () => {
    const performCancel = async () => {
      if (activeRide?.id) {
        try {
          await api.cancelRide(Number(activeRide.id));
        } catch (e) {
          console.log('Error cancelling:', e);
        }
      }
      await activeRideStorage.clear();
      setActiveRide(null);
      setPassengerAccepted(false);
      setNoDriverAvailable(false);
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Cancel Ride Request?\n\nAre you sure you want to cancel this ride request?');
      if (confirmed) {
        await performCancel();
      }
    } else {
      Alert.alert(
        'Cancel Ride Request?',
        'Are you sure you want to cancel this ride request?',
        [
          { text: 'No, Keep Ride', style: 'cancel' },
          {
            text: 'Yes, Cancel Ride',
            style: 'destructive',
            onPress: performCancel,
          },
        ]
      );
    }
  };

  // VERIFY CASH PIN & ACCRUE +50 LOYALTY POINTS UPON RIDE COMPLETION
  const verifyPin = async () => {
    if (inputPin === cashPin) {
      setIsVerified(true);
      setShowPaymentPrompt(false);
      const newPts = await loyaltyStorage.addPoints(50, user?.id);
      Alert.alert(
        'Trip Complete & Paid! 🎉',
        `Thank you for riding with GRAP! Cash OTP verified.\n\n🏆 You earned +50 Loyalty Points! Total Balance: ${newPts} Pts.`
      );
      activeRideStorage.clear();
      setActiveRide(null);
    } else {
      Alert.alert('Invalid PIN', 'The 4-digit PIN entered does not match your ride PIN.');
    }
  };

  const handleDigitalPaymentComplete = async () => {
    setShowPaymentPrompt(false);
    const newPts = await loyaltyStorage.addPoints(50, user?.id);
    Alert.alert(
      'Payment Authorized! 🎉',
      `Digital Mobile Money payout released successfully.\n\n🏆 You earned +50 Loyalty Points! Total Balance: ${newPts} Pts.`
    );
    activeRideStorage.clear();
    setActiveRide(null);
  };

  const renderRideHistory = () => (
    <View style={[styles.historySection, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.historyHeader}>
        <View>
          <Text style={[styles.historyTitle, { color: colors.text }]}>Ride history</Text>
          <Text style={[styles.historySubtitle, { color: colors.subText }]}>Completed trips from your account</Text>
        </View>
        <Ionicons name="time-outline" size={22} color={colors.primary} />
      </View>
      {completedRides.length === 0 && sharedHistory.length === 0 ? (
        <Text style={[styles.historyEmpty, { color: colors.subText }]}>Your completed rides will appear here.</Text>
      ) : <>{completedRides.map((ride) => (
        <View key={ride.id} style={[styles.historyRow, { borderTopColor: colors.cardBorder }]}>
          <View style={[styles.historyIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="checkmark" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.historyRoute, { color: colors.text }]} numberOfLines={1}>{ride.pickup_name} to {ride.destination_name}</Text>
            <Text style={[styles.historyMeta, { color: colors.subText }]}>{formatRideDate(ride.completed_at || ride.created_at)} • {ride.distance_km || 0} km</Text>
          </View>
          <Text style={[styles.historyFare, { color: colors.primary }]}>{ride.final_fare || ride.estimated_fare || 0} FCFA</Text>
        </View>
      ))}{sharedHistory.map((ride) => (
        <View key={`shared-${ride.id}`} style={[styles.historyRow, { borderTopColor: colors.cardBorder }]}>
          <View style={[styles.historyIcon, { backgroundColor: `${colors.secondary}18` }]}><Ionicons name="people" size={17} color={colors.secondary} /></View>
          <View style={{ flex: 1 }}><Text style={[styles.historyRoute, { color: colors.text }]} numberOfLines={1}>{ride.pickup_name} to {ride.destination_name}</Text><Text style={[styles.historyMeta, { color: colors.subText }]}>Shared ride • {formatRideDate(ride.joined_at)}</Text></View>
          <Text style={[styles.historyFare, { color: colors.primary }]}>{ride.allocated_shared_fare || 0} FCFA</Text>
        </View>
      ))}</>}
    </View>
  );

  const renderHistoryButton = () => (
    <TouchableOpacity
      style={[styles.historyIconButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={() => setShowHistory((value) => !value)}
      accessibilityLabel={showHistory ? 'Hide ride history' : 'Show ride history'}
    >
      <Ionicons name="time-outline" size={18} color={colors.primary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.subText, marginTop: verticalScale(12), fontSize: fontScale(14) }]}>Loading active ride...</Text>
      </View>
    );
  }

  // NO ACTIVE RIDE EMPTY STATE
  if (!activeRide) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, padding: horizontalScale(20), justifyContent: 'center' }]}>
        <View style={[styles.emptyHistoryAction, { top: verticalScale(18), right: horizontalScale(18), zIndex: 20 }]}>
          {renderHistoryButton()}
        </View>
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: horizontalScale(24), borderRadius: moderateScale(20) }]}>
          <View style={[styles.emptyIconBadge, { backgroundColor: `${colors.primary}18`, width: moderateScale(70), height: moderateScale(70), borderRadius: moderateScale(35), marginBottom: verticalScale(16) }]}>
            <Ionicons name="car-outline" size={moderateScale(42)} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontSize: fontScale(20), marginBottom: verticalScale(8) }]}>No Active Ride</Text>
          <Text style={[styles.emptySub, { color: colors.subText, fontSize: fontScale(13), textAlign: 'center', lineHeight: verticalScale(19), marginBottom: verticalScale(20) }]}>
            You currently have no active trip. Select a destination on the home map to request a ride.
          </Text>

          <TouchableOpacity style={[styles.requestNowBtn, { backgroundColor: colors.primary, height: verticalScale(48), paddingHorizontal: horizontalScale(20), borderRadius: moderateScale(14) }]} onPress={() => router.push('/')}>
            <Ionicons name="navigate-sharp" size={moderateScale(18)} color="#0B1325" style={{ marginRight: horizontalScale(6) }} />
            <Text style={[styles.requestNowBtnText, { fontSize: fontScale(14) }]}>Request a Ride Now</Text>
          </TouchableOpacity>
          {showHistory && renderRideHistory()}
        </View>
      </View>
    );
  }

  const rideState = activeRide.status || 'ACCEPTED';
  const driverName = activeRide.driver_name || 'Paul Nkoa';
  const vehicleInfo = activeRide.vehicle_info || 'Toyota Yaris • CE-992-AA';
  const pickupName = activeRide.pickup_name || paramPickup;
  const destName = activeRide.destination_name || paramDest;
  const selectedPayment = activeRide.payment_method || paramPay;

  // DYNAMIC VEHICLE TYPE (MOTO vs CAR)
  const isMotoVehicle = activeRide.vehicleType === 'MOTO' || vehicleInfo.includes('TVS') || vehicleInfo.includes('Motorcycle');

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Map Header */}
      <View style={[styles.mapHeader, { height: isWeb ? '50%' : '44%' }]}>
        <GoogleDriverMap
          rideState={rideState}
          pickupLat={activeRide.pickup_lat || paramPickupLat}
          pickupLng={activeRide.pickup_lng || paramPickupLng}
          destLat={activeRide.destination_lat || paramDestLat}
          destLng={activeRide.destination_lng || paramDestLng}
          driverLat={driverPosition?.lat ?? 3.8450}
          driverLng={driverPosition?.lng ?? 11.5050}
          isMoving={passengerAccepted}
          vehicleType={isMotoVehicle ? 'MOTO' : 'CAR'}
          pickupName={pickupName}
          destName={destName}
          passengers={participants.map((p: any) => ({
            id: p.passenger?.id || p.id,
            name: p.passenger?.username || p.passenger_name || `Passenger ${p.pickup_order || ''}`.trim(),
            pickupName: p.pickup_name,
            pickupLat: Number(p.pickup_lat),
            pickupLng: Number(p.pickup_lng),
          }))}
          onArrivePickup={handleAutomatedPickupArrival}
          onArriveDestination={handleAutomatedDestinationArrival}
        />
      </View>

      {/* History Action */}
      <View style={[styles.topHistoryAction, { top: verticalScale(18), right: horizontalScale(18), zIndex: 20 }]}>
        {renderHistoryButton()}
      </View>

      {/* Info Sheet */}
      <View style={[styles.infoSheetOuter, { backgroundColor: colors.card, padding: horizontalScale(16), borderTopLeftRadius: verticalScale(24), borderTopRightRadius: verticalScale(24), marginTop: verticalScale(-20) }]}>
        {/* Slide-Up Active Ride Info Sheet */}
        <ScrollView style={[styles.infoSheet, { backgroundColor: colors.card }]} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* CASE A: NO DRIVER AVAILABLE / DECLINED -> SHOW OTHER CATEGORIES */}
        {noDriverAvailable ? (
          <View style={[styles.noDriverCard, { backgroundColor: colors.inputBg, borderColor: '#FF5252' }]}>
            <View style={styles.noDriverHeader}>
              <Ionicons name="warning" size={20} color="#FF5252" />
              <Text style={styles.noDriverTitle}>No Driver Available in Economy Category</Text>
            </View>
            <Text style={[styles.noDriverSub, { color: colors.subText }]}>
              The proposed driver was declined or unavailable. Choose an available driver from another category below:
            </Text>

            <Text style={[styles.altSectionTitle, { color: colors.text }]}>Available Drivers in Other Categories</Text>
            {alternativeDrivers.map((alt) => (
              <View key={alt.id} style={[styles.altDriverCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.altHeaderRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: `${alt.catBadgeColor}20` }]}>
                      <Text style={[styles.categoryBadgeText, { color: alt.catBadgeColor }]}>{alt.category}</Text>
                    </View>
                    <Text style={[styles.altFareText, { color: colors.primary }]}>{alt.fare}</Text>
                  </View>

                  <Text style={[styles.altDriverName, { color: colors.text }]}>{alt.driverName}</Text>
                  <Text style={[styles.altVehicleInfo, { color: colors.subText }]}>{alt.vehicleInfo}</Text>

                  <View style={styles.altMetaRow}>
                    <Ionicons name="star" size={12} color="#FFD600" />
                    <Text style={[styles.altMetaText, { color: colors.subText }]}>{alt.rating} • {alt.eta}</Text>
                  </View>
                </View>

                <TouchableOpacity style={[styles.switchAcceptBtn, { backgroundColor: colors.primary }]} onPress={() => handleSwitchCategoryDriver(alt)}>
                  <Text style={styles.switchAcceptBtnText}>Switch & Accept</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : !storageReady ? (
          <View style={{ paddingVertical: verticalScale(20), alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.subText, marginTop: verticalScale(12), fontSize: fontScale(14) }]}>Restoring ride state...</Text>
          </View>
        ) : (!passengerAccepted || (acceptedRideId && activeRide && acceptedRideId !== String(activeRide.id))) ? (
          /* CASE B: INITIAL DRIVER MATCH PROPOSAL (PASSENGER CAN ACCEPT OR DECLINE) */
          <View style={[styles.proposalCard, { backgroundColor: colors.inputBg, borderColor: colors.primary }]}>
            <View style={styles.proposalHeader}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={[styles.proposalTitle, { color: colors.primary }]}>
                Nearby {isMotoVehicle ? 'Moto' : 'Taxi'} Driver Matched!
              </Text>
            </View>
            <Text style={[styles.proposalSub, { color: colors.subText }]}>
              {params.shared === '1' ? 'You joined this shared ride. Confirm to start tracking the trip.' : 'Review driver profile below and tap "Accept Driver & Start Ride" or "Decline" to see other categories.'}
            </Text>

            <View style={[styles.driverCard, { backgroundColor: colors.card, marginBottom: 12 }]}>
              <View style={[styles.driverAvatar, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name={isMotoVehicle ? 'bicycle' : 'person'} size={24} color={colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.driverName, { color: colors.text }]}>{driverName}</Text>
                <Text style={[styles.carInfo, { color: colors.subText }]}>{vehicleInfo}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#FFD600" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>4.9 (42 rides) • 2 mins to pickup</Text>
                </View>
              </View>
            </View>

            {/* EXPLICIT ACCEPTANCE & DECLINE ACTION BUTTONS */}
            <View style={styles.proposalActionsRow}>
              <TouchableOpacity style={styles.declineBtn} onPress={handleDeclineDriver}>
                <Ionicons name="close-circle" size={16} color="#FF5252" style={{ marginRight: 4 }} />
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.acceptDriverBtn, { backgroundColor: colors.primary }]} onPress={handlePassengerAcceptDriver}>
                <Ionicons name="checkmark-circle" size={18} color="#0B1325" style={{ marginRight: 6 }} />
                <Text style={styles.acceptDriverBtnText}>Accept Driver & Start Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* CASE C: TRIP IN PROGRESS (AFTER PASSENGER ACCEPTS DRIVER) */
          <>
            {/* Stage Status Banner */}
            <View style={[styles.stateBanner, { backgroundColor: rideState === 'IN_PROGRESS' ? 'rgba(255, 159, 28, 0.15)' : 'rgba(0, 230, 118, 0.15)' }]}>
              <Ionicons name={isMotoVehicle ? 'bicycle' : 'car'} size={16} color={rideState === 'IN_PROGRESS' ? colors.accent : colors.primary} />
              <Text style={[styles.stateBannerText, { color: rideState === 'IN_PROGRESS' ? colors.accent : colors.primary }]}>
                {rideState === 'ACCEPTED'
                  ? `STAGE 1: DRIVER EN ROUTE TO PICK YOU UP (${pickupName.toUpperCase()})`
                  : `STAGE 2: TRIP IN PROGRESS TO DESTINATION (${destName.toUpperCase()})`}
              </Text>
            </View>

            {/* Accepted Driver Card */}
            <View style={[styles.driverCard, { backgroundColor: colors.inputBg }]}>
              <View style={[styles.driverAvatar, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name={isMotoVehicle ? 'bicycle' : 'person'} size={24} color={colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.driverName, { color: colors.text }]}>{driverName}</Text>
                <Text style={[styles.carInfo, { color: colors.subText }]}>{vehicleInfo}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#FFD600" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>4.9 (42 rides)</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: colors.bg }]} onPress={() => Alert.alert('Call', `Calling ${driverName} (+237670003344)...`)}>
                <Ionicons name="call" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* WHATSAPP & SECURITY CONTACT LIVE TRIP SHARE BUTTON */}
            <TouchableOpacity style={[styles.shareWhatsAppBtn, { backgroundColor: '#25D366' }]} onPress={handleShareTripWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.shareWhatsAppBtnText}>Share Live Trip via WhatsApp / Security</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Route Summary */}
        <View style={[styles.routeSummaryCard, { backgroundColor: colors.inputBg }]}>
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={14} color={colors.primary} />
            <Text style={[styles.routeText, { color: colors.text }]}>{pickupName}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <Ionicons name="location-sharp" size={14} color="#FF5252" />
            <Text style={[styles.routeText, { color: colors.text }]}>{destName}</Text>
          </View>
        </View>

        {/* Shared Ride Participants */}
        {(activeRide?.is_shared || participants.length > 0) && (
          <View style={[styles.participantsCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <View style={styles.participantsHeader}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={[styles.participantsTitle, { color: colors.text }]}>Joined Passengers ({participants.length})</Text>
            </View>
            {participants.length === 0 ? (
              <View style={{ paddingVertical: 10 }}>
                <Text style={[styles.participantEmpty, { color: colors.subText }]}>No passengers have joined yet.</Text>
                <Text style={[styles.participantEmpty, { color: colors.subText, fontSize: 11 }]}>Debug: rideId={activeRide?.id} is_shared={String(activeRide?.is_shared)} sharedHistory={sharedHistory.length}</Text>
              </View>
            ) : (
              participants.map((p: any) => (
                <View key={p.id} style={[styles.participantRow, { borderBottomColor: colors.cardBorder }]}>
                  <View style={[styles.participantAvatar, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.participantInitial, { color: colors.primary }]}>{((p.passenger?.username || p.passenger_name || 'P') || 'P').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.participantName, { color: colors.text }]}>{p.passenger?.username || p.passenger_name || `Passenger ${p.pickup_order || ''}`}</Text>
                    <Text style={[styles.participantPickup, { color: colors.subText }]}>{p.pickup_name}</Text>
                  </View>
                  <Text style={[styles.participantFare, { color: colors.primary }]}>{Number(p.allocated_shared_fare || 0).toLocaleString()} FCFA</Text>
                </View>
              ))
             )}
           </View>
         )}

        {/* PAYMENT METHOD CONDITIONAL: CASH 4-DIGIT PIN vs DIGITAL MOBILE MONEY BADGE */}
        {selectedPayment === 'CASH' ? (
          <View style={[styles.otpCard, { backgroundColor: colors.inputBg, borderColor: colors.accent }]}>
            <View style={styles.otpHeader}>
              <Ionicons name="key" size={18} color={colors.accent} />
              <Text style={[styles.otpTitle, { color: colors.accent }]}>{t('cashPinTitle')}</Text>
            </View>
            <Text style={[styles.otpSub, { color: colors.subText }]}>{t('givePinSub')}</Text>
            
            <View style={[styles.pinBox, { backgroundColor: colors.bg }]}>
              <Text style={[styles.pinText, { color: colors.primary }]}>{cashPin}</Text>
            </View>

            {isVerified ? (
              <View style={styles.verifiedBanner}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={[styles.verifiedText, { color: colors.primary }]}>{t('cashConfirmed')}</Text>
              </View>
            ) : (
              <View style={styles.verifyRow}>
                <TextInput
                  style={[styles.pinInput, { backgroundColor: colors.bg, color: colors.text }]}
                  placeholder="Enter PIN"
                  placeholderTextColor={colors.subText}
                  keyboardType="number-pad"
                  value={inputPin}
                  onChangeText={setInputPin}
                  maxLength={4}
                />
                <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: colors.accent }]} onPress={verifyPin}>
                  <Text style={styles.verifyBtnText}>{t('confirmCash')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.digitalPayBadgeCard, { backgroundColor: colors.inputBg, borderColor: selectedPayment === 'MTN_MOMO' ? '#FFCC00' : '#FF6600' }]}>
            <View style={[styles.digitalPayIconContainer, { backgroundColor: selectedPayment === 'MTN_MOMO' ? '#FFCC00' : '#FF6600' }]}>
              <Ionicons name={selectedPayment === 'MTN_MOMO' ? 'wallet-sharp' : 'card-sharp'} size={16} color={selectedPayment === 'MTN_MOMO' ? '#000' : '#FFF'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.digitalPayTitle, { color: colors.text }]}>
                {selectedPayment === 'MTN_MOMO' ? 'MTN Mobile Money Authorized' : 'Orange Money Authorized'}
              </Text>
              <Text style={[styles.digitalPaySub, { color: colors.subText }]}>
                Digital payment confirmed. Funds will be released upon trip completion.
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
          </View>
        )}

        {/* WELL-DESIGNED CANCEL RIDE BUTTON */}
        <TouchableOpacity
          style={[styles.cancelRideBtn, Platform.OS === 'web' && { cursor: 'pointer' }]}
          onPress={handleCancelRide}
          onClick={(e) => { if (Platform.OS === 'web') { e.preventDefault(); handleCancelRide(); } }}
        >
          <Ionicons name="close-circle" size={18} color="#FF5252" style={{ marginRight: 6 }} />
          <Text style={styles.cancelRideBtnText}>Cancel Ride Request</Text>
        </TouchableOpacity>
        {showHistory && renderRideHistory()}
      </ScrollView>
      </View>

      {/* AUTOMATED PROFESSIONAL & FUNCTIONAL PAYMENT SETTLEMENT MODAL */}
      <Modal
        visible={showPaymentPrompt}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.paymentModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.paymentModalHeader}>
              <View style={[styles.paySuccessIconBadge, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="location-sharp" size={26} color={colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentModalTitle, { color: colors.text }]}>Arrived at Destination!</Text>
                <Text style={[styles.paymentModalSub, { color: colors.subText }]}>
                  Safe arrival at {destName}. Please settle payment with driver {driverName}.
                </Text>
              </View>
            </View>

            {/* ITEMIZED FARE RECEIPT */}
            <View style={[styles.receiptCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.receiptTitle, { color: colors.subText }]}>TRIP FARE RECEIPT</Text>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptItem, { color: colors.text }]}>Base Fare ({isMotoVehicle ? 'Moto Taxi' : 'Economy Taxi'})</Text>
                <Text style={[styles.receiptPrice, { color: colors.text }]}>600 FCFA</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptItem, { color: colors.text }]}>Distance Rate (6.4 km x 110 FCFA/km)</Text>
                <Text style={[styles.receiptPrice, { color: colors.text }]}>700 FCFA</Text>
              </View>

              <View style={[styles.receiptDivider, { backgroundColor: colors.cardBorder }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptTotalLabel, { color: colors.text }]}>
                  {(activeRide?.is_shared || participants.length > 0) && participants.length > 0 ? 'Total Shared Ride Fare' : 'Total Amount Due'}
                </Text>
                <Text style={[styles.receiptTotalAmount, { color: colors.primary }]}>
                  {(activeRide?.is_shared || participants.length > 0) && participants.length > 0
                    ? participants.reduce((sum, p) => sum + Number(p.allocated_shared_fare || 0), 0).toLocaleString()
                    : '1,300'}
                  {' '}FCFA
                </Text>
              </View>
            </View>

            {/* PAYMENT METHOD AUTHORIZATION */}
            {selectedPayment === 'CASH' ? (
              <View style={[styles.cashBox, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.pinPromptLabel, { color: colors.text }]}>
                  Give 4-Digit Cash OTP PIN ({cashPin}) to driver {driverName}:
                </Text>
                <View style={styles.verifyRow}>
                  <TextInput
                    style={[styles.pinInput, { backgroundColor: colors.card, color: colors.text }]}
                    placeholder="Enter PIN"
                    placeholderTextColor={colors.subText}
                    keyboardType="number-pad"
                    value={inputPin}
                    onChangeText={setInputPin}
                    maxLength={4}
                  />
                  <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: colors.primary }]} onPress={verifyPin}>
                    <Text style={[styles.verifyBtnText, { color: '#0B1325' }]}>Confirm Cash</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.digitalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleDigitalPaymentComplete}
              >
                <Ionicons name="checkmark-circle-sharp" size={20} color="#0B1325" style={{ marginRight: 6 }} />
                <Text style={styles.digitalConfirmBtnText}>Release Mobile Money Payout (1,300 FCFA)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatRideDate(value?: string) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  infoSheetOuter: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyIconBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '800',
  },
  emptySub: {
    textAlign: 'center',
    lineHeight: 19,
  },
  requestNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestNowBtnText: {
    color: '#0B1325',
    fontWeight: '800',
  },
  historySection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 18,
    width: '100%',
  },
  historyButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  historyButtonText: {
    flex: 1,
    fontWeight: '800',
  },
  historyIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  topHistoryAction: {
    position: 'absolute',
  },
  emptyHistoryAction: {
    position: 'absolute',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyTitle: {
    fontWeight: '800',
  },
  historySubtitle: {
    marginTop: 2,
  },
  historyEmpty: {
    marginTop: 14,
    textAlign: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 11,
    gap: 9,
  },
  historyIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyRoute: {
    fontWeight: '700',
  },
  historyMeta: {
    marginTop: 3,
  },
  historyFare: {
    fontWeight: '800',
  },
  mapHeader: {
    position: 'relative',
  },
  infoSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  noDriverCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  noDriverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  noDriverTitle: {
    fontWeight: '800',
    color: '#FF5252',
  },
  noDriverSub: {
    lineHeight: 16,
    marginBottom: 12,
  },
  altSectionTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },
  altDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  altHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontWeight: '800',
  },
  altFareText: {
    fontWeight: '900',
  },
  altDriverName: {
    fontWeight: '700',
  },
  altVehicleInfo: {
  },
  altMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  altMetaText: {
    fontWeight: '600',
  },
  switchAcceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  switchAcceptBtnText: {
    color: '#0B1325',
    fontWeight: '800',
  },
  proposalCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  proposalTitle: {
    fontWeight: '800',
  },
  proposalSub: {
    lineHeight: 16,
    marginBottom: 10,
  },
  proposalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.4)',
  },
  declineBtnText: {
    color: '#FF5252',
    fontWeight: '800',
  },
  acceptDriverBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptDriverBtnText: {
    color: '#0B1325',
    fontWeight: '800',
  },
  stateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
    alignSelf: 'center',
  },
  stateBannerText: {
    fontWeight: '800',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  driverAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    fontWeight: '700',
  },
  carInfo: {
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontWeight: '700',
  },
  actionIconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareWhatsAppBtn: {
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  shareWhatsAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  routeSummaryCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    fontWeight: '600',
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: '#64748B',
    marginLeft: 6,
    marginVertical: 2,
  },
  otpCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  otpTitle: {
    fontWeight: '800',
  },
  otpSub: {
    marginBottom: 8,
  },
  pinBox: {
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  pinText: {
    fontWeight: '900',
    letterSpacing: 6,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifiedText: {
    fontWeight: '700',
  },
  verifyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  verifyBtn: {
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  digitalPayBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    marginBottom: 14,
  },
  digitalPayIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitalPayTitle: {
    fontWeight: '800',
  },
  digitalPaySub: {
    marginTop: 2,
  },
  cancelRideBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF5252',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelRideBtnText: {
    color: '#FF5252',
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  paymentModalCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  paySuccessIconBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalTitle: {
    fontWeight: '900',
  },
  paymentModalSub: {
    marginTop: 2,
  },
  receiptCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  receiptTitle: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  receiptItem: {
  },
  receiptPrice: {
    fontWeight: '700',
  },
  receiptDivider: {
    height: 1,
    marginVertical: 8,
  },
  receiptTotalLabel: {
    fontWeight: '800',
  },
  receiptTotalAmount: {
    fontWeight: '900',
  },
  cashBox: {
    padding: 12,
    borderRadius: 14,
  },
  pinPromptLabel: {
    fontWeight: '700',
    marginBottom: 8,
  },
  digitalConfirmBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitalConfirmBtnText: {
    color: '#0B1325',
    fontWeight: '800',
  },
  participantsCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  participantName: {
    fontSize: 13,
    fontWeight: '700',
  },
  participantPickup: {
    fontSize: 12,
    marginTop: 2,
  },
  participantFare: {
    fontSize: 12,
    fontWeight: '800',
  },
  participantEmpty: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 6,
  },
});
