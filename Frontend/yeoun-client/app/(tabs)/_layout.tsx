import { Tabs } from 'expo-router';
import React from 'react';

import { PillNav } from '@/src/components/ui/pill-navbar';
import { HouseSvg } from '@/src/components/icons/HouseSvg';
import { MapLocationPinSvg } from '@/src/components/icons/MapLocationPinSvg';
import { ProfileRoundSvg } from '@/src/components/icons/ProfileRoundSvg';
import { CreditCardSvg } from '@/src/components/icons/CreditCardSvg';
import { useColorScheme } from '@/src/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
      label: 'Profile', 
      href: '/profile', 
      icon: ({ color, size }: { color: string; size: number }) => <ProfileRoundSvg color={color} size={size} />
    },
  ];

  return (
    <Tabs
      tabBar={() => (
        <PillNav 
          items={navItems} 
          baseColor={colorScheme === 'dark' ? '#111' : '#fff'}
          pillColor={colorScheme === 'dark' ? '#fff' : '#000'}
          activeTextColor={colorScheme === 'dark' ? '#000' : '#fff'}
          inactiveTextColor={colorScheme === 'dark' ? '#999' : '#666'}
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
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
