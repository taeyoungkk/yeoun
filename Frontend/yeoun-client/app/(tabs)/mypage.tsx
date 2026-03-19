import { StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useUserStore, useTripStore } from '@/src/store';
import { getMyInfo } from '@/src/api/user';

import { ProfileHeader } from "@/src/components/profile/ProfileHeader";
import { UserInfoCard } from "@/src/components/profile/UserInfoCard";
import { TripList } from "@/src/components/profile/TripList";
import { TripData } from "@/src/components/profile/TripCard";
import { TravelMap } from "@/src/components/profile/TravelMap";
import { TreeRingsChart } from "@/src/components/profile/TreeRingsChart";

export default function MyPageScreen() {
  const { profile, setProfile } = useUserStore();
  const { pastTrips, likedTripIds, toggleFavorite, activeTrip } = useTripStore();
  
  // Map pastTrips to TripData format and apply favorite status
  const allTripsData: TripData[] = pastTrips.map(trip => ({
    id: trip.tripId,
    title: trip.title,
    location: "대한민국", // Fallback location
    dates: `${trip.startDate} ~ ${trip.endDate.split('.').slice(-1)}`, // Simple format
    imageSource: trip.tripId === 'mock-1' ? require('@/assets/images/trip_placeholder_1.png') : 
                (trip.tripId === 'mock-2' ? require('@/assets/images/trip_placeholder_2.png') : 
                 require('@/assets/images/trip_placeholder_3.png')),
    isFavorite: likedTripIds.includes(trip.tripId)
  }));

  const favoriteTripsDisplay = allTripsData.filter(t => t.isFavorite);
  const pastTripsDisplay = allTripsData.filter(t => t.id !== activeTrip?.tripId);
  
  // Fetch profile when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      
      const fetchProfile = async () => {
        try {
          const response = await getMyInfo();
          if (response.success && isMounted) {
            setProfile(response.data);
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error);
        }
      };

      fetchProfile();
      
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
          location="대한민국, 대전광역시" 
          avatarUrl={profile?.profileImageUrl || undefined}
          onSettingsPress={() => router.push('/settings')}
        />
        
        <UserInfoCard data={{
          email: profile?.email || 'N/A',
          joinDate: '2024.03.17', 
          friendsCount: 42,        
        }} />
        
        <TripList 
          title="좋아한 여행" 
          trips={favoriteTripsDisplay} 
          onViewMore={() => router.push('/trips/liked')} 
          onToggleFavorite={(id) => handleToggleFavorite(id)}
          onPressTrip={(id) => router.push({ pathname: '/trip/report', params: { tripId: id } })}
        />

        <TripList 
          title="과거 여행" 
          trips={pastTripsDisplay} 
          onViewMore={() => router.push('/trips/past')} 
          onToggleFavorite={(id) => handleToggleFavorite(id)}
          onPressTrip={(id) => router.push({ pathname: '/trip/report', params: { tripId: id } })}
        />
        
        <TravelMap />
        
        <TreeRingsChart />
        
      </ScrollView>
    </SafeAreaView>
  );
}
