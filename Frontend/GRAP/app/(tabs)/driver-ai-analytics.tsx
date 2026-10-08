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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAIRecommendations();
  }, []);

  const loadAIRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.getDriverAIRecommendations();
      setData(res);
    } catch (e) {
      console.log('AI Recommendations error:', e);
    } finally {
      setLoading(false);
    }
  };

  const topZones = data?.top_demand_zones || [];
  const recommendations = data?.ai_recommendations || [];
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
          <Text style={[styles.aiTitle, { color: colors.text }]}>GRAP Driver AI Decision Support</Text>
          <Text style={[styles.aiSub, { color: colors.subText }]}>
            Live platform search analytics & personalized operational recommendations to maximize earnings.
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
          <Text style={[styles.metricLabel, { color: colors.subText }]}>Real Passenger Searches</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
          <Text style={[styles.metricValue, { color: colors.text }]}>{completedTrips}</Text>
          <Text style={[styles.metricLabel, { color: colors.subText }]}>Completed Trips</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
      ) : (
        <>
          {/* Personalized Routine Recommendations */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('personalAdvice') || 'Personalized AI Recommendations'}
          </Text>

          {recommendations.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.emptyText, { color: colors.subText }]}>
                Complete more trips to generate customized routine insights.
              </Text>
            </View>
          ) : (
            recommendations.map((rec: any, idx: number) => (
              <View key={rec.id || idx} style={[styles.recCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.recTopRow}>
                  <View style={styles.recTitleGroup}>
                    <Ionicons name="bulb" size={18} color="#FFD600" />
                    <Text style={[styles.recCardTitle, { color: colors.text }]}>{rec.title}</Text>
                  </View>
                  <View style={styles.confidenceTag}>
                    <Text style={styles.confidenceText}>{Math.round((rec.confidence || 0.9) * 100)}% Match</Text>
                  </View>
                </View>

                <Text style={[styles.recMessage, { color: colors.text }]}>{rec.message}</Text>

                <View style={styles.recFooter}>
                  {rec.target_zone && (
                    <View style={[styles.recPill, { backgroundColor: colors.inputBg }]}>
                      <Ionicons name="location" size={12} color={colors.primary} />
                      <Text style={[styles.recPillText, { color: colors.text }]}>{rec.target_zone}</Text>
                    </View>
                  )}
                  {rec.time_window && (
                    <View style={[styles.recPill, { backgroundColor: colors.inputBg }]}>
                      <Ionicons name="time" size={12} color={colors.secondary} />
                      <Text style={[styles.recPillText, { color: colors.text }]}>{rec.time_window}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}

          {/* Real High Demand Zones */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 10 }]}>
            {t('highDemandZones') || 'High Demand Search Zones'}
          </Text>
          <View style={styles.zoneGrid}>
            {topZones.map((zone: any, idx: number) => {
              const score = zone.demand_score || 80;
              const searchCount = zone.total_searches || 1;

              return (
                <View key={idx} style={[styles.zoneCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.zoneHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.zoneName, { color: colors.text }]}>{zone.zone_name}</Text>
                      <Text style={[styles.zoneTime, { color: colors.subText }]}>
                        Peak Window: {zone.peak_time} • {searchCount} searches logged
                      </Text>
                    </View>
                    <Ionicons name="flame" size={20} color={score > 85 ? '#FF5252' : '#FFB300'} />
                  </View>

                  <View style={[styles.progressTrack, { backgroundColor: colors.inputBg }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${score}%`,
                          backgroundColor: score > 85 ? '#FF5252' : '#FFB300',
                        },
                      ]}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={[styles.scoreText, { color: colors.subText }]}>Demand Intensity</Text>
                    <Text style={[styles.scoreText, { color: colors.text, fontWeight: '800' }]}>{score}/100</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  recCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  recTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceTag: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '800',
  },
  recMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  recFooter: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  recPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  zoneGrid: {
    gap: 10,
    marginBottom: 24,
  },
  zoneCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '700',
  },
  zoneTime: {
    fontSize: 11,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
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
