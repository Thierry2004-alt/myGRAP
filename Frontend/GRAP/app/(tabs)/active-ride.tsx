import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function ActiveRideRedirectScreen() {
  const router = useRouter();
  const { role } = useAuth();

  useEffect(() => {
    if (role === 'DRIVER') {
      router.replace('/driver-home');
    } else {
      router.replace('/rides');
    }
  }, [role, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00E676" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
