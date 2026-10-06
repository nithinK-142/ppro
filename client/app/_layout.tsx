import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/state/auth';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AuthProvider>
  );
}