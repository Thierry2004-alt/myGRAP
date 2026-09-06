import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

export default function AdminApprovalScreen() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [m, d] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminDrivers(),
      ]);
      setMetrics(m);
      setDrivers(d);
    } catch (e) {
      console.log('Admin load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDriver = async (driverId: number, newStatus: 'VERIFIED' | 'REJECTED') => {
    setActionId(driverId);
    try {
      await api.verifyDriver(driverId, newStatus);
      Alert.alert('Status Updated', `Driver verification status set to ${newStatus}`);
      loadAdminData();
    } catch (e: any) {
      Alert.alert('Verification Error', e.message || 'Failed to update driver status');
    } finally {
      setActionId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Metrics Grid */}
      <Text style={styles.sectionTitle}>GRAP System Metrics</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Ionicons name="people" size={20} color="#AB47BC" />
          <Text style={styles.metricValue}>{metrics?.total_users || 0}</Text>
          <Text style={styles.metricLabel}>Total Users</Text>
        </View>

        <View style={styles.metricCard}>
          <Ionicons name="car" size={20} color="#29B6F6" />
          <Text style={styles.metricValue}>{metrics?.total_drivers || 0}</Text>
          <Text style={styles.metricLabel}>Total Drivers</Text>
        </View>

        <View style={styles.metricCard}>
          <Ionicons name="navigate" size={20} color="#00E676" />
          <Text style={styles.metricValue}>{metrics?.total_rides || 0}</Text>
          <Text style={styles.metricLabel}>Total Rides</Text>
        </View>

        <View style={styles.metricCard}>
          <Ionicons name="cash" size={20} color="#FFD600" />
          <Text style={styles.metricValue}>{metrics?.total_platform_commission || '0.00'}</Text>
          <Text style={styles.metricLabel}>Commission Earned</Text>
        </View>
      </View>

      {/* Driver Verification Queue */}
      <View style={styles.queueHeader}>
        <Text style={styles.sectionTitle}>Driver Verification Queue</Text>
        <TouchableOpacity onPress={loadAdminData}>
          <Ionicons name="refresh" size={18} color="#AB47BC" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#AB47BC" style={{ marginVertical: 20 }} />
      ) : drivers.length > 0 ? (
        drivers.map((drv) => (
          <View key={drv.id} style={styles.driverCard}>
            <View style={styles.driverCardTop}>
              <View>
                <Text style={styles.driverUsername}>{drv.user?.username || 'Driver Account'}</Text>
                <Text style={styles.licenseText}>License: {drv.license_number || 'N/A'}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                drv.verification_status === 'VERIFIED' ? styles.badgeVerified : styles.badgePending
              ]}>
                <Text style={styles.badgeText}>{drv.verification_status}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleVerifyDriver(drv.id, 'VERIFIED')}
                disabled={actionId === drv.id}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleVerifyDriver(drv.id, 'REJECTED')}
                disabled={actionId === drv.id}
              >
                <Ionicons name="close-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No drivers in verification queue.</Text>
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
  sectionTitle: {
    color: '#ECEFF1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#131C31',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    gap: 4,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  metricLabel: {
    color: '#90A4AE',
    fontSize: 12,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: '#131C31',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2D4A',
    marginBottom: 12,
  },
  driverCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  driverUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  licenseText: {
    color: '#78909C',
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeVerified: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
  },
  badgePending: {
    backgroundColor: 'rgba(255, 109, 0, 0.15)',
  },
  badgeText: {
    color: '#ECEFF1',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#00E676',
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FF5252',
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#131C31',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#78909C',
    fontSize: 13,
  },
});
