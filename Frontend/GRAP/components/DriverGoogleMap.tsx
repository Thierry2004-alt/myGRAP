import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import type { RidePosition } from '../hooks/useRideLocationTracking';

interface DriverGoogleMapProps {
  rideState?: string;
  pickup?: RidePosition | null;
  destination?: RidePosition | null;
  driverPosition: RidePosition | null;
  passengerPosition?: RidePosition | null;
}

const YAOUNDE_REGION: Region = {
  latitude: 3.848,
  longitude: 11.5021,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function DriverGoogleMap({
  rideState,
  pickup,
  destination,
  driverPosition,
  passengerPosition,
}: DriverGoogleMapProps) {
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const lastRouteOriginRef = useRef<RidePosition | null>(null);
  const driverPositionRef = useRef(driverPosition);
  const activeTarget = rideState === 'IN_PROGRESS' ? destination : pickup;
  const showRoute = Boolean(
    rideState &&
    rideState !== 'DRIVER_AT_PICKUP' &&
    driverPosition &&
    activeTarget
  );

  driverPositionRef.current = driverPosition;

  useEffect(() => {
    if (!showRoute || !driverPosition || !activeTarget) {
      setRouteCoordinates([]);
      lastRouteOriginRef.current = null;
      return;
    }

    let active = true;
    const controller = new AbortController();
    const fetchRoute = async () => {
      const origin = driverPositionRef.current;
      if (!origin) return;
      const previousOrigin = lastRouteOriginRef.current;
      if (
        previousOrigin &&
        Math.abs(previousOrigin.lat - origin.lat) < 0.001 &&
        Math.abs(previousOrigin.lng - origin.lng) < 0.001
      ) {
        return;
      }
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${origin.lng},${origin.lat};${activeTarget.lng},${activeTarget.lat}` +
        '?overview=full&geometries=geojson';

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
        const data = await response.json();
        const coordinates = data.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
          throw new Error('No driving route was returned.');
        }
        if (!active) return;
        setRouteCoordinates(
          coordinates.map(([longitude, latitude]: [number, number]) => ({ latitude, longitude }))
        );
        lastRouteOriginRef.current = origin;
      } catch (error) {
        if (controller.signal.aborted || !active) return;
        console.error('Unable to load driver road route:', error);
        setRouteCoordinates([]);
      }
    };

    void fetchRoute();
    const interval = setInterval(fetchRoute, 30000);
    return () => {
      active = false;
      clearInterval(interval);
      controller.abort();
    };
  }, [activeTarget?.lat, activeTarget?.lng, rideState, showRoute]);

  const initialRegion = useMemo<Region>(() => {
    const center = driverPosition || pickup || YAOUNDE_REGION;
    return {
      latitude: 'lat' in center ? center.lat : YAOUNDE_REGION.latitude,
      longitude: 'lng' in center ? center.lng : YAOUNDE_REGION.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>Google Maps navigation is available in the GRAP mobile app.</Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton
      toolbarEnabled={false}
      loadingEnabled
    >
      {pickup ? (
        <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Passenger pickup">
          <View style={styles.pickupMarker}><Text style={styles.pickupMarkerText}>P</Text></View>
        </Marker>
      ) : null}
      {destination && rideState === 'IN_PROGRESS' ? (
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title="Destination"
          pinColor="#e53935"
        />
      ) : null}
      {passengerPosition && ['ACCEPTED', 'DRIVER_ARRIVING'].includes(rideState || '') ? (
        <Marker
          coordinate={{ latitude: passengerPosition.lat, longitude: passengerPosition.lng }}
          title="Passenger live location"
        >
          <View style={styles.passengerMarker}><Text style={styles.passengerMarkerText}>P</Text></View>
        </Marker>
      ) : null}
      {driverPosition ? (
        <Marker
          coordinate={{ latitude: driverPosition.lat, longitude: driverPosition.lng }}
          title="Your live location"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.driverMarker}><Text style={styles.driverMarkerText}>🚕</Text></View>
        </Marker>
      ) : null}
      {routeCoordinates.length > 0 ? (
        <Polyline coordinates={routeCoordinates} strokeColor="#1677ff" strokeWidth={7} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFill,
  },
  driverMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd600',
    borderColor: '#fff',
    borderWidth: 3,
    elevation: 6,
  },
  driverMarkerText: {
    fontSize: 22,
  },
  pickupMarker: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#00c853',
    borderColor: '#fff',
    borderWidth: 2,
  },
  pickupMarkerText: {
    color: '#fff',
    fontWeight: '800',
  },
  passengerMarker: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#0288d1',
    borderColor: '#fff',
    borderWidth: 2,
  },
  passengerMarkerText: {
    color: '#fff',
    fontWeight: '800',
  },
  webFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8eef4',
  },
  webFallbackText: {
    padding: 20,
    color: '#27364b',
    textAlign: 'center',
  },
});
