import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function DriverRequestsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  useEffect(() => {
    loadRequests();
    // Auto-refresh requests every 5 seconds for real-time order broadcast
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      const data = await api.getRideRequests();
      setRequests(data || []);
    } catch (e) {
      console.log('Error loading requests:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    setAcceptingId(id);
    try {
      await api.acceptRide(id);
      Alert.alert(
        t('Ride Accepted!'),
        t('You have accepted ride #{id}. Proceed to pickup passenger.').replace('{id}', String(id)),
        [
          {
            text: t('Go to Trip Navigation'),
            onPress: () => router.push('/driver-home'),
          },
        ]
      );
      router.push('/driver-home');
    } catch (e: any) {
      Alert.alert(t('Error'), e.message ? t(e.message) : t('Could not accept ride'));
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('requests')}</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            setLoading(true);
            loadRequests();
          }}
        >
          <Ionicons name="refresh" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {loading && requests.length === 0 ? (
        <ActivityIndicator color={colors.secondary} style={{ marginVertical: 20 }} />
      ) : requests.length > 0 ? (
        requests.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.cardTop}>
              <View style={[styles.categoryBadge, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.categoryText, { color: colors.secondary }]}>
                  {item.category_name || 'Economy'} • {(Number(item.distance_km) || 4.5).toFixed(1)} km
                </Text>
              </View>
              <Text style={[styles.fareText, { color: colors.primary }]}>{item.estimated_fare} FCFA</Text>
            </View>

            <Text style={[styles.passengerName, { color: colors.text }]}>
              Passenger: {item.passenger_name || item.passenger_username || 'Rider'}
            </Text>

            <View style={[styles.routeBox, { backgroundColor: colors.inputBg }]}>
              <View style={styles.routeRow}>
                <Ionicons name="radio-button-on" size={14} color={colors.primary} />
                <Text style={[styles.routeText, { color: colors.text }]}>{item.pickup_name}</Text>
              </View>
              <View style={styles.routeRow}>
                <Ionicons name="location-sharp" size={14} color="#FF5252" />
                <Text style={[styles.routeText, { color: colors.text }]}>{item.destination_name}</Text>
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleAccept(item.id)}
                disabled={acceptingId === item.id}
              >
                {acceptingId === item.id ? (
                  <ActivityIndicator color="#0B1325" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#0B1325" style={{ marginRight: 6 }} />
                    <Text style={styles.acceptBtnText}>{t('Accept Request')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.rejectBtn} onPress={() => loadRequests()}>
                <Text style={styles.rejectBtnText}>{t('Decline')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 30, alignItems: 'center' }]}>
          <Ionicons name="car-outline" size={48} color={colors.subText} style={{ marginBottom: 12 }} />
          <Text style={[styles.passengerName, { color: colors.text, fontSize: 16, fontWeight: '700' }]}>
            No Pending Ride Requests
          </Text>
          <Text style={[styles.routeText, { color: colors.subText, textAlign: 'center', marginTop: 6 }]}>
            Real passenger ride requests in your area will appear here automatically.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  refreshBtn: {
    padding: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fareText: {
    fontSize: 16,
    fontWeight: '800',
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  routeBox: {
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#0B1325',
    fontWeight: '800',
    fontSize: 14,
  },
  rejectBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FF525220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    color: '#FF5252',
    fontWeight: '700',
    fontSize: 13,
  },
});
