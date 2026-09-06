import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function DriverEarningsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [earningsData, setEarningsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      const data = await api.getDriverEarnings();
      setEarningsData(data);
    } catch (e) {
      console.log('Earnings load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }
    setWithdrawing(true);
    try {
      await api.withdrawEarnings(amt);
      Alert.alert('Withdrawal Submitted', `Your withdrawal request of ${amt} FCFA is pending.`);
      setWithdrawAmount('');
      loadEarnings();
    } catch (e: any) {
      Alert.alert('Withdrawal Error', e.message || 'Failed to submit withdrawal request.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Balance Overview Card */}
      <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
        <Text style={[styles.balanceLabel, { color: colors.subText }]}>{t('availableBalance')}</Text>
        <Text style={[styles.balanceAmount, { color: colors.secondary }]}>{earningsData?.available_balance || '82,000'} FCFA</Text>

        <View style={[styles.statsRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{t('netEarning')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{earningsData?.total_net_earnings || '125,500'} FCFA</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{t('commission')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{earningsData?.total_platform_commission || '18,750'} FCFA</Text>
          </View>
        </View>
      </View>

      {/* Withdrawal Form Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Request Earnings Withdrawal</Text>
        <Text style={[styles.cardSub, { color: colors.subText }]}>Transfer eligible earnings to Mobile Money (MTN / Orange).</Text>

        <View style={[styles.inputGroup, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Amount in FCFA (e.g. 10000)"
            placeholderTextColor={colors.subText}
            keyboardType="numeric"
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
          />
        </View>

        <TouchableOpacity style={[styles.withdrawBtn, { backgroundColor: colors.secondary }]} onPress={handleWithdraw} disabled={withdrawing}>
          {withdrawing ? (
            <ActivityIndicator color="#0B1325" />
          ) : (
            <>
              <Ionicons name="arrow-up-circle" size={20} color="#0B1325" style={{ marginRight: 6 }} />
              <Text style={styles.withdrawBtnText}>{t('submitWithdrawal')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Recent History */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Recent Trip Earnings</Text>
      {loading ? (
        <ActivityIndicator color={colors.secondary} style={{ marginVertical: 20 }} />
      ) : (
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.historyRow}>
            <View>
              <Text style={[styles.tripTitle, { color: colors.text }]}>Mvan ➔ Bastos</Text>
              <Text style={[styles.tripSub, { color: colors.subText }]}>Commission: 225 FCFA (15%)</Text>
            </View>
            <Text style={[styles.tripNet, { color: colors.primary }]}>+1,275 FCFA</Text>
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
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    marginBottom: 14,
  },
  inputGroup: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    height: 44,
    fontSize: 14,
  },
  withdrawBtn: {
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawBtnText: {
    color: '#0B1325',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  historyCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tripSub: {
    fontSize: 12,
    marginTop: 2,
  },
  tripNet: {
    fontSize: 16,
    fontWeight: '800',
  },
});
