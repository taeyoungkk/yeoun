import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import "../src/styles/global.css";

import * as WebBrowser from 'expo-web-browser';

import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store';

// Handle OAuth redirects early in the lifecycle
WebBrowser.maybeCompleteAuthSession();

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);

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
    // Wait for fonts and store hydration
    if (loaded && isHydrated) {
      SplashScreen.hideAsync();

      const inAuthGroup = segments[0] === '(auth)';
      const isRedirectPage = segments[0] === 'oauthredirect';
      const isLoggedIn = !!accessToken;

      if (isRedirectPage) {
        // Don't redirect if we are on the dedicated OAuth redirect page
        return;
      }

      if (!isLoggedIn && !inAuthGroup) {
        // Redirect to login if not logged in and not in auth group
        router.replace('/(auth)/login');
      } else if (isLoggedIn && inAuthGroup) {
        // Redirect to tabs if logged in and in auth group
        router.replace('/(tabs)');
      }
    }
  }, [loaded, isHydrated, accessToken, segments]);

  if (!loaded || !isHydrated) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip/start" />
        <Stack.Screen name="trip/recording" />
        <Stack.Screen name="trip/photo-album" />
        <Stack.Screen name="trip/report" />
        <Stack.Screen name="trip/liked" />
        <Stack.Screen name="trip/past" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
