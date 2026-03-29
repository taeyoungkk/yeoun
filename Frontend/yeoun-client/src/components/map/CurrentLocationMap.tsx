import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';

import { configureMapbox } from '@/src/lib/mapbox';

import { FogOverlay } from './FogOverlay';
import { PastRoutesLayer } from './PastRoutesLayer';
import { useFogData } from '@/src/hooks/useFogData';

const hasMapboxToken = configureMapbox();

export function CurrentLocationMap() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [isFogEnabled, setIsFogEnabled] = useState(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const [isCentred, setIsCentred] = useState(false);
  const { fogFeature } = useFogData(currentLocation);

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
    if (cameraRef.current && currentLocation) {
      cameraRef.current.setCamera({
        centerCoordinate: currentLocation,
        zoomLevel: 15,
        animationDuration: 800,
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

        {isFogEnabled && fogFeature && (
          <FogOverlay
            feature={fogFeature}
            radiusKm={1}
          />
        )}


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
    </View>
  );
}
