import { Tabs } from 'expo-router';
import React from 'react';

import { RegularNav } from '@/src/components/ui/regular-navbar';
import { HouseSvg } from '@/src/components/icons/HouseSvg';
import { MapLocationPinSvg } from '@/src/components/icons/MapLocationPinSvg';
import { ProfileRoundSvg } from '@/src/components/icons/ProfileRoundSvg';
import { CreditCardSvg } from '@/src/components/icons/CreditCardSvg';
import { BellSvg } from '@/src/components/icons/BellSvg';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { useNotificationStore } from '@/src/store/notification.store';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const hasUnread = useNotificationStore((state) => state.hasUnread);

  const navItems = [
    { 
      label: 'Home', 
      href: '/', 
      icon: ({ color, size }: { color: string; size: number }) => <HouseSvg color={color} size={size} />
    },
    { 
      label: 'Explore', 
      href: '/explore', 
      icon: ({ color, size }: { color: string; size: number }) => <MapLocationPinSvg color={color} size={size} />
    },
    { 
      label: 'Cards', 
      href: '/cards', 
      icon: ({ color, size }: { color: string; size: number }) => <CreditCardSvg color={color} size={size} />
    },
    { 
      label: 'Notice', 
      href: '/notifications', 
      icon: ({ color, size }: { color: string; size: number }) => <BellSvg color={color} size={size} />,
      showBadge: hasUnread
    },
    { 
      label: 'My Page', 
      href: '/mypage', 
      icon: ({ color, size }: { color: string; size: number }) => <ProfileRoundSvg color={color} size={size} />
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notice',
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'My Page',
        }}
      />
    </Tabs>
  );
}
