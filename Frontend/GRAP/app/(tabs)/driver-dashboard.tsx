import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

export default function DriverDashboardScreen() {
  const [isOnline, setIsOnline] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRideRequests();
      setRequests(data);
    } catch (e) {
      console.log('Error loading requests:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (value: boolean) => {
    setIsOnline(value);
    try {
      await api.toggleDriverStatus(value);
    } catch (e) {
      console.log('Status toggle error:', e);
    }
  };

  const handleAcceptRide = async (rideId: number) => {
    setAcceptingId(rideId);
    try {
      const accepted = await api.acceptRide(rideId);
      Alert.alert('Ride Accepted!', `You have accepted ride #${accepted.id}. Proceed to pickup.`);
      loadRequests();
    } catch (e: any) {
      Alert.alert('Accept Error', e.message || 'Could not accept ride');
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Online Status Toggle Banner */}
      <View style={[styles.statusCard, isOnline ? styles.statusCardOnline : styles.statusCardOffline]}>
        <View style={styles.statusInfo}>
          <Ionicons
            name={isOnline ? 'checkmark-circle' : 'moon'}
            size={24}
            color={isOnline ? '#00E676' : '#90A4AE'}
          />
          <View>
            <Text style={styles.statusLabel}>{isOnline ? 'YOU ARE ONLINE' : 'YOU ARE OFFLINE'}</Text>
            <Text style={styles.statusSub}>
              {isOnline ? 'Receiving incoming ride requests nearby' : 'Go online to start receiving ride requests'}
            </Text>
          </View>
        </View>
        <Switch value={isOnline} onValueChange={toggleStatus} trackColor={{ false: '#37474F', true: '#00E676' }} />
      </View>

      {/* Vehicle Info Box */}
      <View style={styles.vehicleCard}>
        <Ionicons name="car-sport" size={24} color="#29B6F6" />
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle}>Assigned Vehicle: Toyota Yaris</Text>
          <Text style={styles.vehicleSub}>Plate: CE-992-AA • Economy Category</Text>
        </View>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
        </View>
      </View>

      {/* Incoming Requests Feed Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Incoming Ride Requests</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadRequests}>
          <Ionicons name="refresh" size={18} color="#29B6F6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#29B6F6" style={{ marginVertical: 20 }} />
      ) : requests.length > 0 ? (
        requests.map((req) => (
          <View key={req.id} style={styles.requestCard}>
            <View style={styles.reqTopRow}>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{req.category_name || 'Economy'}</Text>
              </View>
              <Text style={styles.fareTag}>{req.estimated_fare} FCFA</Text>
            </View>

            <Text style={styles.passengerText}>Passenger: {req.passenger_name || 'Passenger'}</Text>

            <View style={styles.routeBox}>
              <View style={styles.routeItem}>
                <Ionicons name="radio-button-on" size={14} color="#00E676" />
                <Text style={styles.routeText}>{req.pickup_name}</Text>
              </View>
              <View style={styles.routeItem}>
                <Ionicons name="location-sharp" size={14} color="#FF5252" />
                <Text style={styles.routeText}>{req.destination_name}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAcceptRide(req.id)}
              disabled={acceptingId === req.id}
            >
              {acceptingId === req.id ? (
                <ActivityIndicator color="#0B1325" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#0B1325" style={{ marginRight: 6 }} />
                  <Text style={styles.acceptBtnText}>Accept Ride Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="car-outline" size={40} color="#546E7A" style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>No Pending Requests</Text>
          <Text style={styles.emptySub}>
            New requests in your area will appear here automatically when passengers place orders.
          </Text>
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
  statusCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusCardOnline: {
    borderColor: 'rgba(0, 230, 118, 0.4)',
  },
  statusCardOffline: {
    borderColor: '#1E2D4A',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  statusSub: {
    color: '#90A4AE',
    fontSize: 12,
    marginTop: 2,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131C31',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    gap: 12,
    marginBottom: 20,
  },
  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  vehicleSub: {
    color: '#90A4AE',
    fontSize: 12,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(41, 182, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: '#29B6F6',
    fontSize: 10,
    fontWeight: '700',
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedTitle: {
    color: '#ECEFF1',
    fontSize: 16,
    fontWeight: '700',
  },
  refreshBtn: {
    padding: 6,
  },
  requestCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    marginBottom: 14,
  },
  reqTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTag: {
    backgroundColor: '#1E2D4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryTagText: {
    color: '#29B6F6',
    fontSize: 12,
    fontWeight: '600',
  },
  fareTag: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '800',
  },
  passengerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  routeBox: {
    backgroundColor: '#0A0F1D',
    padding: 10,
    borderRadius: 10,
    gap: 6,
    marginBottom: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    color: '#ECEFF1',
    fontSize: 13,
  },
  acceptBtn: {
    backgroundColor: '#00E676',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#0B1325',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#78909C',
    fontSize: 13,
    textAlign: 'center',
  },
});
