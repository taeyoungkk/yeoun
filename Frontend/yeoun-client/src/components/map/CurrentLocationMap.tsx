import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { configureMapbox } from '@/src/lib/mapbox';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { FogOverlay } from './FogOverlay';
import { PastRoutesLayer } from './PastRoutesLayer';

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
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [isFogEnabled, setIsFogEnabled] = useState(true);

  // 사용자의 실시간 현재 위치를 추적합니다.
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }
        if (loc) {
          setCurrentLocation([loc.coords.longitude, loc.coords.latitude]);
        }

        // 에뮬레이터에서 위치를 변경하거나 사용자가 물리적으로 이동했을 때 카메라가 실시간으로 따라가도록 설정합니다.
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (newLoc) => {
            setCurrentLocation([newLoc.coords.longitude, newLoc.coords.latitude]);
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
    if (currentLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: currentLocation,
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
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
          zoomLevel={15}
          followZoomLevel={15}
          followUserLocation={true}
          centerCoordinate={currentLocation || undefined}
          animationMode="flyTo"
          animationDuration={currentLocation ? 1000 : 0}
        />
        
        {/* 과거 이동 경로 표시 및 안개 걷어내기 효과 */}
        <PastRoutesLayer 
          routes={MOCK_PAST_ROUTES} 
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
                    coordinates: MOCK_PAST_ROUTES
                  }
                ]
              }
            }} 
            radiusKm={1} 
          />
        )}

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
    </View>
  );
}
