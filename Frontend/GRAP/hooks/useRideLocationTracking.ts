import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export interface RidePosition {
  lat: number;
  lng: number;
}

interface UseRideLocationTrackingOptions {
  rideId?: string | number | null;
  enabled: boolean;
  role: 'driver' | 'passenger';
  isConnected: boolean;
  send: (data: unknown) => void;
}

export function useRideLocationTracking({
  rideId,
  enabled,
  role,
  isConnected,
  send,
}: UseRideLocationTrackingOptions) {
  const [position, setPosition] = useState<RidePosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const lastAcceptedFixRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setLocationError(null);
      lastAcceptedFixRef.current = null;
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    lastAcceptedFixRef.current = null;

    const startTracking = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setLocationError('Allow location access during this ride to share your live position.');
          return;
        }

        setLocationError('Waiting for an accurate GPS location...');
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1500,
            distanceInterval: 3,
          },
          ({ coords, timestamp }) => {
            if (!active || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
            if (coords.accuracy !== null && coords.accuracy > 50) {
              setLocationError('GPS accuracy is weak. Move outdoors or enable precise location for a better position.');
              return;
            }
            setLocationError(null);

            const fix = { lat: coords.latitude, lng: coords.longitude, timestamp };
            const previousFix = lastAcceptedFixRef.current;
            if (previousFix) {
              const distance = distanceInMeters(previousFix, fix);
              const elapsedSeconds = Math.max(0.5, (timestamp - previousFix.timestamp) / 1000);
              const minimumMovement = Math.max(6, Math.min(12, (coords.accuracy ?? 12) * 0.5));

              if (distance < minimumMovement) return;
              if (distance / elapsedSeconds > 45) return;
            }

            lastAcceptedFixRef.current = fix;
            setPosition({ lat: fix.lat, lng: fix.lng });
          }
        );

        if (!active) subscription.remove();
      } catch (error) {
        console.error('Ride location tracking failed:', error);
        if (active) setLocationError('Unable to read your location. Check device location settings.');
      }
    };

    startTracking();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, rideId]);

  useEffect(() => {
    if (!enabled || !rideId || !position || !isConnected) return;
    send({
      action: `${role}_location`,
      latitude: position.lat,
      longitude: position.lng,
    });
  }, [enabled, isConnected, position, rideId, role, send]);

  return { position, locationError };
}

function distanceInMeters(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.lat - first.lat);
  const longitudeDelta = radians(second.lng - first.lng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.lat)) *
      Math.cos(radians(second.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
