import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LeafletMap from '../../components/LeafletMap';
import { api } from '../../services/api';
import { searchPlaces, reverseGeocode, PlaceSuggestion, calculateMultiFactorCategoryFare, getDrivingDistanceKm } from '../../services/geocoding';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useResponsive } from '../../utils/responsive';
import * as Location from 'expo-location';

export default function PassengerHomeScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { horizontalScale, verticalScale, moderateScale, fontScale, isDesktop, screenWidth, screenHeight } = useResponsive();

  const [pickupName, setPickupName] = useState('IAI Cameroun, Awae Escalier, Yaoundé');
  const [pickupLat, setPickupLat] = useState(3.856500);
  const [pickupLng, setPickupLng] = useState(11.551200);

  const [destName, setDestName] = useState('');
  const [destLat, setDestLat] = useState(3.8400);
  const [destLng, setDestLng] = useState(11.5000);

  // Live Autocomplete Suggestions State
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [showGreeting, setShowGreeting] = useState(true);

  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [categoryFares, setCategoryFares] = useState<{ [catId: number]: number }>({});
  const [rideMode, setRideMode] = useState<'PRIVATE' | 'SHARED'>('PRIVATE');

  // PAYMENT METHOD STATE: MTN_MOMO | ORANGE_MONEY | CASH
  const [paymentMethod, setPaymentMethod] = useState<'MTN_MOMO' | 'ORANGE_MONEY' | 'CASH'>('CASH');

  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [sharedMatches, setSharedMatches] = useState<any[] | null>(null);
  const [searchingShared, setSearchingShared] = useState(false);

  useEffect(() => {
    loadCategories();
    const greetingTimer = setTimeout(() => setShowGreeting(false), 4500);
    return () => clearTimeout(greetingTimer);
  }, []);

  useEffect(() => {
    if (user && user.role === 'PASSENGER' && !user.is_verified) {
      const reminder = setTimeout(() => {
        Alert.alert(
          'Verify your email',
          `Protect your GRAP account by verifying ${user.email}. You can do this from your Profile.`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Profile', onPress: () => router.push('/profile') },
          ],
        );
      }, 900);
      return () => clearTimeout(reminder);
    }
  }, [user?.id, user?.is_verified]);

  const loadCategories = async () => {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategory(cats[0]);
      }
    } catch (e) {
      console.log('Error loading categories:', e);
    }
  };

  useEffect(() => {
    void handleSyncCurrentLocation();
  }, []);

  const handleSyncCurrentLocation = async () => {
    const applyPosition = async (latitude: number, longitude: number, isFallback = false) => {
      const lat = Number(latitude.toFixed(6));
      const lng = Number(longitude.toFixed(6));
      setPickupLat(lat);
      setPickupLng(lng);

      try {
        const rev = await reverseGeocode(lat, lng);
        const displayName = rev.name || rev.address;
        setPickupName(displayName && !displayName.includes('Pinned location') ? displayName : `GPS Position (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } catch {
        setPickupName(`GPS Position (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }

      if (categories.length > 0) void calculateFaresForCategories(categories, destLat, destLng, lat, lng);
      setFeedbackToast(isFallback ? 'Position set to Yaoundé Centre-Ville (Allow browser GPS for exact pin)' : `Pickup synced to GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      setTimeout(() => setFeedbackToast(null), 4000);
    };

    const getBrowserPosition = () => new Promise<any>((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Browser location is unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        () => {
          // Second attempt: low accuracy (WiFi / IP network geolocation)
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 60000,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 30000,
        }
      );
    });

    if (Platform.OS === 'web') {
      try {
        const browserPos = await getBrowserPosition();
        await applyPosition(browserPos.coords.latitude, browserPos.coords.longitude);
        return;
      } catch (browserError) {
        console.log('Browser direct location failed, setting exact position to IAI Cameroun (Awae):', browserError);
        // Default position set to IAI Cameroun (Awae Escalier, Yaoundé)
        await applyPosition(3.856500, 11.551200, true);
        setPickupName('IAI Cameroun, Awae Escalier, Yaoundé');
        return;
      }
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPickupName('Choose a pickup location');
        setFeedbackToast('Location permission is required for accurate pickup');
        setTimeout(() => setFeedbackToast(null), 3000);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeout: 10000,
      });
      await applyPosition(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      console.log('Location error:', error);
      await applyPosition(3.856500, 11.551200, true);
      setPickupName('IAI Cameroun, Awae Escalier, Yaoundé');
    }
  };

  const handleSearchTextChange = async (text: string) => {
    setDestName(text);
    if (text.trim().length > 0) {
      const results = await searchPlaces(text);
      setSuggestions(results);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (place: PlaceSuggestion) => {
    setShowSuggestions(false);
    setDestName(place.name);
    setDestLat(place.latitude);
    setDestLng(place.longitude);
    setSharedMatches(null);

    if (categories.length > 0) {
      void calculateFaresForCategories(categories, place.latitude, place.longitude);
    }

    setFeedbackToast(`Selected: ${place.name}`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleMapLocationSelected = async (lat: number, lng: number) => {
    const place = await reverseGeocode(lat, lng);
    handleSelectSuggestion(place);
  };

  const calculateFaresForCategories = async (allCats: any[], dLat = destLat, dLng = destLng, pLat = pickupLat, pLng = pickupLng) => {
    setLoading(true);
    try {
      const dLatRad = (dLat - pLat) * (Math.PI / 180);
      const dLngRad = (dLng - pLng) * (Math.PI / 180);
      const a =
        Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
        Math.cos(pLat * (Math.PI / 180)) *
          Math.cos(dLat * (Math.PI / 180)) *
          Math.sin(dLngRad / 2) *
          Math.sin(dLngRad / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const straightLineDistance = 6371 * c;
      const roadDistance = await getDrivingDistanceKm(pLat, pLng, dLat, dLng);
      const calculatedDist = roadDistance ?? Number(straightLineDistance.toFixed(2));
      const validDist = calculatedDist < 0.1 ? 0.1 : calculatedDist;

      setDistanceKm(validDist);

      const fareMap: { [catId: number]: number } = {};
      allCats.forEach((cat) => {
        fareMap[cat.id] = calculateMultiFactorCategoryFare(validDist, cat.code);
      });

      setCategoryFares(fareMap);

      const activeCat = selectedCategory || allCats[0];
      setEstimatedFare(fareMap[activeCat.id] || fareMap[allCats[0].id]);
    } catch (e) {
      console.log('Calculation error:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (pName: string, pLat: number, pLng: number, dName: string, dLat: number, dLng: number) => {
    setPickupName(pName);
    setPickupLat(pLat);
    setPickupLng(pLng);
    setDestName(dName);
    setDestLat(dLat);
    setDestLng(dLng);
    setShowSuggestions(false);
    setSharedMatches(null);
    if (categories.length > 0) {
      void calculateFaresForCategories(categories, dLat, dLng);
    }
    setFeedbackToast(`Route set: ${pName} ➔ ${dName}`);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleSearchSharedRides = async () => {
    setSearchingShared(true);
    setSharedMatches(null);
    try {
      const res = await api.searchSharedRides({
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_lat: destLat,
        destination_lng: destLng,
      });
      setSharedMatches(res.shareable_rides);
    } catch (e: any) {
      Alert.alert('Search Error', e.message || 'Could not search shared rides');
    } finally {
      setSearchingShared(false);
    }
  };

  const handleRequestRide = async () => {
    if (!selectedCategory) return;
    setRequesting(true);
    try {
      const ride = await api.requestRide({
        category_id: selectedCategory.id,
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_name: destName,
        destination_lat: destLat,
        destination_lng: destLng,
        payment_method: paymentMethod,
      });

      const rideId = ride?.id || Math.floor(Math.random() * 1000) + 1;

      if (rideMode === 'SHARED') {
        await api.makeRideShareable(rideId);
        Alert.alert(
          'Shareable Ride Requested!',
          `Ride #${rideId} requested. Payment: ${paymentMethod}.\nMatching driver...`,
          [
            {
              text: 'Track Ride',
              onPress: () =>
                router.push({
                  pathname: '/rides',
                  params: {
                    ride_id: String(rideId),
                    pay: paymentMethod,
                    pickup: pickupName,
                    dest: destName,
                    fare: String(estimatedFare || 1300),
                  },
                }),
            },
          ]
        );
      } else {
        Alert.alert(
          'Private Ride Requested!',
          `Ride #${rideId} requested. Payment: ${paymentMethod}.\nMatching driver...`,
          [
            {
              text: 'Track Ride',
              onPress: () =>
                router.push({
                  pathname: '/rides',
                  params: {
                    ride_id: String(rideId),
                    pay: paymentMethod,
                    pickup: pickupName,
                    dest: destName,
                    fare: String(estimatedFare || 1300),
                  },
                }),
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to request ride');
    } finally {
      setRequesting(false);
    }
  };

  const handleJoinSharedMatch = async (match: any) => {
    setRequesting(true);
    try {
      const res = await api.joinSharedRide({
        shared_ride_id: match.shared_ride_id,
        pickup_name: pickupName,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        destination_name: destName,
        destination_lat: destLat,
        destination_lng: destLng,
        allocated_shared_fare: match.proportional_shared_fare,
      });

      const rideId = match.primary_ride_id || Math.floor(Math.random() * 1000) + 1;

      Alert.alert(
        'Joined Shared Ride!',
        `Joined ride #${rideId}.\nFare: ${res.allocated_fare} FCFA via ${paymentMethod}`,
        [
          {
            text: 'Track Ride',
            onPress: () =>
              router.push({
                pathname: '/rides',
                params: {
                  ride_id: String(rideId),
                  pay: paymentMethod,
                  pickup: pickupName,
                  dest: destName,
                  fare: String(match.proportional_shared_fare || 800),
                  pickup_lat: String(pickupLat),
                  pickup_lng: String(pickupLng),
                  dest_lat: String(destLat),
                  dest_lng: String(destLng),
                },
              }),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to join shared ride');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* REAL LEAFLET / OPENSTREETMAP */}
      <LeafletMap
        pickupLat={pickupLat}
        pickupLng={pickupLng}
        destLat={destLat}
        destLng={destLng}
        pickupName={pickupName}
        destName={destName}
        onSelectLocation={(lat, lng) => { void handleMapLocationSelected(lat, lng); }}
      />

      {showGreeting && !showSuggestions && (
        <View style={[styles.greetingBanner, { backgroundColor: colors.card, borderColor: colors.primary, top: verticalScale(6), left: horizontalScale(20), right: horizontalScale(20), minHeight: verticalScale(42), paddingHorizontal: horizontalScale(13) }]}>
          <Ionicons name="sunny-outline" size={moderateScale(18)} color={colors.primary} />
          <Text style={[styles.greetingText, { color: colors.text, fontSize: fontScale(12) }]}>Welcome to GRAP. Where are you headed?</Text>
        </View>
      )}

      {/* Floating Search Bar with Live Autocomplete */}
      <View style={[
        styles.floatingSearchContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          top: verticalScale(54),
          left: isDesktop ? horizontalScale(24) : horizontalScale(16),
          right: isDesktop ? undefined : horizontalScale(16),
          width: isDesktop ? Math.min(horizontalScale(520), screenWidth - horizontalScale(48)) : undefined,
          paddingHorizontal: horizontalScale(14),
          paddingVertical: verticalScale(4),
        }
      ]}>
        <View style={styles.searchBarRow}>
          <Ionicons name="search" size={moderateScale(20)} color={colors.primary} style={{ marginRight: horizontalScale(8) }} />
          <TextInput
            style={[styles.floatingSearchInput, { color: colors.text, fontSize: fontScale(14) }]}
            value={destName}
            onChangeText={handleSearchTextChange}
            onFocus={async () => {
              const res = await searchPlaces(destName);
              setSuggestions(res);
              setShowSuggestions(true);
            }}
            placeholder="Where are we going today?"
            placeholderTextColor={colors.subText}
          />
          {destName.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchTextChange('')} style={{ padding: horizontalScale(4) }}>
              <Ionicons name="close-circle" size={moderateScale(18)} color={colors.subText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Live Autocomplete Suggestions Overlay */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={[styles.suggestionsDropdown, { backgroundColor: colors.card, borderColor: colors.primary, marginTop: verticalScale(6), marginBottom: verticalScale(8), maxHeight: verticalScale(240) }]}>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.suggestionItem, { borderBottomColor: colors.cardBorder, paddingVertical: verticalScale(12), paddingHorizontal: horizontalScale(12), gap: horizontalScale(10) }]}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.suggestionIconBadge, { backgroundColor: `${colors.primary}20`, width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14) }]}>
                  <Ionicons name="location" size={moderateScale(16)} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestionName, { color: colors.text, fontSize: fontScale(14) }]}>{item.name}</Text>
                  <Text style={[styles.suggestionSub, { color: colors.subText, fontSize: fontScale(11) }]}>{item.address}</Text>
                </View>
                <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Feedback Toast */}
      {feedbackToast && !showSuggestions && (
        <View style={[
          styles.toastBanner,
          { backgroundColor: colors.primary, top: verticalScale(112), paddingHorizontal: horizontalScale(14), paddingVertical: verticalScale(6), borderRadius: moderateScale(20), gap: horizontalScale(6) }
        ]}>
          <Ionicons name="checkmark-circle" size={moderateScale(16)} color="#0B1325" />
          <Text style={[styles.toastText, { fontSize: fontScale(12) }]}>{feedbackToast}</Text>
        </View>
      )}

      {/* Floating Location Presets */}
      {!showSuggestions && !feedbackToast && (
        <View style={[styles.floatingChipsRow, { top: verticalScale(118), left: horizontalScale(16), gap: horizontalScale(8) }]}>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.cardBorder, paddingHorizontal: horizontalScale(12), paddingVertical: verticalScale(6), borderRadius: moderateScale(16), gap: horizontalScale(6) }]}
            onPress={() => selectPreset('Mvan Bus Station', 3.8400, 11.5000, 'Bastos Ambassades', 3.8750, 11.5180)}
          >
            <Ionicons name="flash" size={moderateScale(12)} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.text, fontSize: fontScale(12) }]}>{t('mvanToBastos')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.cardBorder, paddingHorizontal: horizontalScale(12), paddingVertical: verticalScale(6), borderRadius: moderateScale(16), gap: horizontalScale(6) }]}
            onPress={() => selectPreset('Mokolo Market', 3.8680, 11.5050, 'Biyem-Assi Carrefour', 3.8320, 11.4900)}
          >
            <Ionicons name="location" size={moderateScale(12)} color={colors.secondary} />
            <Text style={[styles.chipText, { color: colors.text, fontSize: fontScale(12) }]}>{t('mokoloToBiyem')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* BOTTOM SLIDE-UP BOOKING DRAWER */}
      <View style={[
        styles.bottomDrawer,
        {
          backgroundColor: colors.card, 
          borderTopColor: colors.cardBorder, 
          padding: horizontalScale(16), 
          borderTopLeftRadius: verticalScale(24),
          borderTopRightRadius: verticalScale(24),
          ...(isDesktop ? {
            left: undefined,
            right: horizontalScale(24),
            bottom: verticalScale(24),
            width: Math.min(horizontalScale(440), screenWidth - horizontalScale(48)),
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderRadius: verticalScale(20),
          } : {}),
        }
      ]}>
        <View style={[styles.drawerHandle, { backgroundColor: colors.subText, width: horizontalScale(40), height: verticalScale(4), borderRadius: verticalScale(2), marginBottom: verticalScale(12), alignSelf: 'center' }]} />

        <ScrollView style={{ maxHeight: isDesktop ? screenHeight - verticalScale(170) : verticalScale(370) }} showsVerticalScrollIndicator={false}>
          {/* Pickup & Destination Inputs with GPS Sync Button */}
          <View style={[styles.routeBox, { backgroundColor: colors.inputBg, padding: horizontalScale(12), borderRadius: moderateScale(14), marginBottom: verticalScale(12) }]}>
            <View style={styles.inputRow}>
              <View style={[styles.greenDot, { backgroundColor: colors.primary, width: moderateScale(10), height: moderateScale(10), borderRadius: moderateScale(5), marginLeft: horizontalScale(3) }]} />
              <TextInput
                style={[styles.routeInput, { color: colors.text, fontSize: fontScale(14), height: verticalScale(36) }]}
                value={pickupName}
                onChangeText={setPickupName}
                placeholder="Pickup Location"
                placeholderTextColor={colors.subText}
              />
              <TouchableOpacity
                style={[styles.gpsSyncBtn, { backgroundColor: `${colors.primary}20`, width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14) }]}
                onPress={handleSyncCurrentLocation}
              >
                <Ionicons name="locate" size={moderateScale(18)} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputDivider, { backgroundColor: colors.cardBorder, height: 1, marginVertical: verticalScale(6), marginLeft: horizontalScale(24) }]} />

            <View style={styles.inputRow}>
              <Ionicons name="location-sharp" size={moderateScale(16)} color="#FF5252" />
              <TextInput
                style={[styles.routeInput, { color: colors.text, fontSize: fontScale(14), height: verticalScale(36) }]}
                value={destName}
                onChangeText={setDestName}
                placeholder="Where are we going today?"
              />
            </View>
          </View>

          {/* High Precision Pickup Shortcut Pills for Web */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(10) }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.primary}20`, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 }}
              onPress={() => {
                setPickupLat(3.856500);
                setPickupLng(11.551200);
                setPickupName("IAI Cameroun, Awae Escalier, Yaoundé");
                setFeedbackToast("Pickup set to IAI Cameroun (3.8565, 11.5512)");
                setTimeout(() => setFeedbackToast(null), 3000);
              }}
            >
              <Ionicons name="location" size={13} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>IAI Cameroun (Awae)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 }}
              onPress={() => {
                setPickupLat(3.805000);
                setPickupLng(11.538000);
                setPickupName("Carrefour Messamendongo, Yaoundé");
                setFeedbackToast("Pickup set to Carrefour Messamendongo");
                setTimeout(() => setFeedbackToast(null), 3000);
              }}
            >
              <Ionicons name="location-outline" size={13} color={colors.text} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>Messamendongo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 }}
              onPress={() => {
                setPickupLat(3.875000);
                setPickupLng(11.518000);
                setPickupName("Bastos Ambassades, Yaoundé");
                setFeedbackToast("Pickup set to Bastos Ambassades");
                setTimeout(() => setFeedbackToast(null), 3000);
              }}
            >
              <Ionicons name="location-outline" size={13} color={colors.text} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>Bastos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 }}
              onPress={() => {
                setPickupLat(3.840000);
                setPickupLng(11.500000);
                setPickupName("Complexe Mvan, Yaoundé");
                setFeedbackToast("Pickup set to Mvan");
                setTimeout(() => setFeedbackToast(null), 3000);
              }}
            >
              <Ionicons name="location-outline" size={13} color={colors.text} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>Mvan</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Mode Switcher: Private Ride vs Voluntary Shared Ride */}
          <View style={[styles.modeToggleRow, { gap: horizontalScale(10), marginBottom: verticalScale(12) }]}>
            <TouchableOpacity
               style={[styles.modeTab, { backgroundColor: rideMode === 'PRIVATE' ? colors.primary : colors.inputBg, paddingVertical: verticalScale(10), borderRadius: moderateScale(12), gap: horizontalScale(6) }]}
              onPress={() => {
                setRideMode('PRIVATE');
                setSharedMatches(null);
              }}
            >
              <Ionicons name="car" size={moderateScale(16)} color={rideMode === 'PRIVATE' ? (mode === 'dark' ? '#0B1325' : '#FFFFFF') : colors.subText} style={styles.modeTabIcon} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.modeTabText, { fontSize: fontScale(13), color: rideMode === 'PRIVATE' ? (mode === 'dark' ? '#0B1325' : '#FFFFFF') : colors.subText }]}>
                {t('privateRide')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
               style={[styles.modeTab, { backgroundColor: rideMode === 'SHARED' ? colors.secondary : colors.inputBg, paddingVertical: verticalScale(10), borderRadius: moderateScale(12), gap: horizontalScale(6) }]}
              onPress={() => {
                setRideMode('SHARED');
                handleSearchSharedRides();
              }}
            >
              <Ionicons name="people" size={moderateScale(16)} color={rideMode === 'SHARED' ? '#FFFFFF' : colors.subText} style={styles.modeTabIcon} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.modeTabText, { fontSize: fontScale(13), color: rideMode === 'SHARED' ? '#FFFFFF' : colors.subText }]}>
                {t('voluntaryShareTab')}
              </Text>
              <View style={[styles.saveBadge, { backgroundColor: colors.accent, paddingHorizontal: horizontalScale(6), paddingVertical: verticalScale(2), borderRadius: moderateScale(4) }]}>
                <Text style={[styles.saveBadgeText, { color: '#172018', fontSize: fontScale(9) }]}>SAVE 40%</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Category Selector Grid */}
          <Text style={[styles.sectionTitle, { color: colors.subText, fontSize: fontScale(12), marginBottom: verticalScale(8) }]}>{t('selectCategory')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(12) }}>
            {categories.map((cat) => {
              const isSel = selectedCategory?.id === cat.id;
              const catFare = categoryFares[cat.id] ?? (distanceKm === null ? null : calculateMultiFactorCategoryFare(distanceKm, cat.code));
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryPill,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, paddingHorizontal: horizontalScale(14), paddingVertical: verticalScale(10), marginRight: horizontalScale(10), borderRadius: moderateScale(14), borderWidth: 1, minWidth: horizontalScale(95) },
                    isSel && { borderColor: colors.primary, backgroundColor: `${colors.primary}20` },
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setEstimatedFare(catFare);
                  }}
                >
                  <Ionicons
                    name={cat.code === 'MOTO' ? 'bicycle' : cat.code === 'COMFORT_PLUS' ? 'car-sport' : 'car'}
                    size={moderateScale(22)}
                    color={isSel ? colors.primary : colors.subText}
                  />
                  <Text style={[styles.categoryPillName, { color: isSel ? colors.primary : colors.subText, fontSize: fontScale(12), marginTop: verticalScale(4) }]}>
                    {cat.name}
                  </Text>
                  <Text style={[styles.categoryPillFare, { color: isSel ? colors.primary : colors.text, fontSize: fontScale(12), marginTop: verticalScale(2) }]}>
                    {catFare === null ? 'Set destination' : `${catFare} FCFA`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* PROFESSIONAL VECTOR BRANDING PAYMENT METHOD SELECTOR */}
          <Text style={[styles.sectionTitle, { color: colors.subText, fontSize: fontScale(12) }]}>Payment Method (Mode de Paiement)</Text>
          <View style={[styles.paymentMethodRow, { gap: horizontalScale(8), marginBottom: verticalScale(12) }]}>
            {/* MTN Mobile Money Pill */}
            <TouchableOpacity
              style={[
                styles.payCard,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, paddingVertical: verticalScale(8), paddingHorizontal: horizontalScale(6), borderRadius: moderateScale(12), borderWidth: 1.5 },
                paymentMethod === 'MTN_MOMO' && { borderColor: '#FFCC00', backgroundColor: 'rgba(255, 204, 0, 0.12)' },
              ]}
              onPress={() => setPaymentMethod('MTN_MOMO')}
            >
              <View style={[styles.payIconContainer, { backgroundColor: '#FFCC00', width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(12) }]}>
                <Ionicons name="wallet-sharp" size={moderateScale(14)} color="#000000" />
              </View>
              <Text style={[styles.payText, { fontSize: fontScale(10), marginTop: verticalScale(4), color: paymentMethod === 'MTN_MOMO' ? '#FFCC00' : '#94A3B8', fontWeight: paymentMethod === 'MTN_MOMO' ? '800' : '600' }]}>
                MTN MoMo
              </Text>
            </TouchableOpacity>

            {/* Orange Money Pill */}
            <TouchableOpacity
              style={[
                styles.payCard,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, paddingVertical: verticalScale(8), paddingHorizontal: horizontalScale(6), borderRadius: moderateScale(12), borderWidth: 1.5 },
                paymentMethod === 'ORANGE_MONEY' && { borderColor: '#FF6600', backgroundColor: 'rgba(255, 102, 0, 0.12)' },
              ]}
              onPress={() => setPaymentMethod('ORANGE_MONEY')}
            >
              <View style={[styles.payIconContainer, { backgroundColor: '#FF6600', width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(12) }]}>
                <Ionicons name="card-sharp" size={moderateScale(14)} color="#FFFFFF" />
              </View>
              <Text style={[styles.payText, { fontSize: fontScale(10), marginTop: verticalScale(4), color: paymentMethod === 'ORANGE_MONEY' ? '#FF6600' : '#94A3B8', fontWeight: paymentMethod === 'ORANGE_MONEY' ? '800' : '600' }]}>
                Orange Money
              </Text>
            </TouchableOpacity>

            {/* Cash Pill */}
            <TouchableOpacity
              style={[
                styles.payCard,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, paddingVertical: verticalScale(8), paddingHorizontal: horizontalScale(6), borderRadius: moderateScale(12), borderWidth: 1.5 },
                paymentMethod === 'CASH' && { borderColor: colors.primary, backgroundColor: 'rgba(0, 230, 118, 0.12)' },
              ]}
              onPress={() => setPaymentMethod('CASH')}
            >
              <View style={[styles.payIconContainer, { backgroundColor: colors.primary, width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(12) }]}>
                <Ionicons name="cash-sharp" size={moderateScale(14)} color="#0B1325" />
              </View>
              <Text style={[styles.payText, { fontSize: fontScale(10), marginTop: verticalScale(4), color: paymentMethod === 'CASH' ? colors.primary : '#94A3B8', fontWeight: paymentMethod === 'CASH' ? '800' : '600' }]}>
                Cash (OTP 4-PIN)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Shared Rides Matches */}
          {rideMode === 'SHARED' && (
            <View style={[styles.sharedSection, { marginBottom: verticalScale(12) }]}>
              {searchingShared ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: verticalScale(12) }} />
              ) : sharedMatches && sharedMatches.length > 0 ? (
                sharedMatches.map((m, idx) => (
                  <View key={idx} style={[styles.matchCard, { backgroundColor: colors.inputBg, padding: horizontalScale(12), marginBottom: verticalScale(10), borderRadius: moderateScale(14), borderWidth: 1, borderColor: 'rgba(255, 214, 0, 0.35)' }]}>
                    {/* Yango-Style Header: Vehicle Color Badge + Available Seats Pill */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(8) }}>
                      {/* Car Color & Vehicle Info Badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1325', paddingHorizontal: horizontalScale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(16) }}>
                        <View style={{ width: moderateScale(12), height: moderateScale(12), borderRadius: moderateScale(6), backgroundColor: m.car_color_hex || '#FFD600', marginRight: horizontalScale(6), borderWidth: 1.5, borderColor: '#FFFFFF' }} />
                        <Ionicons name="car-sport" size={moderateScale(13)} color="#FFD600" style={{ marginRight: horizontalScale(4) }} />
                        <Text style={{ color: '#FFFFFF', fontSize: fontScale(11), fontWeight: '700' }}>
                          {m.car_color || 'Yellow'} {m.car_model || 'Vehicle'} • {m.license_plate || 'LT-482-YA'}
                        </Text>
                      </View>

                      {/* Available Seats Indicator */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 230, 118, 0.15)', paddingHorizontal: horizontalScale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(12), borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.4)' }}>
                        <Ionicons name="people" size={moderateScale(13)} color="#00E676" style={{ marginRight: horizontalScale(4) }} />
                        <Text style={{ color: '#00E676', fontSize: fontScale(11), fontWeight: '800' }}>
                          💺 {m.available_seats || 2}/{m.total_capacity || 4} Places
                        </Text>
                      </View>
                    </View>

                    {/* Route Title & Savings Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: verticalScale(6) }}>
                      <Text style={[styles.matchRoute, { color: colors.text, fontSize: fontScale(13), fontWeight: '700', flex: 1, marginRight: horizontalScale(6) }]} numberOfLines={1}>
                        {m.pickup_name} ➔ {m.destination_name}
                      </Text>
                      <View style={[styles.savePercentBadge, { paddingHorizontal: horizontalScale(6), paddingVertical: verticalScale(2), borderRadius: moderateScale(4), backgroundColor: '#00E676' }]}>
                        <Text style={[styles.savePercentText, { color: '#0B1325', fontSize: fontScale(10), fontWeight: '800' }]}>Save {m.savings_percentage}%</Text>
                      </View>
                    </View>

                    {/* Driver & Proportional Fare Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: verticalScale(4) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="star" size={moderateScale(12)} color="#FFD600" />
                        <Text style={{ color: colors.subText, fontSize: fontScale(11), marginLeft: horizontalScale(3), fontWeight: '600' }}>
                          {m.driver_rating || '4.9'} • {m.driver_name || 'Driver'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={[styles.soloFareStrike, { color: colors.subText, fontSize: fontScale(11), textDecorationLine: 'line-through', marginRight: horizontalScale(6) }]}>{m.normal_solo_fare} FCFA</Text>
                        <Text style={[styles.proportionalFare, { color: colors.primary, fontSize: fontScale(15), fontWeight: '800' }]}>{m.proportional_shared_fare} FCFA</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.joinBtn,
                        { backgroundColor: colors.primary, paddingVertical: verticalScale(9), borderRadius: moderateScale(10), marginTop: verticalScale(6), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: (m.available_seats || 0) <= 0 ? 0.5 : 1 },
                        (m.available_seats || 0) <= 0 ? { backgroundColor: colors.subText } : null,
                      ]}
                      onPress={() => handleJoinSharedMatch(m)}
                      disabled={requesting || (m.available_seats || 0) <= 0}
                      pointerEvents={(requesting || (m.available_seats || 0) <= 0) ? 'none' : 'auto'}
                    >
                      <Ionicons name="car-outline" size={moderateScale(16)} color="#0B1325" style={{ marginRight: horizontalScale(6) }} />
                      <Text style={[styles.joinBtnText, { color: '#0B1325', fontSize: fontScale(12), fontWeight: '800' }]}>{(m.available_seats || 0) <= 0 ? 'Ride Full' : `${t('joinShared')} (${m.proportional_shared_fare} FCFA)`}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={[styles.noMatchCard, { backgroundColor: colors.inputBg, padding: horizontalScale(10), borderRadius: moderateScale(10) }]}>
                  <Text style={[styles.noMatchTitle, { color: colors.text, fontSize: fontScale(13) }]}>{t('noMatch')}</Text>
                  <Text style={[styles.noMatchSub, { color: colors.subText, fontSize: fontScale(11), marginTop: verticalScale(2) }]}>{t('makeShareableSub')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Fare Summary & Action Button */}
          {estimatedFare !== null && (
            <View style={[styles.fareRow, { marginVertical: verticalScale(10) }]}>
              <Text style={[styles.fareLabel, { color: colors.subText, fontSize: fontScale(13) }]}>
                {rideMode === 'SHARED' ? t('estimatedSharedFare') : t('estimatedSoloFare')} ({distanceKm} km)
              </Text>
              <Text style={[styles.fareAmount, { color: colors.primary, fontSize: fontScale(22) }]}>{estimatedFare} FCFA</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.requestBtn, { backgroundColor: colors.primary, height: verticalScale(50), borderRadius: moderateScale(14), marginBottom: verticalScale(8) }]} onPress={handleRequestRide} disabled={requesting}>
            {requesting ? (
              <ActivityIndicator color="#0B1325" />
            ) : (
              <Text style={[styles.requestBtnText, { fontSize: fontScale(16) }]}>
                {rideMode === 'SHARED' ? t('requestShareable') : t('requestRide')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  root: {
    flex: 1,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
  },
  greetingBanner: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    zIndex: 105,
    elevation: 12,
  },
  greetingText: {
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    zIndex: 100,
    elevation: 10,
  },
  searchInput: {
    flex: 1,
    fontWeight: '700',
  },
  floatingSearchContainer: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 20,
    zIndex: 100,
    elevation: 10,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingSearchInput: {
    flex: 1,
    fontWeight: '700',
  },
  suggestionsDropdown: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 12,
    marginTop: 6,
    marginBottom: 8,
    maxHeight: 240,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionIconBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionName: {
    fontWeight: '700',
  },
  suggestionSub: {
    marginTop: 1,
  },
  toastBanner: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 6,
    zIndex: 90,
    elevation: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  toastText: {
    color: '#0B1325',
    fontWeight: '800',
  },
  floatingChipsRow: {
    position: 'absolute',
    flexDirection: 'row',
    zIndex: 90,
    elevation: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '700',
  },
  bottomDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    elevation: 12,
  },
  drawerHandle: {
    opacity: 0.5,
    borderRadius: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeInput: {
    flex: 1,
  },
  routeBox: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  greenDot: {
    flexShrink: 0,
  },
  gpsSyncBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  inputDivider: {
    flexShrink: 0,
  },
  modeToggleRow: {
    flexDirection: 'row',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeTabText: {
    fontWeight: '700',
  },
  modeTabIcon: {
    flexShrink: 0,
  },
  saveBadge: {
    backgroundColor: '#FF9F1C',
    flexShrink: 0,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  categoryPill: {
    alignItems: 'center',
  },
  categoryPillName: {
    fontWeight: '700',
  },
  categoryPillFare: {
    fontWeight: '800',
  },
  paymentMethodRow: {
    flexDirection: 'row',
  },
  payCard: {
    flex: 1,
    alignItems: 'center',
  },
  payIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  payText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  sharedSection: {
    marginBottom: 12,
  },
  matchCard: {
  },
  matchBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchRoute: {
    fontWeight: '700',
  },
  savePercentBadge: {
    backgroundColor: '#FF9F1C',
  },
  savePercentText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  proportionalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  soloFareStrike: {
    textDecorationLine: 'line-through',
  },
  proportionalFare: {
    fontWeight: '800',
  },
  joinBtn: {
    alignItems: 'center',
    marginTop: 4,
  },
  joinBtnText: {
    color: '#0B1325',
    fontWeight: '800',
  },
  noMatchCard: {
    alignItems: 'center',
  },
  noMatchTitle: {
    fontWeight: '700',
  },
  noMatchSub: {
    textAlign: 'center',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
  },
  fareAmount: {
    fontWeight: '900',
  },
  requestBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestBtnText: {
    color: '#0B1325',
    fontWeight: '800',
  },
});
