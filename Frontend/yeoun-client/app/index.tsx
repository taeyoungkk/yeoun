import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/auth.store';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
