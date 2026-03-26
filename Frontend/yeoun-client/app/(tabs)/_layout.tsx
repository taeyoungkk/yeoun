import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

import { BellSvg } from '@/src/components/icons/BellSvg';
import { CreditCardSvg } from '@/src/components/icons/CreditCardSvg';
import { HouseSvg } from '@/src/components/icons/HouseSvg';
import { MapLocationPinSvg } from '@/src/components/icons/MapLocationPinSvg';
import { ProfileRoundSvg } from '@/src/components/icons/ProfileRoundSvg';
import { RegularNav } from '@/src/components/ui/regular-navbar';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { useNotificationStore } from '@/src/store/notification.store';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const navItems = [
    {
      label: '홈',
      href: '/',
      icon: ({ color, size }: { color: string; size: number }) => <HouseSvg color={color} size={size} />,
    },
    {
      label: '탐색',
      href: '/explore',
      icon: ({ color, size }: { color: string; size: number }) => <MapLocationPinSvg color={color} size={size} />,
    },
    {
      label: '카드',
      href: '/cards',
      icon: ({ color, size }: { color: string; size: number }) => <CreditCardSvg color={color} size={size} />,
    },
    {
      label: '알림함',
      href: '/notifications',
      icon: ({ color, size }: { color: string; size: number }) => <BellSvg color={color} size={size} />,
      badgeCount: unreadCount,
    },
    {
      label: '마이페이지',
      href: '/mypage',
      icon: ({ color, size }: { color: string; size: number }) => <ProfileRoundSvg color={color} size={size} />,
    },
  ];

  return (
    <Tabs
      tabBar={() => (
        <RegularNav
          items={navItems}
          backgroundColor={colorScheme === 'dark' ? '#111' : '#fff'}
          activeColor={colorScheme === 'dark' ? '#EBF3EA' : '#244934'}
          inactiveColor={colorScheme === 'dark' ? '#666' : '#94A098'}
        />
      )}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="explore" options={{ title: '탐색' }} />
      <Tabs.Screen name="cards" options={{ title: '카드' }} />
      <Tabs.Screen name="notifications" options={{ title: '알림함' }} />
      <Tabs.Screen name="mypage" options={{ title: '마이페이지' }} />
    </Tabs>
  );
}
