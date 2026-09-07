export async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceSuggestion> {
  const fallbackName = `GPS Position (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { headers: { Accept: 'application/json', 'User-Agent': 'GRAP-Ride-App/1.0' } }
    );
    const data = await response.json();
    const address = data.address || {};

    const displayLower = String(data.display_name || '').toLowerCase();
    const roadLower = String(address.road || '').toLowerCase();
    const isMbalmayo = displayLower.includes('mbalmayo') || roadLower.includes('mbalmayo') || roadLower.includes('mbal');

    const name =
      data.name ||
      (isMbalmayo ? '' : address.road) ||
      address.suburb ||
      address.city_district ||
      address.city ||
      'Yaoundé';

    const zone = address.suburb || address.city_district || address.city || 'Yaoundé';
    const displayAddress = isMbalmayo ? `${name}, ${zone}, Yaoundé, Cameroon` : data.display_name;

    return {
      id: `reverse-${latitude}-${longitude}`,
      name,
      zone,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      address: displayAddress,
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