import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { configureMapbox } from '@/src/lib/mapbox';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { FogOverlay } from './FogOverlay';

const hasMapboxToken = configureMapbox();

export function CurrentLocationMap() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number]>([126.9784, 37.5667]);
  const [isFogEnabled, setIsFogEnabled] = useState(true);

  // 사용자의 현재 위치를 앱 로드시 한 번 가져옵니다.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation([location.coords.longitude, location.coords.latitude]);
      } catch (e) {
        console.log('초기 위치를 가져오지 못했습니다:', e);
      }
    })();
  }, []);

  const handleMapReady = () => {
    setIsMapReady(true);
    setMapLoadFailed(false);
  };

  const handleMapLoadFailure = () => {
    setIsMapReady(false);
    setMapLoadFailed(true);
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
          centerCoordinate={currentLocation}
          animationMode="flyTo"
          animationDuration={1000}
        />
        
        {/* 현재 위치 반경 1km 밖을 부드럽게 어둡게 처리하는 안개 오버레이 */}
        {isFogEnabled && (
          <FogOverlay 
            feature={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: currentLocation
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

      {/* 안개 토글 버튼 */}
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
        </View>
      )}
    </View>
  );
}
