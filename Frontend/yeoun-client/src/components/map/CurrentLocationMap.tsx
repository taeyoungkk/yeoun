import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { configureMapbox } from '@/src/lib/mapbox';
import { PhotoMarker, PaymentMarker, LocationMarker } from '@/src/components/map/EventMarkers';
import { getTripEvents, subscribeTripEvents, type TimelineEvent } from '@/src/features/trip/store/tripMockStore';

import { FogOverlay } from './FogOverlay';
import { PastRoutesLayer } from './PastRoutesLayer';

const hasMapboxToken = configureMapbox();

export function CurrentLocationMap() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [isFogEnabled, setIsFogEnabled] = useState(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const [isCentred, setIsCentred] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    setEvents(getTripEvents());
    const unsubscribe = subscribeTripEvents(() => {
      setEvents(getTripEvents());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let initialLocationFound = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      try {
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        if (loc && !initialLocationFound) {
          initialLocationFound = true;
          setCurrentLocation([loc.coords.longitude, loc.coords.latitude]);
        }

        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (newLoc) => {
            setCurrentLocation([newLoc.coords.longitude, newLoc.coords.latitude]);
            if (!initialLocationFound) {
              initialLocationFound = true;
            }
          },
        );
      } catch (error) {
        console.log('Failed to subscribe current location.', error);
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const handleMapReady = () => {
    setIsMapReady(true);
    setMapLoadFailed(false);
  };

  const handleMapLoadFailure = () => {
    setIsMapReady(false);
    setMapLoadFailed(true);
  };

  const centerOnUser = () => {
    setIsFollowing(true);
  };

  return (
    <View className="flex-1 overflow-hidden">
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.Outdoors}
        localizeLabels={{ locale: 'ko' }}
        scaleBarEnabled={false}
        attributionEnabled
        logoEnabled
        compassEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
        onDidFinishLoadingStyle={handleMapReady}
        onMapIdle={handleMapReady}
        onDidFailLoadingMap={handleMapLoadFailure}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [126.9784, 37.5667],
            zoomLevel: 15,
          }}
          followZoomLevel={15}
          followUserLocation={isFollowing && !!currentLocation}
          onUserTrackingModeChange={(event: any) => {
            const isFollowActive = event.nativeEvent?.followUserLocation ?? event.payload?.followUserLocation;
            if (!isFollowActive) {
              setIsFollowing(false);
            } else if (!isCentred) {
              setTimeout(() => setIsCentred(true), 1500);
            }
          }}
          animationMode={!isCentred ? 'flyTo' : 'none'}
          animationDuration={!isCentred ? 1500 : 0}
        />

        <PastRoutesLayer routes={[]} isFogEnabled={false} />

        {isFogEnabled && currentLocation && (
          <FogOverlay
            feature={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'GeometryCollection',
                geometries: [
                  {
                    type: 'Point',
                    coordinates: currentLocation,
                  },
                  {
                    type: 'MultiLineString',
                    coordinates: [],
                  },
                ],
              },
            }}
            radiusKm={1}
          />
        )}

        {events.map((event) => {
          if (!event.coordinate) {
            return null;
          }

          if (event.type === 'photo') {
            return (
              <PhotoMarker
                key={event.id}
                id={event.id}
                coordinate={event.coordinate}
                photoUrls={event.photoUrls || []}
                onPress={() => setSelectedEvent(event)}
              />
            );
          }

          if (event.type === 'payment') {
            return (
              <PaymentMarker
                key={event.id}
                id={event.id}
                coordinate={event.coordinate}
                onPress={() => setSelectedEvent(event)}
              />
            );
          }

          return (
            <LocationMarker
              key={event.id}
              id={event.id}
              coordinate={event.coordinate}
              onPress={() => setSelectedEvent(event)}
            />
          );
        })}

        <Mapbox.UserLocation visible showsUserHeadingIndicator />
      </Mapbox.MapView>

      {!isMapReady ? (
        <View className="absolute inset-0 bg-[#EFF4EC] items-center justify-center" pointerEvents="none">
          <View
            className="p-4 rounded-xl bg-[#FCFEFB] items-center gap-2"
            style={{
              shadowColor: '#223428',
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <MaterialIcons
              name={!hasMapboxToken || mapLoadFailed ? 'wifi-off' : 'map'}
              size={18}
              color={!hasMapboxToken || mapLoadFailed ? '#A65F4B' : '#415D4C'}
            />
            <Text className="font-pretendard-medium text-[13px] text-[#65786C] text-center">
              {!hasMapboxToken
                ? 'Mapbox 토큰이 없어 지도를 표시할 수 없습니다.'
                : mapLoadFailed
                  ? '지도를 불러오지 못했습니다.'
                  : '지도를 준비하고 있습니다.'}
            </Text>
          </View>
        </View>
      ) : null}

      {isMapReady && (
        <View className="absolute top-4 right-4 items-end gap-2">
          <TouchableOpacity
            className="bg-white p-3 rounded-full shadow-md items-center justify-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
            onPress={() => setIsFogEnabled(!isFogEnabled)}
          >
            <MaterialIcons name={isFogEnabled ? 'visibility-off' : 'visibility'} size={24} color="#415D4C" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-white p-3 rounded-full shadow-md items-center justify-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
            onPress={centerOnUser}
          >
            <MaterialIcons name="my-location" size={24} color="#415D4C" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setSelectedEvent(null)}>
          <Pressable
            className="bg-white rounded-t-3xl pt-6 px-6"
            style={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedEvent && (
              <View>
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 pr-4">
                    <Text className="text-xl font-pretendard-bold text-gray-900">{selectedEvent.title}</Text>
                    {selectedEvent.placeName && (
                      <Text className="text-sm font-pretendard-medium text-gray-500 mt-1">{selectedEvent.placeName}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedEvent(null)} className="p-1">
                    <MaterialIcons name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {selectedEvent.eventMemo && (
                  <Text className="text-sm font-pretendard-regular text-gray-700 mb-6">{selectedEvent.eventMemo}</Text>
                )}

                {selectedEvent.type === 'photo' && selectedEvent.photoUrls && selectedEvent.photoUrls.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-sm font-pretendard-semibold text-gray-800 mb-3">
                      사진 ({selectedEvent.photoUrls.length})
                    </Text>
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                      <View className="flex-row flex-wrap">
                        {selectedEvent.photoUrls.map((url, idx) => (
                          <View key={idx} style={{ width: '33.33%', padding: 4 }}>
                            <Image
                              source={{ uri: url }}
                              style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#E5E7EB' }}
                              contentFit="cover"
                            />
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {selectedEvent.type === 'payment' && (
                  <View className="mb-4 bg-[#FFF0E8]/50 p-5 rounded-2xl border border-[#FFF0E8]">
                    <Text className="text-sm font-pretendard-semibold text-gray-600 mb-1">결제 정보</Text>
                    <Text className="text-2xl font-pretendard-bold text-gray-900">{selectedEvent.amount}</Text>
                    <View className="flex-row gap-2 mt-3">
                      {selectedEvent.chips?.map((chip, idx) => (
                        <View key={idx} className="bg-white px-2.5 py-1 rounded-md border border-[#F0B132]/20">
                          <Text className="text-xs font-pretendard-medium text-[#F0B132]">{chip}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {selectedEvent.type === 'location' && selectedEvent.chips && selectedEvent.chips.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    {selectedEvent.chips.map((chip, idx) => (
                      <View key={idx} className="bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                        <Text className="text-xs font-pretendard-medium text-gray-600">{chip}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
