import { Stack } from 'expo-router';

import FriendScreen from '@/src/features/friend/screens/FriendScreen';

export default function FriendsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FriendScreen />
    </>
  );
}
