import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { useUserStore, useFavoriteStore } from '@/src/store';
import { getMyInfo } from '@/src/api/user';
import { getFriendsApi } from '@/src/api/friend';
import { getTripsApi, TripListItem } from '@/src/api/trip';
import { ProfileHeader } from '@/src/components/profile/ProfileHeader';
import { UserInfoCard } from '@/src/components/profile/UserInfoCard';
import { TripList } from '@/src/components/profile/TripList';
import { TripData } from '@/src/components/profile/TripCard';
import { TravelMap } from '@/src/components/profile/TravelMap';
import { TreeRingsChart } from '@/src/components/profile/TreeRingsChart';

// We'll keep these as fallback/additional mock for now if needed, 
// but we will primarily use server data.
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

  // Helper to map API trip to UI TripData
  const mapToTripData = (trip: TripListItem): TripData => ({
    id: trip.tripId,
    title: trip.title,
    location: (trip.region && trip.country) ? `${trip.region}, ${trip.country}` : (trip.region || trip.country || '대한민국'),
    dates: `${trip.startDate.replace(/-/g, '.')} ~ ${trip.endDate.split('-').pop()}`,
    imageSource: require('@/assets/images/trip_placeholder_1.png'), // Placeholder
    isFavorite: favoriteIds.includes(trip.tripId)
  });

  // Dynamic favorite trips based on store and both mock/server data
  const favoriteTrips = [
    ...MOCK_FAVORITE_TRIPS,
    ...serverTrips.map(mapToTripData)
  ].filter(trip => favoriteIds.includes(trip.id))
   .filter((trip, index, self) => self.findIndex(t => t.id === trip.id) === index); // Unique

  // Past trips from server (status ENDED)
  const pastTrips = serverTrips
    .filter(trip => trip.status === 'ENDED')
    .map(mapToTripData);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchData = async () => {
        try {
          const [profileResponse, friendsResponse, tripsResponse] = await Promise.all([
            getMyInfo(),
            getFriendsApi(),
            getTripsApi()
          ]);

          if (isMounted) {
            if (profileResponse.success) {
              setProfile(profileResponse.data);
            }

            if (friendsResponse.success) {
              setFriendsCount(friendsResponse.data.items.length);
            }

            if (tripsResponse.success) {
              setServerTrips(tripsResponse.data.items);
            }
          }
        } catch (error) {
          console.error('Failed to fetch mypage data:', error);
        }
      };

      fetchData();

      return () => {
        isMounted = false;
      };
    }, [setProfile])
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

        <TravelMap />
        <TreeRingsChart />
      </ScrollView>
    </SafeAreaView>
  );
}
