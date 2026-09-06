import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Banner */}
      <View style={[styles.aiHeaderBanner, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <View style={[styles.aiBadge, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aiTitle, { color: colors.text }]}>GRAP Driver AI Decision Support</Text>
          <Text style={[styles.aiSub, { color: colors.subText }]}>
            Historical demand analytics & personalized operational recommendations to maximize earnings.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
      ) : (
        <>
          {/* Personalized Routine Recommendations */}
          <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('personalAdvice')}</Text>
          <View style={[styles.recCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.recTopRow}>
              <View style={styles.recTitleGroup}>
                <Ionicons name="bulb" size={18} color="#FFD600" />
                <Text style={[styles.recCardTitle, { color: colors.text }]}>Personal Routine Insight</Text>
              </View>
              <View style={styles.confidenceTag}>
                <Text style={styles.confidenceText}>92% Match</Text>
              </View>
            </View>

            <Text style={[styles.recMessage, { color: colors.text }]}>
              Based on your last 14 days, you frequently finish trips near Bastos. High demand is predicted around Mvan → Bastos between 17:00 and 19:00 today. Position near Mvan station before 17:30.
            </Text>

            <View style={styles.recFooter}>
              <View style={[styles.recPill, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="location" size={12} color={colors.primary} />
                <Text style={[styles.recPillText, { color: colors.text }]}>Mvan Station</Text>
              </View>
              <View style={[styles.recPill, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="time" size={12} color={colors.secondary} />
                <Text style={[styles.recPillText, { color: colors.text }]}>17:00 - 19:00</Text>
              </View>
            </View>
          </View>

          {/* High Demand Zones */}
          <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('highDemandZones')}</Text>
          <View style={styles.zoneGrid}>
            {[
              { zone_name: 'Mvan Bus Station', peak_time: '17:00 - 19:00', score: 92 },
              { zone_name: 'Bastos Ambassades', peak_time: '18:00 - 20:00', score: 85 },
              { zone_name: 'Marché Mokolo', peak_time: '07:00 - 09:00', score: 90 },
            ].map((zone, idx) => (
              <View key={idx} style={[styles.zoneCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.zoneHeader}>
                  <Text style={[styles.zoneName, { color: colors.text }]}>{zone.zone_name}</Text>
                  <Ionicons name="flame" size={18} color="#FF5252" />
                </View>
                <Text style={[styles.zoneTime, { color: colors.subText }]}>Peak: {zone.peak_time}</Text>

                <View style={[styles.progressTrack, { backgroundColor: colors.inputBg }]}>
                  <View style={[styles.progressFill, { width: `${zone.score}%` }]} />
                </View>
                <Text style={[styles.scoreText, { color: colors.subText }]}>Demand Intensity: {zone.score}/100</Text>
              </View>
            ))}
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
    padding: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 20,
  },
  aiBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  aiSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  recCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
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
    fontSize: 15,
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
    fontSize: 12,
    fontWeight: '600',
  },
  zoneGrid: {
    gap: 12,
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
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '700',
  },
  zoneTime: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF5252',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
