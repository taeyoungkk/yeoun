import { StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { globalUserState, subscribeUser } from '@/src/store/userStore';

import { ProfileHeader } from "@/src/components/profile/ProfileHeader";
import { UserInfoCard } from "@/src/components/profile/UserInfoCard";
import { TripList } from "@/src/components/profile/TripList";
import { TripData } from "@/src/components/profile/TripCard";
import { TravelMap } from "@/src/components/profile/TravelMap";
import { TreeRingsChart } from "@/src/components/profile/TreeRingsChart";


const MOCK_FAVORITE_TRIPS: TripData[] = [
  {
    id: '1',
    title: '일본 여행',
    location: '일본, 후쿠오카',
    dates: '2024.02.03 ~ 02.06',
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
    isFavorite: true,
  },
  {
    id: '2',
    title: '일본 여행',
    location: '일본, 후쿠오카',
    dates: '2024.02.03 ~ 02.06',
    imageSource: require('@/assets/images/trip_placeholder_2.png'),
    isFavorite: true,
  }
];

const MOCK_PAST_TRIPS: TripData[] = [
  {
    id: '3',
    title: '제주도 가족여행',
    location: '한국, 제주도',
    dates: '2023.08.12 ~ 08.15',
    imageSource: require('@/assets/images/trip_placeholder_3.png'),
  },
  {
    id: '4',
    title: '부산 바다',
    location: '한국, 부산',
    dates: '2022.07.01 ~ 07.03',
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
  }
];

export default function MyPageScreen() {
  const [favoriteTrips, setFavoriteTrips] = useState<TripData[]>(MOCK_FAVORITE_TRIPS);
  const [pastTrips, setPastTrips] = useState<TripData[]>(MOCK_PAST_TRIPS);
  
  const [userData, setUserData] = useState({ ...globalUserState });
  
  useEffect(() => {
    // Subscribe to changes from edit profile
    const unsubscribe = subscribeUser(() => {
      setUserData({ ...globalUserState });
    });
    return unsubscribe;
  }, []);

  const handleToggleFavorite = (id: string, isFavList: boolean) => {
    if (isFavList) {
      setFavoriteTrips(prev => prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
    } else {
      setPastTrips(prev => prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F3F6EB]" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ProfileHeader 
          nickname={userData.nickname} 
          location="대한민국, 대전광역시" 
          avatarUrl={userData.avatarUrl || undefined}
          onSettingsPress={() => router.push('/settings')}
        />
        
        <UserInfoCard data={userData} />
        
        <TripList 
          title="좋아한 여행" 
          trips={favoriteTrips} 
          onViewMore={() => console.log('View more favorites')} 
          onToggleFavorite={(id) => handleToggleFavorite(id, true)}
        />

        <TripList 
          title="과거 여행" 
          trips={pastTrips} 
          onViewMore={() => console.log('View more past trips')} 
          onToggleFavorite={(id) => handleToggleFavorite(id, false)}
        />
        
        <TravelMap />
        
        <TreeRingsChart />
        
      </ScrollView>
    </SafeAreaView>
  );
}
