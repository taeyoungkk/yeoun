import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getTripRouteByDayApi } from '@/src/api/trip';
import { configureMapbox } from '@/src/lib/mapbox';
import { getTripEvents, subscribeTripEvents, TimelineEvent } from '@/src/features/trip/store/tripMockStore';
import { useTripStore } from '@/src/store/trip.store';
import { globalUserState, subscribeUser } from '@/src/store/userStore';

import { locationService } from '../../services/locationService';
import { LocationMarker, PaymentMarker, PhotoMarker } from './EventMarkers';
import { PastRoutesLayer } from './PastRoutesLayer';

configureMapbox();

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function ActiveTripMap() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const tripId = useTripStore((state) => state.currentTripId);
  const routeRefreshKey = useTripStore((state) => state.routeRefreshKey);

  const [currentCoordinate, setCurrentCoordinate] = useState<[number, number] | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [isFogEnabled, setIsFogEnabled] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeLoadFailed, setRouteLoadFailed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [tripEvents, setTripEvents] = useState<TimelineEvent[]>(() => getTripEvents());
  const [mapPreferences, setMapPreferences] = useState({
    showPhotoPins: globalUserState.showPhotoPins,
    showPaymentPins: globalUserState.showPaymentPins,
  });

  useEffect(() => {
    const unsubscribeTripEvents = subscribeTripEvents(() => {
      setTripEvents(getTripEvents());
    });

    const unsubscribeUser = subscribeUser(() => {
      setMapPreferences({
        showPhotoPins: globalUserState.showPhotoPins,
        showPaymentPins: globalUserState.showPaymentPins,
      });
    });

    return () => {
      unsubscribeTripEvents();
      unsubscribeUser();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentPosition = async () => {
      try {
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        if (isMounted && loc) {
          setCurrentCoordinate([loc.coords.longitude, loc.coords.latitude]);
        }
      } catch (error) {
        console.warn('Failed to load current position:', error);
      }
    };

    void loadCurrentPosition();

    const unsubscribe = locationService.subscribe((location) => {
      if (!isMounted) {
        return;
      }

      setCurrentCoordinate([location.longitude, location.latitude]);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRoute = async () => {
      if (!tripId) {
        setRouteCoordinates([]);
        setRouteLoadFailed(false);
        setIsLoadingRoute(false);
        return;
      }

      setIsLoadingRoute(true);
      const response = await getTripRouteByDayApi(tripId, getTodayDateString());

      if (!isMounted) {
        return;
      }

      if (response.success) {
        const nextCoordinates = response.data.routeDays.flatMap((routeDay) =>
          routeDay.coordinates
            .filter((coordinate): coordinate is [number, number] => Array.isArray(coordinate) && coordinate.length >= 2)
            .map(([longitude, latitude]) => [longitude, latitude] as [number, number]),
        );
        setRouteCoordinates(nextCoordinates);
        setRouteLoadFailed(false);
      } else {
        setRouteCoordinates([]);
        setRouteLoadFailed(true);
      }

      setIsLoadingRoute(false);
    };

    void loadRoute();

    return () => {
      isMounted = false;
    };
  }, [tripId, routeRefreshKey]);

  const filteredMapEvents = tripEvents.filter((event) => {
    if (!event.coordinate) {
      return false;
    }
    if (event.type === 'photo') {
      return mapPreferences.showPhotoPins;
    }
    if (event.type === 'payment') {
      return mapPreferences.showPaymentPins;
    }
    return true;
  });

  const hasRouteCoordinates = routeCoordinates.length >= 2;
  const hasEmptyRoute = !isLoadingRoute && !routeLoadFailed && routeCoordinates.length === 0;
  const centerCoordinate = routeCoordinates[routeCoordinates.length - 1] ?? currentCoordinate ?? [126.9784, 37.5667];

  const routeShape: GeoJSON.FeatureCollection<GeoJSON.LineString> | null = useMemo(() => {
    if (!hasRouteCoordinates) {
      return null;
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates,
          },
        },
      ],
    };
  }, [hasRouteCoordinates, routeCoordinates]);

  const centerOnUser = () => {
    if (!cameraRef.current) {
      return;
    }

    setIsFollowing(true);
    cameraRef.current.setCamera({
      centerCoordinate,
      zoomLevel: 15,
      animationDuration: 800,
    });
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
            centerCoordinate: [126.9784, 37.5667],
            zoomLevel: 15,
          }}
          centerCoordinate={centerCoordinate}
          followUserLocation={isFollowing && !!currentCoordinate}
          followZoomLevel={15}
          animationMode="flyTo"
          animationDuration={600}
          onUserTrackingModeChange={(event: any) => {
            const followActive = event?.nativeEvent?.followUserLocation ?? event?.payload?.followUserLocation;
            if (followActive === false) {
              setIsFollowing(false);
            }
          }}
        />

        <PastRoutesLayer routes={hasRouteCoordinates ? [routeCoordinates] : []} isFogEnabled={isFogEnabled} />

        {routeShape ? (
          <Mapbox.ShapeSource id="active-trip-route" shape={routeShape}>
            <Mapbox.LineLayer
              id="active-trip-route-line"
              style={{
                lineColor: '#F35B4F',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.92,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        <Mapbox.UserLocation visible showsUserHeadingIndicator />

        {filteredMapEvents.map((event) => {
          const coord = event.coordinate as [number, number];
          if (event.type === 'photo') {
            return <PhotoMarker key={event.id} id={event.id} coordinate={coord} photoUrls={event.photoUrls} />;
          }
          if (event.type === 'payment') {
            return <PaymentMarker key={event.id} id={event.id} coordinate={coord} />;
          }
          return <LocationMarker key={event.id} id={event.id} coordinate={coord} />;
        })}
      </Mapbox.MapView>

      {(isLoadingRoute || routeLoadFailed || hasEmptyRoute) && (
        <View style={styles.banner}>
          {isLoadingRoute ? (
            <ActivityIndicator size="small" color="#415D4C" />
          ) : routeLoadFailed ? (
            <MaterialIcons name="info-outline" size={18} color="#A65F4B" />
          ) : (
            <MaterialIcons name="sync" size={18} color="#415D4C" />
          )}
          <Text style={styles.bannerText}>
            {isLoadingRoute
              ? '동기화된 경로를 불러오는 중입니다.'
              : routeLoadFailed
                ? '정제된 경로를 불러오지 못했습니다. 동기화 후 다시 확인해 주세요.'
                : '아직 표시할 정제 경로가 없습니다. GPS 동기화 후 worker 처리 완료 시 경로가 나타납니다.'}
          </Text>
        </View>
      )}

      <View className="absolute top-4 right-4 items-end gap-2">
        <TouchableOpacity
          className="bg-white p-3 rounded-full shadow-md items-center justify-center"
          style={styles.fab}
          onPress={() => setIsFogEnabled((prev) => !prev)}
        >
          <MaterialIcons name={isFogEnabled ? 'visibility-off' : 'visibility'} size={24} color="#415D4C" />
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-white p-3 rounded-full shadow-md items-center justify-center"
          style={styles.fab}
          onPress={centerOnUser}
        >
          <MaterialIcons name="my-location" size={24} color="#415D4C" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 88,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    color: '#40503F',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});
