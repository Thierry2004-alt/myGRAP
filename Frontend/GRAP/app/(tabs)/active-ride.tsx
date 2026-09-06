import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

export default function ActiveRideTrackerScreen() {
  const [rideState, setRideState] = useState<'REQUESTED' | 'ACCEPTED' | 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED'>('ACCEPTED');
  const [cashOtp, setCashOtp] = useState('4892');
  const [inputOtp, setInputOtp] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const simulateNextState = () => {
    if (rideState === 'REQUESTED') setRideState('ACCEPTED');
    else if (rideState === 'ACCEPTED') setRideState('DRIVER_ARRIVING');
    else if (rideState === 'DRIVER_ARRIVING') setRideState('IN_PROGRESS');
    else if (rideState === 'IN_PROGRESS') setRideState('COMPLETED');
  };

  const handleVerifyCashOtp = () => {
    if (inputOtp === cashOtp) {
      setPaymentConfirmed(true);
      Alert.alert('Payment Confirmed!', 'Your cash payment was verified successfully by OTP.');
    } else {
      Alert.alert('Invalid OTP', 'The PIN entered does not match your ride OTP code.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* State Progress Header */}
      <View style={styles.headerCard}>
        <View style={styles.statusBadgeRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTitle}>STATUS: {rideState.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.routeHeader}>Mvan Bus Station ➔ Bastos Ambassades</Text>

        {/* State Timeline Bar */}
        <View style={styles.timelineRow}>
          {['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED'].map((st, idx) => {
            const isDone = ['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED'].indexOf(rideState) >= idx;
            return (
              <View key={st} style={styles.timelineStep}>
                <View style={[styles.timelineNode, isDone && styles.timelineNodeDone]}>
                  {isDone && <Ionicons name="checkmark" size={12} color="#0B1325" />}
                </View>
                <Text style={styles.timelineText}>{st.split('_')[0]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Driver Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Assigned Driver</Text>
        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={24} color="#00E676" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>Paul Nkoa</Text>
            <Text style={styles.vehicleInfo}>Toyota Yaris • CE-992-AA</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD600" />
              <Text style={styles.ratingText}>4.9 (42 rides)</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert('Call Driver', 'Calling +237670003344...')}>
            <Ionicons name="call" size={20} color="#00E676" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Cash OTP Security Banner */}
      <View style={styles.otpCard}>
        <View style={styles.otpHeader}>
          <Ionicons name="key" size={20} color="#FF6D00" />
          <Text style={styles.otpTitle}>Cash Payment Verification PIN</Text>
        </View>
        <Text style={styles.otpSub}>
          Show or tell this 4-digit PIN code to your driver upon handing over cash payment:
        </Text>
        <View style={styles.otpBox}>
          <Text style={styles.otpCode}>{cashOtp}</Text>
        </View>

        {paymentConfirmed ? (
          <View style={styles.confirmedBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#00E676" />
            <Text style={styles.confirmedText}>Cash Payment Confirmed</Text>
          </View>
        ) : (
          <View style={styles.otpVerifyRow}>
            <TextInput
              style={styles.otpInput}
              placeholder="Confirm OTP PIN"
              placeholderTextColor="#78909C"
              keyboardType="number-pad"
              value={inputOtp}
              onChangeText={setInputOtp}
              maxLength={4}
            />
            <TouchableOpacity style={styles.otpVerifyBtn} onPress={handleVerifyCashOtp}>
              <Text style={styles.otpVerifyBtnText}>Verify Cash</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Simulator Control for Demo */}
      <TouchableOpacity style={styles.demoAdvanceBtn} onPress={simulateNextState}>
        <Ionicons name="play-forward" size={18} color="#0B1325" style={{ marginRight: 6 }} />
        <Text style={styles.demoAdvanceText}>Demo: Advance Ride State</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  headerCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    marginBottom: 16,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  statusTitle: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '800',
  },
  routeHeader: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E2D4A',
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E2D4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineNodeDone: {
    backgroundColor: '#00E676',
  },
  timelineText: {
    color: '#90A4AE',
    fontSize: 10,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    marginBottom: 16,
  },
  cardSectionTitle: {
    color: '#78909C',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  vehicleInfo: {
    color: '#90A4AE',
    fontSize: 13,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    color: '#ECEFF1',
    fontSize: 12,
    fontWeight: '600',
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2D4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 109, 0, 0.4)',
    marginBottom: 20,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  otpTitle: {
    color: '#FF6D00',
    fontSize: 14,
    fontWeight: '700',
  },
  otpSub: {
    color: '#90A4AE',
    fontSize: 12,
    marginBottom: 12,
  },
  otpBox: {
    backgroundColor: '#0A0F1D',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2D4A',
  },
  otpCode: {
    color: '#00E676',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 8,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmedText: {
    color: '#00E676',
    fontWeight: '700',
    fontSize: 14,
  },
  otpVerifyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  otpInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#0A0F1D',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E2D4A',
  },
  otpVerifyBtn: {
    backgroundColor: '#FF6D00',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpVerifyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  demoAdvanceBtn: {
    backgroundColor: '#29B6F6',
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  demoAdvanceText: {
    color: '#0B1325',
    fontWeight: '700',
    fontSize: 14,
  },
});
