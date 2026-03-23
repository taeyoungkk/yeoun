import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Image } from 'expo-image';
import { configureMapbox } from '@/src/lib/mapbox';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FogOverlay } from './FogOverlay';
import { PastRoutesLayer } from './PastRoutesLayer';
import { matchMapTrace } from '@/src/api/mapbox';
import { PhotoMarker, PaymentMarker, LocationMarker } from '@/src/components/map/EventMarkers';
import { getTripEvents, subscribeTripEvents, type TimelineEvent } from '@/src/features/trip/store/tripMockStore';

// TODO: 실제 서버에서 지난 여행 기록을 가져오도록 수정해야 합니다.
const MOCK_PAST_ROUTES = [
  // 남산 타워 근처 루트
  [
    [126.9882, 37.5511],
    [126.9890, 37.5520],
    [126.9901, 37.5532],
    [126.9912, 37.5545]
  ],
  // 명동 성당 근처 루트
  [
    [126.9877, 37.5641],
    [126.9880, 37.5630],
    [126.9895, 37.5620]
  ]
];

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
  const [matchedRoutes, setMatchedRoutes] = useState<[number, number][][]>(MOCK_PAST_ROUTES as [number, number][][]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // 목업 이벤트(사진, 장소, 결제)를 불러옵니다.
  useEffect(() => {
    setEvents(getTripEvents());
    const unsubscribe = subscribeTripEvents(() => {
      setEvents(getTripEvents());
    });
    return unsubscribe;
  }, []);

  // 초기 로드 시 Mock 데이터를 맵 매칭 API로 보정합니다.
  useEffect(() => {
    const performMapMatching = async () => {
      const results = await Promise.all(
        MOCK_PAST_ROUTES.map(route => matchMapTrace(route as [number, number][], 'walking'))
      );
      // 매칭에 성공한 것들만 업데이트, 실패하면 Mock 그대로 유지
      setMatchedRoutes(results.map((res, i) => res || MOCK_PAST_ROUTES[i] as [number, number][] ));
    };
    performMapMatching();
  }, []);

  // 사용자의 실시간 현재 위치를 추적합니다.
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let initialLocationFound = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        // 1. 초기 위치 확보 (가장 최근 또는 현재)
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        
        if (loc && !initialLocationFound) {
          initialLocationFound = true;
          setCurrentLocation([loc.coords.longitude, loc.coords.latitude]);
        }

        // 2. 실시간 위치 추적 시작
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (newLoc) => {
            setCurrentLocation([newLoc.coords.longitude, newLoc.coords.latitude]);
            if (!initialLocationFound) {
              initialLocationFound = true;
            }
          }
        );
      } catch (e) {
        console.log('초기 위치를 가져오지 못했습니다:', e);
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
    console.log('[CurrentLocationMap] centerOnUser triggered. CurrentLocation:', currentLocation);
    setIsFollowing(true); // 따라가기 모드 다시 활성화 (Mapbox가 자동으로 부드럽게 중심을 맞춥니다)
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
            centerCoordinate: [126.9784, 37.5667], // 서울 기본 좌표 (Europe/Africa 방지)
            zoomLevel: 15,
          }}
          followZoomLevel={15}
          followUserLocation={isFollowing && !!currentLocation} // 위치가 있으면 즉시 따라가기 시작
          onUserTrackingModeChange={(event: any) => {
            // 사용자가 지도를 직접 움직이면(팬/줌) 따라가기 자동 해제
            const isFollowActive = event.nativeEvent?.followUserLocation ?? event.payload?.followUserLocation;
            if (!isFollowActive) {
              setIsFollowing(false);
            } else if (!isCentred) {
              // 최초 "따라가기"가 활성화되었을 때, 비행 애니메이션이 끝날 시간을 벌어줍니다.
              setTimeout(() => setIsCentred(true), 1500);
            }
          }}
          animationMode={!isCentred ? 'flyTo' : 'none'}
          animationDuration={!isCentred ? 1500 : 0}
        />
        
        {/* 과거 이동 경로 표시 및 안개 걷어내기 효과 */}
        <PastRoutesLayer 
          routes={matchedRoutes} 
          isFogEnabled={false} // 안개 영역은 아래 FogOverlay에서 합쳐서 한 번에 그립니다.
        />

        {/* 현재 위치 반경 1km 밖을 부드럽게 어둡게 처리하는 안개 오버레이 */}
        {/* 과거 경로, 그리고 현재 위치를 모두 걷어냅니다 */}
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
                    coordinates: currentLocation
                  },
                  {
                    type: 'MultiLineString',
                    coordinates: matchedRoutes
                  }
                ]
              }
            }} 
            radiusKm={1} 
          />
        )}

        {/* 이벤트 마커 렌더링 (사진, 결제, 장소) */}
        {events.map((event) => {
          if (!event.coordinate) return null;

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
          if (event.type === 'location') {
            return (
              <LocationMarker 
                key={event.id} 
                id={event.id} 
                coordinate={event.coordinate} 
                onPress={() => setSelectedEvent(event)}
              />
            );
          }
          return null;
        })}

        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />
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
                ? '지도를 표시하기 위한 설정이 아직 완료되지 않았어요.'
                : mapLoadFailed
                  ? '잠시 후 다시 시도해주세요.'
                  : '지도를 준비하고 있습니다.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 안개 토글 버튼 및 내 위치 버튼 */}
      {isMapReady && (
        <View className="absolute top-4 right-4 items-end gap-2">
          <TouchableOpacity 
            className="bg-white p-3 rounded-full shadow-md items-center justify-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
            onPress={() => setIsFogEnabled(!isFogEnabled)}
          >
            <MaterialIcons 
              name={isFogEnabled ? 'visibility-off' : 'visibility'} 
              size={24} 
              color="#415D4C" 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            className="bg-white p-3 rounded-full shadow-md items-center justify-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
            onPress={centerOnUser}
          >
            <MaterialIcons 
              name="my-location" 
              size={24} 
              color="#415D4C" 
            />
          </TouchableOpacity>
        </View>
      )}

      {/* 이벤트 상세 모달 */}
      <Modal
        visible={!!selectedEvent}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable 
          className="flex-1 justify-end bg-black/40" 
          onPress={() => setSelectedEvent(null)}
        >
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
                    <Text className="text-sm font-pretendard-semibold text-gray-800 mb-3">사진 ({selectedEvent.photoUrls.length}장)</Text>
                    <ScrollView 
                      showsVerticalScrollIndicator={false} 
                      style={{ maxHeight: 300 }}
                    >
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
                    <Text className="text-sm font-pretendard-semibold text-gray-600 mb-1">결제 금액</Text>
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
