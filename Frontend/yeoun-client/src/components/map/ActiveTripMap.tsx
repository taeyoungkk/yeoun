import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { configureMapbox } from '@/src/lib/mapbox';
import { locationService } from '@/src/services/locationService';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FogOverlay } from './FogOverlay';
import { PastRoutesLayer } from './PastRoutesLayer';

// TODO: 실제 서버에서 지난 여행 기록을 가져오도록 수정해야 합니다.
// 현재는 안개 걷히는(스크래치 오프) 기능 테스트를 위한 하드코딩된 더미 데이터입니다.
export const MOCK_PAST_ROUTES = [
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

configureMapbox();

export function ActiveTripMap() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [isFogEnabled, setIsFogEnabled] = useState(true);

  // 여행 중 실시간 위치 업데이트를 구독합니다. 즉각적으로 선을 그어줍니다.
  useEffect(() => {
    // 초기 위치를 즉시 가져와 중심을 맞춥니다.
    (async () => {
      try {
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        if (loc) {
          setRouteCoordinates((prev) => 
            prev.length === 0 ? [[loc.coords.longitude, loc.coords.latitude]] : prev
          );
        }
      } catch (e) {
        console.warn('초기 위치 획득 실패:', e);
      }
    })();

    const unsubscribe = locationService.subscribe((location) => {
      setRouteCoordinates((prev) => [...prev, [location.longitude, location.latitude]]);
    });

    return () => unsubscribe();
  }, []);

  const centerOnUser = () => {
    if (routeCoordinates.length > 0 && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: routeCoordinates[routeCoordinates.length - 1],
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
  };

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
          defaultSettings={{
            centerCoordinate: [126.9784, 37.5667], // 서울 기본 좌표 (Europe/Africa 방지)
            zoomLevel: 15,
          }}
          followZoomLevel={15}
          followUserLocation={routeCoordinates.length > 0} // 위치 데이터가 있을 때만 follow
          centerCoordinate={routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : undefined}
          animationMode={routeCoordinates.length > 0 ? 'flyTo' : 'none'}
          animationDuration={routeCoordinates.length > 0 ? 1000 : 0}
        />
        
        {/* 과거 이동 경로 표시 및 안개 걷어내기 효과 */}
        <PastRoutesLayer 
          routes={[
            ...MOCK_PAST_ROUTES, 
            routeCoordinates.length > 0 ? routeCoordinates : [[126.9784, 37.5667], [126.9784, 37.5667]]
          ]} 
          isFogEnabled={isFogEnabled} 
        />

        {/* 현재 이동 중인 경로를 빨간색 선으로 표시 (과거 경로보다 위에 그려짐) */}
        <Mapbox.ShapeSource id="active-trip-route" shape={routeShape}>
          <Mapbox.LineLayer
            id="active-trip-route-line"
            style={{ lineColor: '#F35B4F', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.92 }}
          />
        </Mapbox.ShapeSource>

        {/* 사용자의 현재 위치를 나타내는 파란색 점 애니메이션 */}
        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />
      </Mapbox.MapView>

      {/* 안개 토글 버튼 및 내 위치 버튼 */}
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
      {/* 테스트용 경로 추가 버튼 (개발용) */}
      <View className="absolute bottom-4 right-4">
        <TouchableOpacity 
          className="bg-white p-3 rounded-full shadow-md items-center justify-center"
          style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
          onPress={() => {
            setRouteCoordinates(prev => {
              // 임의로 북동쪽으로 약간 이동한 좌표를 추가하여 경로가 길어지는 것을 테스트합니다.
              const last = prev.length > 0 ? prev[prev.length - 1] : [126.9784, 37.5667];
              return [...prev, [last[0] + 0.003, last[1] + 0.003]];
            });
          }}
        >
          <MaterialIcons 
            name="directions-walk" 
            size={24} 
            color="#415D4C" 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
