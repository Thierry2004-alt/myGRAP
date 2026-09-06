import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { activeRideStorage, loyaltyStorage, paymentStorage } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function PassengerProfileScreen() {
  const { user, logout, refreshUser, requestEmailVerification, verifyEmail, updateProfile } = useAuth();
  const { mode, toggleTheme, colors } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const isDark = mode === 'dark';

  // USER-DEFINED CUSTOM SAVED PLACES STATE
  const [homeAddress, setHomeAddress] = useState('Tap to set Home address');
  const [workAddress, setWorkAddress] = useState('Tap to set Work address');
  const [editingPlace, setEditingPlace] = useState<'HOME' | 'WORK' | null>(null);
  const [tempAddressInput, setTempAddressInput] = useState('');

  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [paymentNumbers, setPaymentNumbers] = useState({ mtn: '', orange: '' });
  const [editingPayment, setEditingPayment] = useState<'MTN' | 'ORANGE' | null>(null);
  const [paymentInput, setPaymentInput] = useState('');
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [profileEditorVisible, setProfileEditorVisible] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });

  useEffect(() => {
    loyaltyStorage.getPoints(user?.id).then(setLoyaltyPoints);
    paymentStorage.get(user?.id).then(setPaymentNumbers);
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      refreshUser().catch((error) => console.log('Profile refresh error:', error));
    }, [refreshUser]),
  );
  const [silentRide, setSilentRide] = useState(false);
  const [autoRideShare, setAutoRideShare] = useState(true);
  const [airConditioned, setAirConditioned] = useState(true);
  const [defaultPayment, setDefaultPayment] = useState<'MTN_MOMO' | 'ORANGE_MONEY' | 'CASH'>('CASH');

  const handleSaveCustomAddress = () => {
    if (!tempAddressInput.trim()) return;
    if (editingPlace === 'HOME') {
      setHomeAddress(tempAddressInput.trim());
    } else if (editingPlace === 'WORK') {
      setWorkAddress(tempAddressInput.trim());
    }
    setEditingPlace(null);
    setTempAddressInput('');
    Alert.alert('Saved Place Updated', 'Your custom address has been saved successfully!');
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out of GRAP?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await activeRideStorage.clear();
          await logout();
        },
      },
    ]);
  };

  const handleSOSConfig = () => {
    Alert.alert('Emergency Contact / SOS', 'Emergency contact set to: +237 670 00 99 88.\nIn case of emergency, tap SOS button to send live location to contacts.');
  };

  const openProfileEditor = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone_number: (user as any)?.phone_number || '',
    });
    setProfileEditorVisible(true);
  };

  const saveProfile = async () => {
    if (!profileForm.first_name.trim() || !profileForm.last_name.trim() || !profileForm.email.trim()) {
      Alert.alert('Incomplete profile', 'First name, last name, and email are required.');
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile({ ...profileForm, first_name: profileForm.first_name.trim(), last_name: profileForm.last_name.trim(), email: profileForm.email.trim() });
      setProfileEditorVisible(false);
      Alert.alert('Profile updated', 'Your profile details were saved successfully.');
    } catch (error: any) {
      Alert.alert('Could not save profile', error.message || 'Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const sendVerificationCode = async () => {
    setVerificationLoading(true);
    try {
      await requestEmailVerification();
      setVerificationVisible(true);
      Alert.alert('Code sent', `We sent a 6-digit PIN to ${user?.email}.`);
    } catch (error: any) {
      Alert.alert('Could not send code', error.message || 'Please try again.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const confirmVerification = async () => {
    const normalizedCode = verificationCode.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(normalizedCode)) {
      Alert.alert('Invalid PIN', 'Enter the 6-digit code from your email.');
      return;
    }
    setVerificationLoading(true);
    try {
      await verifyEmail(normalizedCode);
      setVerificationVisible(false);
      setVerificationCode('');
      Alert.alert('Account verified', 'Your email has been verified successfully.');
    } catch (error: any) {
      Alert.alert('Verification failed', error.message || 'Check the PIN and try again.');
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* MODULE 1: PASSENGER PROFILE HEADER CARD */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.profileTop}>
          <View style={[styles.avatarBox, { backgroundColor: `${colors.primary}25` }]}>
            <Ionicons name="person-circle-sharp" size={64} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.text }]}>{user?.username || 'GRAP User'}</Text>
            <Text style={[styles.profileContact, { color: colors.subText }]}>@{user?.username || 'grap_user'}</Text>
            <Text style={[styles.profileContact, { color: colors.subText }]}>{user?.first_name || 'Passenger'} account</Text>
          </View>
          <View style={[styles.vipBadge, { backgroundColor: user?.is_verified ? 'rgba(0, 230, 118, 0.15)' : `${colors.accent}20`, borderColor: user?.is_verified ? colors.primary : colors.accent }]}> 
            <Ionicons name={user?.is_verified ? 'shield-checkmark' : 'alert-circle-outline'} size={12} color={user?.is_verified ? colors.primary : colors.accent} />
            <Text style={[styles.vipText, { color: user?.is_verified ? colors.primary : colors.accent }]}>{user?.is_verified ? 'Verified' : 'Email unverified'}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.editProfileBtn, { backgroundColor: colors.inputBg }]} onPress={openProfileEditor}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={[styles.editProfileBtnText, { color: colors.primary }]}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {!user?.is_verified && (
        <View style={[styles.verificationCard, { backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}80` }]}>
          <View style={[styles.verificationIcon, { backgroundColor: `${colors.accent}25` }]}><Ionicons name="mail-unread-outline" size={22} color={colors.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.verificationTitle, { color: colors.text }]}>Verify your email</Text>
            <Text style={[styles.verificationSub, { color: colors.subText }]}>Confirm your email to protect your account and unlock trusted ride features.</Text>
            <TouchableOpacity style={[styles.verifyButton, { backgroundColor: colors.accent }]} onPress={sendVerificationCode} disabled={verificationLoading}>
              <Text style={styles.verifyButtonText}>{verificationLoading ? 'Sending...' : 'Send verification PIN'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODULE 2: FRESH 0 POINTS & 0 FCFA SAVINGS DASHBOARD */}
      <View style={[styles.statsRow, { gap: 10 }]}>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="trophy" size={24} color="#FFD600" />
          <Text style={styles.statNumber}>{loyaltyPoints} Pts</Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Loyalty Points</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="leaf" size={24} color={colors.primary} />
          <Text style={[styles.statNumber, { color: colors.primary }]}>0 FCFA</Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Shared Ride Savings</Text>
        </View>
      </View>

      {/* MODULE 3: USER-DEFINED SAVED FAVORITE PLACES MODULE */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Saved Places (Lieux Favoris)</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Set Home Address */}
        <TouchableOpacity
          style={styles.favRow}
          onPress={() => {
            setEditingPlace('HOME');
            setTempAddressInput(homeAddress === 'Tap to set Home address' ? '' : homeAddress);
          }}
        >
          <View style={[styles.favIconBadge, { backgroundColor: 'rgba(0, 230, 118, 0.15)' }]}>
            <Ionicons name="home" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.favTitle, { color: colors.text }]}>Home Address</Text>
            <Text style={[styles.favSub, { color: homeAddress.includes('Tap') ? colors.primary : colors.subText }]}>{homeAddress}</Text>
          </View>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        {/* Set Work Address */}
        <TouchableOpacity
          style={styles.favRow}
          onPress={() => {
            setEditingPlace('WORK');
            setTempAddressInput(workAddress === 'Tap to set Work address' ? '' : workAddress);
          }}
        >
          <View style={[styles.favIconBadge, { backgroundColor: 'rgba(41, 182, 246, 0.15)' }]}>
            <Ionicons name="briefcase" size={18} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.favTitle, { color: colors.text }]}>Work Address</Text>
            <Text style={[styles.favSub, { color: workAddress.includes('Tap') ? colors.secondary : colors.subText }]}>{workAddress}</Text>
          </View>
          <Ionicons name="create-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* MODULE 4: DEFAULT PAYMENT METHODS MODULE */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Default Payment Method (Paiement)</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <TouchableOpacity style={styles.settingRow} onPress={() => { setDefaultPayment('MTN_MOMO'); setEditingPayment('MTN'); setPaymentInput(paymentNumbers.mtn); }}>
          <View style={[styles.payIconBadge, { backgroundColor: '#FFCC00' }]}>
            <Ionicons name="wallet-sharp" size={14} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>MTN Mobile Money</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>{paymentNumbers.mtn ? `Linked: ${paymentNumbers.mtn}` : 'Tap to add your MTN number'}</Text>
          </View>
          {defaultPayment === 'MTN_MOMO' && <Ionicons name="checkmark-circle" size={20} color="#FFCC00" />}
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <TouchableOpacity style={styles.settingRow} onPress={() => { setDefaultPayment('ORANGE_MONEY'); setEditingPayment('ORANGE'); setPaymentInput(paymentNumbers.orange); }}>
          <View style={[styles.payIconBadge, { backgroundColor: '#FF6600' }]}>
            <Ionicons name="card-sharp" size={14} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Orange Money</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>{paymentNumbers.orange ? `Linked: ${paymentNumbers.orange}` : 'Tap to add your Orange number'}</Text>
          </View>
          {defaultPayment === 'ORANGE_MONEY' && <Ionicons name="checkmark-circle" size={20} color="#FF6600" />}
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <TouchableOpacity style={styles.settingRow} onPress={() => setDefaultPayment('CASH')}>
          <View style={[styles.payIconBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="cash-sharp" size={14} color="#0B1325" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Cash Payment (Espèces OTP 4-PIN)</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Generate 4-digit verification code</Text>
          </View>
          {defaultPayment === 'CASH' && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {/* MODULE 5: RIDE PREFERENCES MODULE */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Ride Preferences (Préférences)</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Voluntary Shared Ride Opt-In</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Auto-suggest route matching to save up to 40%</Text>
          </View>
          <Switch value={autoRideShare} onValueChange={setAutoRideShare} trackColor={{ false: '#334155', true: colors.primary }} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Silent Trip Preference</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Request quiet ride from driver</Text>
          </View>
          <Switch value={silentRide} onValueChange={setSilentRide} trackColor={{ false: '#334155', true: colors.primary }} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Air Conditioned Vehicle</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Prefer AC equipped cars</Text>
          </View>
          <Switch value={airConditioned} onValueChange={setAirConditioned} trackColor={{ false: '#334155', true: colors.primary }} />
        </View>
      </View>

      {/* MODULE 6: APP CUSTOMIZATION MODULE (THEME & LANGUAGE) */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Appearance & Language</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>High contrast dark design system</Text>
          </View>
          <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#334155', true: colors.primary }} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Language</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Currently: {language === 'en' ? 'English' : 'Français'}</Text>
          </View>

          <TouchableOpacity style={[styles.langToggleBtn, { backgroundColor: colors.inputBg }]} onPress={() => setLanguage(language === 'en' ? 'fr' : 'en')}>
            <Text style={[styles.langToggleText, { color: colors.primary }]}>{language === 'en' ? 'FR' : 'EN'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODULE 7: ACCOUNT SAFETY & EMERGENCY CONTACT (SOS) */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>Safety & Security (Sécurité)</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <TouchableOpacity style={styles.settingRow} onPress={handleSOSConfig}>
          <View style={[styles.favIconBadge, { backgroundColor: 'rgba(255, 82, 82, 0.15)' }]}>
            <Ionicons name="shield-checkmark" size={18} color="#FF5252" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Emergency Contacts & SOS</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Set trusted contacts for live ride tracking</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.subText} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Security', 'Change account password...')}>
          <View style={[styles.favIconBadge, { backgroundColor: 'rgba(41, 182, 246, 0.15)' }]}>
            <Ionicons name="lock-closed" size={18} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Password & Security</Text>
            <Text style={[styles.settingSub, { color: colors.subText }]}>Update password and 2FA settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.subText} />
        </TouchableOpacity>
      </View>

      {/* MODULE 8: SUPPORT & LOGOUT ACTIONS */}
      <TouchableOpacity style={[styles.supportBtn, { backgroundColor: colors.inputBg }]} onPress={() => Alert.alert('Support', 'Contacting GRAP 24/7 Customer Support (+237 670 00 00 00)...')}>
        <Ionicons name="help-buoy" size={18} color={colors.primary} />
        <Text style={[styles.supportBtnText, { color: colors.primary }]}>Help & Support</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out" size={18} color="#FF5252" style={{ marginRight: 6 }} />
        <Text style={styles.logoutBtnText}>{t('logout')}</Text>
      </TouchableOpacity>

      {/* USER CUSTOM ADDRESS EDIT MODAL */}
      {editingPlace && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setEditingPlace(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.addressModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Set Custom {editingPlace === 'HOME' ? 'Home' : 'Work'} Address
                </Text>
                <TouchableOpacity onPress={() => setEditingPlace(null)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubText, { color: colors.subText }]}>
                Type your personal {editingPlace === 'HOME' ? 'Home' : 'Work'} neighborhood or street address in Yaoundé:
              </Text>

              <TextInput
                style={[styles.addressInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="e.g. Carrefour Jouvence, Biyem-Assi"
                placeholderTextColor={colors.subText}
                value={tempAddressInput}
                onChangeText={setTempAddressInput}
                autoFocus={true}
              />

              <TouchableOpacity style={[styles.saveAddressBtn, { backgroundColor: colors.primary }]} onPress={handleSaveCustomAddress}>
                <Text style={styles.saveAddressBtnText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {editingPayment && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditingPayment(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.addressModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }] }>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add {editingPayment === 'MTN' ? 'MTN Mobile Money' : 'Orange Money'} number</Text>
                <TouchableOpacity onPress={() => setEditingPayment(null)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
              </View>
              <Text style={[styles.modalSubText, { color: colors.subText }]}>Enter the number you use for payments. It stays private on your account.</Text>
              <TextInput style={[styles.addressInput, { backgroundColor: colors.inputBg, color: colors.text }]} placeholder="e.g. +237 6 70 00 00 00" placeholderTextColor={colors.subText} keyboardType="phone-pad" value={paymentInput} onChangeText={setPaymentInput} autoFocus />
              <TouchableOpacity style={[styles.saveAddressBtn, { backgroundColor: colors.primary }]} onPress={async () => { const next = { ...paymentNumbers, [editingPayment === 'MTN' ? 'mtn' : 'orange']: paymentInput.trim() }; setPaymentNumbers(next); await paymentStorage.save(user?.id, next); setEditingPayment(null); }}>
                <Text style={styles.saveAddressBtnText}>Save number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={profileEditorVisible} transparent animationType="slide" onRequestClose={() => setProfileEditorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.profileEditorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }] }>
            <View style={styles.modalHeader}>
              <View style={styles.editorHeading}><View style={[styles.editorAvatar, { backgroundColor: `${colors.primary}20` }]}><Text style={[styles.editorAvatarText, { color: colors.primary }]}>{(user?.username || 'U').charAt(0).toUpperCase()}</Text></View><View><Text style={[styles.modalTitle, { color: colors.text }]}>Edit profile</Text><Text style={[styles.modalSubText, { color: colors.subText }]}>Update your personal details</Text></View></View>
              <TouchableOpacity onPress={() => setProfileEditorVisible(false)} style={styles.editorClose}><Ionicons name="close" size={20} color={colors.text} /></TouchableOpacity>
            </View>
            <View style={[styles.usernameBanner, { backgroundColor: colors.inputBg }]}><Ionicons name="at-outline" size={18} color={colors.primary} /><View><Text style={[styles.usernameLabel, { color: colors.subText }]}>Username</Text><Text style={[styles.usernameValue, { color: colors.text }]}>{user?.username || 'GRAP user'}</Text></View><Ionicons name="lock-closed-outline" size={15} color={colors.subText} /></View>
            <Text style={[styles.editorHint, { color: colors.subText }]}>Your username is your unique account ID and cannot be changed here.</Text>
            {([['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email address'], ['phone_number', 'Phone number']] as const).map(([key, placeholder]) => (
              <View key={key} style={styles.editorField}><Text style={[styles.editorLabel, { color: colors.text }]}>{placeholder}{key !== 'phone_number' && <Text style={{ color: '#FF5252' }}> *</Text>}</Text><TextInput style={[styles.editorInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]} placeholder={key === 'phone_number' ? 'Optional phone number' : placeholder} placeholderTextColor={colors.subText} value={profileForm[key]} onChangeText={(value) => setProfileForm((current) => ({ ...current, [key]: value }))} keyboardType={key === 'email' ? 'email-address' : key === 'phone_number' ? 'phone-pad' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'words'} /></View>
            ))}
            <View style={styles.editorActions}><TouchableOpacity style={[styles.cancelEditorBtn, { borderColor: colors.cardBorder }]} onPress={() => setProfileEditorVisible(false)}><Text style={[styles.cancelEditorText, { color: colors.subText }]}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.saveAddressBtn, styles.saveEditorBtn, { backgroundColor: colors.primary }]} onPress={saveProfile} disabled={profileSaving}><Ionicons name="checkmark" size={17} color="#0B1325" /><Text style={styles.saveAddressBtnText}>{profileSaving ? 'Saving...' : 'Save changes'}</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>

      <Modal visible={verificationVisible} transparent animationType="slide" onRequestClose={() => setVerificationVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.addressModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Enter email PIN</Text><TouchableOpacity onPress={() => setVerificationVisible(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity></View>
            <Text style={[styles.modalSubText, { color: colors.subText }]}>Enter the 6-digit code sent to {user?.email}.</Text>
            <TextInput style={[styles.addressInput, styles.verificationInput, { backgroundColor: colors.inputBg, color: colors.text }]} placeholder="000000" placeholderTextColor={colors.subText} keyboardType="number-pad" maxLength={7} value={verificationCode} onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))} autoFocus />
            <TouchableOpacity style={[styles.saveAddressBtn, { backgroundColor: colors.primary }]} onPress={confirmVerification} disabled={verificationLoading}><Text style={styles.saveAddressBtnText}>{verificationLoading ? 'Verifying...' : 'Verify account'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.resendButton} onPress={sendVerificationCode} disabled={verificationLoading}><Text style={[styles.resendText, { color: colors.primary }]}>Resend PIN</Text></TouchableOpacity>
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
  profileCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  verificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  verificationSub: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  verifyButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  verifyButtonText: {
    color: '#0B1325',
    fontSize: 11,
    fontWeight: '800',
  },
  verificationInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 15,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileContact: {
    fontSize: 12,
    marginTop: 1,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  vipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  editProfileBtn: {
    height: 38,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  editProfileBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
    color: '#FFD600',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 20,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  favIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  favSub: {
    fontSize: 11,
    marginTop: 1,
  },
  divider: {
    height: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  payIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  langToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langToggleText: {
    fontWeight: '800',
    fontSize: 13,
  },
  supportBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  supportBtnText: {
    fontWeight: '800',
    fontSize: 14,
  },
  logoutBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF5252',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutBtnText: {
    color: '#FF5252',
    fontWeight: '800',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  addressModalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  profileEditorCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    maxHeight: '92%',
  },
  editorHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editorAvatarText: {
    fontSize: 18,
    fontWeight: '900',
  },
  editorClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameBanner: {
    minHeight: 54,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  usernameLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  usernameValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  editorHint: {
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 13,
  },
  editorField: {
    marginBottom: 11,
  },
  editorLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  editorInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelEditorBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditorText: {
    fontSize: 13,
    fontWeight: '800',
  },
  saveEditorBtn: {
    flex: 1.35,
    flexDirection: 'row',
    gap: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubText: {
    fontSize: 12,
    marginBottom: 14,
  },
  addressInput: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 16,
  },
  saveAddressBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveAddressBtnText: {
    color: '#0B1325',
    fontWeight: '800',
    fontSize: 14,
  },
});
