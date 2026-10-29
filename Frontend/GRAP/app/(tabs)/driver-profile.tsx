import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';

export default function DriverProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [driverStats, setDriverStats] = useState<{ rating_avg: number; total_rides: number; is_online: boolean }>({
    rating_avg: 0,
    total_rides: 0,
    is_online: false,
  });
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    profile_picture_url: '',
  });

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      api.getMe()
        .then(({ profile }) => {
          if (isActive) {
            setDriverStats({
              rating_avg: Number(profile?.rating_avg) || 0,
              total_rides: Number(profile?.total_rides) || 0,
              is_online: Boolean(profile?.is_online),
            });
          }
        })
        .catch((error) => console.error('Could not load driver profile stats:', error));

      return () => {
        isActive = false;
      };
    }, []),
  );

  const openProfileEditor = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone_number: user?.phone_number || '',
      profile_picture_url: user?.profile_picture_url || '',
    });
    setEditorVisible(true);
  };

  const chooseProfilePicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Permission needed'), t('Allow photo access to choose a profile picture.'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setProfileForm((current) => ({ ...current, profile_picture_url: uri }));
    }
  };

  const saveProfile = async () => {
    if (!profileForm.first_name.trim() || !profileForm.last_name.trim() || !profileForm.email.trim()) {
      Alert.alert(t('Incomplete profile'), t('First name, last name, and email are required.'));
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        ...profileForm,
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        email: profileForm.email.trim(),
        phone_number: profileForm.phone_number.trim(),
      });
      setImgError(false);
      setEditorVisible(false);
      Alert.alert(t('Profile updated'), t('Your profile details were saved successfully.'));
    } catch (error: any) {
      Alert.alert(t('Could not save profile'), error.message ? t(error.message) : t('Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      {/* Profile Header */}
      <View style={[styles.profileHeaderCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.avatarLarge, { backgroundColor: `${colors.secondary}20`, borderColor: colors.secondary, overflow: 'hidden' }]}>
          {user?.profile_picture_url && !imgError ? (
            <Image
              source={{ uri: user.profile_picture_url }}
              style={styles.avatarImage}
              onError={() => setImgError(true)}
            />
          ) : (
            <Text style={[styles.avatarLargeText, { color: colors.secondary }]}>{user?.username?.charAt(0).toUpperCase() || 'D'}</Text>
          )}
        </View>
        <Text style={[styles.driverName, { color: colors.text }]}>
          {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'GRAP Driver'}
        </Text>
        <Text style={[styles.licenseText, { color: colors.subText }]}>@{user?.username || 'driver'}</Text>
        <Text style={[styles.licenseText, { color: colors.subText }]}>{t('License: CMR-LIC-9982 • Verified Driver')}</Text>
        <TouchableOpacity style={[styles.editProfileButton, { backgroundColor: colors.secondary }]} onPress={openProfileEditor}>
          <Ionicons name="create-outline" size={17} color="#0B1325" />
          <Text style={styles.editProfileButtonText}>{t('Edit profile')}</Text>
        </TouchableOpacity>

        <View style={[styles.statsRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.statBox}>
            <Ionicons name="star" size={16} color="#FFD600" />
            <Text style={[styles.statValue, { color: colors.text }]}>{driverStats.rating_avg.toFixed(1)}</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{t('Rating')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Ionicons name="car" size={16} color={colors.secondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{driverStats.total_rides}</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{t('Total Rides')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statBox}>
            <Ionicons name={driverStats.is_online ? 'radio-button-on' : 'radio-button-off'} size={16} color={driverStats.is_online ? colors.primary : colors.subText} />
            <Text style={[styles.statValue, { color: colors.text }]}>{driverStats.is_online ? 'Online' : 'Offline'}</Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>{t('Availability')}</Text>
          </View>
        </View>
      </View>

      {/* Assigned Vehicle */}
      <Text style={[styles.sectionTitle, { color: colors.subText }]}>{t('Assigned Vehicle Details')}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.vehicleRow}>
          <Ionicons name="car-sport" size={24} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleTitle, { color: colors.text }]}>{t('Toyota Yaris (2021)')}</Text>
            <Text style={[styles.vehicleSub, { color: colors.subText }]}>{t('License Plate: CE-992-AA • Economy')}</Text>
          </View>
          <View style={styles.verifiedTag}>
            <Text style={styles.verifiedTagText}>{t('VERIFIED')}</Text>
          </View>
        </View>
      </View>

      {/* Logout Action */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#FF5252" style={{ marginRight: 8 }} />
        <Text style={styles.logoutBtnText}>{t('logout')}</Text>
      </TouchableOpacity>

      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.editorHeader}>
              <View>
                <Text style={[styles.editorTitle, { color: colors.text }]}>{t('Edit profile')}</Text>
                <Text style={[styles.editorSubtitle, { color: colors.subText }]}>{t('Update your personal details')}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditorVisible(false)} accessibilityLabel="Close profile editor">
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={styles.picturePicker} onPress={chooseProfilePicture}>
                {profileForm.profile_picture_url ? (
                  <Image source={{ uri: profileForm.profile_picture_url }} style={styles.picturePreview} />
                ) : (
                  <View style={[styles.picturePlaceholder, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="image-outline" size={25} color={colors.subText} />
                    <Text style={[styles.picturePlaceholderText, { color: colors.subText }]}>{t('Choose a picture')}</Text>
                  </View>
                )}
                <Text style={[styles.picturePickerLabel, { color: colors.secondary }]}>{t('Change profile picture')}</Text>
              </TouchableOpacity>

              {([
                ['first_name', 'First name'],
                ['last_name', 'Last name'],
                ['email', 'Email address'],
                ['phone_number', 'Phone number'],
              ] as const).map(([key, label]) => (
                <View key={key} style={styles.formField}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    {label}{key !== 'phone_number' && <Text style={{ color: '#FF5252' }}> *</Text>}
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
                    placeholder={key === 'phone_number' ? 'Optional phone number' : label}
                    placeholderTextColor={colors.subText}
                    value={profileForm[key]}
                    onChangeText={(value) => setProfileForm((current) => ({ ...current, [key]: value }))}
                    keyboardType={key === 'email' ? 'email-address' : key === 'phone_number' ? 'phone-pad' : 'default'}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.editorActions}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.cardBorder }]} onPress={() => setEditorVisible(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.subText }]}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.secondary }]} onPress={saveProfile} disabled={saving}>
                <Ionicons name="checkmark" size={17} color="#0B1325" />
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
              </TouchableOpacity>
            </View>
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
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarLargeText: {
    fontSize: 28,
    fontWeight: '900',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 12,
  },
  editProfileButtonText: {
    color: '#0B1325',
    fontSize: 13,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
  },
  editorCard: {
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  editorSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  picturePicker: {
    alignItems: 'center',
    marginBottom: 16,
  },
  picturePreview: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  picturePlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picturePlaceholderText: {
    fontSize: 9,
    marginTop: 3,
  },
  picturePickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },
  formField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldInput: {
    height: 46,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#0B1325',
    fontSize: 13,
    fontWeight: '800',
  },
});
