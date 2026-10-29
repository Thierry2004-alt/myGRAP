import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useResponsive } from '../../utils/responsive';

const YAOUNDE_HUBS = [
  { name: 'Mvan Bus Station', lat: 3.8400, lng: 11.5000 },
  { name: 'Odza Borne 12', lat: 3.7741, lng: 11.5372 },
  { name: 'Bastos Ambassades', lat: 3.8750, lng: 11.5180 },
  { name: 'IAI Cameroun (Awae)', lat: 3.8565, lng: 11.5512 },
  { name: 'Centre-Ville', lat: 3.8660, lng: 11.5170 },
  { name: 'Mokolo Marché', lat: 3.8730, lng: 11.4980 },
];

export default function VoluntaryShareRideScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { horizontalScale, verticalScale, moderateScale, fontScale } = useResponsive();

  const [pickupName, setPickupName] = useState('Mvan Bus Station, Yaounde');
  const [pickupLat, setPickupLat] = useState(3.8400);
  const [pickupLng, setPickupLng] = useState(11.5000);

  const [destName, setDestName] = useState('Bastos Ambassades, Yaounde');
  const [destLat, setDestLat] = useState(3.8750);
  const [destLng, setDestLng] = useState(11.5180);

  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [makeShareableLoading, setMakeShareableLoading] = useState(false);

  const handleSearchSharedRides = async () => {
    setSearching(true);
    try {
      const res = await api.searchSharedRides({
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_lat: destLat,
        destination_lng: destLng,
      });
      setSearchResults(res.shareable_rides || []);
    } catch (e: any) {
      console.log('Search shared rides error:', e?.message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void handleSearchSharedRides();
    }, [pickupLat, pickupLng, destLat, destLng])
  );

  const handleJoinSharedRide = async (sharedItem: any) => {
    if (sharedItem.is_own_ride) {
      router.push({
        pathname: '/rides',
        params: {
          ride_id: String(sharedItem.primary_ride_id),
          shared: '1',
        },
      });
      return;
    }

    if (joiningId === sharedItem.shared_ride_id || (sharedItem.available_seats || 0) <= 0) return;
    setJoiningId(sharedItem.shared_ride_id);
    try {
      const res = await api.joinSharedRide({
        shared_ride_id: sharedItem.shared_ride_id,
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_name: destName,
        destination_lat: destLat,
        destination_lng: destLng,
        allocated_shared_fare: sharedItem.proportional_shared_fare,
      });

      Alert.alert(
        t('Joined Shared Ride!'),
        t('You joined ride #{id}.\nYour allocated fare: {fare} FCFA')
          .replace('{id}', String(sharedItem.primary_ride_id))
          .replace('{fare}', Number(res.allocated_fare || sharedItem.proportional_shared_fare).toLocaleString()),
        [{ 
          text: t('Go to Active Ride'),
          onPress: () => router.push({
            pathname: '/rides',
            params: {
              ride_id: String(sharedItem.primary_ride_id),
              shared: '1',
              pay: 'CASH',
              pickup: pickupName,
              dest: destName,
              fare: String(res.allocated_fare || sharedItem.proportional_shared_fare || 800),
              pickup_lat: String(pickupLat),
              pickup_lng: String(pickupLng),
              dest_lat: String(destLat),
              dest_lng: String(destLng),
            },
          }) 
        }]
      );
      await handleSearchSharedRides();
    } catch (e: any) {
      const msg = e.message || 'Could not join shared ride';
      console.error('Join shared ride error:', msg);
      Alert.alert(t('Error Joining'), t(msg));
    } finally {
      setJoiningId(null);
    }
  };

  const handleMakeShareable = async () => {
    setMakeShareableLoading(true);
    try {
      const cats = await api.getCategories();
      const economyCat = cats[0] || { id: 1 };
      
      const newRide = await api.requestRide({
        category_id: economyCat.id,
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_name: destName,
        destination_lat: destLat,
        destination_lng: destLng,
      });

      const res = await api.makeRideShareable(newRide.id);
      Alert.alert(
        t('Ride Made Shareable!'),
        t('Your ride #{id} is now available for compatible passengers to join on route.').replace('{id}', String(newRide.id)),
        [{ text: t('View Status'), onPress: () => router.push({ pathname: '/rides', params: { ride_id: String(newRide.id), pay: 'CASH', pickup: pickupName, dest: destName } }) }]
      );
    } catch (e: any) {
      const msg = e.message || 'Failed to make ride shareable';
      console.error('Make shareable error:', msg);
      Alert.alert(t('Error'), t(msg));
    } finally {
      setMakeShareableLoading(false);
    }
  };

  const setHubPickup = (hub: typeof YAOUNDE_HUBS[0]) => {
    setPickupName(hub.name);
    setPickupLat(hub.lat);
    setPickupLng(hub.lng);
  };

  const setHubDest = (hub: typeof YAOUNDE_HUBS[0]) => {
    setDestName(hub.name);
    setDestLat(hub.lat);
    setDestLng(hub.lng);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Header Info Banner */}
      <View style={[styles.infoBanner, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}>
        <Ionicons name="people" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>{t('Voluntary Dynamic Ride-Sharing')}</Text>
          <Text style={[styles.infoBody, { color: colors.subText }]}>
            {t('GRAP matches passengers with compatible routes. Fares are split fairly proportional to distance!')}
          </Text>
        </View>
      </View>

      {/* Location Input Card */}
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardHeader, { color: colors.text }]}>{t('Enter Desired Route')}</Text>
        
        <View style={styles.inputRow}>
          <Ionicons name="radio-button-on" size={18} color={colors.primary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={pickupName}
            onChangeText={setPickupName}
            placeholder={t('Pickup Location')}
            placeholderTextColor={colors.subText}
          />
        </View>

        {/* Quick Yaoundé Hub Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingLeft: 26 }}>
            {YAOUNDE_HUBS.map((hub, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.hubChip,
                  { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}35` },
                  pickupName.includes(hub.name) && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setHubPickup(hub)}
              >
                <Text style={[styles.hubChipText, { color: pickupName.includes(hub.name) ? '#0B1325' : colors.text }]}>
                  {hub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <View style={styles.inputRow}>
          <Ionicons name="location-sharp" size={18} color="#FF5252" />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={destName}
            onChangeText={setDestName}
            placeholder={t('Destination')}
            placeholderTextColor={colors.subText}
          />
        </View>

        {/* Quick Yaoundé Hub Chips for Destination */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingLeft: 26 }}>
            {YAOUNDE_HUBS.map((hub, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.hubChip,
                  { backgroundColor: '#FF525215', borderColor: '#FF525235' },
                  destName.includes(hub.name) && { backgroundColor: '#FF5252', borderColor: '#FF5252' }
                ]}
                onPress={() => setHubDest(hub)}
              >
                <Text style={[styles.hubChipText, { color: destName.includes(hub.name) ? '#FFFFFF' : colors.text }]}>
                  {hub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Primary Search Button */}
      <TouchableOpacity
        style={[styles.searchBtn, { backgroundColor: colors.primary }]}
        onPress={handleSearchSharedRides}
        disabled={searching}
      >
        {searching ? (
          <ActivityIndicator color="#0B1325" />
        ) : (
          <>
            <Ionicons name="search" size={20} color="#0B1325" style={{ marginRight: 8 }} />
            <Text style={styles.searchBtnText}>{t('Search Compatible Shared Rides')}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Search Results Display */}
      {searchResults !== null && (
        <View style={styles.resultsContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.resultsTitle, { color: colors.text, marginBottom: 0 }]}>
              {searchResults.length > 0
                ? `Found ${searchResults.length} Compatible Shared Ride(s)`
                : t('No Compatible Shared Ride Available Currently')}
            </Text>
            <TouchableOpacity onPress={handleSearchSharedRides} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{t('Refresh')}</Text>
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 ? (
            searchResults.map((item, index) => (
              <View key={index} style={[styles.matchCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {/* Header: vehicle info + seats */}
                <View style={styles.matchBadgeRow}>
                  <View style={[styles.seatsBadge, { backgroundColor: `${colors.primary}18` }]}>
                    <Ionicons name="person" size={12} color={colors.primary} />
                    <Text style={[styles.seatsBadgeText, { color: colors.primary }]}>
                      💺 {item.available_seats ?? 0}/{item.total_capacity ?? 4} Places
                    </Text>
                  </View>
                  {item.is_own_ride ? (
                    <View style={styles.ownRideBadge}>
                      <Ionicons name="sparkles" size={12} color="#00E676" />
                      <Text style={styles.ownRideBadgeText}>{t('Your Ride (Initiator)')}</Text>
                    </View>
                  ) : (item.savings_percentage ?? 0) > 0 ? (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>{t('Save {percentage}%').replace('{percentage}', String(item.savings_percentage))}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Vehicle Info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  {item.car_color_hex ? (
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.car_color_hex, marginRight: 6, borderWidth: 1.5, borderColor: '#FFFFFF' }} />
                  ) : null}
                  <Ionicons name="car-sport" size={14} color="#FFD600" style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {item.car_model
                      ? `${item.car_color ? item.car_color + ' ' : ''}${item.car_make ? item.car_make + ' ' : ''}${item.car_model}${item.license_plate ? ' \u2022 ' + item.license_plate : ''}`
                      : (item.category_name || 'Economy') + ' Ride'}
                  </Text>
                </View>

                {/* Route */}
                <Text style={[styles.matchRoute, { color: colors.text }]}>
                  {item.pickup_name} ➔ {item.destination_name}
                </Text>

                {/* Driver or Initiator info with Profile Picture */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}20`, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    {item.initiator_profile_picture_url ? (
                      <Image source={{ uri: item.initiator_profile_picture_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                      <Ionicons name="person" size={16} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                      {item.initiator_name || item.initiator_username || 'Passenger'} <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>(Initiator)</Text>
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 11 }}>
                    {item.driver_name ? `${t('Driver:')} ${item.driver_name} (${item.driver_rating ?? '4.9'}★)` : t('Awaiting driver assignment')}
                    </Text>
                  </View>
                </View>

                {/* Fare Breakdown */}
                <View style={[styles.fareBreakdownBox, { backgroundColor: `${colors.cardBorder}30` }]}>
                  <View style={styles.fareRow}>
                    <Text style={[styles.fareLabel, { color: colors.subText }]}>Your route: {item.solo_distance_km} km</Text>
                    <Text style={[styles.fareLabel, { color: colors.subText }]}>{item.total_route_km} km total route</Text>
                  </View>
                  {(item.passenger_solo_cost ?? 0) > 0 && (
                    <View style={styles.fareRow}>
                      <Text style={[styles.fareLabel, { color: colors.subText }]}>{t('Solo cost:')}</Text>
                      <Text style={[styles.soloFareStrike, { color: colors.subText }]}>{Math.round(item.passenger_solo_cost).toLocaleString()} FCFA</Text>
                    </View>
                  )}
                  <View style={styles.fareRow}>
                    <Text style={[styles.fareLabelBold, { color: colors.text }]}>{t('Your Shared Fare:')}</Text>
                    <Text style={[styles.sharedFareHighlight, { color: colors.primary }]}>{Math.round(item.proportional_shared_fare).toLocaleString()} FCFA</Text>
                  </View>
                </View>

                {item.is_own_ride ? (
                  <TouchableOpacity
                    style={[styles.viewRideBtn, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}
                    onPress={() => handleJoinSharedRide(item)}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.viewRideBtnText, { color: colors.primary }]}>
                      {t('View My Active Ride')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.joinBtn,
                      { backgroundColor: colors.primary },
                      (item.available_seats || 0) <= 0 && styles.joinBtnDisabled,
                    ]}
                    onPress={() => handleJoinSharedRide(item)}
                    disabled={joiningId === item.shared_ride_id || (item.available_seats || 0) <= 0}
                  >
                    {joiningId === item.shared_ride_id ? (
                      <ActivityIndicator color="#0B1325" />
                    ) : (
                      <Text style={styles.joinBtnText}>
                        {(item.available_seats || 0) <= 0
                          ? t('Ride Full')
                          : `${t('Join This Ride')} (${Math.round(item.proportional_shared_fare).toLocaleString()} FCFA)`}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            /* Option when NO match exists: Make My Ride Shareable */
            <View style={[styles.noMatchCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="sparkles-outline" size={36} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={[styles.noMatchHeading, { color: colors.text }]}>{t('Be the First Shareable Passenger!')}</Text>
              <Text style={[styles.noMatchText, { color: colors.subText }]}>
                {t('No ride is heading your exact way right now. You can create a new ride and make it shareable so future riders on your route can join you!')}
              </Text>

              <TouchableOpacity
                style={[styles.makeShareableBtn, { backgroundColor: colors.primary }]}
                onPress={handleMakeShareable}
                disabled={makeShareableLoading}
              >
                {makeShareableLoading ? (
                  <ActivityIndicator color="#0B1325" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#0B1325" style={{ marginRight: 8 }} />
                    <Text style={[styles.makeShareableBtnText, { color: '#0B1325' }]}>{t('Make My Ride Shareable')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoBody: {
    fontSize: 12,
    marginTop: 2,
  },
  inputCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  hubChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  hubChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginLeft: 28,
  },
  searchBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBtnText: {
    color: '#0B1325',
    fontSize: 16,
    fontWeight: '700',
  },
  resultsContainer: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  matchCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  matchBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  seatsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ownRideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 1,
    borderColor: '#00E676',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ownRideBadgeText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '700',
  },
  savingsBadge: {
    backgroundColor: '#FF6D00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  matchRoute: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  fareBreakdownBox: {
    padding: 12,
    borderRadius: 10,
    gap: 6,
    marginBottom: 12,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 13,
  },
  soloFareStrike: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  fareLabelBold: {
    fontSize: 14,
    fontWeight: '700',
  },
  sharedFareHighlight: {
    fontSize: 18,
    fontWeight: '800',
  },
  joinBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinBtnDisabled: {
    backgroundColor: '#37474F',
  },
  joinBtnText: {
    color: '#0B1325',
    fontWeight: '700',
    fontSize: 14,
  },
  viewRideBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewRideBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  noMatchCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  noMatchHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  noMatchText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  makeShareableBtn: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeShareableBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
