import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useVPNEvents } from './src/hooks';
import { ProfileNotification } from './src/components';

export default function App() {
  // Listen to VPN events
  useVPNEvents();

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <ProfileNotification />
      <StatusBar style="dark" backgroundColor="transparent" />
    </SafeAreaProvider>
  );
}
