import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useResponsive } from '../../utils/responsive';

export default function TabLayout() {
  const { user, role, logout } = useAuth();
  const { colors, mode, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { contentPadding, isWeb } = useResponsive();

  const isDriver = role === 'DRIVER';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header strictly displaying logged-in user profile, EN/FR language & Dark/Light theme */}
      <View style={[styles.topHeader, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder, paddingHorizontal: contentPadding, paddingTop: isWeb ? 18 : 44 }]}>
        <View style={styles.userInfo}>
          <View style={[styles.avatarCircle, { borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.username || 'GRAP User'}</Text>
            <View style={[styles.roleBadge, { backgroundColor: isDriver ? 'rgba(41, 182, 246, 0.15)' : 'rgba(0, 230, 118, 0.15)' }]}>
              <Text style={[styles.roleBadgeText, { color: isDriver ? colors.secondary : colors.primary }]}>
                {isDriver ? t('driverMode').toUpperCase() : t('riderMode').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Header Controls: Language EN/FR, Theme 🌙/☀️, Logout */}
        <View style={styles.controlsRow}>
          {/* Language Switcher EN/FR */}
          <TouchableOpacity
            style={[styles.miniPill, { backgroundColor: colors.bg }]}
            onPress={() => setLanguage(language === 'en' ? 'fr' : 'en')}
          >
            <Text style={[styles.miniPillText, { color: colors.primary }]}>{language.toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Theme Switcher 🌙/☀️ */}
          <TouchableOpacity style={[styles.miniPill, { backgroundColor: colors.bg }]} onPress={toggleTheme}>
            <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={14} color={colors.accent} />
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FF5252" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Layout: Strictly shows 5 active tabs for the authenticated role */}
      <View style={styles.tabsShell}>
        <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: [styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }],
          tabBarActiveTintColor: isDriver ? colors.secondary : colors.primary,
          tabBarInactiveTintColor: colors.subText,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        {/* PASSENGER TABS (5 Max) */}
        <Tabs.Screen
          name="index"
          options={{
            title: t('home'),
            href: isDriver ? null : '/',
            tabBarItemStyle: isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="rides"
          options={{
            title: t('rides'),
            href: isDriver ? null : '/rides',
            tabBarItemStyle: isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="car-sport" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="places"
          options={{
            title: t('places'),
            href: isDriver ? null : '/places',
            tabBarItemStyle: isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: t('notifications'),
            href: isDriver ? null : '/notifications',
            tabBarItemStyle: isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: t('profile'),
            href: isDriver ? null : '/profile',
            tabBarItemStyle: isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />

        {/* DRIVER TABS (5 Max) */}
        <Tabs.Screen
          name="driver-home"
          options={{
            title: t('home'),
            href: isDriver ? '/driver-home' : null,
            tabBarItemStyle: !isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="driver-requests"
          options={{
            title: t('requests'),
            href: isDriver ? '/driver-requests' : null,
            tabBarItemStyle: !isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="driver-earnings"
          options={{
            title: t('earnings'),
            href: isDriver ? '/driver-earnings' : null,
            tabBarItemStyle: !isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="driver-ai-analytics"
          options={{
            title: t('analytics'),
            href: isDriver ? '/driver-ai-analytics' : null,
            tabBarItemStyle: !isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="driver-profile"
          options={{
            title: t('profile'),
            href: isDriver ? '/driver-profile' : null,
            tabBarItemStyle: !isDriver ? { display: 'none' } : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />

        {/* Hidden legacy admin tabs */}
        <Tabs.Screen
          name="share-ride"
          options={{ href: null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tabs.Screen
          name="active-ride"
          options={{ href: null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tabs.Screen
          name="driver-dashboard"
          options={{ href: null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tabs.Screen
          name="admin-approval"
          options={{ href: null, tabBarItemStyle: { display: 'none' } }}
        />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  topHeader: {
    width: '100%',
    maxWidth: 1180,
    paddingTop: 44,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontWeight: '800',
    fontSize: 14,
  },
  userName: {
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  logoutBtn: {
    paddingHorizontal: 4,
  },
  tabBar: {
    height: 58,
    paddingBottom: 6,
    borderTopWidth: 1,
  },
  tabsShell: {
    flex: 1,
    width: '100%',
    maxWidth: 1180,
  },
});
