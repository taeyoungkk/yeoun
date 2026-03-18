import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { configureMapbox } from '@/src/lib/mapbox';
import { locationService } from '@/src/services/locationService';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FogOverlay } from './FogOverlay';

configureMapbox();

export function ActiveTripMap() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [isFogEnabled, setIsFogEnabled] = useState(true);

  // 여행 중 실시간 위치 업데이트를 구독합니다. 즉각적으로 선을 그어줍니다.
  useEffect(() => {
    const unsubscribe = locationService.subscribe((location) => {
      setRouteCoordinates((prev) => [...prev, [location.longitude, location.latitude]]);
    });

    return () => unsubscribe();
  }, []);

  const routeShape: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          // 경로가 없을 땐 기본으로 서울의 좌표로 초기화합니다.
          coordinates: routeCoordinates.length > 0 ? routeCoordinates : [[126.9784, 37.5667], [126.9784, 37.5667]],
        },
      },
    ],
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
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={15}
          // 마지막 위치를 따라다니도록 카메라 중앙을 지속적으로 업데이트합니다.
          centerCoordinate={routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : [126.9784, 37.5667]}
          animationMode="flyTo"
          animationDuration={1000}
        />
        
        {/* 이동 경로를 빨간색 선으로 표시합니다. */}
        <Mapbox.ShapeSource id="active-trip-route" shape={routeShape}>
          <Mapbox.LineLayer
            id="active-trip-route-line"
            style={{ lineColor: '#F35B4F', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.92 }}
          />
        </Mapbox.ShapeSource>
        
        {/* 이동 경로 전체를 감싸는 1km 반경 밖을 어둡게 처리하는 안개 오버레이 */}
        {isFogEnabled && <FogOverlay feature={routeShape.features[0]} radiusKm={1} />}

        {/* 사용자의 현재 위치를 나타내는 파란색 점 애니메이션 */}
        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />
      </Mapbox.MapView>

      {/* 안개 토글 버튼 */}
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
    </View>
  );
}
