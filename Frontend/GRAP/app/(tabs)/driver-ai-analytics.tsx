import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function DriverAIAnalyticsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAIRecommendations();
  }, []);

  const loadAIRecommendations = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getDriverAIRecommendations();
      setData(res);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load driver analytics.');
    } finally {
      setLoading(false);
    }
  };

  const totalSearches = data?.total_platform_searches || 0;
  const completedTrips = data?.driver_total_rides || 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Header Banner */}
      <View style={[styles.aiHeaderBanner, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <View style={[styles.aiBadge, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aiTitle, { color: colors.text }]}>{t('Driver Analytics')}</Text>
          <Text style={[styles.aiSub, { color: colors.subText }]}>
            {t('Live platform search and completed-trip totals.')}
          </Text>
        </View>
        <TouchableOpacity onPress={loadAIRecommendations} style={{ padding: 4 }}>
          <Ionicons name="reload" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Real-time Platform Search Metrics */}
      <View style={[styles.metricRow]}>
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search-circle" size={24} color={colors.primary} />
          <Text style={[styles.metricValue, { color: colors.text }]}>{totalSearches}</Text>
          <Text style={[styles.metricLabel, { color: colors.subText }]}>{t('Real Passenger Searches')}</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
          <Text style={[styles.metricValue, { color: colors.text }]}>{completedTrips}</Text>
          <Text style={[styles.metricLabel, { color: colors.subText }]}>{t('Completed Trips')}</Text>
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />}
      {!loading && loadError && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.emptyText, { color: colors.subText }]}>{loadError}</Text>
          <TouchableOpacity onPress={loadAIRecommendations} style={{ padding: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('Try again')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  aiHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  aiBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  aiSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
