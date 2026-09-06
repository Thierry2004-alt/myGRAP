import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const [rides, shared] = await Promise.all([api.getMyRides(), api.getMySharedRides()]);
        const rideNotifications = rides.slice(0, 12).map((ride: any) => {
          const isCompleted = ride.status === 'COMPLETED';
          const isCancelled = ride.status.includes('CANCELLED');
          return {
            id: ride.id,
            title: isCompleted ? 'Ride completed' : isCancelled ? 'Ride cancelled' : 'Ride update',
            body: isCompleted
              ? `Your trip from ${ride.pickup_name} to ${ride.destination_name} is complete.`
              : isCancelled
                ? `Your trip to ${ride.destination_name} was cancelled.`
                : `Your trip to ${ride.destination_name} is currently ${ride.status.toLowerCase().replaceAll('_', ' ')}.`,
            time: formatTime(ride.created_at),
            icon: isCompleted ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'car',
            color: isCompleted ? colors.primary : isCancelled ? '#FF5252' : colors.secondary,
          };
        });
        const sharedNotifications = shared.initiated.flatMap((item: any) => item.participants.slice(0, 12).map((participant: any) => ({
          id: `shared-${item.shared_ride_id}-${participant.id}`,
          title: 'Passenger joined your shared ride',
          body: `${participant.passenger_name || participant.passenger_username} will be picked up at ${participant.pickup_name}. Fare: ${participant.allocated_shared_fare} FCFA.`,
          time: formatTime(participant.joined_at),
          icon: 'people',
          color: colors.secondary,
        })));
        const accountNotifications = user?.is_verified ? [{
          id: `account-verified-${user.id}`,
          title: 'Account verified successfully',
          body: 'Your GRAP email has been confirmed. Your account is now protected.',
          time: formatDate(new Date()),
          icon: 'shield-checkmark',
          color: colors.primary,
        }] : [];
        setNotifs([...accountNotifications, ...sharedNotifications, ...rideNotifications]);
      } catch (error) {
        console.log('Notification feed error:', error);
      } finally {
        setLoading(false);
      }
    };
    loadNotifications();
    const refreshTimer = setInterval(loadNotifications, 30000);
    return () => clearInterval(refreshTimer);
  }, [colors.primary, colors.secondary, user?.id, user?.is_verified]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('notifications')}</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : <View style={styles.list}>
        {notifs.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBadge, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.time, { color: colors.subText }]}>{item.time}</Text>
              </View>
              <Text style={[styles.body, { color: colors.subText }]}>{item.body}</Text>
            </View>
          </View>
        ))}
        {notifs.length === 0 && <Text style={[styles.emptyText, { color: colors.subText }]}>No ride updates yet.</Text>}
      </View>}
    </ScrollView>
  );
}

function formatTime(value?: string) {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  const today = new Date();
  const isToday = parsed.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = parsed.toDateString() === yesterday.toDateString();
  const time = parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${parsed.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
});
