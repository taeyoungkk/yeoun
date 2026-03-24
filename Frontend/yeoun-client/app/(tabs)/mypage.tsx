import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendsApi } from '@/src/api/friend';
import { getTripsApi, TripListItem } from '@/src/api/trip';
import { getMyInfo } from '@/src/api/user';
import { ProfileHeader } from '@/src/components/profile/ProfileHeader';
import { TripData } from '@/src/components/profile/TripCard';
import { TripList } from '@/src/components/profile/TripList';
import { TreeRingsChart } from '@/src/components/profile/TreeRingsChart';
import { TravelMap } from '@/src/components/profile/TravelMap';
import { UserInfoCard } from '@/src/components/profile/UserInfoCard';
import { useFavoriteStore, useUserStore } from '@/src/store';

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

export default function MyPageScreen() {
  const { profile, setProfile } = useUserStore();
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const [serverTrips, setServerTrips] = useState<TripListItem[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);

  const mapToTripData = (trip: TripListItem): TripData => ({
    id: trip.tripId,
    title: trip.title,
    location:
      trip.region && trip.country
        ? `${trip.region}, ${trip.country}`
        : trip.region || trip.country || '대한민국',
    dates: `${trip.startDate.replace(/-/g, '.')} ~ ${trip.endDate.split('-').pop()}`,
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
    isFavorite: favoriteIds.includes(trip.tripId),
  });

  const favoriteTrips: TripData[] = [...MOCK_FAVORITE_TRIPS, ...serverTrips.map(mapToTripData)]
    .filter((trip) => favoriteIds.includes(trip.id))
    .filter((trip, index, self) => self.findIndex((item) => item.id === trip.id) === index);

  const pastTrips = serverTrips.filter((trip) => trip.status === 'ENDED').map(mapToTripData);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchData = async () => {
        const [profileResult, friendsResult, tripsResult] = await Promise.allSettled([
          getMyInfo(),
          getFriendsApi(),
          getTripsApi(),
        ]);

        if (!isMounted) {
          return;
        }

        if (profileResult.status === 'fulfilled') {
          if (profileResult.value.success) {
            setProfile(profileResult.value.data);
          } else {
            console.warn('[MyPage] Profile request completed without success.', profileResult.value);
          }
        } else {
          console.warn('[MyPage] Profile request failed.', profileResult.reason);
        }

        if (friendsResult.status === 'fulfilled') {
          if (friendsResult.value.success) {
            setFriendsCount(friendsResult.value.data.items.length);
          } else {
            console.warn('[MyPage] Friends request completed without success.', friendsResult.value);
          }
        } else {
          console.warn('[MyPage] Friends request failed.', friendsResult.reason);
        }

        if (tripsResult.status === 'fulfilled') {
          if (tripsResult.value.success) {
            setServerTrips(tripsResult.value.data.items);
          } else {
            console.warn('[MyPage] Trips request completed without success.', tripsResult.value);
          }
        } else {
          console.warn('[MyPage] Trips request failed.', tripsResult.reason);
        }
      };

      void fetchData();

      return () => {
        isMounted = false;
      };
    }, [setProfile]),
  );

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
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
          onViewMore={() => router.push('/trip/liked')}
          onToggleFavorite={handleToggleFavorite}
        />

        <TripList
          title="다녀온 여행"
          trips={pastTrips}
          onViewMore={() => router.push('/trip/past')}
          onToggleFavorite={handleToggleFavorite}
        />

        <TravelMap tripIds={serverTrips.filter((trip) => trip.status === 'ENDED').map((trip) => trip.tripId)} />
        <TreeRingsChart />
      </ScrollView>
    </SafeAreaView>
  );
}
