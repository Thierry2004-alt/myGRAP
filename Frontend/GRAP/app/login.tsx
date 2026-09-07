import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../utils/responsive';

type Role = 'PASSENGER' | 'DRIVER';

const colors = {
  ink: '#0D3A7A',
  muted: '#5E7472',
  line: '#DCE2DA',
  canvas: '#F6F7F4',
  card: '#FFFFFF',
  green: '#3BB55C',
  greenDark: '#1E9B3D',
  blue: '#1B56B6',
};

export default function LoginScreen() {
  const { contentPadding, isDesktop } = useResponsive();
  const { login, register } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>('PASSENGER');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', email: '', phone: '', password: '',
    licenseNumber: '', licenseImage: '', vehicleMake: '', vehicleModel: '', vehicleYear: '',
    vehicleColor: '', vehiclePlate: '', vehicleCategory: 'ECONOMY', vehicleImage: '',
  });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const chooseImage = async (key: 'licenseImage' | 'vehicleImage') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add your verification document.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) update(key, result.assets[0].uri);
  };

  const validateAccount = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      Alert.alert('Complete your profile', 'Add your name, email, username, and password to continue.');
      return false;
    }
    if (form.password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters for your password.');
      return false;
    }
    return true;
  };

  const validateDriver = () => {
    const required = [form.licenseNumber, form.vehicleMake, form.vehicleModel, form.vehicleYear, form.vehicleColor, form.vehiclePlate, form.vehicleImage];
    if (required.some((value) => !value.trim())) {
      Alert.alert('Finish your driver profile', 'License and all vehicle details, including a clear vehicle photo, are required.');
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    if (isSignUp && !validateAccount()) return;
    if (isSignUp && role === 'DRIVER' && step === 1) {
      setStep(2);
      return;
    }
    if (isSignUp && role === 'DRIVER' && !validateDriver()) return;
    if (!isSignUp && (!form.username.trim() || !form.password)) {
      Alert.alert('Welcome back', 'Enter your username and password to continue.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await register({
          username: form.username.trim(), password: form.password, email: form.email.trim(),
          first_name: form.firstName.trim(), last_name: form.lastName.trim(), phone_number: form.phone.trim(), role,
          ...(role === 'DRIVER' ? {
            license_number: form.licenseNumber.trim(), license_document_url: form.licenseImage,
            vehicle_make: form.vehicleMake.trim(), vehicle_model: form.vehicleModel.trim(),
            vehicle_year: Number(form.vehicleYear), vehicle_color: form.vehicleColor.trim(),
            vehicle_license_plate: form.vehiclePlate.trim().toUpperCase(), vehicle_category: form.vehicleCategory,
            vehicle_image_url: form.vehicleImage,
          } : {}),
        });
      } else {
        await login(form.username.trim(), form.password);
      }
    } catch (error: any) {
      Alert.alert('Unable to continue', error.message || 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp((value) => !value);
    setStep(1);
  };

  const input = (key: keyof typeof form, placeholder: string, icon: keyof typeof Ionicons.glyphMap, options: any = {}) => (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={19} color={colors.muted} />
      <TextInput
        {...options}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#94A39D"
        value={form[key]}
        onChangeText={(value) => update(key, value)}
      />
    </View>
  );

  const uploadTile = (key: 'licenseImage' | 'vehicleImage', title: string, subtitle: string, icon: keyof typeof Ionicons.glyphMap) => (
    <Pressable style={styles.uploadTile} onPress={() => chooseImage(key)}>
      {form[key] ? <Image source={{ uri: form[key] }} style={styles.preview} /> : <Ionicons name={icon} size={27} color={colors.green} />}
      <View style={styles.uploadCopy}>
        <Text style={styles.uploadTitle}>{form[key] ? 'Photo selected' : title}</Text>
        <Text style={styles.uploadSubtitle}>{form[key] ? 'Tap to replace' : subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: contentPadding }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.contentInner, isDesktop && styles.contentInnerDesktop]}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />
          <View><Text style={styles.brand}>GRAP</Text><Text style={styles.brandTag}>Ride together, go further</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{isSignUp ? 'JOIN THE NETWORK' : 'WELCOME BACK'}</Text>
          <Text style={styles.title}>{isSignUp ? 'Your next trip starts here.' : 'Every journey, handled better.'}</Text>
          <Text style={styles.subtitle}>{isSignUp ? 'Create a secure account in a few simple steps.' : 'Reliable rides across Yaoundé, with people you can trust.'}</Text>
        </View>

        <View style={styles.card}>
          {isSignUp && role === 'DRIVER' && <View style={styles.progress}><View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} /></View>}
          <View style={styles.cardHeader}>
            <View><Text style={styles.cardTitle}>{isSignUp ? (role === 'DRIVER' && step === 2 ? 'Driver verification' : 'Create your account') : 'Sign in'}</Text><Text style={styles.cardHint}>{isSignUp && role === 'DRIVER' && step === 2 ? 'Help passengers recognize you on every ride.' : 'Your details stay private and secure.'}</Text></View>
            <Ionicons name={isSignUp && role === 'DRIVER' && step === 2 ? 'shield-checkmark-outline' : 'lock-closed-outline'} size={24} color={colors.green} />
          </View>

          {!isSignUp ? <>
            {input('username', 'Email or username', 'person-outline', { autoCapitalize: 'none', keyboardType: 'email-address' })}
            <View style={styles.inputWrap}><Ionicons name="lock-closed-outline" size={19} color={colors.muted} /><TextInput style={styles.input} placeholder="Password" placeholderTextColor="#94A39D" secureTextEntry={!showPassword} value={form.password} onChangeText={(value) => update('password', value)} /><Pressable onPress={() => setShowPassword((value) => !value)}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} /></Pressable></View>
          </> : step === 1 ? <>
            <View style={styles.nameRow}>{input('firstName', 'First name', 'person-outline')}<View style={styles.nameGap} />{input('lastName', 'Last name', 'person-outline')}</View>
            {input('email', 'Email address', 'mail-outline', { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {input('phone', 'Phone number (optional)', 'call-outline', { keyboardType: 'phone-pad' })}
            {input('username', 'Choose a username', 'at-outline', { autoCapitalize: 'none' })}
            <View style={styles.inputWrap}><Ionicons name="lock-closed-outline" size={19} color={colors.muted} /><TextInput style={styles.input} placeholder="Create a password (8+ characters)" placeholderTextColor="#94A39D" secureTextEntry={!showPassword} value={form.password} onChangeText={(value) => update('password', value)} /><Pressable onPress={() => setShowPassword((value) => !value)}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} /></Pressable></View>
            <Text style={styles.fieldLabel}>I want to join as</Text>
            <View style={styles.roleRow}>{(['PASSENGER', 'DRIVER'] as Role[]).map((item) => <Pressable key={item} style={[styles.roleChoice, role === item && styles.roleChoiceActive]} onPress={() => { setRole(item); setStep(1); }}><Ionicons name={item === 'DRIVER' ? 'car-outline' : 'person-outline'} size={20} color={role === item ? '#FFFFFF' : colors.muted} /><Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'DRIVER' ? 'Driver' : 'Passenger'}</Text></Pressable>)}</View>
          </> : <>
            <View style={styles.sectionLabel}><Ionicons name="document-text-outline" size={18} color={colors.green} /><Text style={styles.fieldLabel}>Driving license</Text></View>
            {input('licenseNumber', 'License number', 'card-outline', { autoCapitalize: 'characters' })}
            {uploadTile('licenseImage', 'Add license photo', 'Clear front photo, JPG or PNG', 'document-attach-outline')}
            <View style={styles.sectionLabel}><Ionicons name="car-outline" size={18} color={colors.green} /><Text style={styles.fieldLabel}>Vehicle details</Text></View>
            <View style={styles.nameRow}>{input('vehicleMake', 'Make (Toyota)', 'car-outline')}<View style={styles.nameGap} />{input('vehicleModel', 'Model (Yaris)', 'car-outline')}</View>
            <View style={styles.nameRow}>{input('vehicleYear', 'Year', 'calendar-outline', { keyboardType: 'number-pad' })}<View style={styles.nameGap} />{input('vehicleColor', 'Color', 'color-palette-outline')}</View>
            {input('vehiclePlate', 'License plate', 'pricetag-outline', { autoCapitalize: 'characters' })}
            <Text style={styles.fieldLabel}>Service category</Text>
            <View style={styles.categoryRow}>{['ECONOMY', 'COMFORT', 'MOTO'].map((item) => <Pressable key={item} style={[styles.category, form.vehicleCategory === item && styles.categoryActive]} onPress={() => update('vehicleCategory', item)}><Text style={[styles.categoryText, form.vehicleCategory === item && styles.categoryTextActive]}>{item === 'COMFORT' ? 'Comfort' : item[0] + item.slice(1).toLowerCase()}</Text></Pressable>)}</View>
            {uploadTile('vehicleImage', 'Add vehicle photo', 'Show the full vehicle clearly', 'camera-outline')}
            <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={colors.blue} /><Text style={styles.noticeText}>Your profile will be reviewed before you receive passenger requests.</Text></View>
          </>}

          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={handleAuth} disabled={loading}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.primaryText}>{!isSignUp ? 'Sign in' : role === 'DRIVER' && step === 1 ? 'Continue to verification' : 'Submit for review'}</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></>}</Pressable>
          {isSignUp && role === 'DRIVER' && step === 2 && <Pressable style={styles.backButton} onPress={() => setStep(1)}><Ionicons name="arrow-back" size={17} color={colors.green} /><Text style={styles.backText}>Back to account details</Text></Pressable>}
          <Pressable style={styles.switchButton} onPress={switchMode}><Text style={styles.switchText}>{isSignUp ? 'Already have an account? Sign in' : 'New to GRAP? Create an account'}</Text></Pressable>
        </View>
        <Text style={styles.footer}>By continuing, you agree to GRAP's terms and privacy policy.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 28 },
  contentInner: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  contentInnerDesktop: { paddingTop: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 42 },
  logo: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
  brand: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: 2 },
  brandTag: { color: colors.muted, fontSize: 12, marginTop: 1 },
  hero: { marginBottom: 25 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  title: { color: colors.ink, fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: 0 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 330 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.line, shadowColor: '#174836', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  progress: { height: 4, backgroundColor: '#E6F0EB', borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 19 },
  cardTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  cardHint: { color: colors.muted, fontSize: 12, marginTop: 4, maxWidth: 270 },
  inputWrap: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: '#FBFDFC', borderRadius: 13, paddingHorizontal: 14, marginBottom: 12 },
  input: { flex: 1, color: colors.ink, fontSize: 14, marginLeft: 10, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  nameGap: { width: 8 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 9, marginTop: 4 },
  roleRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  roleChoice: { flex: 1, minHeight: 49, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  roleChoiceActive: { backgroundColor: colors.green, borderColor: colors.green },
  roleText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  roleTextActive: { color: '#FFFFFF' },
  sectionLabel: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 2 },
  uploadTile: { minHeight: 72, borderWidth: 1, borderColor: '#B9DCCB', borderStyle: 'dashed', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#F7FCF9' },
  preview: { width: 50, height: 50, borderRadius: 9 },
  uploadCopy: { flex: 1, marginLeft: 11 },
  uploadTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  uploadSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  category: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  categoryActive: { backgroundColor: '#E2F4EB', borderColor: colors.green },
  categoryText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: colors.greenDark },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: '#EEF6FC', borderRadius: 11, padding: 11, marginBottom: 15 },
  noticeText: { flex: 1, color: '#3E6684', fontSize: 11, lineHeight: 16 },
  primaryButton: { height: 53, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginTop: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.86 },
  backButton: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginTop: 16 },
  backText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  switchButton: { alignItems: 'center', marginTop: 18 },
  switchText: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 20 },
});
