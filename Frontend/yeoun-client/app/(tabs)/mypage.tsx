import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { useUserStore } from '@/src/store';
import { getMyInfo } from '@/src/api/user';
import { getFriendsApi } from '@/src/api/friend';
import { ProfileHeader } from '@/src/components/profile/ProfileHeader';
import { UserInfoCard } from '@/src/components/profile/UserInfoCard';
import { TripList } from '@/src/components/profile/TripList';
import { TripData } from '@/src/components/profile/TripCard';
import { TravelMap } from '@/src/components/profile/TravelMap';
import { TreeRingsChart } from '@/src/components/profile/TreeRingsChart';

const MOCK_FAVORITE_TRIPS: TripData[] = [
  {
    id: '1',
    title: '제주 여행',
    location: '제주, 대한민국',
    dates: '2024.02.03 ~ 02.06',
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
    isFavorite: true,
  },
  {
    id: '2',
    title: '서울 여행',
    location: '서울, 대한민국',
    dates: '2024.02.03 ~ 02.06',
    imageSource: require('@/assets/images/trip_placeholder_2.png'),
    isFavorite: true,
  },
];

const MOCK_PAST_TRIPS: TripData[] = [
  {
    id: '3',
    title: '부산 여행',
    location: '부산, 대한민국',
    dates: '2023.08.12 ~ 08.15',
    imageSource: require('@/assets/images/trip_placeholder_3.png'),
  },
  {
    id: '4',
    title: '강릉 여행',
    location: '강릉, 대한민국',
    dates: '2022.07.01 ~ 07.03',
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
  },
];

export default function MyPageScreen() {
  const { profile, setProfile } = useUserStore();
  const [favoriteTrips, setFavoriteTrips] = useState<TripData[]>(MOCK_FAVORITE_TRIPS);
  const [pastTrips, setPastTrips] = useState<TripData[]>(MOCK_PAST_TRIPS);
  const [friendsCount, setFriendsCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchProfile = async () => {
        try {
          const [profileResponse, friendsResponse] = await Promise.all([getMyInfo(), getFriendsApi()]);

          if (profileResponse.success && isMounted) {
            setProfile(profileResponse.data);
          }

          if (friendsResponse.success && isMounted) {
            setFriendsCount(friendsResponse.data.items.length);
          }
        } catch (error) {
          console.error('Failed to fetch mypage data:', error);
        }
      };

      fetchProfile();

      return () => {
        isMounted = false;
      };
    }, [setProfile])
  );

  const handleToggleFavorite = (id: string, isFavList: boolean) => {
    if (isFavList) {
      setFavoriteTrips((prev) => prev.map((trip) => (trip.id === id ? { ...trip, isFavorite: !trip.isFavorite } : trip)));
    } else {
      setPastTrips((prev) => prev.map((trip) => (trip.id === id ? { ...trip, isFavorite: !trip.isFavorite } : trip)));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F3F6EB]" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ProfileHeader
          nickname={profile?.nickname || 'Guest'}
          location="대한민국 어딘가"
          avatarUrl={profile?.profileImageUrl || undefined}
          onSettingsPress={() => router.push('/settings')}
        />

        <UserInfoCard
          data={{
            email: profile?.email || 'N/A',
            joinDate: '2024.03.17',
            friendsCount,
          }}
          onPressFriends={() => router.push('/friends')}
        />

        <TripList
          title="좋아하는 여행"
          trips={favoriteTrips}
          onViewMore={() => console.log('View more favorites')}
          onToggleFavorite={(id) => handleToggleFavorite(id, true)}
        />

        <TripList
          title="다녀온 여행"
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
