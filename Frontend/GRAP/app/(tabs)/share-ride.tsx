import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useResponsive } from '../../utils/responsive';

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
    setSearchResults(null);
    try {
      const res = await api.searchSharedRides({
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_lat: destLat,
        destination_lng: destLng,
      });
      setSearchResults(res.shareable_rides);
    } catch (e: any) {
      Alert.alert('Search Error', e.message || 'Failed to search shared rides');
    } finally {
      setSearching(false);
    }
  };

  const handleJoinSharedRide = async (sharedItem: any) => {
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
        'Joined Shared Ride!',
        `You joined ride #${sharedItem.primary_ride_id}.\nYour allocated fare: ${res.allocated_fare} FCFA`,
        [{ 
          text: 'Go to Active Ride', 
          onPress: () => router.push({
            pathname: '/rides',
            params: {
              ride_id: String(sharedItem.primary_ride_id),
              pay: 'CASH',
              pickup: pickupName,
              dest: destName,
              fare: String(res.allocated_fare || 800),
              pickup_lat: String(pickupLat),
              pickup_lng: String(pickupLng),
              dest_lat: String(destLat),
              dest_lng: String(destLng),
            },
          }) 
        }]
      );
    } catch (e: any) {
      Alert.alert('Error Joining', e.message || 'Could not join shared ride');
    } finally {
      setJoiningId(null);
    }
  };

  const handleMakeShareable = async () => {
    setMakeShareableLoading(true);
    try {
      // Create a base ride request first, then make shareable
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
        'Ride Made Shareable!',
        `Your ride #${newRide.id} is now available for compatible passengers to join on route.`,
        [{ text: 'View Status', onPress: () => router.push('/active-ride') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to make ride shareable');
    } finally {
      setMakeShareableLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Header Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={24} color="#00E676" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Voluntary Dynamic Ride-Sharing</Text>
          <Text style={styles.infoBody}>
            GRAP matches passengers with compatible routes. Rides are split using our fair proportional fare algorithm!
          </Text>
        </View>
      </View>

      {/* Location Input Card */}
      <View style={styles.inputCard}>
        <Text style={styles.cardHeader}>Enter Desired Route</Text>
        
        <View style={styles.inputRow}>
          <Ionicons name="radio-button-on" size={18} color="#00E676" />
          <TextInput
            style={styles.input}
            value={pickupName}
            onChangeText={setPickupName}
            placeholder="Pickup Location"
            placeholderTextColor="#78909C"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.inputRow}>
          <Ionicons name="location-sharp" size={18} color="#FF5252" />
          <TextInput
            style={styles.input}
            value={destName}
            onChangeText={setDestName}
            placeholder="Destination"
            placeholderTextColor="#78909C"
          />
        </View>
      </View>

      {/* Primary Search Button */}
      <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSharedRides} disabled={searching}>
        {searching ? (
          <ActivityIndicator color="#0B1325" />
        ) : (
          <>
            <Ionicons name="search" size={20} color="#0B1325" style={{ marginRight: 8 }} />
            <Text style={styles.searchBtnText}>Search Compatible Shared Rides</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Search Results Display */}
      {searchResults !== null && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            {searchResults.length > 0
              ? `Found ${searchResults.length} Compatible Shared Ride(s)`
              : 'No Compatible Shared Ride Available Currently'}
          </Text>

          {searchResults.length > 0 ? (
            searchResults.map((item, index) => (
              <View key={index} style={styles.matchCard}>
                <View style={styles.matchBadgeRow}>
                  <View style={styles.seatsBadge}>
                    <Ionicons name="person" size={12} color="#00E676" />
                    <Text style={styles.seatsBadgeText}>{item.available_seats} seat(s) left</Text>
                  </View>
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>Save {item.savings_percentage}%</Text>
                  </View>
                </View>

                <Text style={styles.matchRoute}>
                  {item.pickup_name} ➔ {item.destination_name}
                </Text>

                <View style={styles.fareBreakdownBox}>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Normal Solo Fare:</Text>
                    <Text style={styles.soloFareStrike}>{item.normal_solo_fare} FCFA</Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabelBold}>Proportional Shared Fare:</Text>
                    <Text style={styles.sharedFareHighlight}>{item.proportional_shared_fare} FCFA</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.joinBtn}
                  onPress={() => handleJoinSharedRide(item)}
                  disabled={joiningId === item.shared_ride_id || (item.available_seats || 0) <= 0}
                >
                  {joiningId === item.shared_ride_id ? (
                    <ActivityIndicator color="#0B1325" />
                  ) : (
                    <Text style={styles.joinBtnText}>
                      {(item.available_seats || 0) <= 0 ? 'Ride Full' : 'Join This Shared Ride'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          ) : (
            /* Option when NO match exists: Make My Ride Shareable */
            <View style={styles.noMatchCard}>
              <Ionicons name="sparkles-outline" size={36} color="#00E676" style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={styles.noMatchHeading}>Be the First Shareable Passenger!</Text>
              <Text style={styles.noMatchText}>
                No ride is heading your exact way right now. You can create a new ride and make it shareable so future riders on your route can join you!
              </Text>

              <TouchableOpacity
                style={styles.makeShareableBtn}
                onPress={handleMakeShareable}
                disabled={makeShareableLoading}
              >
                {makeShareableLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.makeShareableBtnText}>Make My Ride Shareable</Text>
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
    backgroundColor: '#0A0F1D',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    gap: 12,
    marginBottom: 16,
  },
  infoTitle: {
    color: '#00E676',
    fontSize: 14,
    fontWeight: '700',
  },
  infoBody: {
    color: '#90A4AE',
    fontSize: 12,
    marginTop: 2,
  },
  inputCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    marginBottom: 16,
  },
  cardHeader: {
    color: '#ECEFF1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    color: '#FFFFFF',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E2D4A',
    marginVertical: 8,
    marginLeft: 28,
  },
  searchBtn: {
    backgroundColor: '#00E676',
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
    color: '#ECEFF1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  matchCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2D4A',
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
    backgroundColor: '#1E2D4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  seatsBadgeText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  fareBreakdownBox: {
    backgroundColor: '#0A0F1D',
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
    color: '#78909C',
    fontSize: 13,
  },
  soloFareStrike: {
    color: '#78909C',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  fareLabelBold: {
    color: '#ECEFF1',
    fontSize: 14,
    fontWeight: '700',
  },
  sharedFareHighlight: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '800',
  },
  joinBtn: {
    backgroundColor: '#00E676',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#0B1325',
    fontWeight: '700',
    fontSize: 14,
  },
  noMatchCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    alignItems: 'center',
  },
  noMatchHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  noMatchText: {
    color: '#90A4AE',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  makeShareableBtn: {
    backgroundColor: '#29B6F6',
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeShareableBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
