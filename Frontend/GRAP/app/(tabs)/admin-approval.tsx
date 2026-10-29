import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const { width: SW } = Dimensions.get('window');
type AdminTab = 'OVERVIEW' | 'CHARTS' | 'LIVE_FEED' | 'FLEET';

/* â”€â”€â”€ Animated Stat Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function StatCard({ icon, label, value, sub, iconColor, delay = 0 }: {
  icon: string; label: string; value: string; sub?: string;
  iconColor: string; delay?: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 360, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[s.statCard, { opacity: fade, transform: [{ translateY: slideY }] }]}>
      <View style={[s.statIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon as any} size={19} color={iconColor} />
      </View>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
      {sub ? <Text style={[s.statSub, { color: iconColor }]}>{sub}</Text> : null}
    </Animated.View>
  );
}

/* â”€â”€â”€ Tab pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function TabPill({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.pill, active && s.pillActive]} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon as any} size={12} color={active ? '#0B1325' : '#8899AA'} style={{ marginRight: 4 }} />
      <Text style={[s.pillTxt, { color: active ? '#0B1325' : '#8899AA' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* â”€â”€â”€ Finance row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FinRow({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  return (
    <View style={s.finRow}>
      {icon ? <Ionicons name={icon as any} size={13} color={color || '#8899AA'} style={{ marginRight: 7 }} /> : null}
      <Text style={s.finLbl}>{label}</Text>
      <Text style={[s.finVal, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function AdminApprovalScreen() {
  const { colors } = useTheme();
  const { user }   = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  const [metrics,   setMetrics]   = useState<any | null>(null);
  const [drivers,   setDrivers]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [actionId,  setActionId]  = useState<number | null>(null);
  const [selDay,    setSelDay]    = useState(6);

  const heroFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAdminData();
    Animated.timing(heroFade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [m, d] = await Promise.all([api.getAdminMetrics(), api.getAdminDrivers()]);
      setMetrics(m);
      setDrivers(d || []);
    } catch (e) { console.log('Admin load error:', e); }
    finally     { setLoading(false); }
  };

  const handleVerify = async (id: number, status: 'VERIFIED' | 'REJECTED') => {
    setActionId(id);
    try {
      await api.verifyDriver(id, status);
      Alert.alert(t('Done'), `${t('Driver set to')} ${t(status)}`);
      loadAdminData();
    } catch (e: any) { Alert.alert(t('Error'), e.message || t('Failed')); }
    finally          { setActionId(null); }
  };

  /* Helpers */
  const fin  = metrics?.financials       || {};
  const ops  = metrics?.operations       || {};
  const fl   = metrics?.users_and_fleet  || {};
  const cats: any[] = metrics?.categories    || [];
  const spots: any[] = metrics?.hotspots    || [];
  const feed: any[] = metrics?.recent_live_feed || [];
  const gw   = metrics?.gateways         || { momo_share_pct: 50 };
  const trend: any[] = metrics?.daily_trends || [];

  const maxBar = Math.max(...trend.map((d: any) => d.gross || 0), 1);
  const f = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  /* â”€â”€ UI â”€â”€ */
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

      {/* â•â•â• HERO DARK GRADIENT HEADER â•â•â• */}
      <View style={s.hero}>
        {/* Decorative orbs */}
        <View style={s.orb1} /><View style={s.orb2} />

        <Animated.View style={{ opacity: heroFade }}>
          {/* Top row */}
          <View style={s.heroRow}>
            <View style={s.heroLeft}>
              <View style={s.shieldBox}>
                <Ionicons name="shield-checkmark" size={17} color="#FFD600" />
              </View>
              <View>
                <Text style={s.heroTitle}>{t('GRAP Command Center')}</Text>
                <View style={s.pulseRow}>
                  <View style={s.dot} />
                  <Text style={s.pulseText}>{t('LIVE SYSTEM • YAOUNDÉ')}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.refreshBtn} onPress={loadAdminData} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#FFD600" size="small" />
                : <Ionicons name="reload-outline" size={15} color="#FFD600" />}
            </TouchableOpacity>
          </View>

          {/* Vault */}
          <View style={s.vaultBox}>
            <Text style={s.vaultEye}>{t('PLATFORM NET REVENUE (GRAP VAULT)')}</Text>
            <Text style={s.vaultNum}>{f(fin.platform_vault_float)} FCFA</Text>
            <Text style={s.vaultSub}>
              {t('15% of')} {f(fin.total_gross_volume)} FCFA {t('total ride volume')}
            </Text>
          </View>

          {/* 4-stat strip */}
          <View style={s.strip}>
            {[
              { lbl: t('Gross GMV'), val: f(fin.total_gross_volume), color: '#FFFFFF' },
              { lbl: t('Driver Net (85%)'), val: f(fin.total_driver_net_earnings), color: '#69F0AE' },
              { lbl: t('Disbursed'), val: f(fin.total_disbursed_momo), color: '#FF8A80' },
              { lbl: t('Avg Ticket'), val: f(fin.average_ticket_fcfa), color: '#FFD600' },
            ].map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={s.stripDiv} />}
                <View style={s.stripItem}>
                  <Text style={[s.stripVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={s.stripLbl}>{item.lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* â•â•â• TAB BAR â•â•â• */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 9 }}>
          {[
            { key: 'OVERVIEW',  label: t('Overview'),    icon: 'speedometer-outline' },
            { key: 'CHARTS',    label: t('Financials'),  icon: 'analytics-outline' },
            { key: 'LIVE_FEED', label: t('Live Feed'),   icon: 'pulse-outline' },
            { key: 'FLEET',     label: `${t('Approvals')} (${fl.pending_approval_drivers || 0})`, icon: 'car-outline' },
          ].map(t => (
            <TabPill key={t.key} label={t.label} icon={t.icon}
              active={activeTab === t.key} onPress={() => setActiveTab(t.key as AdminTab)} />
          ))}
        </ScrollView>
      </View>

      <View style={s.body}>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• OVERVIEW â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'OVERVIEW' && (<>

          <Text style={s.sec}>{t('Operational KPIs')}</Text>
          <View style={s.grid4}>
            <StatCard icon="navigate-circle" label={t('Total Requests')} value={String(ops.total_rides_requested || 0)}
              sub={`${ops.completed_rides || 0} ${t('completed')}`} iconColor="#4FC3F7" delay={0} />
            <StatCard icon="checkmark-done-circle" label={t('Completion')} value={`${ops.completion_rate_pct || 0}%`}
              sub={`${ops.cancelled_rides || 0} ${t('cancelled')}`} iconColor="#69F0AE" delay={60} />
            <StatCard icon="people" label={t('Users')} value={String(fl.total_users || 0)}
              sub={`${fl.total_passengers || 0} ${t('riders')}`} iconColor="#CE93D8" delay={120} />
            <StatCard icon="car-sport" label={t('Drivers')} value={String(fl.total_drivers || 0)}
              sub={`${fl.online_drivers_now || 0} ${t('online')}`} iconColor="#FFB74D" delay={180} />
          </View>

          {/* FINANCIAL ACCOUNTING */}
          <Text style={s.sec}>{t('Revenue Accounting')}</Text>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={s.cardIconBox}><Ionicons name="wallet" size={15} color="#FFD600" /></View>
              <Text style={s.cardTitle}>{t('Financial Breakdown')}</Text>
            </View>
            <View style={s.divLine} />
            <FinRow label={t('Total Ride Volume (GMV)')} value={`${f(fin.total_gross_volume)} FCFA`} color="#FFFFFF" icon="cash-outline" />
            <FinRow label={`  ${t('Driver Net Owed (85%)')}`} value={`− ${f(fin.total_driver_net_earnings)} FCFA`} color="#69F0AE" icon="person-outline" />
            <FinRow label={`  ${t('Platform Commission (15%)')}`} value={`= ${f(fin.platform_vault_float)} FCFA`} color="#FFD600" icon="shield-checkmark-outline" />
            <View style={s.divLine} />
            <FinRow label={t('Driver MoMo Disbursed')} value={`− ${f(fin.total_disbursed_momo)} FCFA`} color="#FF8A80" icon="arrow-up-circle-outline" />
            <FinRow label={t('Driver Pending Payout')} value={`${f(fin.driver_unpaid_balance || 0)} FCFA`} color="#FFB74D" icon="time-outline" />
            <View style={s.vaultHighlight}>
              <Text style={s.vaultHlLbl}>{t('GRAP Vault (Net Revenue)')}</Text>
              <Text style={s.vaultHlVal}>{f(fin.platform_vault_float)} FCFA</Text>
            </View>
          </View>

          {/* FLEET STATUS */}
          <Text style={s.sec}>{t('Fleet Status')}</Text>
          <View style={s.card}>
            <View style={s.fleetRow}>
              {[
                { num: fl.verified_drivers || 0, lbl: t('Verified'), color: '#69F0AE' },
                { num: fl.pending_approval_drivers || 0, lbl: t('Pending'), color: '#FFD600' },
                { num: fl.online_drivers_now || 0, lbl: t('Online'), color: '#4FC3F7' },
                { num: ops.shared_rides_count || 0, lbl: t('Shared'), color: '#CE93D8' },
              ].map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={s.fleetDiv} />}
                  <View style={s.fleetItem}>
                    <Text style={[s.fleetNum, { color: item.color }]}>{item.num}</Text>
                    <Text style={s.fleetLbl}>{item.lbl}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* HOTSPOTS */}
          <Text style={s.sec}>{t('Search Hotspots')}</Text>
          <View style={s.card}>
            {spots.length === 0
              ? <Text style={s.empty}>{t('No hotspot data yet.')}</Text>
              : spots.map((h: any, i: number) => {
                const hColor = i === 0 ? '#FFD600' : i === 1 ? '#69F0AE' : '#4FC3F7';
                return (
                  <View key={i} style={s.spotRow}>
                    <View style={[s.spotRank, { backgroundColor: `${hColor}18` }]}>
                      <Text style={[s.spotRankTxt, { color: hColor }]}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={s.spotName}>{h.name}</Text>
                      <View style={s.spotTrack}>
                        <View style={[s.spotFill, { width: `${Math.min(100, h.share_pct * 2.5)}%` as any, backgroundColor: hColor }]} />
                      </View>
                    </View>
                    <Text style={[s.spotCount, { color: hColor }]}>{h.searches}</Text>
                  </View>
                );
              })}
          </View>
        </>)}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CHARTS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'CHARTS' && (<>

          <Text style={s.sec}>7-Day Revenue Trend</Text>
          <View style={s.card}>
            <View style={s.legRow}>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: '#4FC3F7' }]} /><Text style={s.legTxt}>{t('Gross')}</Text></View>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: '#FFD600' }]} /><Text style={s.legTxt}>15% Commission</Text></View>
            </View>
            <View style={s.bars}>
              {trend.map((d: any, i: number) => {
                const sel = selDay === i;
                const bh  = Math.max(8, Math.min(130, (d.gross / maxBar) * 130));
                return (
                  <TouchableOpacity key={i} style={s.barCol} onPress={() => setSelDay(i)} activeOpacity={0.8}>
                    <View style={s.barStack}>
                      <View style={[s.barGross, { height: bh, backgroundColor: sel ? '#4FC3F7' : '#4FC3F730', borderWidth: sel ? 1 : 0, borderColor: '#4FC3F7' }]} />
                      <View style={[s.barComm,  { height: Math.max(4, bh * 0.15), backgroundColor: sel ? '#FFD600' : '#FFD60050' }]} />
                    </View>
                    <Text style={[s.barLbl, { color: sel ? '#FFFFFF' : '#556678', fontWeight: sel ? '800' : '500' }]}>{d.day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {trend[selDay] && (
              <View style={s.callout}>
                <Text style={s.calloutDate}>{trend[selDay].date} ({trend[selDay].day})</Text>
                <View style={s.calloutStats}>
                  <Text style={[s.calloutStat, { color: '#4FC3F7' }]}>Gross: {f(trend[selDay].gross)} FCFA</Text>
                  <Text style={[s.calloutStat, { color: '#FFD600' }]}>Commission: {f(trend[selDay].commission)} FCFA</Text>
                  <Text style={[s.calloutStat, { color: '#8899AA' }]}>{trend[selDay].completed} trips</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.sec}>{t('Category Distribution')}</Text>
          <View style={s.card}>
            {cats.length === 0
              ? <Text style={s.empty}>{t('No category data.')}</Text>
              : cats.map((cat: any) => {
                const pct = (ops.completed_rides || 0) > 0 ? Math.round((cat.completed_rides / ops.completed_rides) * 100) : 0;
                return (
                  <View key={cat.id} style={s.catRow}>
                    <View style={s.catHead}>
                      <Text style={s.catName}>{cat.name} <Text style={s.catCode}>({cat.code})</Text></Text>
                      <Text style={s.catVal}>{f(cat.gross_volume)} FCFA Â· {pct}%</Text>
                    </View>
                    <View style={s.catTrack}><View style={[s.catFill, { width: `${Math.max(3, pct)}%` as any }]} /></View>
                  </View>
                );
              })}
          </View>

          <Text style={s.sec}>{t('Payment Gateway Mix')}</Text>
          <View style={s.card}>
            <View style={s.gwRow}><Text style={s.gwLbl}>ðŸŸ¡ Campay MoMo</Text><Text style={s.gwPct}>{gw.momo_share_pct}%</Text></View>
            <View style={s.gwTrack}>
              <View style={[s.gwMomo, { width: `${gw.momo_share_pct}%` as any }]} />
              <View style={[s.gwCash, { width: `${100 - gw.momo_share_pct}%` as any }]} />
            </View>
            <View style={s.gwRow}><Text style={s.gwSubLbl}>💵 {t('Cash OTP')}</Text><Text style={s.gwPct}>{(100 - gw.momo_share_pct).toFixed(1)}%</Text></View>
          </View>
        </>)}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• LIVE FEED â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'LIVE_FEED' && (<>
          <View style={s.liveHeader}>
            <Text style={s.sec}>{t('Real-Time Stream')}</Text>
            <View style={s.liveBadge}><View style={s.dot} /><Text style={s.liveBadgeTxt}>{t('LIVE')}</Text></View>
          </View>
          {feed.length === 0 ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 36 }]}>
              <Ionicons name="pulse-outline" size={36} color="#556678" style={{ marginBottom: 10 }} />
              <Text style={s.empty}>{t('No recent rides.')}</Text>
            </View>
          ) : feed.map((r: any) => {
            const done   = r.status === 'COMPLETED';
            const cancel = r.status?.startsWith('CANCELLED');
            const sc     = done ? '#69F0AE' : cancel ? '#FF5252' : '#FFD600';
            return (
              <View key={r.id} style={s.feedCard}>
                <View style={[s.feedStripe, { backgroundColor: sc }]} />
                <View style={s.feedBody}>
                  <View style={s.feedTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.feedId}>Ride #{r.id}</Text>
                      {r.is_shared && <View style={s.sharedBadge}><Text style={s.sharedTxt}>{t('SHARED')}</Text></View>}
                    </View>
                    <View style={[s.statusTag, { backgroundColor: `${sc}15`, borderColor: `${sc}40` }]}>
                      <Text style={[s.statusTxt, { color: sc }]}>{r.status}</Text>
                    </View>
                  </View>
                  <Text style={s.feedRoute}>{r.pickup}  â†’  {r.destination}</Text>
                  <View style={s.feedPeople}>
                    <View style={s.feedPerson}><Ionicons name="person" size={10} color="#556678" /><Text style={s.feedPersonTxt}>{r.passenger_name}</Text></View>
                    <View style={s.feedPerson}><Ionicons name="car" size={10} color="#556678" /><Text style={s.feedPersonTxt}>{r.driver_name}</Text></View>
                  </View>
                  <View style={s.feedBottom}>
                    <Text style={s.feedTime}>{r.created_at}</Text>
                    <Text style={s.feedFare}>{f(r.fare)} FCFA</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>)}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FLEET APPROVALS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'FLEET' && (<>
          <View style={s.queueHead}>
            <Text style={s.sec}>{t('Verification Queue')}</Text>
            <View style={s.pendBadge}><Text style={s.pendTxt}>{fl.pending_approval_drivers || 0} Pending</Text></View>
          </View>
          {drivers.length === 0 ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 36 }]}>
              <Ionicons name="checkmark-done-circle" size={40} color="#69F0AE" style={{ marginBottom: 10 }} />
              <Text style={s.empty}>{t('All drivers verified!')}</Text>
            </View>
          ) : drivers.map((drv) => {
            const verified   = drv.verification_status === 'VERIFIED';
            const actioning  = actionId === drv.id;
            return (
              <View key={drv.id} style={s.drvCard}>
                <View style={s.drvTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.drvName}>{drv.user?.first_name} {drv.user?.last_name}</Text>
                    <Text style={s.drvMeta}>@{drv.user?.username} Â· {drv.user?.phone_number || 'N/A'}</Text>
                    <Text style={s.drvMeta}>License: {drv.license_number || 'Pending'}</Text>
                  </View>
                  <View style={[s.drvBadge, {
                    backgroundColor: verified ? '#69F0AE15' : '#FFD60015',
                    borderColor:     verified ? '#69F0AE40' : '#FFD60040',
                  }]}>
                    <Text style={[s.drvBadgeTxt, { color: verified ? '#69F0AE' : '#FFD600' }]}>
                      {drv.verification_status}
                    </Text>
                  </View>
                </View>
                <View style={s.drvMetrics}>
                  <Text style={s.drvMItem}>Trips <Text style={s.drvMVal}>{drv.total_rides || 0}</Text></Text>
                  <Text style={s.drvMItem}>Rating <Text style={[s.drvMVal, { color: '#FFD600' }]}>â­ {drv.rating_avg || '5.0'}</Text></Text>
                  <Text style={s.drvMItem}>Status <Text style={[s.drvMVal, { color: drv.is_online ? '#69F0AE' : '#8899AA' }]}>{drv.is_online ? 'ONLINE' : 'OFFLINE'}</Text></Text>
                </View>
                <View style={s.actionRow}>
                  {!verified && (
                    <TouchableOpacity style={s.approveBtn} onPress={() => handleVerify(drv.id, 'VERIFIED')} disabled={actioning}>
                      {actioning ? <ActivityIndicator color="#0B1325" size="small" /> : <>
                        <Ionicons name="checkmark" size={14} color="#0B1325" />
                        <Text style={s.approveTxt}>{t('Approve')}</Text>
                      </>}
                    </TouchableOpacity>
                  )}
                  {drv.verification_status !== 'REJECTED' && (
                    <TouchableOpacity style={s.rejectBtn} onPress={() => handleVerify(drv.id, 'REJECTED')} disabled={actioning}>
                      <Ionicons name="close" size={14} color="#FF5252" />
                      <Text style={s.rejectTxt}>{t('Reject')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </>)}

      </View>
    </ScrollView>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STYLES
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07111E' },
  body: { paddingHorizontal: 14, paddingTop: 2 },

  /* HERO */
  hero: { backgroundColor: '#0B1A2E', paddingTop: 52, paddingHorizontal: 18, paddingBottom: 24, overflow: 'hidden', position: 'relative' },
  orb1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#FFD60008', top: -40, right: -40 },
  orb2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#4FC3F70A', bottom: -20, left: 20 },

  heroRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFD60015', borderWidth: 1, borderColor: '#FFD60030', justifyContent: 'center', alignItems: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  pulseRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#69F0AE' },
  pulseText: { color: '#69F0AE', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  refreshBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF0C', borderWidth: 1, borderColor: '#FFFFFF18', justifyContent: 'center', alignItems: 'center' },

  vaultBox: { alignItems: 'center', marginBottom: 22 },
  vaultEye: { color: '#556678', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
  vaultNum: { color: '#FFD600', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  vaultSub: { color: '#4A5E72', fontSize: 11, marginTop: 5, textAlign: 'center' },

  strip:    { flexDirection: 'row', backgroundColor: '#FFFFFF07', borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF0C', paddingVertical: 12 },
  stripItem: { flex: 1, alignItems: 'center' },
  stripVal:  { fontSize: 13, fontWeight: '800' },
  stripLbl:  { color: '#556678', fontSize: 9, marginTop: 3, textAlign: 'center', fontWeight: '700' },
  stripDiv:  { width: 1, backgroundColor: '#FFFFFF12' },

  /* TABS */
  tabBar: { backgroundColor: '#07111E', borderBottomWidth: 1, borderBottomColor: '#FFFFFF0C' },
  pill:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF08', borderWidth: 1, borderColor: '#FFFFFF0C' },
  pillActive: { backgroundColor: '#FFD600', borderColor: '#FFD600' },
  pillTxt:   { fontSize: 11, fontWeight: '800' },

  /* SECTION TITLES */
  sec: { color: '#5A7A9A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10, marginTop: 20, textTransform: 'uppercase' },

  /* STAT CARD GRID */
  grid4:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: '#0D1E33', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#FFFFFF0C' },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statVal:  { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  statLbl:  { color: '#8899AA', fontSize: 11, marginTop: 3 },
  statSub:  { fontSize: 11, fontWeight: '700', marginTop: 4 },

  /* GLASS CARD */
  card:       { backgroundColor: '#0D1E33', borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0C', padding: 16, marginBottom: 4 },
  cardHead:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardIconBox:{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFD60013', justifyContent: 'center', alignItems: 'center' },
  cardTitle:  { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  divLine:    { height: 1, backgroundColor: '#FFFFFF08', marginVertical: 8 },

  /* FIN ROWS */
  finRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  finLbl:   { flex: 1, color: '#8899AA', fontSize: 12 },
  finVal:   { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  vaultHighlight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFD60010', borderWidth: 1, borderColor: '#FFD60028', borderRadius: 10, padding: 12, marginTop: 8 },
  vaultHlLbl: { color: '#FFD600', fontSize: 11, fontWeight: '800' },
  vaultHlVal: { color: '#FFD600', fontSize: 17, fontWeight: '900' },

  /* FLEET GRID */
  fleetRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  fleetItem: { flex: 1, alignItems: 'center' },
  fleetDiv:  { width: 1, height: 32, backgroundColor: '#FFFFFF0C' },
  fleetNum:  { fontSize: 22, fontWeight: '900' },
  fleetLbl:  { color: '#8899AA', fontSize: 10, marginTop: 3, fontWeight: '700' },

  /* HOTSPOTS */
  spotRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  spotRank:    { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  spotRankTxt: { fontSize: 11, fontWeight: '900' },
  spotName:    { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  spotTrack:   { height: 5, backgroundColor: '#FFFFFF0A', borderRadius: 3, overflow: 'hidden' },
  spotFill:    { height: 5, borderRadius: 3 },
  spotCount:   { fontSize: 12, fontWeight: '800', marginLeft: 10 },

  /* CHARTS */
  legRow:  { flexDirection: 'row', gap: 16, marginBottom: 16 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot:  { width: 8, height: 8, borderRadius: 4 },
  legTxt:  { color: '#8899AA', fontSize: 11, fontWeight: '700' },
  bars:    { flexDirection: 'row', alignItems: 'flex-end', height: 148, gap: 4, marginBottom: 12 },
  barCol:  { flex: 1, alignItems: 'center', gap: 4 },
  barStack:{ alignItems: 'center', width: '100%', gap: 2 },
  barGross:{ width: '82%', borderRadius: 4 },
  barComm: { width: '82%', borderRadius: 3 },
  barLbl:  { fontSize: 10, marginTop: 3 },
  callout: { backgroundColor: '#FFFFFF07', borderRadius: 12, borderWidth: 1, borderColor: '#FFFFFF0C', padding: 12 },
  calloutDate:  { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  calloutStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  calloutStat:  { fontSize: 12, fontWeight: '700' },
  catRow:  { marginBottom: 12 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  catCode: { color: '#8899AA', fontSize: 11 },
  catVal:  { color: '#4FC3F7', fontSize: 12, fontWeight: '700' },
  catTrack:{ height: 5, backgroundColor: '#FFFFFF0A', borderRadius: 3, overflow: 'hidden' },
  catFill: { height: 5, borderRadius: 3, backgroundColor: '#4FC3F7' },
  gwRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  gwLbl:   { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  gwSubLbl:{ color: '#8899AA', fontSize: 12 },
  gwPct:   { color: '#8899AA', fontSize: 12, fontWeight: '700' },
  gwTrack: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', marginBottom: 8 },
  gwMomo:  { height: 10, backgroundColor: '#FFD600' },
  gwCash:  { height: 10, backgroundColor: '#4FC3F7' },

  /* LIVE FEED */
  liveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#69F0AE12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#69F0AE28', marginBottom: 10 },
  liveBadgeTxt:{ color: '#69F0AE', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  feedCard:   { flexDirection: 'row', backgroundColor: '#0D1E33', borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF0A', marginBottom: 10, overflow: 'hidden' },
  feedStripe: { width: 3 },
  feedBody:   { flex: 1, padding: 13 },
  feedTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  feedId:     { color: '#4FC3F7', fontSize: 13, fontWeight: '900' },
  sharedBadge:{ backgroundColor: '#CE93D812', borderWidth: 1, borderColor: '#CE93D835', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  sharedTxt:  { color: '#CE93D8', fontSize: 9, fontWeight: '800' },
  statusTag:  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt:  { fontSize: 10, fontWeight: '800' },
  feedRoute:  { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 7 },
  feedPeople: { flexDirection: 'row', gap: 14, marginBottom: 7 },
  feedPerson: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedPersonTxt: { color: '#8899AA', fontSize: 11 },
  feedBottom: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#FFFFFF07', paddingTop: 7 },
  feedTime:   { color: '#4A5E72', fontSize: 10 },
  feedFare:   { color: '#FFD600', fontSize: 14, fontWeight: '800' },

  /* FLEET APPROVALS */
  queueHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pendBadge: { backgroundColor: '#FFD60012', borderWidth: 1, borderColor: '#FFD60030', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 10 },
  pendTxt:   { color: '#FFD600', fontSize: 11, fontWeight: '800' },
  drvCard:   { backgroundColor: '#0D1E33', borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF0C', padding: 15, marginBottom: 12 },
  drvTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  drvName:   { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  drvMeta:   { color: '#8899AA', fontSize: 11, marginTop: 2 },
  drvBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  drvBadgeTxt: { fontSize: 11, fontWeight: '800' },
  drvMetrics: { flexDirection: 'row', gap: 16, backgroundColor: '#FFFFFF05', borderRadius: 10, padding: 10, marginBottom: 12 },
  drvMItem:  { color: '#8899AA', fontSize: 12 },
  drvMVal:   { color: '#FFFFFF', fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#69F0AE', paddingVertical: 11, borderRadius: 10 },
  approveTxt: { color: '#0B1325', fontSize: 13, fontWeight: '800' },
  rejectBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FF525212', paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#FF525235' },
  rejectTxt:  { color: '#FF5252', fontSize: 13, fontWeight: '800' },

  empty: { color: '#556678', fontSize: 13, textAlign: 'center' },
});
