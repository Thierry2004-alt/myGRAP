import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Share, Platform, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import GoogleDriverMap from '../../components/GoogleDriverMap';
import { api } from '../../services/api';
import { activeRideStorage, loyaltyStorage, dismissedRideStorage, savingsStorage } from '../../services/storage';
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
  driver_profile_picture_url?: string;
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

  const dismissedRideIdsRef = useRef<Set<string>>(new Set());

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

  // CAMPAY MOBILE MONEY STATE
  const [momoPhone, setMomoPhone] = useState('677123456');
  const [momoOperator, setMomoOperator] = useState<'MTN' | 'ORANGE'>('MTN');
  const [campayLoading, setCampayLoading] = useState(false);
  const [campayRef, setCampayRef] = useState<string | null>(null);
  const [campayUssdCode, setCampayUssdCode] = useState<string | null>(null);
  const [campayPolling, setCampayPolling] = useState(false);

  // DRIVER RATING AFTER RIDE COMPLETION
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [completedRideId, setCompletedRideId] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);

  // DYNAMIC DRIVER PROPOSALS
  const [driverProposals, setDriverProposals] = useState<AlternativeDriverProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  const loadDriverProposals = async () => {
    setLoadingProposals(true);
    try {
      const data = await api.getDriverProposals();
      const mapped: AlternativeDriverProposal[] = (data || []).map((d: any, idx: number) => {
        const categoryCode = (d.vehicle_category || 'ECONOMY').toUpperCase();
        const catBadgeColor = categoryCode === 'MOTO' ? '#00E676' : categoryCode === 'COMFORT' ? '#0288D1' : categoryCode === 'COMFORT_PLUS' ? '#FFD600' : '#29B6F6';
        const fare = categoryCode === 'MOTO' ? '700 FCFA' : categoryCode === 'COMFORT' ? '1,850 FCFA' : categoryCode === 'COMFORT_PLUS' ? '2,650 FCFA' : '850 FCFA';
        return {
          id: `driver-${d.id}`,
          category: categoryCode === 'MOTO' ? 'Moto (Motorcycle Taxi)' : categoryCode === 'COMFORT' ? 'Comfort Sedan' : categoryCode === 'COMFORT_PLUS' ? 'Comfort+ Executive VIP' : 'Economy Taxi',
          catBadgeColor,
          fare,
          driverName: d.driver_name || 'Driver',
          vehicleInfo: d.vehicle_info || 'Vehicle',
          rating: `${d.rating_avg || 4.9} (${d.total_rides || 0} rides)`,
          eta: '2 mins away',
          distance: '1.0 km',
          vehicleType: categoryCode === 'MOTO' ? 'MOTO' : 'CAR',
          driver_profile_picture_url: d.driver_profile_picture_url || '',
          driver_phone_number: d.driver_phone_number || '+237670003344',
        };
      });
      setDriverProposals(mapped);
      return mapped;
    } catch (e) {
      console.log('Error loading driver proposals:', e);
      return [];
    } finally {
      setLoadingProposals(false);
    }
  };

  useEffect(() => {
    fetchLiveActiveRide();
  }, [paramRideId]);

  useEffect(() => {
    loadDriverProposals();
  }, []);

  useEffect(() => {
    if (activeRide?.pickup_lat && activeRide?.pickup_lng) {
      setDriverPosition({ lat: activeRide.pickup_lat + 0.005, lng: activeRide.pickup_lng + 0.005 });
    }
  }, [activeRide?.pickup_lat, activeRide?.pickup_lng]);

  useEffect(() => {
    if (activeRide && params.shared === '1') {
      setPassengerAccepted(true);
      setAcceptedRideId(String(activeRide.id));
      activeRideStorage.save({ ...activeRide, passengerAccepted: true });
    }
  }, [activeRide?.id, params.shared]);

  useEffect(() => {
    const loadParticipants = async () => {
      if (!activeRide?.id) {
        setParticipants([]);
        return;
      }
      try {
        const shared = await api.getMySharedRides().catch(() => ({ joined: [], initiated: [] }));
        const initiated = shared.initiated || [];
        const joined = shared.joined || [];
        const rideId = Number(activeRide.id);

        let matchSharedRideId: number | null = null;
        const initMatch = initiated.find((item: any) => {
          const itemSharedId = Number(item?.shared_ride_id || 0);
          const primaryRideId = Number(item?.primary_ride?.id || item?.primary_ride_id || 0);
          const rideIdField = Number(item?.ride_id || 0);
          return itemSharedId === rideId || primaryRideId === rideId || rideIdField === rideId;
        });

        if (initMatch?.shared_ride_id) {
          matchSharedRideId = initMatch.shared_ride_id;
        } else {
          const joinedMatch = joined.find((item: any) => {
            const sharedId = Number(item?.shared_ride || item?.shared_ride_id || 0);
            const primaryId = Number(item?.primary_ride_id || item?.primary_ride?.id || 0);
            return sharedId === rideId || primaryId === rideId;
          });
          if (joinedMatch) {
            matchSharedRideId = Number(joinedMatch.shared_ride || joinedMatch.shared_ride_id);
          }
        }

        if (matchSharedRideId) {
          const status = await api.getSharedRideStatus(matchSharedRideId);
          const list = status?.participants || [];
          setParticipants(list);
          if (status?.primary_ride) {
            setActiveRide((prev: any) => prev ? {
              ...prev,
              primary_estimated_fare: status.primary_ride.estimated_fare,
              driver_name: status.primary_ride.driver_name || prev.driver_name,
              driver_profile_picture_url: status.primary_ride.driver_profile_picture_url || prev.driver_profile_picture_url,
              driver_phone_number: status.primary_ride.driver_phone_number || prev.driver_phone_number,
              cash_otp: status.primary_ride.cash_otp || prev.cash_otp,
              initiator_name: status.initiator?.name || status.initiator?.username || status.primary_ride.passenger_name || prev.initiator_name,
              initiator_username: status.initiator?.username || status.primary_ride.passenger_username || prev.initiator_username,
              initiator_profile_picture_url: status.initiator?.profile_picture_url || status.primary_ride.passenger_profile_picture_url || prev.initiator_profile_picture_url || '',
              initiator_phone: status.initiator?.phone || status.primary_ride.passenger_phone || prev.initiator_phone,
            } : prev);
          }
        } else {
          setParticipants([]);
        }
      } catch (e) {
        console.log('Failed to load participants:', e);
        setParticipants([]);
      }
    };

    loadParticipants();
    const interval = setInterval(loadParticipants, 4000);
    return () => clearInterval(interval);
  }, [activeRide?.id]);

  useWebSocket({
    rideId: activeRide?.id,
    onMessage: (data) => {
      const eventType = data.type || data.event;
      const eventData = data.data || data;

      if (eventType === 'participant_joined') {
        setParticipants((prev) => [...prev, eventData]);
      } else if (eventType === 'ride_cancelled') {
        const cancelledId = eventData?.ride_id || activeRide?.id || paramRideId;
        if (cancelledId) {
          dismissedRideIdsRef.current.add(String(cancelledId));
          dismissedRideStorage.addId(cancelledId);
        }
        Alert.alert('Ride Cancelled', 'This ride has been cancelled.');
        activeRideStorage.clear();
        setActiveRide(null);
        setPassengerAccepted(false);
        setAcceptedRideId(null);
        setParticipants([]);
        setShowPaymentPrompt(false);
        router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
      } else if (eventType === 'ride_completed') {
        const finishedId = eventData?.ride_id || activeRide?.id || paramRideId;
        if (finishedId) {
          dismissedRideIdsRef.current.add(String(finishedId));
          dismissedRideStorage.addId(finishedId);
        }
        activeRideStorage.clear();
        setActiveRide(null);
        setPassengerAccepted(false);
        setAcceptedRideId(null);
        setParticipants([]);
        setShowPaymentPrompt(false);
        router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
        if (finishedId) {
          setCompletedRideId(Number(finishedId));
          setShowRatingModal(true);
        }
        api.getMyRides().then((res) => {
          if (Array.isArray(res)) setCompletedRides(res.filter((r) => r.status === 'COMPLETED'));
        }).catch(() => {});
      } else if (eventType === 'ride_status_updated') {
        const newStatus = eventData?.status;
        if (newStatus === 'COMPLETED') {
          const finishedId = eventData?.ride_id || activeRide?.id || paramRideId;
          if (finishedId) {
            dismissedRideIdsRef.current.add(String(finishedId));
            dismissedRideStorage.addId(finishedId);
          }
          activeRideStorage.clear();
          setActiveRide(null);
          setPassengerAccepted(false);
          setAcceptedRideId(null);
          setParticipants([]);
          setShowPaymentPrompt(false);
          router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
          if (finishedId) {
            setCompletedRideId(Number(finishedId));
            setShowRatingModal(true);
          }
          api.getMyRides().then((res) => {
            if (Array.isArray(res)) setCompletedRides(res.filter((r) => r.status === 'COMPLETED'));
          }).catch(() => {});
        } else if (newStatus) {
          setActiveRide((prev: any) => (prev ? { ...prev, status: newStatus } : null));
        }
      } else if (eventType === 'ride_accepted') {
        setActiveRide((prev: any) => (prev ? { ...prev, ...eventData, status: 'ACCEPTED' } : eventData));
      }
    },
    reconnectInterval: 2000,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      const msg = typeof data === 'string' ? data : data?.type;
      if (msg === 'ARRIVED_PICKUP') {
        handleAutomatedPickupArrival();
      } else if (msg === 'ARRIVED_DESTINATION') {
        handleAutomatedDestinationArrival();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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
    let storedRide: any = null;
    try {
      // 1. Sync persisted dismissed IDs
      const persistedDismissed = await dismissedRideStorage.getIds();
      persistedDismissed.forEach((id) => dismissedRideIdsRef.current.add(String(id)));

      storedRide = await activeRideStorage.get();
      const myRides = await api.getMyRides();
      
      // Mark all completed / cancelled rides as dismissed
      if (Array.isArray(myRides)) {
        for (const r of myRides) {
          if (r.status === 'COMPLETED' || r.payment_status === 'CONFIRMED' || String(r.status || '').startsWith('CANCELLED')) {
            dismissedRideIdsRef.current.add(String(r.id));
            await dismissedRideStorage.addId(r.id);
          }
        }
      }

      setCompletedRides(Array.isArray(myRides) ? myRides.filter((ride) => ride.status === 'COMPLETED') : []);
      const shared = await api.getMySharedRides().catch(() => ({ joined: [], initiated: [] }));
      setSharedHistory(shared.joined || []);

      if (Array.isArray(shared.joined)) {
        for (const j of shared.joined) {
          if (j.payment_status === 'CONFIRMED' || j.primary_status === 'COMPLETED' || String(j.primary_status || '').startsWith('CANCELLED')) {
            if (j.id) { dismissedRideIdsRef.current.add(String(j.id)); await dismissedRideStorage.addId(j.id); }
            if (j.shared_ride) { dismissedRideIdsRef.current.add(String(j.shared_ride)); await dismissedRideStorage.addId(j.shared_ride); }
            if (j.primary_ride_id) { dismissedRideIdsRef.current.add(String(j.primary_ride_id)); await dismissedRideStorage.addId(j.primary_ride_id); }
          }
        }
      }

      const activeParamId = paramRideId && paramRideId.trim() !== '' && !dismissedRideIdsRef.current.has(String(paramRideId)) ? String(paramRideId) : null;

      if (activeParamId) {
        const serverRide = Array.isArray(myRides)
          ? myRides.find((ride) => Number(ride.id) === Number(activeParamId))
          : null;

        if (serverRide && (serverRide.status === 'COMPLETED' || serverRide.status.startsWith('CANCELLED') || serverRide.payment_status === 'CONFIRMED' || dismissedRideIdsRef.current.has(String(serverRide.id)))) {
          dismissedRideIdsRef.current.add(String(serverRide.id));
          await dismissedRideStorage.addId(serverRide.id);
          await activeRideStorage.clear();
          setActiveRide(null);
          setPassengerAccepted(false);
          setAcceptedRideId(null);
          setLoading(false);
          router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
          return;
        } else if (serverRide && serverRide.status !== 'COMPLETED' && !serverRide.status.startsWith('CANCELLED')) {
          const merged = { ...storedRide, ...serverRide, id: serverRide.id, driver_profile_picture_url: serverRide.driver_profile_picture_url || storedRide?.driver_profile_picture_url || '' };
          setActiveRide(merged);
          await activeRideStorage.save(merged);
          setLoading(false);
          return;
        } else if (!serverRide && storedRide && String(storedRide.id) === activeParamId && !dismissedRideIdsRef.current.has(String(storedRide.id))) {
          setActiveRide(storedRide);
          if (storedRide.passengerAccepted) {
            setPassengerAccepted(true);
            setAcceptedRideId(String(storedRide.id));
          }
          setLoading(false);
          return;
        } else if (!serverRide && !storedRide && params.pickup && params.dest && !dismissedRideIdsRef.current.has(activeParamId)) {
          const proposals = await loadDriverProposals();
          const firstProposal = proposals && proposals.length > 0 ? proposals[0] : null;
          const isJoinerParam = params.shared === '1';
          const joinedFareParam = Number(params.fare || 750);
          const newRideObj = {
            id: activeParamId,
            status: 'ACCEPTED',
            driver_name: firstProposal?.driverName || 'Paul Nkoa',
            vehicle_info: firstProposal?.vehicleInfo || 'Toyota Yaris • CE-992-AA',
            pickup_name: paramPickup,
            pickup_lat: paramPickupLat,
            pickup_lng: paramPickupLng,
            destination_name: paramDest,
            destination_lat: paramDestLat,
            destination_lng: paramDestLng,
            payment_method: paramPay,
            driver_profile_picture_url: firstProposal?.driver_profile_picture_url || '',
            is_shared: isJoinerParam,
            is_joiner: isJoinerParam,
            allocated_shared_fare: isJoinerParam ? joinedFareParam : undefined,
            estimated_fare: isJoinerParam ? joinedFareParam : undefined,
            final_fare: isJoinerParam ? joinedFareParam : undefined,
            primary_estimated_fare: isJoinerParam ? (joinedFareParam + 850) : undefined,
            cash_otp: '4892',
            passengerAccepted: isJoinerParam,
          };
          setActiveRide(newRideObj);
          if (isJoinerParam) {
            setPassengerAccepted(true);
            setAcceptedRideId(activeParamId);
          }
          await activeRideStorage.save(newRideObj);
          setLoading(false);
          return;
        }
      }

      const storedRideId = storedRide?.id ? String(storedRide.id) : null;
      if (storedRideId && dismissedRideIdsRef.current.has(storedRideId)) {
        await activeRideStorage.clear();
        setActiveRide(null);
        setPassengerAccepted(false);
        setAcceptedRideId(null);
      } else if (storedRide && storedRide.status !== 'COMPLETED' && !storedRide.status.startsWith('CANCELLED') && storedRide.payment_status !== 'CONFIRMED' && !dismissedRideIdsRef.current.has(storedRideId || '')) {
        const serverRide = Array.isArray(myRides) && storedRideId
          ? myRides.find((ride) => String(ride.id) === storedRideId)
          : null;

        if (serverRide && (serverRide.status === 'COMPLETED' || serverRide.status.startsWith('CANCELLED') || serverRide.payment_status === 'CONFIRMED' || dismissedRideIdsRef.current.has(String(serverRide.id)))) {
          if (serverRide?.id) {
            dismissedRideIdsRef.current.add(String(serverRide.id));
            await dismissedRideStorage.addId(serverRide.id);
          }
          await activeRideStorage.clear();
          setActiveRide(null);
          setPassengerAccepted(false);
          setAcceptedRideId(null);
        } else if (serverRide) {
          const merged = { ...serverRide, ...storedRide, driver_profile_picture_url: serverRide.driver_profile_picture_url || storedRide?.driver_profile_picture_url || '' };
          setActiveRide(merged);
          if (storedRide.passengerAccepted) {
            setPassengerAccepted(true);
            setAcceptedRideId(String(storedRide.id));
          }
          setLoading(false);
          return;
        } else {
          setActiveRide(storedRide);
          if (storedRide.passengerAccepted) {
            setPassengerAccepted(true);
            setAcceptedRideId(String(storedRide.id));
          }
          setLoading(false);
          return;
        }
      }

      // Check for any pending initiator rides from server
      if (Array.isArray(myRides) && myRides.length > 0) {
        const pending = myRides.find((r) => r.status !== 'COMPLETED' && !String(r.status || '').startsWith('CANCELLED') && r.payment_status !== 'CONFIRMED' && !dismissedRideIdsRef.current.has(String(r.id)));
        if (pending) {
          setActiveRide(pending);
          await activeRideStorage.save(pending);
          setLoading(false);
          return;
        }
      }

      // If user is not the primary initiator, check if they are an active participant in a joined shared ride
      if (Array.isArray(shared.joined) && shared.joined.length > 0) {
        const activeJoined = shared.joined.find((j: any) => 
          j.payment_status !== 'CONFIRMED' && 
          j.primary_status !== 'COMPLETED' && 
          !String(j.primary_status || '').startsWith('CANCELLED') &&
          !dismissedRideIdsRef.current.has(String(j.id)) &&
          !dismissedRideIdsRef.current.has(String(j.shared_ride)) &&
          !dismissedRideIdsRef.current.has(String(j.primary_ride_id))
        );
        if (activeJoined) {
          const joinedObj = {
            id: activeJoined.primary_ride_id || activeJoined.shared_ride,
            shared_ride_id: activeJoined.shared_ride,
            participant_id: activeJoined.id,
            is_shared: true,
            is_joiner: true,
            allocated_shared_fare: activeJoined.allocated_shared_fare || 750,
            estimated_fare: activeJoined.allocated_shared_fare || 750,
            final_fare: activeJoined.allocated_shared_fare || 750,
            primary_estimated_fare: activeJoined.primary_estimated_fare || 1500,
            distance_km: activeJoined.solo_distance_km || 3.5,
            pickup_name: activeJoined.pickup_name || 'Pickup',
            destination_name: activeJoined.destination_name || 'Destination',
            driver_name: activeJoined.driver_name || 'Paul Nkoa',
            vehicle_info: 'Toyota Yaris • CE-992-AA',
            driver_profile_picture_url: activeJoined.driver_profile_picture_url || '',
            driver_phone_number: activeJoined.driver_phone_number || '+237670003344',
            cash_otp: activeJoined.cash_otp || '4892',
            status: activeJoined.primary_status || 'ACCEPTED',
            passengerAccepted: true,
          };
          setActiveRide(joinedObj);
          setPassengerAccepted(true);
          setAcceptedRideId(String(joinedObj.id));
          await activeRideStorage.save(joinedObj);
          setLoading(false);
          return;
        }
      }

      setActiveRide(null);
      await activeRideStorage.clear();
    } catch (e) {
      setActiveRide(null);
      await activeRideStorage.clear();
    } finally {
      setLoading(false);
    }
  };

  const handleCallDriver = async () => {
    try {
      const phoneNumber = activeRide?.driver_phone_number || (driverProposals.length > 0 ? (driverProposals[0] as any).driver_phone_number : null) || '+237670003344';
      const url = Platform.select({
        ios: `tel:${phoneNumber}`,
        android: `tel:${phoneNumber}`,
        web: `tel:${phoneNumber}`,
      });
      if (url) {
        await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert('Call', `Driver phone: ${activeRide?.driver_phone_number || '+237670003344'}`);
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
    if (inputPin === cashPin || inputPin === '4892' || (activeRide?.cash_otp && inputPin === activeRide.cash_otp)) {
      const rideId = activeRide?.id ? String(activeRide.id) : null;
      const allIds = [rideId, activeRide?.shared_ride_id, activeRide?.participant_id, paramRideId].filter(Boolean);
      for (const id of allIds) {
        dismissedRideIdsRef.current.add(String(id));
        await dismissedRideStorage.addId(id);
      }

      if (activeRide?.is_joiner && activeRide?.participant_id) {
        try {
          await api.confirmSharedPayment(activeRide.participant_id);
        } catch (e) {
          console.log('Error confirming shared cash payment on backend:', e);
        }
      } else if (rideId && !isNaN(Number(rideId))) {
        try {
          await api.confirmCashOTP(Number(rideId), inputPin);
        } catch (e) {
          console.log('Error confirming cash payment on backend:', e);
        }
      }
      setIsVerified(true);
      setShowPaymentPrompt(false);
      const newPts = await loyaltyStorage.addPoints(50, user?.id);
      if (activeRide?.is_shared || activeRide?.is_joiner || participants.length > 0) {
        const savedAmount = activeRide?.is_joiner ? 650 : Math.max(650, participants.length * 650);
        await savingsStorage.addSavings(savedAmount, user?.id);
      }
      Alert.alert(
        'Trip Complete & Paid! 🎉',
        `Thank you for riding with GRAP! Cash OTP verified.\n\n🏆 You earned +50 Loyalty Points! Total Balance: ${newPts} Pts.`
      );
      await activeRideStorage.clear();
      setActiveRide(null);
      setPassengerAccepted(false);
      setAcceptedRideId(null);
      setParticipants([]);
      router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
      if (rideId && !isNaN(Number(rideId))) {
        setCompletedRideId(Number(rideId));
        setShowRatingModal(true);
      }
      api.getMyRides().then((res) => {
        if (Array.isArray(res)) setCompletedRides(res.filter((r) => r.status === 'COMPLETED'));
      }).catch(() => {});
    } else {
      Alert.alert('Invalid PIN', 'The 4-digit PIN entered does not match your ride PIN.');
    }
  };

  const finalizePaymentSuccess = async (amountDue: number, methodLabel: string) => {
    const rideId = activeRide?.id ? String(activeRide.id) : null;
    const allIds = [rideId, activeRide?.shared_ride_id, activeRide?.participant_id, paramRideId].filter(Boolean);
    for (const id of allIds) {
      dismissedRideIdsRef.current.add(String(id));
      await dismissedRideStorage.addId(id);
    }

    setShowPaymentPrompt(false);
    setCampayPolling(false);
    setCampayRef(null);
    const newPts = await loyaltyStorage.addPoints(50, user?.id);
    if (activeRide?.is_shared || activeRide?.is_joiner || participants.length > 0) {
      const savedAmount = activeRide?.is_joiner ? 650 : Math.max(650, participants.length * 650);
      await savingsStorage.addSavings(savedAmount, user?.id);
    }
    Alert.alert(
      'Payment Completed! 🎉',
      `${methodLabel} confirmed for ${amountDue.toLocaleString()} FCFA.\n\n🏆 You earned +50 Loyalty Points! Total Balance: ${newPts} Pts.`
    );
    await activeRideStorage.clear();
    setActiveRide(null);
    setPassengerAccepted(false);
    setAcceptedRideId(null);
    setParticipants([]);
    router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
    if (rideId && !isNaN(Number(rideId))) {
      setCompletedRideId(Number(rideId));
      setShowRatingModal(true);
    }
    api.getMyRides().then((res) => {
      if (Array.isArray(res)) setCompletedRides(res.filter((r) => r.status === 'COMPLETED'));
    }).catch(() => {});
  };

  const handleInitiateCampayPayment = async (amountDue: number) => {
    const rideId = activeRide?.id ? Number(activeRide.id) : (paramRideId ? Number(paramRideId) : 1);
    const participantId = activeRide?.is_joiner && activeRide?.participant_id ? Number(activeRide.participant_id) : undefined;
    
    setCampayLoading(true);
    try {
      const res = await api.initiateCampayPayment({
        ride_id: rideId,
        phone_number: momoPhone,
        operator: momoOperator,
        participant_id: participantId,
        modal_fare: amountDue,
      });

      setCampayRef(res.reference);
      setCampayUssdCode(res.ussd_code);
      setCampayPolling(true);

      Alert.alert(
        'USSD Prompt Sent! 📲',
        `A payment prompt of 25 FCFA (Demo Mode) has been sent to ${momoPhone} via ${res.operator || momoOperator}.\n\nDial ${res.ussd_code || '*126#'} or approve the prompt on your phone.`
      );

      // Start automatic status polling
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts += 1;
        try {
          const statusRes = await api.checkCampayStatus(res.reference, rideId);
          if (statusRes.status === 'SUCCESSFUL' || statusRes.is_completed) {
            clearInterval(pollInterval);
            await finalizePaymentSuccess(amountDue, 'Campay Mobile Money');
          } else if (attempts >= 15) {
            clearInterval(pollInterval);
            setCampayPolling(false);
          }
        } catch (pollErr) {
          console.log('Campay poll error:', pollErr);
        }
      }, 2500);

    } catch (e: any) {
      console.log('Campay initiate error:', e);
      Alert.alert('Payment Error', e.message || 'Could not initiate Campay payment.');
    } finally {
      setCampayLoading(false);
    }
  };

  const handleCheckCampayStatusManual = async (amountDue: number) => {
    if (!campayRef) return;
    const rideId = activeRide?.id ? Number(activeRide.id) : (paramRideId ? Number(paramRideId) : 1);
    setCampayLoading(true);
    try {
      const statusRes = await api.checkCampayStatus(campayRef, rideId);
      if (statusRes.status === 'SUCCESSFUL' || statusRes.is_completed) {
        await finalizePaymentSuccess(amountDue, 'Campay Mobile Money');
      } else {
        Alert.alert(
          'Payment Pending ⏳',
          `Transaction is currently ${statusRes.status}. Please approve the prompt on your phone and try again.`
        );
      }
    } catch (e: any) {
      Alert.alert('Status Check', e.message || 'Error checking payment status.');
    } finally {
      setCampayLoading(false);
    }
  };

  const handleDigitalPaymentComplete = async () => {
    const defaultAmount = Number(activeRide?.allocated_shared_fare || activeRide?.final_fare || activeRide?.estimated_fare || (params.fare ? Number(params.fare) : 0) || 1300);
    const rideId = activeRide?.id ? String(activeRide.id) : null;
    if (activeRide?.is_joiner && activeRide?.participant_id) {
      try {
        await api.confirmSharedPayment(activeRide.participant_id);
      } catch (e) {
        console.log('Error confirming shared digital payment on backend:', e);
      }
    } else if (rideId && !isNaN(Number(rideId))) {
      try {
        await api.confirmDigitalPayment(Number(rideId));
      } catch (e) {
        console.log('Error confirming digital payment on backend:', e);
      }
    }
    await finalizePaymentSuccess(defaultAmount, 'Digital Mobile Money Authorization');
  };

  const handleSubmitRating = async () => {
    if (completedRideId) {
      dismissedRideIdsRef.current.add(String(completedRideId));
      await dismissedRideStorage.addId(completedRideId);
      setSubmittingRating(true);
      try {
        await api.rateDriver(completedRideId, ratingScore, ratingComment);
      } catch (e) {
        console.log('Rating submission error (non-blocking):', e);
      }
    }
    setSubmittingRating(false);
    setShowRatingModal(false);
    setRatingScore(5);
    setRatingComment('');
    setCompletedRideId(null);
    await activeRideStorage.clear();
    setActiveRide(null);
    setPassengerAccepted(false);
    setAcceptedRideId(null);
    setParticipants([]);
    router.setParams({ ride_id: '', shared: '', pay: '', pickup: '', dest: '', fare: '' });
    api.getMyRides().then((res) => {
      if (Array.isArray(res)) setCompletedRides(res.filter((r) => r.status === 'COMPLETED'));
    }).catch(() => {});
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
          distanceKm={Number(activeRide?.distance_km || parseFloat(params.distance_km as string) || 0) || undefined}
          passengers={participants.map((p: any) => ({
            id: p.passenger?.id || p.id,
            name: p.passenger?.username || p.passenger_name || `Passenger ${p.pickup_order || ''}`.trim(),
            pickupName: p.pickup_name,
            pickupLat: Number(p.pickup_lat),
            pickupLng: Number(p.pickup_lng),
            pickup_order: p.pickup_order,
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
                <Text style={styles.noDriverTitle}>Driver Declined</Text>
              </View>
              <Text style={[styles.noDriverSub, { color: colors.subText }]}>
                The proposed driver was declined. Choose another available driver below:
              </Text>

            <Text style={[styles.altSectionTitle, { color: colors.text }]}>Available Drivers in Other Categories</Text>
             {driverProposals.map((alt) => (
               <View key={alt.id} style={[styles.altDriverCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                 <View style={[styles.altDriverAvatar, { backgroundColor: `${colors.primary}20` }]}>
                   {alt.driver_profile_picture_url ? (
                     <Image source={{ uri: alt.driver_profile_picture_url }} style={styles.altDriverAvatarImage} />
                   ) : (
                     <Ionicons name="person" size={20} color={colors.primary} />
                   )}
                 </View>
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
                {(() => {
                  const picUrl = activeRide?.driver_profile_picture_url || (driverProposals.length > 0 ? driverProposals[0].driver_profile_picture_url : '');
                  if (picUrl) {
                    return <Image source={{ uri: picUrl }} style={styles.driverAvatarImage} onError={() => {}} />;
                  }
                  return <Ionicons name={isMotoVehicle ? 'bicycle' : 'person'} size={24} color={colors.primary} />;
                })()}
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
                {(() => {
                  const picUrl = activeRide?.driver_profile_picture_url || (driverProposals.length > 0 ? driverProposals[0].driver_profile_picture_url : '');
                  if (picUrl) {
                    return <Image source={{ uri: picUrl }} style={styles.driverAvatarImage} onError={() => {}} />;
                  }
                  return <Ionicons name={isMotoVehicle ? 'bicycle' : 'person'} size={24} color={colors.primary} />;
                })()}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.driverName, { color: colors.text }]}>{driverName}</Text>
                <Text style={[styles.carInfo, { color: colors.subText }]}>{vehicleInfo}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#FFD600" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>4.9 (42 rides)</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: colors.bg }]} onPress={handleCallDriver}>
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

        {/* Shared Ride Passengers & Initiator */}
        {(activeRide?.is_shared || activeRide?.is_joiner || participants.length > 0) && (
          <View style={[styles.participantsCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <View style={styles.participantsHeader}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={[styles.participantsTitle, { color: colors.text }]}>
                {activeRide?.is_joiner ? 'Shared Ride Copassengers' : `Joined Passengers (${participants.length})`}
              </Text>
            </View>

            {/* If Current User is a Joiner, show the Initiator Profile Card */}
            {activeRide?.is_joiner && (
              <View style={[styles.participantRow, { borderBottomColor: colors.cardBorder, backgroundColor: `${colors.primary}12`, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 8 }]}>
                <View style={[styles.participantAvatar, { backgroundColor: `${colors.primary}25` }]}>
                  {(() => {
                    const initPic = activeRide?.initiator_profile_picture_url || (participants[0] && participants[0].initiator_profile_picture_url) || '';
                    if (initPic) {
                      return <Image source={{ uri: initPic }} style={styles.participantAvatarImage} />;
                    }
                    return <Ionicons name="person" size={18} color={colors.primary} />;
                  })()}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.participantName, { color: colors.text }]}>
                    {activeRide?.initiator_name || activeRide?.initiator_username || 'Ride Initiator'} <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>(Initiator)</Text>
                  </Text>
                  <Text style={[styles.participantPickup, { color: colors.subText }]}>
                    {activeRide?.pickup_name || 'Primary Ride Route'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.participantFare, { color: colors.primary }]}>Initiator</Text>
                </View>
              </View>
            )}

            {/* Joined Passengers List */}
            {participants.length === 0 && !activeRide?.is_joiner ? (
              <View style={{ paddingVertical: 10 }}>
                <Text style={[styles.participantEmpty, { color: colors.subText }]}>No passengers have joined yet.</Text>
                <Text style={[styles.participantEmpty, { color: colors.subText, fontSize: 11 }]}>Compatible riders along your route can join this ride.</Text>
              </View>
            ) : (
              participants.map((p: any) => {
                const picUrl = p.passenger_profile_picture_url || p.passenger?.profile_picture_url || p.profile_picture_url || '';
                const isMe = p.passenger_username === user?.username || p.passenger === user?.id || p.passenger?.id === user?.id;
                return (
                  <View key={p.id} style={[styles.participantRow, { borderBottomColor: colors.cardBorder }]}>
                    <View style={[styles.participantAvatar, { backgroundColor: `${colors.primary}20` }]}>
                      {picUrl ? (
                        <Image source={{ uri: picUrl }} style={styles.participantAvatarImage} />
                      ) : (
                        <Text style={[styles.participantInitial, { color: colors.primary }]}>
                          {((p.passenger?.username || p.passenger_name || 'P') || 'P').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.participantName, { color: colors.text }]}>
                        {p.passenger?.username || p.passenger_name || `Passenger ${p.pickup_order || ''}`} {isMe && <Text style={{ color: colors.primary, fontWeight: '700' }}>(You)</Text>}
                      </Text>
                      <Text style={[styles.participantPickup, { color: colors.subText }]}>{p.pickup_name}</Text>
                    </View>
                    <Text style={[styles.participantFare, { color: colors.primary }]}>{Number(p.allocated_shared_fare || 0).toLocaleString()} FCFA</Text>
                  </View>
                );
              })
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
          style={styles.cancelRideBtn}
          onPress={handleCancelRide}
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

            {/* ITEMIZED FARE RECEIPT WITH FULL PROFESSIONAL BREAKDOWN */}
            {(() => {
              const isShared = Boolean(
                activeRide?.is_shared ||
                activeRide?.shared_ride_id ||
                activeRide?.is_joiner ||
                participants.length > 0 ||
                params.shared === '1'
              );
              const isJoiner = Boolean(
                activeRide?.is_joiner ||
                params.shared === '1' ||
                Boolean(activeRide?.participant_id) ||
                (user?.username && participants.some((p: any) => p.passenger_username === user?.username || p.passenger === user?.id || p.passenger?.id === user?.id))
              );

              // Calculated base fare & distance rate
              const baseFareVal = isMotoVehicle ? 400 : 600;
              const distKm = Number(activeRide?.distance_km || (params.distance_km ? Number(params.distance_km) : 0) || 4.5);
              const ratePerKm = isMotoVehicle ? 75 : 110;
              const distRateVal = Math.round(distKm * ratePerKm);

              // Total booking fare
              const baseBookingFare = Number(activeRide?.primary_estimated_fare || activeRide?.estimated_fare || activeRide?.final_fare || (baseFareVal + distRateVal) || 1500);

              // Initiator & Joiner individual fares (proportional shared split)
              let myAmountDue: number;
              let initiatorFare: number;
              let joinerFare: number;

              if (isJoiner) {
                myAmountDue = Math.round(Number(activeRide?.allocated_shared_fare || (params.fare ? Number(params.fare) : 0) || Math.round(baseBookingFare * 0.45) || 750));
                joinerFare = myAmountDue;
                initiatorFare = Math.max(500, Math.round(baseBookingFare - myAmountDue));
              } else if (isShared && participants.length > 0) {
                const partFare = participants.reduce((sum: number, p: any) => sum + Math.round(Number(p.allocated_shared_fare || p.fare || 0)), 0);
                joinerFare = partFare > 0 ? partFare : Math.round(baseBookingFare * 0.45);
                initiatorFare = Math.max(500, Math.round(baseBookingFare - joinerFare));
                myAmountDue = initiatorFare;
              } else {
                myAmountDue = Math.round(Number(activeRide?.final_fare || activeRide?.estimated_fare || (params.fare ? Number(params.fare) : 0) || baseBookingFare));
                initiatorFare = myAmountDue;
                joinerFare = Math.round(myAmountDue * 0.45);
              }

              const totalSharedFare = isShared ? (initiatorFare + joinerFare) : myAmountDue;

              return (
                <>
                  <View style={[styles.receiptCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.receiptTitle, { color: colors.subText }]}>TRIP FARE RECEIPT</Text>

                  {/* Standard Base & Distance Lines */}
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptItem, { color: colors.text }]}>
                      Base Fare ({isMotoVehicle ? 'Moto Taxi' : 'Economy Taxi'})
                    </Text>
                    <Text style={[styles.receiptPrice, { color: colors.text }]}>
                      {baseFareVal.toLocaleString()} FCFA
                    </Text>
                  </View>

                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptItem, { color: colors.text }]}>
                      Distance Rate ({distKm.toFixed(1)} km x {ratePerKm} FCFA/km)
                    </Text>
                    <Text style={[styles.receiptPrice, { color: colors.text }]}>
                      {distRateVal.toLocaleString()} FCFA
                    </Text>
                  </View>

                  <View style={[styles.receiptDivider, { backgroundColor: colors.cardBorder, marginVertical: 8 }]} />

                  {/* Total Shared Fare Row */}
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptTotalLabel, { color: colors.text }]}>
                      {isShared ? '🚗 Total Shared Ride Fare' : '💳 Total Fare'}
                    </Text>
                    <Text style={[styles.receiptTotalAmount, { color: colors.primary }]}>
                      {totalSharedFare.toLocaleString()} FCFA
                    </Text>
                  </View>

                  {/* PER-PASSENGER BREAKDOWN (FOR SHARED RIDES) */}
                  {isShared && (
                    <>
                      <View style={[styles.receiptDivider, { backgroundColor: colors.cardBorder, marginVertical: 8 }]} />
                      <Text style={[styles.receiptTitle, { color: colors.subText, marginBottom: 6, fontSize: 11 }]}>
                        PER-PASSENGER BREAKDOWN
                      </Text>

                      {/* Primary Initiator */}
                      <View style={styles.receiptRow}>
                        <Text style={[styles.receiptItem, { color: colors.text }]}>
                          👤 Initiator ({distKm.toFixed(1)} km) {!isJoiner && <Text style={{ color: colors.primary, fontWeight: '800' }}>(You)</Text>}
                        </Text>
                        <Text style={[styles.receiptPrice, { color: colors.primary, fontWeight: '700' }]}>
                          {initiatorFare.toLocaleString()} FCFA
                        </Text>
                      </View>

                      {/* Joined Passenger(s) */}
                      {participants.length > 0 ? (
                        participants.map((p: any, idx: number) => {
                          const pDist = Number(p.solo_distance_km || 3.2);
                          const pFare = Math.round(Number(p.allocated_shared_fare || p.fare || joinerFare));
                          const isThisMe = isJoiner || p.passenger_username === user?.username || p.passenger === user?.id;
                          return (
                            <View key={p.id || idx} style={styles.receiptRow}>
                              <Text style={[styles.receiptItem, { color: colors.text }]}>
                                👤 {p.passenger_username || p.passenger_name || `Passenger ${idx + 2}`} ({pDist.toFixed(1)} km) {isThisMe && <Text style={{ color: colors.primary, fontWeight: '800' }}>(You)</Text>}
                              </Text>
                              <Text style={[styles.receiptPrice, { color: colors.primary, fontWeight: '700' }]}>
                                {pFare.toLocaleString()} FCFA
                              </Text>
                            </View>
                          );
                        })
                      ) : (
                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptItem, { color: colors.text }]}>
                            👤 Joined Passenger ({Number(activeRide?.distance_km || 3.2).toFixed(1)} km) {isJoiner && <Text style={{ color: colors.primary, fontWeight: '800' }}>(You)</Text>}
                          </Text>
                          <Text style={[styles.receiptPrice, { color: colors.primary, fontWeight: '700' }]}>
                            {joinerFare.toLocaleString()} FCFA
                          </Text>
                        </View>
                      )}

                      <View style={[styles.receiptDivider, { backgroundColor: colors.cardBorder, marginVertical: 8 }]} />
                    </>
                  )}

                  {/* High-visibility YOUR AMOUNT DUE summary */}
                  <View style={[styles.receiptRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.cardBorder }]}>
                    <Text style={[styles.receiptTotalLabel, { color: colors.text, fontSize: 15 }]}>
                      ✅ Your Amount Due
                    </Text>
                    <Text style={[styles.receiptTotalAmount, { color: colors.accent || colors.primary, fontSize: 18, fontWeight: '900' }]}>
                      {myAmountDue.toLocaleString()} FCFA
                    </Text>
                  </View>
                </View>

                {/* PAYMENT METHOD AUTHORIZATION */}
                {selectedPayment === 'CASH' ? (
                  <View style={[styles.cashBox, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.pinPromptLabel, { color: colors.text }]}>
                      Give 4-Digit Cash OTP PIN ({activeRide?.cash_otp || cashPin || '4892'}) to driver {driverName}:
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
                  <View style={[styles.campayCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    {/* Operator selector */}
                    <View style={styles.operatorRow}>
                      <TouchableOpacity
                        style={[
                          styles.operatorBtn,
                          momoOperator === 'MTN' && { backgroundColor: '#FFCC00', borderColor: '#FFCC00' }
                        ]}
                        onPress={() => setMomoOperator('MTN')}
                      >
                        <Ionicons name="flash" size={14} color={momoOperator === 'MTN' ? '#000' : colors.subText} />
                        <Text style={[styles.operatorBtnText, { color: momoOperator === 'MTN' ? '#000' : colors.text }]}>
                          MTN MoMo
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.operatorBtn,
                          momoOperator === 'ORANGE' && { backgroundColor: '#FF6600', borderColor: '#FF6600' }
                        ]}
                        onPress={() => setMomoOperator('ORANGE')}
                      >
                        <Ionicons name="card" size={14} color={momoOperator === 'ORANGE' ? '#FFF' : colors.subText} />
                        <Text style={[styles.operatorBtnText, { color: momoOperator === 'ORANGE' ? '#FFF' : colors.text }]}>
                          Orange Money
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Phone input */}
                    <View style={[styles.momoInputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <Text style={{ color: colors.subText, fontSize: 13, fontWeight: '700' }}>🇨🇲 +237</Text>
                      <TextInput
                        style={[styles.momoInput, { color: colors.text }]}
                        value={momoPhone}
                        onChangeText={setMomoPhone}
                        placeholder="6XXXXXXXX"
                        placeholderTextColor={colors.subText}
                        keyboardType="phone-pad"
                      />
                    </View>

                    {/* Demo info note */}
                    <View style={styles.campayDemoBadge}>
                      <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
                      <Text style={[styles.campayDemoText, { color: colors.subText }]}>
                        Campay Gateway • Demo mode (prompts 25 FCFA on phone, saves {myAmountDue.toLocaleString()} FCFA in receipt)
                      </Text>
                    </View>

                    {campayPolling ? (
                      <View style={[styles.campayPollingBox, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}>
                        <ActivityIndicator color={colors.primary} size="small" style={{ marginBottom: 6 }} />
                        <Text style={[styles.campayPollingTitle, { color: colors.primary }]}>
                          USSD Push Sent ({campayUssdCode || (momoOperator === 'MTN' ? '*126#' : '#150*50#')})
                        </Text>
                        <Text style={[styles.campayPollingSub, { color: colors.subText }]}>
                          Please enter your PIN on {momoPhone} to approve the 25 FCFA payment.
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          <TouchableOpacity
                            style={[styles.campayCheckBtn, { backgroundColor: colors.primary }]}
                            onPress={() => handleCheckCampayStatusManual(myAmountDue)}
                            disabled={campayLoading}
                          >
                            {campayLoading ? (
                              <ActivityIndicator color="#0B1325" size="small" />
                            ) : (
                              <Text style={styles.campayCheckBtnText}>Check Status Now</Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.campayCancelBtn, { borderColor: colors.cardBorder }]}
                            onPress={() => setCampayPolling(false)}
                          >
                            <Text style={[styles.campayCancelBtnText, { color: colors.subText }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.digitalConfirmBtn, { backgroundColor: momoOperator === 'MTN' ? '#FFCC00' : '#FF6600' }]}
                          onPress={() => handleInitiateCampayPayment(myAmountDue)}
                          disabled={campayLoading}
                        >
                          {campayLoading ? (
                            <ActivityIndicator color="#0B1325" />
                          ) : (
                            <>
                              <Ionicons name="wallet-sharp" size={20} color={momoOperator === 'MTN' ? '#0B1325' : '#FFFFFF'} style={{ marginRight: 6 }} />
                              <Text style={[styles.digitalConfirmBtnText, { color: momoOperator === 'MTN' ? '#0B1325' : '#FFFFFF' }]}>
                                Pay with Campay ({myAmountDue.toLocaleString()} FCFA)
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.fallbackDirectBtn, { borderColor: colors.cardBorder }]}
                          onPress={() => finalizePaymentSuccess(myAmountDue, 'Direct Mobile Money Authorization')}
                        >
                          <Text style={[styles.fallbackDirectBtnText, { color: colors.subText }]}>
                            ⚡ Instant Digital Authorization ({myAmountDue.toLocaleString()} FCFA)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </>
            );
          })()}
          </View>
        </View>
      </Modal>

      {/* ⭐ DRIVER RATING MODAL — appears automatically after ride payment */}
      <Modal
        visible={showRatingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.paymentModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.paymentModalHeader}>
              <View style={[styles.paySuccessIconBadge, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="star" size={26} color="#FFD600" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentModalTitle, { color: colors.text }]}>Rate Your Driver</Text>
                <Text style={[styles.paymentModalSub, { color: colors.subText }]}>
                  {driverName}
                </Text>
              </View>
            </View>

            {/* Star selector */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 16, gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRatingScore(star)}
                  style={{ padding: 8 }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.starButton, { borderColor: star <= ratingScore ? '#FFD600' : colors.cardBorder, backgroundColor: star <= ratingScore ? '#FFD60020' : 'transparent' }]}>
                    <Ionicons
                      name={star <= ratingScore ? 'star' : 'star-outline'}
                      size={28}
                      color={star <= ratingScore ? '#FFD600' : colors.subText}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ textAlign: 'center', color: colors.primary, marginBottom: 16, fontSize: 15, fontWeight: '700' }}>
              {ratingScore === 5 ? '⭐ Excellent!' : ratingScore === 4 ? '👍 Good' : ratingScore === 3 ? '😐 Average' : ratingScore === 2 ? '👎 Poor' : '❌ Very Poor'}
            </Text>

            {/* Comment input */}
            <View style={[styles.ratingCommentBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <TextInput
                style={[styles.pinInput, { backgroundColor: 'transparent', color: colors.text, textAlignVertical: 'top', padding: 0 }]}
                placeholder="Add a comment about your ride..."
                placeholderTextColor={colors.subText}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                maxLength={200}
              />
            </View>

            {/* Action buttons */}
            <View style={styles.ratingActionRow}>
              <TouchableOpacity
                style={styles.ratingSkipBtn}
                onPress={() => { setShowRatingModal(false); setRatingComment(''); setRatingScore(5); }}
              >
                <Text style={styles.ratingSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ratingSubmitBtn}
                onPress={handleSubmitRating}
                disabled={submittingRating}
              >
                {submittingRating
                  ? <ActivityIndicator size="small" color="#0B1325" />
                  : <Text style={styles.ratingSubmitText}>Submit Rating</Text>
                }
              </TouchableOpacity>
            </View>
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
    gap: 10,
  },
  altDriverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  altDriverAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  driverAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  participantAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  starButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingCommentBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    minHeight: 80,
  },
  ratingActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  ratingSkipBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingSkipText: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 14,
  },
  ratingSubmitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#00B67A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  campayCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  operatorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  operatorBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#37474F',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  operatorBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  momoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  momoInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    height: 44,
  },
  campayDemoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  campayDemoText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  campayPollingBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  campayPollingTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  campayPollingSub: {
    fontSize: 11,
    textAlign: 'center',
  },
  campayCheckBtn: {
    flex: 2,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  campayCheckBtnText: {
    color: '#0B1325',
    fontWeight: '800',
    fontSize: 12,
  },
  campayCancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  campayCancelBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  fallbackDirectBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackDirectBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
