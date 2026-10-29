import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, ImageBackground, Platform, TextInput, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, PlaceDetail } from '../../services/api';
import { loyaltyStorage } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface FormattedAiResponseProps {
  text: string;
  textColor: string;
  subTextColor: string;
  accentColor: string;
  cardBg: string;
  borderColor: string;
}

const FormattedAiResponse: React.FC<FormattedAiResponseProps> = ({
  text,
  textColor,
  accentColor,
  cardBg,
  borderColor,
}) => {
  const { t } = useLanguage();
  const sections = text.split(/\n(?=###|\d+\.|\*\*|\uD83D\uDCA1|\uD83D\uDCCD)/);

  return (
    <View style={{ gap: 10 }}>
      {/* AI CONCIERGE BRANDING HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255, 214, 0, 0.25)', paddingBottom: 6, marginBottom: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: 'rgba(255, 214, 0, 0.2)', padding: 5, borderRadius: 8 }}>
            <Ionicons name="sparkles" size={14} color="#FFD600" />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '900', color: accentColor, letterSpacing: 0.5 }}>
            {t('GRAP AI CONCIERGE')}
          </Text>
        </View>
        <View style={{ backgroundColor: 'rgba(0, 230, 118, 0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#00E676' }}>{t('LOCAL PLACES')}</Text>
        </View>
      </View>

      {sections.map((section, sIdx) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        // 1. Pro-Tip Banner Box (💡)
        if (trimmed.includes('💡') || trimmed.toLowerCase().includes('pro-tip')) {
          return (
            <View
              key={sIdx}
              style={{
                backgroundColor: 'rgba(255, 214, 0, 0.12)',
                borderWidth: 1,
                borderColor: '#FFD600',
                borderRadius: 14,
                padding: 12,
                marginVertical: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="bulb" size={16} color="#FFD600" />
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFD600' }}>{t('Concierge Pro-Tip')}</Text>
              </View>
              <Text style={{ fontSize: 12.5, color: textColor, lineHeight: 18.5 }}>
                {trimmed.replace(/💡|Concierge Pro-Tip:?/g, '').trim()}
              </Text>
            </View>
          );
        }

        // 2. Structured Venue Card (if section starts with ### or Numbered Title or has 📍)
        const isVenueHeader = /^#+\s*|\d+\.\s*\*\*/.test(trimmed) || trimmed.includes('📍');
        if (isVenueHeader) {
          const lines = trimmed.split('\n');
          const titleLine = lines[0] || '';
          const cleanTitle = titleLine.replace(/^#+\s*|\d+\.\s*|\*\*/g, '').trim();

          const locLine = lines.find((l) => l.includes('📍') || l.toLowerCase().includes('location:'));
          const cleanLoc = locLine ? locLine.replace(/📍|\*|\*\*|Location:?/gi, '').trim() : '';

          return (
            <View
              key={sIdx}
              style={{
                backgroundColor: cardBg,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: borderColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 5,
                elevation: 3,
                marginVertical: 2,
              }}
            >
              {/* Venue Title & Icon Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: textColor }}>
                    {cleanTitle}
                  </Text>
                  {cleanLoc ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(255, 214, 0, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' }}>
                      <Ionicons name="location-sharp" size={12} color="#FFD600" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: textColor }}>{cleanLoc}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 214, 0, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="location" size={16} color="#FFD600" />
                </View>
              </View>

              {/* Venue Details & Bullet Lines */}
              <View style={{ gap: 4, marginBottom: 10 }}>
                {lines.slice(1).map((line, lIdx) => {
                  const lineTrimmed = line.trim();
                  if (!lineTrimmed || lineTrimmed.includes('📍') || lineTrimmed.toLowerCase().includes('location:')) return null;

                  const parts = lineTrimmed.replace(/^[\*\-]\s*/, '').split(/(\*\*.*?\*\*)/g);
                  return (
                    <View key={lIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                      <Text style={{ color: accentColor, fontWeight: '900', fontSize: 12 }}>•</Text>
                      <Text style={{ flex: 1, fontSize: 12.5, color: textColor, lineHeight: 18 }}>
                        {parts.map((p, pIdx) => {
                          if (p.startsWith('**') && p.endsWith('**')) {
                            return <Text key={pIdx} style={{ fontWeight: '800', color: accentColor }}>{p.slice(2, -2)}</Text>;
                          }
                          return p;
                        })}
                      </Text>
                    </View>
                  );
                })}
              </View>

            </View>
          );
        }

        // 3. General Intro or Outro Paragraphs
        const lines = trimmed.split('\n');
        return (
          <View key={sIdx} style={{ gap: 4 }}>
            {lines.map((line, lIdx) => {
              const lineTrimmed = line.trim();
              if (!lineTrimmed) return null;

              const parts = lineTrimmed.split(/(\*\*.*?\*\*)/g);
              return (
                <Text key={lIdx} style={{ fontSize: 13, color: textColor, lineHeight: 19 }}>
                  {parts.map((p, pIdx) => {
                    if (p.startsWith('**') && p.endsWith('**')) {
                      return <Text key={pIdx} style={{ fontWeight: '800', color: accentColor }}>{p.slice(2, -2)}</Text>;
                    }
                    return p;
                  })}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

export default function PlacesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [places, setPlaces] = useState<PlaceDetail[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');

  // AI CONCIERGE CHATBOT STATE
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'AI' | 'USER'; text: string; recommendedPlaces?: PlaceDetail[] }>>([
    {
      sender: 'AI',
      text: t('Tell me what you are looking for, where you want to go, and any preferences such as nature, history, food, shopping, or sports.'),
    },
  ]);

  const loadPlaces = useCallback(async () => {
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      setPlaces(await api.getPlaces());
    } catch (error) {
      console.error('Could not load places from the database:', error);
      setPlacesError(error instanceof Error ? error.message : t('Could not load places. Please try again.'));
    } finally {
      setPlacesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPlaces();
  }, [loadPlaces]);

  useEffect(() => {
    let active = true;
    loyaltyStorage.getPoints(user?.id).then((points) => {
      if (active) setLoyaltyPoints(points);
    }).catch((error) => console.error('Could not load loyalty points:', error));
    return () => {
      active = false;
    };
  }, [user?.id]);

  const filteredPlaces = places.filter((place) => {
    const matchesCategory = selectedCategory === 'ALL' || place.categoryCode === selectedCategory;
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(placeSearch.trim());
    const searchableText = normalize(`${place.name} ${place.zone} ${place.category} ${place.description} ${place.searchKeywords.join(' ')}`);
    const matchesSearch = !query || searchableText.includes(query);
    return matchesCategory && matchesSearch;
  });

  const handleOpenPlace = (place: PlaceDetail) => {
    setSelectedPlace(place);
    setModalVisible(true);
  };

  const handleRequestRideToPlace = (targetPlace?: PlaceDetail) => {
    const place = targetPlace || selectedPlace;
    if (!place) return;
    setModalVisible(false);
    setChatVisible(false);
    router.push({
      pathname: '/',
      params: {
        destination_name: place.name,
        destination_lat: String(place.latitude),
        destination_lng: String(place.longitude),
      },
    });
  };

  // AI CONCIERGE CHATBOT ADVICE LOGIC
  const handleSendChat = async (presetQuery?: string) => {
    const q = (presetQuery || chatInput).trim();
    if (!q || chatLoading) return;

    setChatMessages((prev) => [...prev, { sender: 'USER', text: q }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await api.getPlaceRecommendation(q);
      const recommendedPlaces = (response.recommended_place_ids || [])
        .map((id) => places.find((place) => place.id === id))
        .filter((place): place is PlaceDetail => Boolean(place));
      setChatMessages((prev) => [...prev, { sender: 'AI', text: response.answer, recommendedPlaces }]);
    } catch (error) {
      setChatMessages((prev) => [...prev, {
        sender: 'AI',
        text: error instanceof Error ? error.message : 'The GRAP Concierge is temporarily unavailable. Please try again.',
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getPlaceMapHTML = (lat: number, lng: number, placeName: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #satmap { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f172a; }
        .place-badge { background: #FFD600; color: #000; padding: 5px 10px; border-radius: 8px; font-weight: bold; font-family: sans-serif; font-size: 11px; }
      </style>
    </head>
    <body>
      <div id="satmap"></div>
      <script>
        var map = L.map('satmap', { zoomControl: false }).setView([${lat}, ${lng}], 17);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        var redIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='background-color:#FF5252;width:24px;height:24px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 14px #FF5252;'></div>",
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        L.marker([${lat}, ${lng}], {icon: redIcon}).addTo(map)
          .bindPopup("<b class='place-badge'>${placeName}</b>").openPopup();
      </script>
    </body>
    </html>
  `;

  const renderPlaceMap = (lat: number, lng: number, placeName: string) => {
    const htmlContent = getPlaceMapHTML(lat, lng, placeName);
    if (Platform.OS === 'web') {
      return React.createElement('iframe', {
        srcDoc: htmlContent,
        style: { width: '100%', height: '100%', border: 'none' },
        title: 'OpenStreetMap place location',
      });
    }
    const { WebView } = require('react-native-webview');
    return <WebView originWhitelist={['*']} source={{ html: htmlContent }} style={{ flex: 1 }} />;
  };

  const categoriesConfig: Array<{ code: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { code: 'ALL', label: 'All places', icon: 'location-sharp' },
    { code: 'DINING', label: 'Food', icon: 'restaurant' },
    { code: 'PARKS', label: 'Nature', icon: 'leaf' },
    { code: 'CULTURE', label: 'Culture & heritage', icon: 'library' },
    { code: 'SHOPPING', label: 'Markets', icon: 'bag-handle' },
    { code: 'SPORTS', label: 'Sports & events', icon: 'football' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        <ImageBackground
          source={places.length > 0 ? { uri: places[0].photoUrl } : undefined}
          style={styles.heroCard}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroScrim}>
            <View style={styles.heroEyebrow}>
              <Ionicons name="location" size={13} color="#0B1325" />
              <Text style={styles.heroEyebrowText}>{t('YAOUNDÉ • LOCAL GUIDE')}</Text>
            </View>
              <Text style={styles.heroTitle}>{t('Find your next stop in the city')}</Text>
              <Text style={styles.heroSubtitle}>{t('Real places, map locations and photos from Wikimedia Commons.')}</Text>
          </View>
        </ImageBackground>

        {/* Loyalty Header Card */}
        <View style={[styles.loyaltyCard, { backgroundColor: colors.card, borderColor: 'rgba(255, 214, 0, 0.4)' }]}>
          <View style={styles.loyaltyTop}>
            <Ionicons name="trophy" size={30} color="#FFD600" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.loyaltyTitle, { color: colors.text }]}>{t('GRAP Loyalty Program')}</Text>
              <Text style={[styles.loyaltySub, { color: colors.subText }]}>{t('Earn points on completed & shared rides')}</Text>
            </View>
          </View>

          <View style={[styles.pointsBadge, { backgroundColor: colors.inputBg }]}>
          <Text style={styles.pointsNumber}>{loyaltyPoints.toLocaleString()}</Text>
            <Text style={[styles.pointsLabel, { color: colors.subText }]}>{t('loyalPoints')}</Text>
          </View>
        </View>

        <View style={[styles.placeSearch, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput value={placeSearch} onChangeText={setPlaceSearch} placeholder={t('Search Yaoundé places, zones, landmarks...')} placeholderTextColor={colors.subText} style={[styles.placeSearchInput, { color: colors.text }]} />
          {placeSearch.length > 0 && <TouchableOpacity onPress={() => setPlaceSearch('')}><Ionicons name="close-circle" size={18} color={colors.subText} /></TouchableOpacity>}
        </View>

        {/* PROFESSIONAL VECTOR ICON CATEGORY FILTER PILLS */}
        <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('Filter by Category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {categoriesConfig.map((cat) => {
            const isSel = selectedCategory === cat.code;
            return (
              <TouchableOpacity
                key={cat.code}
                style={[
                  styles.categoryPill,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  isSel && { borderColor: colors.primary, backgroundColor: `${colors.primary}20` },
                ]}
                onPress={() => setSelectedCategory(cat.code)}
              >
                <Ionicons name={cat.icon as any} size={14} color={isSel ? colors.primary : colors.subText} style={{ marginRight: 6 }} />
                <Text style={[styles.categoryPillText, isSel ? { color: colors.primary, fontWeight: '800' } : { color: colors.subText }]}>
                  {t(cat.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Place Discovery List */}
        <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('discoverPlaces')} ({filteredPlaces.length} {t('venues found')})</Text>
        {placesLoading ? (
          <View style={styles.emptySearchState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptySearchText, { color: colors.subText }]}>{t('Loading places...')}</Text>
          </View>
        ) : placesError ? (
          <View style={styles.emptySearchState}>
            <Ionicons name="cloud-offline-outline" size={24} color={colors.subText} />
            <Text style={[styles.emptySearchText, { color: colors.subText }]}>{placesError}</Text>
            <TouchableOpacity onPress={() => void loadPlaces()} style={[styles.requestRideBtn, { backgroundColor: colors.primary, paddingHorizontal: 18 }]}>
              <Text style={styles.requestRideBtnText}>{t('Try again')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placesList}>
            {filteredPlaces.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.placeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => handleOpenPlace(item)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: item.photoUrl }} style={styles.placeThumbnail} />
                <View style={styles.placeCardContent}>
                  <View style={styles.placeCardTopLine}>
                    <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                  </View>
                  <Text style={[styles.placeSub, { color: colors.subText }]}>{t(item.category)} • {item.zone}</Text>
                  <View style={styles.placeSourceBadge}>
                    <Ionicons name="map-outline" size={12} color={colors.primary} />
                    <Text style={[styles.placeSourceText, { color: colors.primary }]}>{t('OpenStreetMap location')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {filteredPlaces.length === 0 && (
              <View style={styles.emptySearchState}>
                <Ionicons name="search-outline" size={24} color={colors.subText} />
                <Text style={[styles.emptySearchText, { color: colors.subText }]}>{t('No places match this search.')}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FLOATING AI CONCIERGE CHATBOT BUTTON (🤖) */}
      <TouchableOpacity
        style={[styles.floatingChatbotBtn, { backgroundColor: colors.primary }]}
        onPress={() => setChatVisible(true)}
      >
        <Ionicons name="sparkles" size={24} color="#0B1325" />
      </TouchableOpacity>

      {/* AI CONCIERGE ASSISTANT CHATBOT MODAL */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.chatModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderTitleRow}>
                <View style={[styles.aiBadge, { backgroundColor: `${colors.primary}25` }]}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.chatTitle, { color: colors.text }]}>{t('GRAP AI Concierge Assistant')}</Text>
                  <Text style={[styles.chatSub, { color: colors.subText }]}>{t('Date & Venue Advice for Yaoundé')}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Query Vector Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat(t('I want a restaurant around Warda.'))}>
                <Ionicons name="restaurant" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: colors.primary }]}>{t('Food near Warda')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat(t('Suggest a quiet place in nature.'))}>
                <Ionicons name="leaf" size={13} color="#FFD600" style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: '#FFD600' }]}>{t('Nature & quiet')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat(t('I am interested in history and culture.'))}>
                <Ionicons name="library" size={13} color={colors.secondary} style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: colors.secondary }]}>{t('History & culture')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat(t('I want to shop at a local market.'))}>
                <Ionicons name="bag-handle" size={13} color={colors.text} style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: colors.text }]}>{t('Local markets')}</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Chat Log */}
            <ScrollView style={styles.chatLog} contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
              {chatMessages.map((msg, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'USER'
                      ? {
                          alignSelf: 'flex-end',
                          backgroundColor: colors.primary,
                          maxWidth: '85%',
                          borderRadius: 18,
                          borderBottomRightRadius: 4,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        }
                      : {
                          alignSelf: 'flex-start',
                          backgroundColor: colors.card,
                          maxWidth: '96%',
                          borderRadius: 20,
                          borderTopLeftRadius: 4,
                          borderWidth: 1.5,
                          borderColor: 'rgba(255, 214, 0, 0.4)',
                          padding: 16,
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          elevation: 4,
                        },
                  ]}
                >
                  {msg.sender === 'USER' ? (
                    <Text style={{ fontSize: 14, color: '#0B1325', fontWeight: '800' }}>
                      {msg.text}
                    </Text>
                  ) : (
                    <FormattedAiResponse
                      text={msg.text}
                      textColor={colors.text}
                      subTextColor={colors.subText}
                      accentColor={colors.primary}
                      cardBg={colors.inputBg}
                      borderColor={colors.cardBorder}
                    />
                  )}

                  {msg.recommendedPlaces?.map((place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={[styles.recPlaceBtn, { backgroundColor: colors.inputBg, borderColor: colors.primary, borderWidth: 1, marginTop: 10 }]}
                      onPress={() => handleRequestRideToPlace(place)}
                      accessibilityRole="button"
                      accessibilityLabel={t('Set {place} as ride destination').replace('{place}', place.name)}
                    >
                      <Image source={{ uri: place.photoUrl }} style={styles.recPlaceImage} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.recPlaceTitle, { color: colors.text }]}>{place.name}</Text>
                        <Text style={[styles.recPlaceText, { color: colors.subText }]}>{place.zone} · {t(place.category)}</Text>
                        <Text style={[styles.recPlaceText, { color: colors.primary }]}>{t('Tap to set as ride destination')}</Text>
                      </View>
                      <Ionicons name="car-sport" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.chatBubble, { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, borderRadius: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="sparkles" size={16} color="#FFD600" />
                    <Text style={{ color: colors.text, fontStyle: 'italic', fontSize: 13, fontWeight: '600' }}>
                    {t('Matching your preferences to places in the local guide...')}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={[styles.chatTextInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder={t('Ask AI for date advice...')}
                placeholderTextColor={colors.subText}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={() => handleSendChat()}
              />
              <TouchableOpacity style={[styles.chatSendBtn, { backgroundColor: colors.primary }]} onPress={() => handleSendChat()}>
                <Ionicons name="send" size={16} color="#0B1325" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DYNAMIC PLACE DETAIL MODAL WITH SATELLITE MAP & PHOTO GALLERY */}
      {selectedPlace && (
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedPlace.name}</Text>
                  <Text style={[styles.modalSub, { color: colors.subText }]}>{t(selectedPlace.category)} • {selectedPlace.zone}</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* OpenStreetMap location */}
              <View style={styles.satelliteMapBox}>
                {renderPlaceMap(selectedPlace.latitude, selectedPlace.longitude, selectedPlace.name)}
              </View>

              {/* Place-specific image and its license attribution */}
              <Text style={[styles.subSectionTitle, { color: colors.subText }]}>{t('Venue Photo Gallery')}</Text>
              <Image source={{ uri: selectedPlace.photoUrl }} style={styles.galleryImage} />
              <TouchableOpacity
                onPress={() => Linking.openURL(selectedPlace.photoSourceUrl).catch((error) => console.error('Could not open photo source:', error))}
                accessibilityRole="link"
              >
                <Text style={[styles.photoCredit, { color: colors.subText }]}>
                  {t('Photo attribution: {credit} · {license} · Wikimedia Commons')
                    .replace('{credit}', selectedPlace.photoCredit)
                    .replace('{license}', selectedPlace.photoLicense)}
                </Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
                <Text style={[styles.descText, { color: colors.text }]}>{t(selectedPlace.description)}</Text>

                <Text style={[styles.subSectionTitle, { color: colors.subText }]}>{t('Place details')}</Text>
                {selectedPlace.highlights.map((act, idx) => (
                  <View key={idx} style={styles.activityRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={[styles.activityText, { color: colors.text }]}>{t(act)}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => Linking.openURL(selectedPlace.mapSourceUrl).catch((error) => console.error('Could not open map source:', error))}
                  accessibilityRole="link"
                  style={styles.mapSourceLink}
                >
                  <Ionicons name="map-outline" size={14} color={colors.primary} />
                  <Text style={[styles.mapSourceText, { color: colors.primary }]}>{t('View location on OpenStreetMap')}</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Action Button: Request a Ride Here */}
              <TouchableOpacity
                style={[styles.requestRideBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleRequestRideToPlace()}
              >
                <Ionicons name="car-sport" size={20} color="#0B1325" style={{ marginRight: 8 }} />
                <Text style={styles.requestRideBtnText}>{t('Request a Ride Here')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    height: 190,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'flex-end',
    backgroundColor: '#223044',
  },
  heroImage: {
    borderRadius: 22,
  },
  heroScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
    backgroundColor: 'rgba(5, 12, 24, 0.48)',
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFD600',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  heroEyebrowText: {
    color: '#0B1325',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
    maxWidth: 290,
  },
  heroSubtitle: {
    color: '#F1F5F9',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 300,
  },
  loyaltyCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  loyaltyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  loyaltyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  loyaltySub: {
    fontSize: 12,
    marginTop: 2,
  },
  pointsBadge: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pointsNumber: {
    color: '#FFD600',
    fontSize: 28,
    fontWeight: '900',
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  placeSearch: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 18,
  },
  placeSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  placesList: {
    gap: 10,
  },
  emptySearchState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptySearchText: {
    fontSize: 13,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeThumbnail: {
    width: 94,
    height: 88,
    borderRadius: 13,
    backgroundColor: '#DDE8E3',
  },
  placeCardContent: {
    flex: 1,
    minHeight: 76,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  placeCardTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  placeSub: {
    fontSize: 12,
    marginTop: 5,
  },
  placeSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  placeSourceText: {
    fontSize: 10,
    fontWeight: '800',
  },
  floatingChatbotBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  chatModalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderTopWidth: 1,
    height: '75%',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chatHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  chatSub: {
    fontSize: 11,
  },
  queryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  queryChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatLog: {
    flex: 1,
    marginVertical: 6,
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
  },
  chatText: {
    fontSize: 13,
    lineHeight: 18,
  },
  recPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
  },
  recPlaceImage: {
    width: 54,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  recPlaceTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  recPlaceText: {
    fontSize: 10,
    marginTop: 3,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  chatTextInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  satelliteMapBox: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  galleryImage: {
    width: '100%',
    height: 145,
    borderRadius: 12,
    marginBottom: 5,
    backgroundColor: '#1E293B',
  },
  photoCredit: {
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 10,
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  activityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  hoursText: {
    fontSize: 12,
  },
  mapSourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  mapSourceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  requestRideBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  requestRideBtnText: {
    color: '#0B1325',
    fontSize: 15,
    fontWeight: '800',
  },
});
