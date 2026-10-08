import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
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
  const [momoOperator, setMomoOperator] = useState<'MTN' | 'ORANGE'>('MTN');
  const [momoPhone, setMomoPhone] = useState('+237670003344');
  const [withdrawing, setWithdrawing] = useState(false);
  const [payoutReceipt, setPayoutReceipt] = useState<any | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

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
    setPayoutError(null);
    const amt = parseFloat(withdrawAmount);
    const available = Number(earningsData?.available_balance || 0);

    if (isNaN(amt) || amt <= 0) {
      setPayoutError('Please enter a valid withdrawal amount.');
      return;
    }
    if (amt > available) {
      setPayoutError(`Requested ${amt} FCFA exceeds your available balance of ${available.toFixed(2)} FCFA.`);
      return;
    }

    setWithdrawing(true);
    try {
      const res = await api.withdrawEarnings({
        amount: amt,
        phone_number: momoPhone,
        operator: momoOperator,
      });

      // Show rich visual payout receipt
      setPayoutReceipt({
        amount: amt,
        phone: momoPhone,
        operator: momoOperator,
        reference: res.campay_reference || res.withdrawal?.id || 'CAMPAY-PAYOUT',
        message: res.message,
        new_balance: res.new_available_balance ?? Math.max(0, available - amt),
        date: new Date().toLocaleString(),
      });

      setWithdrawAmount('');
      loadEarnings();
    } catch (e: any) {
      const msg = e.message || 'Failed to submit withdrawal request.';
      setPayoutError(msg);
      Alert.alert('Withdrawal Error', msg);
    } finally {
      setWithdrawing(false);
    }
  };

  const availableBalance = Number(earningsData?.available_balance || 0);
  const totalNet = Number(earningsData?.total_net_earnings || 0);
  const totalGross = Number(earningsData?.total_gross_earnings || 0);
  const totalComm = Number(earningsData?.total_platform_commission || 0);
  const completedCount = Number(earningsData?.completed_rides_count || 0);
  const earningsHistory = earningsData?.earnings_history || [];
  const withdrawalsHistory = earningsData?.withdrawals_history || [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Balance Overview Card */}
      <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
        <Text style={[styles.balanceLabel, { color: colors.subText }]}>{t('availableBalance')} (Real Withdrawable)</Text>
        <Text style={[styles.balanceAmount, { color: colors.secondary }]}>
          {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FCFA
        </Text>

        {/* Demo Link Note */}
        <View style={[styles.demoLinkBadge, { backgroundColor: `${colors.primary}15` }]}>
          <Ionicons name="flash" size={13} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={[styles.demoLinkText, { color: colors.primary }]}>
            Campay Linked • 85% of Fare (21.25 FCFA) per completed passenger payment
          </Text>
        </View>

        <View style={[styles.statsRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Completed Trips</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{completedCount} Trips</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Total Gross Worked</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{totalGross.toLocaleString()} FCFA</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Platform Fee (15%)</Text>
            <Text style={[styles.statValue, { color: colors.subText }]}>{totalComm.toLocaleString()} FCFA</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Driver Net (85%)</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalNet.toLocaleString()} FCFA</Text>
          </View>
        </View>
      </View>

      {/* Withdrawal Form Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Ionicons name="wallet-outline" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Withdraw Real Earnings</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.subText }]}>
          Transfer eligible earnings directly to your Mobile Money wallet via Campay.
        </Text>

        {payoutError && (
          <View style={[styles.errorBanner, { backgroundColor: '#FF525220', borderColor: '#FF5252' }]}>
            <Ionicons name="alert-circle" size={18} color="#FF5252" style={{ marginRight: 6 }} />
            <Text style={[styles.errorBannerText, { color: '#FF5252' }]}>{payoutError}</Text>
          </View>
        )}

        {/* Operator Selector */}
        <Text style={[styles.fieldLabel, { color: colors.subText }]}>Mobile Money Operator</Text>
        <View style={styles.operatorRow}>
          <TouchableOpacity
            style={[
              styles.operatorBtn,
              { backgroundColor: momoOperator === 'MTN' ? '#FFCC0020' : colors.inputBg, borderColor: momoOperator === 'MTN' ? '#FFCC00' : colors.cardBorder }
            ]}
            onPress={() => setMomoOperator('MTN')}
          >
            <Text style={[styles.operatorEmoji]}>🟡</Text>
            <Text style={[styles.operatorText, { color: momoOperator === 'MTN' ? '#FFCC00' : colors.text }]}>MTN MoMo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.operatorBtn,
              { backgroundColor: momoOperator === 'ORANGE' ? '#FF660020' : colors.inputBg, borderColor: momoOperator === 'ORANGE' ? '#FF6600' : colors.cardBorder }
            ]}
            onPress={() => setMomoOperator('ORANGE')}
          >
            <Text style={[styles.operatorEmoji]}>🟠</Text>
            <Text style={[styles.operatorText, { color: momoOperator === 'ORANGE' ? '#FF6600' : colors.text }]}>Orange Money</Text>
          </TouchableOpacity>
        </View>

        {/* Phone Input */}
        <Text style={[styles.fieldLabel, { color: colors.subText }]}>Recipient Mobile Money Phone</Text>
        <View style={[styles.inputGroup, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Ionicons name="call-outline" size={16} color={colors.subText} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="+237 6XXXXXXXX"
            placeholderTextColor={colors.subText}
            keyboardType="phone-pad"
            value={momoPhone}
            onChangeText={setMomoPhone}
          />
        </View>

        {/* Amount Input */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.fieldLabel, { color: colors.subText }]}>Amount in FCFA</Text>
          {availableBalance > 0 && (
            <TouchableOpacity onPress={() => setWithdrawAmount(Math.floor(availableBalance).toString())}>
              <Text style={[styles.maxBtnText, { color: colors.primary }]}>Max: {availableBalance.toFixed(2)} FCFA</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.inputGroup, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={`Enter amount (e.g. ${availableBalance > 0 ? Math.floor(availableBalance) : 21})`}
            placeholderTextColor={colors.subText}
            keyboardType="numeric"
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
          />
        </View>

        <TouchableOpacity
          style={[styles.withdrawBtn, { backgroundColor: availableBalance > 0 ? colors.secondary : colors.cardBorder }]}
          onPress={handleWithdraw}
          disabled={withdrawing || availableBalance <= 0}
        >
          {withdrawing ? (
            <ActivityIndicator color="#0B1325" />
          ) : (
            <>
              <Ionicons name="arrow-up-circle" size={20} color="#0B1325" style={{ marginRight: 6 }} />
              <Text style={styles.withdrawBtnText}>
                {availableBalance > 0 ? 'Withdraw via Campay MoMo' : 'No Withdrawable Balance Yet'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Real Trip Earnings History */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Real Trip Earnings History</Text>
      {loading ? (
        <ActivityIndicator color={colors.secondary} style={{ marginVertical: 20 }} />
      ) : earningsHistory.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="car-outline" size={32} color={colors.subText} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>
            No completed rides recorded yet. When passengers complete and pay for trips, your exact earnings will appear here.
          </Text>
        </View>
      ) : (
        earningsHistory.map((item: any, idx: number) => {
          const pickup = item.ride_details?.pickup_name || 'Pickup Zone';
          const dest = item.ride_details?.destination_name || 'Destination';
          const gross = Number(item.gross_fare || 0);
          const comm = Number(item.commission_amount || 0);
          const net = Number(item.net_earning || 0);
          const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent';

          return (
            <View key={idx} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.historyRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.tripTitle, { color: colors.text }]}>
                    {pickup} ➔ {dest}
                  </Text>
                  <Text style={[styles.tripSub, { color: colors.subText }]}>
                    {dateStr} • Gross: {gross.toLocaleString()} FCFA (15% Comm: {comm.toLocaleString()} FCFA)
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.tripNet, { color: colors.primary }]}>+{net.toLocaleString()} FCFA</Text>
                  <Text style={[styles.tripRealRate, { color: colors.secondary }]}>+21.25 FCFA Real</Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Real Withdrawal History */}
      {withdrawalsHistory.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 14 }]}>Withdrawal History</Text>
          {withdrawalsHistory.map((w: any, idx: number) => (
            <View key={idx} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.historyRow}>
                <View>
                  <Text style={[styles.tripTitle, { color: colors.text }]}>Campay Mobile Money Payout</Text>
                  <Text style={[styles.tripSub, { color: colors.subText }]}>
                    {w.requested_at ? new Date(w.requested_at).toLocaleDateString() : 'Recent'} • Status: {w.status}
                  </Text>
                </View>
                <Text style={[styles.tripNet, { color: '#FF5252' }]}>-{Number(w.amount).toFixed(2)} FCFA</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* SUCCESS PAYOUT RECEIPT MODAL */}
      <Modal visible={!!payoutReceipt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.receiptModal, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
            <View style={[styles.receiptIconBox, { backgroundColor: '#00E67620' }]}>
              <Ionicons name="checkmark-circle" size={44} color="#00E676" />
            </View>

            <Text style={[styles.receiptTitle, { color: colors.text }]}>Withdrawal Successful! 💸</Text>
            <Text style={[styles.receiptSubtitle, { color: colors.subText }]}>
              Funds have been disbursed to your Mobile Money account via Campay.
            </Text>

            <View style={[styles.receiptBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.subText }]}>Amount Transferred</Text>
                <Text style={[styles.receiptValueBold, { color: colors.secondary }]}>
                  {Number(payoutReceipt?.amount || 0).toLocaleString()} FCFA
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.subText }]}>Operator</Text>
                <Text style={[styles.receiptValue, { color: colors.text }]}>
                  {payoutReceipt?.operator === 'MTN' ? '🟡 MTN MoMo' : '🟠 Orange Money'}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.subText }]}>Phone Number</Text>
                <Text style={[styles.receiptValue, { color: colors.text }]}>{payoutReceipt?.phone}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.subText }]}>Campay Reference</Text>
                <Text style={[styles.receiptValueSmall, { color: colors.subText }]}>{payoutReceipt?.reference}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.subText }]}>Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>PROCESSED</Text>
                </View>
              </View>

              <View style={[styles.receiptDivider, { backgroundColor: colors.cardBorder }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.subText }]}>Remaining Balance</Text>
                <Text style={[styles.receiptValueBold, { color: colors.text }]}>
                  {Number(payoutReceipt?.new_balance || 0).toFixed(2)} FCFA
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: colors.primary }]}
              onPress={() => setPayoutReceipt(null)}
            >
              <Text style={styles.closeModalBtnText}>Close & View Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginVertical: 4,
  },
  demoLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  demoLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
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
    textAlign: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
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
  },
  cardSub: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  operatorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  operatorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  operatorEmoji: {
    fontSize: 14,
  },
  operatorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
  },
  withdrawBtn: {
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  withdrawBtnText: {
    color: '#0B1325',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
    fontSize: 11,
    marginTop: 3,
  },
  tripNet: {
    fontSize: 15,
    fontWeight: '800',
  },
  tripRealRate: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptModal: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  receiptIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  receiptBox: {
    width: '100%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
    gap: 10,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 12,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptValueBold: {
    fontSize: 15,
    fontWeight: '800',
  },
  receiptValueSmall: {
    fontSize: 11,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '800',
  },
  receiptDivider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
  closeModalBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#0B1325',
    fontSize: 15,
    fontWeight: '800',
  },
});
