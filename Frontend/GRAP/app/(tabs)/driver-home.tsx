import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LeafletMap from '../../components/LeafletMap';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function DriverHomeScreen() {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [earnings, setEarnings] = useState({ total: 0, balance: 0 });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [requests, earningsData] = await Promise.all([api.getRideRequests(), api.getDriverEarnings()]);
        setRequestCount(requests.length);
        setEarnings({
          total: Number(earningsData.total_net_earnings || 0),
          balance: Number(earningsData.available_balance || 0),
        });
      } catch (e) {
        console.log('Dashboard data error:', e);
      }
    };

    loadDashboard();
  }, []);

  const displayName = user?.first_name || user?.username || 'Driver';
  const formatCurrency = (value: number) => `${Math.round(value).toLocaleString()} FCFA`;

  const toggleStatus = async (val: boolean) => {
    const previousStatus = isOnline;
    setIsOnline(val);
    setIsUpdatingStatus(true);
    try {
      await api.toggleDriverStatus(val);
    } catch (e) {
      console.log('Status error:', e);
      setIsOnline(previousStatus);
      Alert.alert('Connection issue', 'Your availability could not be updated. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* REAL INTERACTIVE LEAFLET OPENSTREETMAP */}
      <LeafletMap
        pickupLat={3.8400}
        pickupLng={11.5000}
        destLat={3.8750}
        destLng={11.5180}
        pickupName="Mvan Demand Zone"
        destName="Bastos Demand Zone"
      />

      {/* Floating Status & Earnings Header */}
      <View style={[styles.topStatusCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.topStatusRow}>
          <View style={styles.driverInfoGroup}>
            <View style={[styles.driverDot, { backgroundColor: isOnline ? colors.primary : colors.subText }]} />
            <View>
              <Text style={[styles.driverGreeting, { color: colors.text }]}>{t('driverWelcome')}, {displayName}</Text>
              <Text style={[styles.todayEarningsText, { color: colors.subText }]}>{isOnline ? t('youAreOnline') : t('youAreOffline')}</Text>
            </View>
          </View>
          {isUpdatingStatus ? <ActivityIndicator color={colors.secondary} /> : <Switch value={isOnline} onValueChange={toggleStatus} trackColor={{ false: colors.cardBorder, true: colors.secondary }} />}
        </View>

        <View style={[styles.metricsRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(earnings.total)}</Text>
            <Text style={[styles.metricLabel, { color: colors.subText }]}>Net earnings</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{requestCount}</Text>
            <Text style={[styles.metricLabel, { color: colors.subText }]}>Open requests</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(earnings.balance)}</Text>
            <Text style={[styles.metricLabel, { color: colors.subText }]}>Available</Text>
          </View>
        </View>
      </View>

      {/* Floating Demand Hotspots Widget */}
      <View style={[styles.demandWidget, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.widgetHeader}>
          <Ionicons name="flame" size={16} color="#FF5252" />
          <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('demandNearYou')}</Text>
          <Text style={[styles.requestCount, { color: colors.secondary }]}>{requestCount} open</Text>
        </View>

        <View style={styles.zoneRow}>
          <Text style={[styles.zoneText, { color: colors.subText }]}>Mvan Station</Text>
          <View style={styles.highBadge}>
            <Text style={styles.highBadgeText}>HIGH DEMAND</Text>
          </View>
        </View>

        <View style={styles.zoneRow}>
          <Text style={[styles.zoneText, { color: colors.subText }]}>Bastos</Text>
          <View style={styles.medBadge}>
            <Text style={styles.medBadgeText}>MEDIUM</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.goOnlineBtn, { backgroundColor: colors.secondary }]} onPress={() => router.push('/driver-requests')}>
          <Ionicons name="list-outline" size={18} color="#0B1325" />
          <Text style={styles.goOnlineText}>{language === 'en' ? 'View ride requests' : 'Voir les demandes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.cardBorder }]} onPress={() => toggleStatus(!isOnline)} disabled={isUpdatingStatus}>
          <Text style={[styles.secondaryActionText, { color: colors.text }]}>{isOnline ? t('goOffline') : t('goOnline')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topStatusCard: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    elevation: 8,
    zIndex: 10,
  },
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  driverGreeting: {
    fontSize: 15,
    fontWeight: '800',
  },
  todayEarningsText: {
    fontSize: 12,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  metricDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  demandWidget: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    elevation: 10,
    zIndex: 10,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  requestCount: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
  },
  widgetTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneText: {
    fontSize: 13,
  },
  highBadge: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  highBadgeText: {
    color: '#FF5252',
    fontSize: 10,
    fontWeight: '800',
  },
  medBadge: {
    backgroundColor: 'rgba(255, 214, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  medBadgeText: {
    color: '#FFD600',
    fontSize: 10,
    fontWeight: '800',
  },
  goOnlineBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  goOnlineText: {
    color: '#0B1325',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryAction: {
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
