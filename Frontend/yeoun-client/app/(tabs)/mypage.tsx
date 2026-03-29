import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { getTripImage } from '@/src/utils/image-utils';

const formatDate = (dateString?: string) => {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
};

export default function MyPageScreen() {
  const profile = useUserStore(state => state.profile);
  const setProfile = useUserStore(state => state.setProfile);
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const serverTrips = useTripStore((state) => state.trips);
  const fetchTrips = useTripStore((state) => state.fetchTrips);
  const setReviewTrip = useTripStore((state) => state.setReviewTrip);
  const [friendsCount, setFriendsCount] = useState(0);
  const currentAddress = useTripStore((state) => state.currentAddress);
  const locationStatus = useTripStore((state) => state.locationStatus);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const mapToTripData = (trip: TripListItem): TripData => ({
    id: trip.tripId,
    title: trip.title,
    region: trip.region,
    country: trip.country,
    dates: `${trip.startDate.replace(/-/g, '.')} ~ ${trip.endDate.split('-').pop()}`,
    imageSource: getTripImage(trip.tripId, trip.imageUrl),
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

  const loadData = useCallback(async () => {
    try {
      const response = await getMyInfo();
      if (response.success) {
        setProfile(response.data);
      }
      
      await fetchTrips(true);
      
      const friendsResponse = await getFriendsApi();
      if (friendsResponse.success) {
        setFriendsCount(friendsResponse.data.items.length);
      }
    } catch (error) {
      console.error('Error loading mypage data:', error);
    }
  }, [fetchTrips, setProfile]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
  };

  const handleOpenTripReport = useCallback((tripId: string) => {
    const selectedTrip = serverTrips.find((trip) => trip.tripId === tripId);

    if (selectedTrip) {
      setReviewTrip({
        tripId: selectedTrip.tripId,
        tripName: selectedTrip.title,
        startDate: selectedTrip.startDate,
        endDate: selectedTrip.endDate,
        memberCount: selectedTrip.memberCount,
        origin: selectedTrip.country || '---',
        destination: selectedTrip.region || selectedTrip.title,
      });
    }

    router.push({
      pathname: '/trip/report',
      params: { tripId, mode: 'review' },
    });
  }, [serverTrips, setReviewTrip]);

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]" edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120 }}
        scrollEnabled={scrollEnabled}
      >
        <ProfileHeader
          nickname={profile?.nickname || 'Guest'}
          avatarUrl={profile?.profileImageUrl || undefined}
          location={
            locationStatus === 'DENIED' 
              ? '위치 권한 필요' 
              : locationStatus === 'GPS_OFF' 
                ? 'GPS 꺼짐' 
                : currentAddress || '위치 확인 중...'
          }
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
          onPressTrip={(trip) => handleOpenTripReport(trip.id)}
        />

        <TripList
          title="지난 여행"
          trips={pastTrips}
          onViewMore={() => router.push('/trip/past')}
          onToggleFavorite={handleToggleFavorite}
          onPressTrip={(trip) => handleOpenTripReport(trip.id)}
        />
  
        <TravelMap 
          tripIds={monitoredTripIds} 
          onInteractionStart={() => setScrollEnabled(false)}
          onInteractionEnd={() => setScrollEnabled(true)}
        />
        <TreeRingsChart />
      </ScrollView>
    </SafeAreaView>
  );
}
