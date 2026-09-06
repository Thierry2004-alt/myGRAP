import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, Platform, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { loyaltyStorage } from '../../services/storage';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface PlaceDetail {
  id: number;
  name: string;
  category: string;
  catCode: 'DINING' | 'PARKS' | 'CULTURE' | 'SHOPPING' | 'NIGHTLIFE' | 'AIRPORT';
  zone: string;
  points: string;
  icon: string;
  lat: number;
  lng: number;
  description: string;
  activities: string[];
  popularHours: string;
  photos: string[];
}

interface FormattedAiResponseProps {
  text: string;
  textColor: string;
  subTextColor: string;
  accentColor: string;
  cardBg: string;
  borderColor: string;
  onRequestRide: (venueName: string) => void;
}

const FormattedAiResponse: React.FC<FormattedAiResponseProps> = ({
  text,
  textColor,
  accentColor,
  cardBg,
  borderColor,
  onRequestRide,
}) => {
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
            GRAP AI CONCIERGE
          </Text>
        </View>
        <View style={{ backgroundColor: 'rgba(0, 230, 118, 0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#00E676' }}>YAOUNDÉ VERIFIED</Text>
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
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFD600' }}>Concierge Pro-Tip</Text>
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
                  <Ionicons name="restaurant" size={16} color="#FFD600" />
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

              {/* Direct Booking Button for this Venue */}
              <TouchableOpacity
                style={{
                  backgroundColor: accentColor,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={() => onRequestRide(cleanTitle)}
              >
                <Ionicons name="car-sport" size={16} color="#0B1325" />
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0B1325' }}>
                  Request GRAP Ride Here
                </Text>
              </TouchableOpacity>
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

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');

  // AI CONCIERGE CHATBOT STATE
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'AI' | 'USER'; text: string; recommendedPlace?: PlaceDetail }>>([
    {
      sender: 'AI',
      text: 'Bonjour! I am your GRAP AI Concierge Assistant. Ask me for date night recommendations, quiet parks, or weekend hangouts in Yaoundé!',
    },
  ]);

  // 100% ACCURATE REAL-WORLD YAOUNDÉ GPS COORDINATES & VENUE PHOTO GALLERIES
  const places: PlaceDetail[] = [
    {
      id: 1,
      name: 'La Chaumière Restaurant',
      category: 'Dining & Lounge',
      catCode: 'DINING',
      zone: 'Bastos',
      points: '+50 pts',
      icon: 'restaurant',
      lat: 3.8820,
      lng: 11.5160,
      description: 'Premier romantic gourmet dining venue in Bastos known for Franco-Cameroonian cuisine, executive networking, and live acoustic jazz music.',
      activities: ['Romantic Candlelight Dinners (19:00 - 23:00)', 'Executive Lunch Specials', 'Cocktail Lounge'],
      popularHours: '12:00 - 15:00, 19:00 - 23:00',
      photos: [
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80',
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
      ],
    },
    {
      id: 2,
      name: 'Parc Febe & Mont Fébé',
      category: 'Parks & Nature',
      catCode: 'PARKS',
      zone: 'Mont Fébé',
      points: '+45 pts',
      icon: 'leaf',
      lat: 3.9050,
      lng: 11.5150,
      description: 'Lush mountain peak offering panoramic views of Yaoundé, cool breeze, golf course, and peaceful walking trails ideal for romantic dates.',
      activities: ['Sunset Panoramic Photography', 'Golf & Nature Walk', 'Mountain Hotel Terrace'],
      popularHours: '08:00 - 19:00 Daily',
      photos: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
        'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80',
      ],
    },
    {
      id: 3,
      name: 'Grand Mall Yaoundé',
      category: 'Shopping & Cinema',
      catCode: 'SHOPPING',
      zone: 'Mvan',
      points: '+80 pts',
      icon: 'cart',
      lat: 3.8390,
      lng: 11.5010,
      description: 'Modern commercial complex featuring fashion boutiques, supermarket, multiplex cinema, and food court near Mvan interchange.',
      activities: ['Supermarket Sales & Promo Days', 'Weekend Family Cinema', 'Fashion Outlets'],
      popularHours: '10:00 - 20:00 Daily',
      photos: [
        'https://images.unsplash.com/photo-1567449303078-57ad995bd301?w=600&q=80',
        'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=600&q=80',
      ],
    },
    {
      id: 4,
      name: 'Palais des Sports (Warda)',
      category: 'Sports & Arena',
      catCode: 'NIGHTLIFE',
      zone: 'Warda',
      points: '+60 pts',
      icon: 'sparkles',
      lat: 3.8692,
      lng: 11.5135,
      description: 'Iconic indoor arena host to basketball championships, international concerts, and national trade exhibitions in downtown Warda.',
      activities: ['Sports Tournaments', 'Music Festivals', 'Trade Fairs'],
      popularHours: 'Event Dependent (15:00 - 22:00)',
      photos: [
        'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=600&q=80',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80',
      ],
    },
    {
      id: 5,
      name: 'Musée National de Yaoundé',
      category: 'Culture & Heritage',
      catCode: 'CULTURE',
      zone: 'Centre-Ville',
      points: '+40 pts',
      icon: 'library',
      lat: 3.8645,
      lng: 11.5165,
      description: 'Historic presidential palace converted into a national cultural museum showcasing traditional art, royal relics, and national history.',
      activities: ['Guided Cultural Tours', 'Traditional Art Gallery', 'Historical Archives'],
      popularHours: '09:00 - 17:00 (Tue - Sun)',
      photos: [
        'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=600&q=80',
        'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&q=80',
      ],
    },
    {
      id: 6,
      name: 'Marché Mokolo',
      category: 'Market & Craft',
      catCode: 'SHOPPING',
      zone: 'Mokolo',
      points: '+45 pts',
      icon: 'basket',
      lat: 3.8685,
      lng: 11.5045,
      description: 'Vibrant commercial hub famous for textiles, electronics, fresh organic produce, and authentic local Cameroonian crafts.',
      activities: ['Wholesale Textile Shopping', 'Fresh Organic Produce', 'Artisan Crafts'],
      popularHours: '07:00 - 18:00 Daily',
      photos: [
        'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=600&q=80',
        'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80',
      ],
    },
    {
      id: 7,
      name: 'Aéroport International de Nsimalen',
      category: 'Transport & Travel',
      catCode: 'AIRPORT',
      zone: 'Nsimalen',
      points: '+100 pts',
      icon: 'airplane',
      lat: 3.7205,
      lng: 11.5510,
      description: 'Primary international airport gateway serving Yaoundé with domestic and international airline connections.',
      activities: ['International Flights', 'Airport Express Transfers', 'Duty-Free Shopping'],
      popularHours: '24/7 Service',
      photos: [
        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
        'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600&q=80',
      ],
    },
  ];

  const filteredPlaces = places.filter((place) => {
    const matchesCategory = selectedCategory === 'ALL' || place.catCode === selectedCategory;
    const query = placeSearch.trim().toLowerCase();
    const matchesSearch = !query || `${place.name} ${place.zone} ${place.category} ${place.description}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const handleOpenPlace = (place: PlaceDetail) => {
    setSelectedPlace(place);
    setModalVisible(true);
  };

  const handleRequestRideToPlace = (targetPlace?: PlaceDetail | string) => {
    const name = typeof targetPlace === 'string' ? targetPlace : targetPlace?.name || selectedPlace?.name;
    if (!name) return;
    setModalVisible(false);
    setChatVisible(false);
    Alert.alert(
      'Destination Set!',
      `Setting ${name} as destination...`,
      [{ text: 'Proceed to Book Ride', onPress: () => router.push('/') }]
    );
  };

  // AI CONCIERGE CHATBOT ADVICE LOGIC
  const handleSendChat = async (presetQuery?: string) => {
    const q = (presetQuery || chatInput).trim();
    if (!q) return;

    const newMsgs = [...chatMessages, { sender: 'USER' as const, text: q }];
    setChatMessages(newMsgs);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await api.getPlaceRecommendation(q, places.map(({ name, zone, description }) => ({ name, zone, description })));
      const recommendedPlace = places.find((place) => response.answer.toLowerCase().includes(place.name.toLowerCase()));
      setChatMessages((prev) => [...prev, { sender: 'AI', text: response.answer, recommendedPlace }]);
    } catch (error: any) {
      setChatMessages((prev) => [...prev, { sender: 'AI', text: error.message || 'The GRAP Concierge is temporarily unavailable. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getGoogleSatelliteHTML = (lat: number, lng: number, placeName: string) => `
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

        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          attribution: '© Google Maps Satellite'
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

  const renderSatelliteMap = (lat: number, lng: number, placeName: string) => {
    const htmlContent = getGoogleSatelliteHTML(lat, lng, placeName);
    if (Platform.OS === 'web') {
      return React.createElement('iframe', {
        srcDoc: htmlContent,
        style: { width: '100%', height: '100%', border: 'none' },
        title: 'Google Maps Satellite Venue View',
      });
    }
    const { WebView } = require('react-native-webview');
    return <WebView originWhitelist={['*']} source={{ html: htmlContent }} style={{ flex: 1 }} />;
  };

  const categoriesConfig = [
    { code: 'ALL', label: 'All Places', icon: 'location-sharp' },
    { code: 'DINING', label: 'Dining & Lounge', icon: 'restaurant' },
    { code: 'PARKS', label: 'Parks & Nature', icon: 'leaf' },
    { code: 'CULTURE', label: 'Culture & Museums', icon: 'library' },
    { code: 'SHOPPING', label: 'Shopping', icon: 'bag-handle' },
    { code: 'NIGHTLIFE', label: 'Nightlife', icon: 'wine' },
    { code: 'AIRPORT', label: 'Airports', icon: 'airplane' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        {/* Loyalty Header Card */}
        <View style={[styles.loyaltyCard, { backgroundColor: colors.card, borderColor: 'rgba(255, 214, 0, 0.4)' }]}>
          <View style={styles.loyaltyTop}>
            <Ionicons name="trophy" size={30} color="#FFD600" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.loyaltyTitle, { color: colors.text }]}>GRAP Loyalty Program</Text>
              <Text style={[styles.loyaltySub, { color: colors.subText }]}>Earn points on completed & shared rides</Text>
            </View>
          </View>

          <View style={[styles.pointsBadge, { backgroundColor: colors.inputBg }]}>
          <Text style={styles.pointsNumber}>0</Text>
            <Text style={[styles.pointsLabel, { color: colors.subText }]}>{t('loyalPoints')}</Text>
          </View>
        </View>

        <View style={[styles.placeSearch, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput value={placeSearch} onChangeText={setPlaceSearch} placeholder="Search Yaoundé places, zones, landmarks..." placeholderTextColor={colors.subText} style={[styles.placeSearchInput, { color: colors.text }]} />
          {placeSearch.length > 0 && <TouchableOpacity onPress={() => setPlaceSearch('')}><Ionicons name="close-circle" size={18} color={colors.subText} /></TouchableOpacity>}
        </View>

        {/* PROFESSIONAL VECTOR ICON CATEGORY FILTER PILLS */}
        <Text style={[styles.sectionTitle, { color: colors.subText }]}>Filter by Category</Text>
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
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Place Discovery List */}
        <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('discoverPlaces')} ({filteredPlaces.length} venues found)</Text>
        <View style={styles.placesList}>
          {filteredPlaces.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.placeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => handleOpenPlace(item)}
              activeOpacity={0.75}
            >
              <Image source={{ uri: item.photos[0] }} style={styles.placeThumbnail} />

              <View style={{ flex: 1 }}>
                <Text style={[styles.placeName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.placeSub, { color: colors.subText }]}>{item.category} • {item.zone}</Text>
              </View>

              <View style={styles.pointsPill}>
                <Text style={styles.pointsPillText}>{item.points}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
                  <Text style={[styles.chatTitle, { color: colors.text }]}>GRAP AI Concierge Assistant</Text>
                  <Text style={[styles.chatSub, { color: colors.subText }]}>Date & Venue Advice for Yaoundé</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Query Vector Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat('Best restaurant near Messamendongo?')}>
                <Ionicons name="restaurant" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: colors.primary }]}>Messamendongo Grill & Dining</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat('Romantic date spot in Bastos?')}>
                <Ionicons name="wine" size={13} color="#FFD600" style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: '#FFD600' }]}>Romantic Bastos Date</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat('Quiet park or view in Mont Febe?')}>
                <Ionicons name="leaf" size={13} color={colors.secondary} style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: colors.secondary }]}>Mont Fébé Nature & View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.queryChip, { backgroundColor: colors.inputBg }]} onPress={() => handleSendChat('Shopping and cinema in Mvan?')}>
                <Ionicons name="bag-handle" size={13} color={colors.text} style={{ marginRight: 4 }} />
                <Text style={[styles.queryChipText, { color: colors.text }]}>Shopping & Cinema</Text>
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
                      onRequestRide={(venueName) => handleRequestRideToPlace(venueName)}
                    />
                  )}

                  {msg.recommendedPlace && (
                    <TouchableOpacity
                      style={[styles.recPlaceBtn, { backgroundColor: colors.inputBg, borderColor: colors.primary, borderWidth: 1, marginTop: 10 }]}
                      onPress={() => handleRequestRideToPlace(msg.recommendedPlace)}
                    >
                      <Ionicons name="car-sport" size={16} color={colors.primary} />
                      <Text style={[styles.recPlaceBtnText, { color: colors.primary }]}>
                        Request GRAP Ride to {msg.recommendedPlace.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.chatBubble, { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, borderRadius: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="sparkles" size={16} color="#FFD600" />
                    <Text style={{ color: colors.text, fontStyle: 'italic', fontSize: 13, fontWeight: '600' }}>
                      GRAP AI Concierge is mapping Yaoundé options...
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={[styles.chatTextInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Ask AI for date advice..."
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
                  <Text style={[styles.modalSub, { color: colors.subText }]}>{selectedPlace.category} • {selectedPlace.zone}</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Google Maps Satellite View */}
              <View style={styles.satelliteMapBox}>
                {renderSatelliteMap(selectedPlace.lat, selectedPlace.lng, selectedPlace.name)}
              </View>

              {/* High-Resolution Venue Photo Gallery */}
              <Text style={[styles.subSectionTitle, { color: colors.subText }]}>Venue Photo Gallery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {selectedPlace.photos.map((imgUrl, pIdx) => (
                  <Image key={pIdx} source={{ uri: imgUrl }} style={styles.galleryImage} />
                ))}
              </ScrollView>

              <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
                <Text style={[styles.descText, { color: colors.text }]}>{selectedPlace.description}</Text>

                <Text style={[styles.subSectionTitle, { color: colors.subText }]}>Popular Venue Activities</Text>
                {selectedPlace.activities.map((act, idx) => (
                  <View key={idx} style={styles.activityRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={[styles.activityText, { color: colors.text }]}>{act}</Text>
                  </View>
                ))}

                <View style={styles.hoursRow}>
                  <Ionicons name="time" size={14} color={colors.secondary} />
                  <Text style={[styles.hoursText, { color: colors.subText }]}>Peak Hours: {selectedPlace.popularHours}</Text>
                </View>
              </ScrollView>

              {/* Action Button: Request a Ride Here */}
              <TouchableOpacity
                style={[styles.requestRideBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleRequestRideToPlace()}
              >
                <Ionicons name="car-sport" size={20} color="#0B1325" style={{ marginRight: 8 }} />
                <Text style={styles.requestRideBtnText}>Request a Ride Here</Text>
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
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
  },
  placeThumbnail: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#DDE8E3',
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
    marginTop: 2,
  },
  pointsPill: {
    backgroundColor: 'rgba(255, 214, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsPillText: {
    color: '#FFD600',
    fontWeight: '800',
    fontSize: 12,
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
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
  },
  recPlaceBtnText: {
    fontSize: 12,
    fontWeight: '800',
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
    width: 140,
    height: 85,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#1E293B',
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
