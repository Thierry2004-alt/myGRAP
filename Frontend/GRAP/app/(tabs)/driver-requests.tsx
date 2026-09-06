import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function DriverRequestsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
      console.log('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    setAcceptingId(id);
    try {
      await api.acceptRide(id);
      Alert.alert('Ride Accepted!', `You accepted ride #${id}. Navigate to pickup.`);
      loadRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not accept ride');
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('requests')}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadRequests}>
          <Ionicons name="refresh" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.secondary} style={{ marginVertical: 20 }} />
      ) : requests.length > 0 ? (
        requests.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.cardTop}>
              <View style={[styles.categoryBadge, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.categoryText, { color: colors.secondary }]}>{item.category_name || 'Economy'}</Text>
              </View>
              <Text style={[styles.fareText, { color: colors.primary }]}>{item.estimated_fare} FCFA</Text>
            </View>

            <Text style={[styles.passengerName, { color: colors.text }]}>Passenger: {item.passenger_name || 'Rider'}</Text>

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
                  <Text style={styles.acceptBtnText}>Accept Request</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.rejectBtn} onPress={() => loadRequests()}>
                <Text style={styles.rejectBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardTop}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.categoryText, { color: colors.secondary }]}>Economy • 6.4 km</Text>
            </View>
            <Text style={[styles.fareText, { color: colors.primary }]}>2,000 FCFA</Text>
          </View>

          <Text style={[styles.passengerName, { color: colors.text }]}>Passenger: Jean Kamga</Text>

          <View style={[styles.routeBox, { backgroundColor: colors.inputBg }]}>
            <View style={styles.routeRow}>
              <Ionicons name="radio-button-on" size={14} color={colors.primary} />
              <Text style={[styles.routeText, { color: colors.text }]}>Mvan Bus Station</Text>
            </View>
            <View style={styles.routeRow}>
              <Ionicons name="location-sharp" size={14} color="#FF5252" />
              <Text style={[styles.routeText, { color: colors.text }]}>Bastos Ambassades</Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={() => Alert.alert('Accepted', 'Accepted ride from Mvan to Bastos!')}>
              <Text style={styles.acceptBtnText}>Accept Ride</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.rejectBtn}>
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  refreshBtn: {
    padding: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fareText: {
    fontSize: 18,
    fontWeight: '900',
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  routeBox: {
    padding: 10,
    borderRadius: 10,
    gap: 6,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    fontSize: 13,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#0B1325',
    fontSize: 14,
    fontWeight: '800',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FF5252',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
