import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { language, t } = useLanguage();
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
            title: t(isCompleted ? 'Ride completed' : isCancelled ? 'Ride cancelled' : 'Ride update'),
            body: isCompleted
              ? t('Your trip from {pickup} to {destination} is complete.')
                  .replace('{pickup}', ride.pickup_name)
                  .replace('{destination}', ride.destination_name)
              : isCancelled
                ? t('Your trip to {destination} was cancelled.').replace('{destination}', ride.destination_name)
                : t('Your trip to {destination} is currently {status}.')
                    .replace('{destination}', ride.destination_name)
                    .replace('{status}', t(ride.status.toLowerCase().replaceAll('_', ' '))),
            time: formatTime(ride.created_at, language, t),
            icon: isCompleted ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'car',
            color: isCompleted ? colors.primary : isCancelled ? '#FF5252' : colors.secondary,
          };
        });
        const sharedNotifications = shared.initiated.flatMap((item: any) => item.participants.slice(0, 12).map((participant: any) => ({
          id: `shared-${item.shared_ride_id}-${participant.id}`,
          title: t('Passenger joined your shared ride'),
          body: t('{passenger} will be picked up at {pickup}. Fare: {fare} FCFA.')
            .replace('{passenger}', participant.passenger_name || participant.passenger_username)
            .replace('{pickup}', participant.pickup_name)
            .replace('{fare}', String(participant.allocated_shared_fare)),
          time: formatTime(participant.joined_at, language, t),
          icon: 'people',
          color: colors.secondary,
        })));
        const accountNotifications = user?.is_verified ? [{
          id: `account-verified-${user.id}`,
          title: t('Account verified successfully'),
          body: t('Your GRAP email has been confirmed. Your account is now protected.'),
          time: formatDate(new Date(), language),
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
  }, [colors.primary, colors.secondary, language, t, user?.id, user?.is_verified]);

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
        {notifs.length === 0 && <Text style={[styles.emptyText, { color: colors.subText }]}>{t('No ride updates yet.')}</Text>}
      </View>}
    </ScrollView>
  );
}

function formatTime(value: string | undefined, language: string, t: (key: string) => string) {
  if (!value) return t('Recently');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t('Recently');
  const today = new Date();
  const isToday = parsed.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = parsed.toDateString() === yesterday.toDateString();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const time = parsed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `${t('Today,')} ${time}`;
  if (isYesterday) return `${t('Yesterday,')} ${time}`;
  return `${parsed.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`;
}

function formatDate(value: Date, language: string) {
  return value.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
