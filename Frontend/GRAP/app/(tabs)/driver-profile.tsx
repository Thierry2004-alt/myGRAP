import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function DriverProfileScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Profile Header */}
      <View style={[styles.profileHeaderCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.avatarLarge, { backgroundColor: `${colors.secondary}20`, borderColor: colors.secondary }]}>
          <Text style={[styles.avatarLargeText, { color: colors.secondary }]}>{user?.username?.charAt(0).toUpperCase() || 'D'}</Text>
        </View>
        <Text style={[styles.driverName, { color: colors.text }]}>{user?.username || 'GRAP Driver'}</Text>
        <Text style={[styles.licenseText, { color: colors.subText }]}>@{user?.username || 'driver'}</Text>
        <Text style={[styles.licenseText, { color: colors.subText }]}>License: CMR-LIC-9982 • Verified Driver</Text>

        <View style={[styles.statsRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.statBox}>
            <Ionicons name="star" size={16} color="#FFD600" />
            <Text style={[styles.statValue, { color: colors.text }]}>4.9</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Rating</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Ionicons name="car" size={16} color={colors.secondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>42</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Total Rides</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Ionicons name="checkmark-done-circle" size={16} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>98%</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>Acceptance</Text>
          </View>
        </View>
      </View>

      {/* Assigned Vehicle */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Assigned Vehicle Details</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.vehicleRow}>
          <Ionicons name="car-sport" size={24} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleTitle, { color: colors.text }]}>Toyota Yaris (2021)</Text>
            <Text style={[styles.vehicleSub, { color: colors.subText }]}>License Plate: CE-992-AA • Economy</Text>
          </View>
          <View style={styles.verifiedTag}>
            <Text style={styles.verifiedTagText}>VERIFIED</Text>
          </View>
        </View>
      </View>

      {/* Logout Action */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#FF5252" style={{ marginRight: 8 }} />
        <Text style={styles.logoutBtnText}>{t('logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeaderCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 10,
  },
  avatarLargeText: {
    fontSize: 28,
    fontWeight: '900',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
  },
  licenseText: {
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  vehicleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedTagText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '800',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF5252',
    marginBottom: 30,
  },
  logoutBtnText: {
    color: '#FF5252',
    fontSize: 15,
    fontWeight: '800',
  },
});
