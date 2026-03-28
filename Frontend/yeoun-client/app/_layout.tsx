import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  const navigationState = useRootNavigationState();
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
    if (!loaded || !isHydrated || !navigationState?.key) {
      return;
    }

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const isRedirectPage = segments[0] === 'oauthredirect';
    const isLoggedIn = !!accessToken;

    if (isRedirectPage) {
      return;
    }

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [loaded, isHydrated, navigationState?.key, accessToken, segments, router]);

  if (!loaded || !isHydrated) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="payment-details" />
          <Stack.Screen name="payment-member-summary" />
          <Stack.Screen name="payment-summary" />
          <Stack.Screen name="payment-settlement" />
          <Stack.Screen name="receipt-ocr" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="add-card" />
          <Stack.Screen name="oauthredirect" />
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
    </GestureHandlerRootView>
  );
}
