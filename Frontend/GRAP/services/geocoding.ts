export interface PlaceSuggestion {
  id: string;
  name: string;
  zone: string;
  latitude: number;
  longitude: number;
  address: string;
}

// Precision index of over 30 Yaoundé neighborhoods & key landmarks
const PRECISION_YAOUNDE_ZONES: PlaceSuggestion[] = [
  { id: 'iai-cameroun', name: 'IAI Cameroun (Institut Africain d\'Informatique)', zone: 'Awae', latitude: 3.856500, longitude: 11.551200, address: 'IAI Cameroun, Awae Escalier, Yaoundé' },
  { id: 'messamendongo-carrefour', name: 'Carrefour Messamendongo', zone: 'Messamendongo', latitude: 3.805000, longitude: 11.538000, address: 'Carrefour Messamendongo, Yaoundé' },
  { id: 'pharmacie-dema', name: 'Pharmacie Dema', zone: 'Damas', latitude: 3.848721, longitude: 11.542183, address: 'Pharmacie Dema, Damas, Yaoundé' },
  { id: 'columbia', name: 'Columbia', zone: 'Bastos', latitude: 3.881642, longitude: 11.517394, address: 'Columbia, Bastos, Yaoundé' },
  { id: 'carrefour-jouvence', name: 'Carrefour Jouvence', zone: 'Biyem-Assi', latitude: 3.835412, longitude: 11.483973, address: 'Carrefour Jouvence, Biyem-Assi, Yaoundé' },
  { id: 'rond-point-nlongkak', name: 'Rond-point Nlongkak', zone: 'Nlongkak', latitude: 3.886112, longitude: 11.518927, address: 'Rond-point Nlongkak, Yaoundé' },
  { id: 'carrefour-mvog-mbi', name: 'Carrefour Mvog-Mbi', zone: 'Mvog-Mbi', latitude: 3.851768, longitude: 11.516407, address: 'Carrefour Mvog-Mbi, Yaoundé' },
  { id: 'carrefour-emia', name: 'Carrefour EMIA', zone: 'Bastos', latitude: 3.880943, longitude: 11.524687, address: 'Carrefour EMIA, Yaoundé' },
  { id: 'essos', name: 'Essos', zone: 'Essos', latitude: 3.874532, longitude: 11.546321, address: 'Essos, Yaoundé' },
  { id: 'nkolbisson', name: 'Nkolbisson', zone: 'Nkolbisson', latitude: 3.884315, longitude: 11.444268, address: 'Nkolbisson, Yaoundé' },
  { id: 'odza', name: 'Odza', zone: 'Odza', latitude: 3.808214, longitude: 11.541857, address: 'Odza, Yaoundé' },
  { id: 'damas', name: 'Damas', zone: 'Damas', latitude: 3.849632, longitude: 11.539228, address: 'Damas, Yaoundé' },
  { id: 'melen', name: 'Melen', zone: 'Melen', latitude: 3.852784, longitude: 11.489654, address: 'Melen, Yaoundé' },
  { id: 'hippodrome', name: 'Hippodrome', zone: 'Centre-Ville', latitude: 3.863902, longitude: 11.518841, address: 'Hippodrome, Yaoundé' },
  { id: 'montée-essomba', name: 'Montée Essomba', zone: 'Nkolbisson', latitude: 3.878412, longitude: 11.469823, address: 'Montée Essomba, Yaoundé' },
  { id: 'carrefour-meec', name: 'Carrefour MEEC', zone: 'Mvan', latitude: 3.833845, longitude: 11.502914, address: 'Carrefour MEEC, Yaoundé' },
  { id: 'quartier-briqueterie', name: 'La Briqueterie', zone: 'Briqueterie', latitude: 3.871376, longitude: 11.515672, address: 'Quartier Briqueterie, Yaoundé' },
  {
    id: 'bastos-emb',
    name: 'Bastos Ambassades',
    zone: 'Bastos',
    latitude: 3.8750,
    longitude: 11.5180,
    address: 'Quartier Bastos, Yaoundé',
  },
  {
    id: 'mvan-station',
    name: 'Mvan Bus Station (Gare Routière)',
    zone: 'Mvan',
    latitude: 3.8400,
    longitude: 11.5000,
    address: 'Complexe Mvan, Yaoundé',
  },
  {
    id: 'mokolo-marche',
    name: 'Marché Mokolo',
    zone: 'Mokolo',
    latitude: 3.8680,
    longitude: 11.5050,
    address: 'Grand Marché Mokolo, Yaoundé',
  },
  {
    id: 'biyem-assi-acacia',
    name: 'Biyem-Assi Carrefour Acacia',
    zone: 'Biyem-Assi',
    latitude: 3.8320,
    longitude: 11.4900,
    address: 'Carrefour Acacia, Biyem-Assi, Yaoundé',
  },
  {
    id: 'ave-kennedy',
    name: 'Avenue Kennedy (Centre-Ville)',
    zone: 'Centre-Ville',
    latitude: 3.8640,
    longitude: 11.5160,
    address: 'Avenue Monseigneur Vogt / Kennedy, Yaoundé',
  },
  {
    id: 'univ-yaounde1',
    name: 'Université de Yaoundé I (Ngoa-Ekellé)',
    zone: 'Ngoa-Ekellé',
    latitude: 3.8580,
    longitude: 11.5020,
    address: 'Campus Ngoa-Ekellé, Yaoundé',
  },
  {
    id: 'nsimalen-airport',
    name: 'Aéroport International de Nsimalen',
    zone: 'Nsimalen',
    latitude: 3.7200,
    longitude: 11.5500,
    address: 'Aéroport de Nsimalen, Yaoundé',
  },
  {
    id: 'palais-sports-warda',
    name: 'Palais des Sports (Warda)',
    zone: 'Warda',
    latitude: 3.8690,
    longitude: 11.5120,
    address: 'Carrefour Warda, Yaoundé',
  },
  {
    id: 'march-central',
    name: 'Marché Central de Yaoundé',
    zone: 'Centre-Ville',
    latitude: 3.8620,
    longitude: 11.5150,
    address: 'Marché Central, Yaoundé',
  },
  {
    id: 'etoudi-palais',
    name: 'Etoudi (Palais de l\'Unité)',
    zone: 'Etoudi',
    latitude: 3.9050,
    longitude: 11.5250,
    address: 'Etoudi, Yaoundé',
  },
  {
    id: 'omnisports-stade',
    name: 'Omnisports (Stade Ahmadou Ahidjo)',
    zone: 'Omnisports',
    latitude: 3.8820,
    longitude: 11.5380,
    address: 'Stade Omnisports, Yaoundé',
  },
  {
    id: 'ekounou-cf',
    name: 'Carrefour Ekounou',
    zone: 'Ekounou',
    latitude: 3.8350,
    longitude: 11.5220,
    address: 'Marché Ekounou, Yaoundé',
  },
];

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query || query.trim().length === 0) {
    return PRECISION_YAOUNDE_ZONES.slice(0, 6);
  }

  const cleanQuery = query.toLowerCase().trim();

  const matchedLocal = PRECISION_YAOUNDE_ZONES.filter(
    (item) =>
      item.name.toLowerCase().includes(cleanQuery) ||
      item.zone.toLowerCase().includes(cleanQuery) ||
      item.address.toLowerCase().includes(cleanQuery)
  );

  if (cleanQuery.length >= 2) {
    try {
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' Yaounde')}&limit=5`
      );
      const data = await response.json();
      if (data && Array.isArray(data.features) && data.features.length > 0) {
        const apiResults: PlaceSuggestion[] = data.features.map((feat: any, idx: number) => {
          const props = feat.properties || {};
          const coords = feat.geometry?.coordinates || [11.518, 3.875];
          const placeName = props.name || props.street || props.district || query;
          const placeCity = props.city || props.county || 'Yaoundé';

          return {
            id: `geo-${idx}-${props.osm_id || Math.random()}`,
            name: placeName,
            zone: placeCity,
            latitude: Number(coords[1].toFixed(6)),
            longitude: Number(coords[0].toFixed(6)),
            address: `${placeName}, ${placeCity}`,
          };
        });

        const yaoundeResults = apiResults.filter(
          (item) => item.latitude >= 3.65 && item.latitude <= 4.05 && item.longitude >= 11.35 && item.longitude <= 11.7
        );
        const combined = [...yaoundeResults, ...matchedLocal];
        for (const apiItem of yaoundeResults) {
          if (!combined.some((m) => m.name.toLowerCase() === apiItem.name.toLowerCase())) {
            combined.push(apiItem);
          }
        }
        return combined.slice(0, 8);
      }

      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=cm&q=${encodeURIComponent(query + ', Yaoundé, Cameroon')}`,
        { headers: { Accept: 'application/json', 'User-Agent': 'GRAP-Ride-App/1.0' } }
      );
      const nominatimData = await nominatimResponse.json();
      if (Array.isArray(nominatimData)) {
        const apiResults: PlaceSuggestion[] = nominatimData
          .map((item: any, idx: number) => ({
            id: `osm-${item.place_id || idx}`,
            name: item.name || item.display_name?.split(',')[0] || query,
            zone: item.address?.suburb || item.address?.city_district || 'Yaoundé',
            latitude: Number(Number(item.lat).toFixed(6)),
            longitude: Number(Number(item.lon).toFixed(6)),
            address: item.display_name || `${query}, Yaoundé`,
          }))
          .filter((item: PlaceSuggestion) => item.latitude >= 3.65 && item.latitude <= 4.05 && item.longitude >= 11.35 && item.longitude <= 11.7);
        return [...matchedLocal, ...apiResults.filter((item) => !matchedLocal.some((local) => local.name.toLowerCase() === item.name.toLowerCase()))].slice(0, 8);
      }
    } catch (e) {
      console.log('Online search fallback:', e);
    }
  }

  return matchedLocal.length > 0 ? matchedLocal : PRECISION_YAOUNDE_ZONES.slice(0, 6);
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceSuggestion> {
  const fallbackName = `Pinned location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { headers: { Accept: 'application/json', 'User-Agent': 'GRAP-Ride-App/1.0' } }
    );
    const data = await response.json();
    const address = data.address || {};
    const name = data.name || address.road || address.suburb || fallbackName;
    return {
      id: `reverse-${latitude}-${longitude}`,
      name,
      zone: address.suburb || address.city_district || address.city || 'Yaoundé',
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      address: data.display_name || fallbackName,
    };
  } catch (error) {
    console.log('Reverse geocoding error:', error);
    return {
      id: `pin-${latitude}-${longitude}`,
      name: fallbackName,
      zone: 'Yaoundé',
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      address: fallbackName,
    };
  }
}

/**
 * Realistic Yango FCFA Pricing Algorithm (Yaoundé, Cameroon)
 * Realistic FCFA rates per category matching Yango standard urban pricing.
 */
export function calculateMultiFactorCategoryFare(
  distanceKm: number,
  categoryCode: string,
  hour?: number,
  weather: string = 'CLEAR'
): number {
  const dist = distanceKm < 1.0 ? 1.0 : distanceKm;

  let baseFare = 300;
  let ratePerKm = 100;
  let minFare = 400;

  switch (categoryCode) {
    case 'MOTO':
      baseFare = 250;
      ratePerKm = 70;
      minFare = 400;
      break;
    case 'COMFORT':
      baseFare = 700;
      ratePerKm = 150;
      minFare = 1000;
      break;
    case 'COMFORT_PLUS':
      baseFare = 1000;
      ratePerKm = 200;
      minFare = 1500;
      break;
    case 'ECONOMY':
    default:
      baseFare = 300;
      ratePerKm = 100;
      minFare = 400;
      break;
  }

  const rawFare = baseFare + (dist * ratePerKm);

  // 1. Time-of-Day Multiplier
  const currentHour = hour !== undefined ? hour : new Date().getHours();
  let timeMultiplier = 1.0;
  if (currentHour >= 21 || currentHour < 6) {
    timeMultiplier = 1.35; // Night Shift Surge (+35%)
  } else if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
    timeMultiplier = 1.20; // Peak Rush Hour Surge (+20%)
  }

  // 2. Weather Multiplier
  let weatherMultiplier = 1.0;
  const wUpper = weather.toUpperCase();
  if (wUpper.includes('HEAVY') || wUpper.includes('THUNDER') || wUpper === 'HEAVY_RAIN') {
    weatherMultiplier = 1.40; // Heavy Rain Surge (+40%)
  } else if (wUpper.includes('RAIN') || wUpper.includes('DRIZZLE') || wUpper === 'RAIN') {
    weatherMultiplier = 1.20; // Rain Surge (+20%)
  }

  const totalFare = rawFare * timeMultiplier * weatherMultiplier;
  const fareWithMin = Math.max(totalFare, minFare);
  
  // Round to nearest 50 FCFA
  const roundedFCFA = Math.round(fareWithMin / 50) * 50;
  return roundedFCFA;
}

export function getDynamicFareSurgeBadges(hour?: number, weather: string = 'CLEAR'): string[] {
  const currentHour = hour !== undefined ? hour : new Date().getHours();
  const badges: string[] = [];

  if (currentHour >= 21 || currentHour < 6) {
    badges.push('🌙 Night Shift (+35%)');
  } else if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
    badges.push('⚡ Rush Hour (+20%)');
  }

  const wUpper = weather.toUpperCase();
  if (wUpper.includes('HEAVY') || wUpper.includes('THUNDER') || wUpper === 'HEAVY_RAIN') {
    badges.push('🌧️ Heavy Rain Surge (+40%)');
  } else if (wUpper.includes('RAIN') || wUpper.includes('DRIZZLE') || wUpper === 'RAIN') {
    badges.push('🌦️ Rain Surge (+20%)');
  }

  return badges;
}

export async function getDrivingDistanceKm(
  pickupLat: number,
  pickupLng: number,
  destinationLat: number,
  destinationLng: number,
): Promise<number | null> {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${destinationLng},${destinationLat}?overview=false`,
    );
    const data = await response.json();
    const meters = data?.routes?.[0]?.distance;
    if (typeof meters === 'number' && Number.isFinite(meters)) {
      return Number((meters / 1000).toFixed(2));
    }
  } catch (error) {
    console.log('Road distance lookup failed:', error);
  }
  return null;
}
