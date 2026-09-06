import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapSimProps {
  pickupName?: string;
  destinationName?: string;
  showRoute?: boolean;
  isDriverView?: boolean;
  statusText?: string;
}

export default function MapSim({
  pickupName = 'Mvan Bus Station',
  destinationName = 'Bastos Ambassades',
  showRoute = true,
  isDriverView = false,
  statusText,
}: MapSimProps) {
  return (
    <View style={styles.mapContainer}>
      {/* Map Grid Background Simulation */}
      <View style={styles.gridOverlay}>
        <View style={styles.gridLineHorizontal1} />
        <View style={styles.gridLineHorizontal2} />
        <View style={styles.gridLineHorizontal3} />
        <View style={styles.gridLineVertical1} />
        <View style={styles.gridLineVertical2} />

        {/* Road networks simulation */}
        <View style={styles.mainRoadVertical} />
        <View style={styles.mainRoadHorizontal} />
        <View style={styles.diagonalRoad} />

        {/* City Zone Labels */}
        <Text style={[styles.zoneLabel, { top: 60, left: 40 }]}>Bastos</Text>
        <Text style={[styles.zoneLabel, { top: 180, right: 50 }]}>Mvan</Text>
        <Text style={[styles.zoneLabel, { bottom: 100, left: 60 }]}>Mokolo</Text>
        <Text style={[styles.zoneLabel, { bottom: 150, right: 70 }]}>Biyem-Assi</Text>

        {/* Nearby Moving Car Icons */}
        <View style={[styles.carMarker, { top: 110, left: 120 }]}>
          <Ionicons name="car-sport" size={18} color="#00E676" />
        </View>
        <View style={[styles.carMarker, { top: 220, right: 90 }]}>
          <Ionicons name="car-sport" size={18} color="#29B6F6" />
        </View>
        <View style={[styles.carMarker, { bottom: 180, left: 150 }]}>
          <Ionicons name="car-sport" size={18} color="#FFD600" />
        </View>

        {/* Route Line Simulation */}
        {showRoute && (
          <View style={styles.routeLineContainer}>
            <View style={styles.routePolyline} />

            {/* Pickup Marker */}
            <View style={styles.pickupMarkerContainer}>
              <View style={styles.pickupPulse} />
              <View style={styles.pickupDot} />
              <View style={styles.markerLabelCard}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  {pickupName}
                </Text>
              </View>
            </View>

            {/* Destination Marker */}
            <View style={styles.destMarkerContainer}>
              <Ionicons name="location-sharp" size={32} color="#FF5252" />
              <View style={styles.markerLabelCardDest}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  {destinationName}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Status Badge overlay on Map */}
        {statusText && (
          <View style={styles.mapStatusBadge}>
            <Ionicons name="navigate-circle" size={16} color="#00E676" />
            <Text style={styles.mapStatusText}>{statusText}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A', // Yango sleek dark map background
    overflow: 'hidden',
  },
  gridOverlay: {
    flex: 1,
    position: 'relative',
  },
  gridLineHorizontal1: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1E293B',
  },
  gridLineHorizontal2: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1E293B',
  },
  gridLineHorizontal3: {
    position: 'absolute',
    top: '75%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1E293B',
  },
  gridLineVertical1: {
    position: 'absolute',
    left: '33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1E293B',
  },
  gridLineVertical2: {
    position: 'absolute',
    left: '66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1E293B',
  },
  mainRoadVertical: {
    position: 'absolute',
    left: '48%',
    top: 0,
    bottom: 0,
    width: 22,
    backgroundColor: '#1E293B',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#334155',
  },
  mainRoadHorizontal: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  diagonalRoad: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: 300,
    height: 16,
    backgroundColor: '#1E293B',
    transform: [{ rotate: '35deg' }],
  },
  zoneLabel: {
    position: 'absolute',
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  carMarker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  routeLineContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  routePolyline: {
    position: 'absolute',
    top: '30%',
    left: '30%',
    width: '40%',
    height: 160,
    borderWidth: 4,
    borderColor: '#00E676',
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  pickupMarkerContainer: {
    position: 'absolute',
    top: '28%',
    left: '26%',
    alignItems: 'center',
  },
  pickupPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 230, 118, 0.25)',
  },
  pickupDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00E676',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginTop: 10,
  },
  markerLabelCard: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00E676',
    marginTop: 4,
    maxWidth: 120,
  },
  destMarkerContainer: {
    position: 'absolute',
    top: '60%',
    left: '64%',
    alignItems: 'center',
  },
  markerLabelCardDest: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF5252',
    marginTop: 2,
    maxWidth: 120,
  },
  markerLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  mapStatusBadge: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00E676',
    gap: 6,
  },
  mapStatusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
