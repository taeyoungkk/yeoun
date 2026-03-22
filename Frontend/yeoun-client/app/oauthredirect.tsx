import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * This page handles the yeoun://oauthredirect deep link.
 * WebBrowser.maybeCompleteAuthSession() will usually intercept this,
 * but having a dedicated route prevents the "Unmatched Route" error screen.
 */
export default function OAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Attempt to complete the auth session if it hasn't been already
    WebBrowser.maybeCompleteAuthSession();
    
    // Fallback: If for some reason we stay on this page, go back to login
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#344966" />
    </View>
  );
}
