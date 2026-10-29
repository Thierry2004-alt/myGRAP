import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert, Linking, TextInput, Platform, ScrollView } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RideLiveMap from '../../components/RideLiveMap';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useRideLocationTracking } from '../../hooks/useRideLocationTracking';

export default function DriverHomeScreen() {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();

  const [isOnline, setIsOnline] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [earnings, setEarnings] = useState({ total: 0, balance: 0 });

  // Driver Active Ride State
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [passengerPosition, setPassengerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const openedNavigationRef = useRef<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [requests, earningsData, currentActiveRide] = await Promise.all([
        api.getRideRequests().catch(() => []),
        api.getDriverEarnings().catch(() => ({ total_net_earnings: 0, available_balance: 0 })),
        api.getDriverActiveRide().catch(() => null),
      ]);

      setRequestCount(Array.isArray(requests) ? requests.length : 0);
      setEarnings({
        total: Number(earningsData?.total_net_earnings || 0),
        balance: Number(earningsData?.available_balance || 0),
      });

      if (currentActiveRide && currentActiveRide.id) {
        setActiveRide(currentActiveRide);
      } else {
        setActiveRide(null);
      }
    } catch (e) {
      console.log('Dashboard data error:', e);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 4000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // WebSocket for real-time ride updates / cancellations
  const rideSocket = useWebSocket({
    rideId: activeRide?.id,
    onMessage: (data) => {
      const type = data.type || data.event;
      const eventData = data.data || data;
      if (type === 'passenger_location_updated') {
        const lat = Number(eventData.latitude);
        const lng = Number(eventData.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) setPassengerPosition({ lat, lng });
      } else if (type === 'ride_cancelled') {
        Alert.alert(t('Ride Cancelled'), t('The passenger has cancelled this ride.'));
        setActiveRide(null);
        loadDashboard();
      } else if (type === 'ride_status_updated') {
        const status = data.data?.status || data.status;
        if (status === 'COMPLETED') {
          setActiveRide(null);
          loadDashboard();
        } else if (status) {
          setActiveRide((prev: any) => (prev ? { ...prev, status } : null));
        }
      }
    },
  });

  useEffect(() => {
    setPassengerPosition(null);
  }, [activeRide?.id]);

  useEffect(() => {
    if (!['ACCEPTED', 'DRIVER_ARRIVING'].includes(activeRide?.status)) {
      setPassengerPosition(null);
    }
  }, [activeRide?.status]);

  const driverTracking = useRideLocationTracking({
    rideId: activeRide?.id,
    enabled: isOnline || Boolean(activeRide),
    role: 'driver',
    isConnected: rideSocket.isConnected,
    send: rideSocket.send,
  });

  const displayName = user?.first_name || user?.username || 'Driver';
  const formatCurrency = (value: number) => `${Math.round(value).toLocaleString()} FCFA`;

  const openGoogleMapsNavigation = useCallback(async (ride: any, status: string) => {
    let destination: { lat: number; lng: number };
    if (status === 'IN_PROGRESS') {
      destination = {
        lat: Number(ride.destination_lat),
        lng: Number(ride.destination_lng),
      };
    } else {
      destination = {
        lat: Number(ride.pickup_lat),
        lng: Number(ride.pickup_lng),
      };
    }

    if (
      !Number.isFinite(destination.lat) ||
      !Number.isFinite(destination.lng) ||
      Math.abs(destination.lat) > 90 ||
      Math.abs(destination.lng) > 180
    ) {
      Alert.alert(t('Navigation unavailable'), t('The ride destination coordinates are missing or invalid.'));
      return;
    }

    const coordinates = `${destination.lat},${destination.lng}`;
    // Omitting origin makes Google Maps use the device's live GPS and start navigation.
    const googleMapsUrl =
      `https://www.google.com/maps/dir/?api=1&destination=${coordinates}` +
      '&travelmode=driving&dir_action=navigate';
    try {
      if (Platform.OS === 'android') {
        try {
          await Linking.openURL(`google.navigation:q=${coordinates}&mode=d`);
          return;
        } catch (error) {
          console.warn('Google Maps navigation intent unavailable; trying the Maps URL:', error);
        }
      }
      await Linking.openURL(googleMapsUrl);
    } catch (error) {
      console.error('Unable to open Google Maps navigation:', error);
      Alert.alert(t('Navigation unavailable'), t('Google Maps could not be opened on this device.'));
    }
  }, [t]);

  useEffect(() => {
    if (!activeRide || !['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(activeRide.status)) {
      openedNavigationRef.current = null;
      return;
    }
    const navigationPhase = activeRide.status === 'IN_PROGRESS' ? 'destination' : 'pickup';
    const navigationKey = `${activeRide.id}:${navigationPhase}`;
    if (openedNavigationRef.current === navigationKey) return;
    openedNavigationRef.current = navigationKey;
    void openGoogleMapsNavigation(activeRide, activeRide.status);
  }, [activeRide?.id, activeRide?.status, openGoogleMapsNavigation]);

  const toggleStatus = async (val: boolean) => {
    const previousStatus = isOnline;
    setIsOnline(val);
    setIsUpdatingStatus(true);
    try {
      await api.toggleDriverStatus(val);
    } catch (e) {
      console.log('Status error:', e);
      setIsOnline(previousStatus);
      Alert.alert(t('Connection issue'), t('Your availability could not be updated. Please try again.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCallPassenger = async () => {
    const phone = activeRide?.passenger_phone || '+237690001122';
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (e) {
      Alert.alert(t('Call Passenger'), `${t('Passenger phone:')} ${phone}`);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const updated = await api.updateRideStatus(activeRide.id, newStatus);
      if (newStatus === 'COMPLETED') {
        Alert.alert(
          t('Trip Completed!'),
          `${t('Fare:')} ${Number(updated.final_fare || updated.estimated_fare).toLocaleString()} FCFA.\n${t('Earnings credited to your wallet.')}`
        );
        setActiveRide(null);
        setEnteredPin('');
        await loadDashboard();
      } else {
        setActiveRide(updated);
        if (newStatus === 'DRIVER_AT_PICKUP') {
          Speech.speak('Bienvenue sur GRAP', {
            language: 'fr-FR',
            rate: 0.95,
            onError: (error) => console.error('Unable to play trip welcome message:', error),
          });
        }
      }
    } catch (e: any) {
      Alert.alert(t('Error'), e.message ? t(e.message) : t('Could not update trip status'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCashPayment = async () => {
    if (!activeRide || !/^\d{4}$/.test(enteredPin.trim())) {
      Alert.alert(t('PIN required'), t('Enter the 4-digit PIN shown by the passenger.'));
      return;
    }

    setActionLoading(true);
    try {
      const result = await api.confirmCashOTP(activeRide.id, enteredPin.trim());
      Alert.alert(
        t('Cash payment confirmed'),
        `${t('Trip completed. Fare:')} ${Number(result.final_fare || activeRide.estimated_fare).toLocaleString()} FCFA.`,
      );
      setActiveRide(null);
      setEnteredPin('');
      await loadDashboard();
    } catch (error: any) {
      Alert.alert(t('Could not confirm payment'), error.message ? t(error.message) : t('Check the PIN and try again.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTrip = () => {
    Alert.alert(
      t('Cancel Active Ride'),
      t('Are you sure you want to cancel this active ride? This will notify the passenger.'),
      [
        { text: t('No'), style: 'cancel' },
        {
          text: t('Cancel Ride'),
          style: 'destructive',
          onPress: () => handleUpdateStatus('CANCELLED_BY_DRIVER'),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <RideLiveMap
        rideState={activeRide?.status || 'IDLE'}
        pickupLat={activeRide ? Number(activeRide.pickup_lat) : driverTracking.position?.lat ?? 3.848}
        pickupLng={activeRide ? Number(activeRide.pickup_lng) : driverTracking.position?.lng ?? 11.5021}
        destinationLat={activeRide ? Number(activeRide.destination_lat) : driverTracking.position?.lat ?? 3.848}
        destinationLng={activeRide ? Number(activeRide.destination_lng) : driverTracking.position?.lng ?? 11.5021}
        driverPosition={driverTracking.position}
        passengerPosition={passengerPosition}
        driverHome={!activeRide}
      />

      {/* Floating Status & Earnings Header */}
      <View style={[styles.topStatusCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.topStatusRow}>
          <View style={styles.driverInfoGroup}>
            <View style={[styles.driverDot, { backgroundColor: isOnline ? colors.primary : colors.subText }]} />
            <View>
              <Text style={[styles.driverGreeting, { color: colors.text }]}>{t('driverWelcome')}, {displayName}</Text>
              <Text style={[styles.todayEarningsText, { color: colors.subText }]}>{isOnline ? t('youAreOnline') : t('youAreOffline')}</Text>
            </View>
          </View>
          {isUpdatingStatus ? (
            <ActivityIndicator color={colors.secondary} />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={toggleStatus}
              trackColor={{ false: colors.cardBorder, true: colors.secondary }}
            />
          )}
        </View>

        <View style={[styles.metricsRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(earnings.total)}</Text>
            <Text style={[styles.metricLabel, { color: colors.subText }]}>{t('Net earnings')}</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{requestCount}</Text>
            <Text style={[styles.metricLabel, { color: colors.subText }]}>{t('Open requests')}</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(earnings.balance)}</Text>
            <Text style={[styles.metricLabel, { color: colors.subText }]}>{t('Available')}</Text>
          </View>
        </View>
      </View>

      {/* CASE A: DRIVER HAS AN ACTIVE TRIP */}
      {activeRide ? (
        <View style={[styles.activeRideWidget, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          {/* Header & Stage Badge */}
          <View style={styles.activeHeaderRow}>
            <View>
              <Text style={[styles.activeTitle, { color: colors.text }]}>Active Ride #{activeRide.id}</Text>
              <Text style={[styles.activeCategory, { color: colors.subText }]}>
                {activeRide.category_name || 'Economy'} • {activeRide.estimated_fare} FCFA
              </Text>
            </View>
            <View style={[
              styles.stageBadge,
              {
                backgroundColor:
                  activeRide.status === 'IN_PROGRESS'
                    ? 'rgba(255, 152, 0, 0.2)'
                    : activeRide.status === 'ARRIVED_AT_DESTINATION'
                    ? 'rgba(255, 152, 0, 0.2)'
                    : activeRide.status === 'DRIVER_AT_PICKUP'
                    ? 'rgba(0, 230, 118, 0.2)'
                    : 'rgba(41, 182, 246, 0.2)'
              }
            ]}>
              <Text style={[
                styles.stageBadgeText,
                {
                  color:
                    activeRide.status === 'IN_PROGRESS'
                      ? '#FF9800'
                      : activeRide.status === 'ARRIVED_AT_DESTINATION'
                      ? '#FF9800'
                      : activeRide.status === 'DRIVER_AT_PICKUP'
                      ? '#00E676'
                      : colors.secondary
                }
              ]}>
                {activeRide.status === 'IN_PROGRESS'
                  ? 'ON TRIP'
                  : activeRide.status === 'ARRIVED_AT_DESTINATION'
                  ? 'AT DESTINATION'
                  : activeRide.status === 'DRIVER_AT_PICKUP'
                  ? 'AT PICKUP'
                  : 'EN ROUTE'}
              </Text>
            </View>
          </View>

          {driverTracking.locationError ? (
            <Text style={[styles.trackingErrorText, { color: colors.subText }]}>
              {t(driverTracking.locationError)}
            </Text>
          ) : driverTracking.position && rideSocket.isConnected ? (
            <Text style={[styles.trackingErrorText, { color: colors.subText }]}>
              Your live location is shared with the passenger while this screen is open.
            </Text>
          ) : (
            <Text style={[styles.trackingErrorText, { color: colors.subText }]}>
              Connecting to GPS and live ride updates...
            </Text>
          )}

          {/* Passenger Info & Phone Call */}
          <View style={[styles.passengerBox, { backgroundColor: colors.inputBg }]}>
            <View style={styles.passengerInfo}>
              <View style={[styles.passengerAvatar, { backgroundColor: `${colors.primary}25` }]}>
                <Ionicons name="person" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.passengerNameText, { color: colors.text }]}>
                  {activeRide.passenger_name || activeRide.passenger_username || 'Passenger'}
                </Text>
                <Text style={[styles.passengerPhoneText, { color: colors.subText }]}>
                  {activeRide.passenger_phone || '+237 ••• ••• •••'}
                </Text>
              </View>
              <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.primary }]} onPress={handleCallPassenger}>
                <Ionicons name="call" size={16} color="#0B1325" />
                <Text style={styles.callBtnText}>{t('Call')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routeItemRow}>
              <Ionicons name="radio-button-on" size={13} color={colors.primary} />
              <Text style={[styles.routeItemText, { color: colors.text }]} numberOfLines={1}>
                {activeRide.pickup_name}
              </Text>
            </View>
            <View style={styles.routeItemRow}>
              <Ionicons name="location-sharp" size={13} color="#FF5252" />
              <Text style={[styles.routeItemText, { color: colors.text }]} numberOfLines={1}>
                {activeRide.destination_name}
              </Text>
            </View>
            {['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(activeRide.status) ? (
              <TouchableOpacity
                style={[styles.secondaryAction, { borderColor: colors.cardBorder, marginTop: 12 }]}
                onPress={() => void openGoogleMapsNavigation(activeRide, activeRide.status)}
              >
                <Ionicons name="navigate-outline" size={17} color={colors.primary} />
                <Text style={[styles.secondaryActionText, { color: colors.text, marginLeft: 6 }]}>
                  Open Google Maps
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Action Step Controls */}
          {actionLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : activeRide.status === 'ACCEPTED' || activeRide.status === 'DRIVER_ARRIVING' ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleUpdateStatus('DRIVER_AT_PICKUP')}
            >
              <Ionicons name="location-outline" size={18} color="#0B1325" style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionBtnText}>{t('I Have Arrived at Pickup')}</Text>
            </TouchableOpacity>
          ) : activeRide.status === 'DRIVER_AT_PICKUP' ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: '#00E676' }]}
              onPress={() => handleUpdateStatus('IN_PROGRESS')}
            >
              <Ionicons name="play" size={16} color="#0B1325" style={{ marginRight: 4 }} />
              <Text style={styles.primaryActionBtnText}>{t('Start Trip')}</Text>
            </TouchableOpacity>
          ) : activeRide.status === 'IN_PROGRESS' ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: '#FF9800' }]}
              onPress={() => handleUpdateStatus('ARRIVED_AT_DESTINATION')}
            >
              <Ionicons name="flag-outline" size={18} color="#0B1325" style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionBtnText}>{t('Arrived at Destination')}</Text>
            </TouchableOpacity>
          ) : activeRide.status === 'ARRIVED_AT_DESTINATION' ? (
            <View style={styles.startTripGroup}>
              <Text style={[styles.pinHelpText, { color: colors.subText }]}>
                For cash rides, collect the fare from the passenger, then enter their 4-digit PIN to confirm payment.
              </Text>
              <View style={styles.pinVerifyRow}>
                <TextInput
                  style={[styles.pinInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
                  placeholder={t('Passenger PIN')}
                  placeholderTextColor={colors.subText}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={enteredPin}
                  onChangeText={(value) => setEnteredPin(value.replace(/\D/g, '').slice(0, 4))}
                />
                <TouchableOpacity
                  style={[styles.startTripBtn, { backgroundColor: colors.secondary }]}
                  onPress={handleConfirmCashPayment}
                  disabled={actionLoading}
                >
                  <Text style={styles.primaryActionBtnText}>{t('Confirm cash')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Emergency Cancel */}
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancelTrip}>
            <Text style={styles.cancelLinkText}>{t('Cancel Ride (Emergency)')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* CASE B: STANDBY MODE — DEMAND HOTSPOTS */
        <View style={[styles.demandWidget, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.widgetHeader}>
            <Ionicons name="flame" size={16} color="#FF5252" />
            <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('demandNearYou')}</Text>
            <Text style={[styles.requestCount, { color: colors.secondary }]}>{requestCount} open</Text>
          </View>

          <TouchableOpacity
            style={[styles.goOnlineBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push('/driver-requests')}
          >
            <Ionicons name="list-outline" size={18} color="#0B1325" />
            <Text style={styles.goOnlineText}>
              {language === 'en' ? 'View ride requests' : 'Voir les demandes'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: colors.cardBorder }]}
            onPress={() => toggleStatus(!isOnline)}
            disabled={isUpdatingStatus}
          >
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>
              {isOnline ? t('goOffline') : t('goOnline')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topStatusCard: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    elevation: 8,
    zIndex: 10,
  },
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  driverGreeting: {
    fontSize: 15,
    fontWeight: '800',
  },
  todayEarningsText: {
    fontSize: 12,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  metricDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  activeRideWidget: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    elevation: 12,
    zIndex: 10,
  },
  navigationInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  navigationInstructionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  trackingErrorText: {
    fontSize: 12,
    marginBottom: 10,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  activeCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  passengerBox: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  passengerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  passengerPhoneText: {
    fontSize: 11,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#0B1325',
    fontSize: 12,
    fontWeight: '800',
  },
  routeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeItemText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  primaryActionBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryActionBtnText: {
    color: '#0B1325',
    fontSize: 14,
    fontWeight: '800',
  },
  startTripGroup: {
    marginTop: 4,
  },
  pinVerifyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  startTripBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHelpText: {
    fontSize: 11,
    marginTop: 4,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 10,
  },
  cancelLinkText: {
    color: '#FF5252',
    fontSize: 12,
    fontWeight: '600',
  },
  demandWidget: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    elevation: 10,
    zIndex: 10,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  requestCount: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
  },
  widgetTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneText: {
    fontSize: 13,
  },
  highBadge: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  highBadgeText: {
    color: '#FF5252',
    fontSize: 10,
    fontWeight: '800',
  },
  medBadge: {
    backgroundColor: 'rgba(255, 214, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  medBadgeText: {
    color: '#FFD600',
    fontSize: 10,
    fontWeight: '800',
  },
  goOnlineBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  goOnlineText: {
    color: '#0B1325',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryAction: {
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
