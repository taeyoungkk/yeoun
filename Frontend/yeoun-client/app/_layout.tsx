import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import "../src/styles/global.css";

import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store';
import { useRouter, useSegments } from 'expo-router';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const accessToken = useAuthStore((s) => s.accessToken);
  const segments = useSegments();
  const router = useRouter();

  const [loaded] = useFonts({
    'Pretendard-Black': require('../assets/fonts/Pretendard-Black.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf'),
    'Pretendard-ExtraLight': require('../assets/fonts/Pretendard-ExtraLight.otf'),
    'Pretendard-Light': require('../assets/fonts/Pretendard-Light.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Thin': require('../assets/fonts/Pretendard-Thin.otf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Auth Guard
  useEffect(() => {
    if (!loaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!accessToken && !inAuthGroup) {
      // Not logged in and not in auth group -> redirect to login
      router.replace('/(auth)/login');
    } else if (accessToken && inAuthGroup) {
      // Logged in and in auth group -> redirect to home
      router.replace('/(tabs)');
    }
  }, [accessToken, segments, loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trip/start" options={{ headerShown: false }} />
        <Stack.Screen name="trip/recording" options={{ headerShown: false }} />
        <Stack.Screen name="trip/photo-album" options={{ headerShown: false }} />
        <Stack.Screen name="trip/report" options={{ headerShown: false }} />
        <Stack.Screen name="trips/liked" options={{ headerShown: false }} />
        <Stack.Screen name="trips/past" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
