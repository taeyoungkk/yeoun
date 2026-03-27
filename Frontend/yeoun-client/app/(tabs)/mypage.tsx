import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { getFriendsApi } from '@/src/api/friend';
import { TripListItem } from '@/src/api/trip';
import { getMyInfo } from '@/src/api/user';
import { ProfileHeader } from '@/src/components/profile/ProfileHeader';
import { TripData } from '@/src/components/profile/TripCard';
import { TripList } from '@/src/components/profile/TripList';
import { TreeRingsChart } from '@/src/components/profile/TreeRingsChart';
import { TravelMap } from '@/src/components/profile/TravelMap';
import { UserInfoCard } from '@/src/components/profile/UserInfoCard';
import { useFavoriteStore, useTripStore, useUserStore } from '@/src/store';
import { reverseGeocodeKo } from '@/src/api/mapbox';
import { getTripPlaceholder } from '@/src/utils/image-utils';

const formatDate = (dateString?: string) => {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
};

export default function MyPageScreen() {
  const { profile, setProfile, settings } = useUserStore();
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const serverTrips = useTripStore((state) => state.trips);
  const fetchTrips = useTripStore((state) => state.fetchTrips);
  const [friendsCount, setFriendsCount] = useState(0);
  const [locationName, setLocationName] = useState('위치 정보를 가져오는 중...');

  const mapToTripData = (trip: TripListItem): TripData => ({
    id: trip.tripId,
    title: trip.title,
    location:
      trip.region && trip.country
        ? `${trip.region}, ${trip.country}`
        : trip.region || trip.country || '대한민국',
    dates: `${trip.startDate.replace(/-/g, '.')} ~ ${trip.endDate.split('-').pop()}`,
    imageSource: getTripPlaceholder(trip.tripId),
    isFavorite: favoriteIds.includes(trip.tripId),
  });

  const favoriteTrips: TripData[] = serverTrips
    .map(mapToTripData)
    .filter((trip) => favoriteIds.includes(trip.id))
    .filter((trip, index, self) => self.findIndex((item) => item.id === trip.id) === index);

  const pastTrips = serverTrips.filter((trip) => trip.status === 'ENDED').map(mapToTripData);
  const monitoredTripIds = useMemo(
    () =>
      serverTrips
        .filter((trip) => trip.status === 'ENDED' || trip.status === 'ACTIVE')
        .map((trip) => trip.tripId),
    [serverTrips],
  );

  const fetchLocation = async () => {
    if (!settings.locationPerm) {
      setLocationName('위치 정보 비활성');
      return;
    }

    try {
      const isServiceEnabled = await Location.hasServicesEnabledAsync();
      if (!isServiceEnabled) {
        setLocationName('GPS 꺼짐');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('위치 권한 필요');
        return;
      }

      // Try last known position first for speed
      let location = await Location.getLastKnownPositionAsync({});
      
      // If no last known, try current position
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (!location) {
        setLocationName('서울시 강남구');
        return;
      }
      
      const result = await reverseGeocodeKo(location.coords.longitude, location.coords.latitude);
      
      if (result) {
        // Remove '대한민국' and zip codes if present
        // Example: "대한민국 06611 서울특별시 서초구 서초동" -> "서울특별시 서초구 서초동"
        const cleaned = result.replace(/대한민국\s*\d*/g, '').replace(/,/g, '').trim();
        setLocationName(cleaned);
      } else {
        setLocationName('서울시 강남구');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationName('서울시 강남구'); // Fallback to a clean string if error
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchData = async () => {
        void fetchLocation();

        const [profileResult, friendsResult, tripsResult] = await Promise.allSettled([
          getMyInfo(),
          getFriendsApi(),
          fetchTrips(),
        ]);

        if (!isMounted) {
          return;
        }

        if (profileResult.status === 'fulfilled') {
          if (profileResult.value.success) {
            console.log('[MyPage] Profile updated from server:', {
              id: profileResult.value.data.userId,
              nickname: profileResult.value.data.nickname,
              createdAt: profileResult.value.data.createdAt,
            });
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
          void tripsResult.value;
        } else {
          console.warn('[MyPage] Trips request failed.', tripsResult.reason);
        }
      };

      void fetchData();

      return () => {
        isMounted = false;
      };
    }, [fetchTrips, setProfile]),
  );

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ProfileHeader
          nickname={profile?.nickname || 'Guest'}
          location={locationName}
          avatarUrl={profile?.profileImageUrl || undefined}
          onSettingsPress={() => router.push('/settings')}
        />

        <UserInfoCard
          data={{
            email: profile?.email || 'N/A',
            joinDate: formatDate(profile?.createdAt),
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

        <TravelMap tripIds={monitoredTripIds} />
        <TreeRingsChart />
      </ScrollView>
    </SafeAreaView>
  );
}
