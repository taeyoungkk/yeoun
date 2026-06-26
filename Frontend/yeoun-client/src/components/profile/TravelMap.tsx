import booleanIntersects from '@turf/boolean-intersects';
import { lineString, point } from '@turf/helpers';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import type { FeatureCollection } from 'geojson';

import { getTripPlacesApi, getTripRouteByDayApi, getTripRouteDaysApi } from '@/src/api/trip';
import { MAPBOX_ACCESS_TOKEN, configureMapbox } from '@/src/lib/mapbox';
import { useStatsStore } from '@/src/store/stats.store';
import { useTripStore, type LocationLog } from '@/src/store/trip.store';

configureMapbox();

const TILESET_ID = 'hoimook.73g4472d';
const SOURCE_LAYER_NAME = '__simplified-bhxngm';
const DATASET_ID = 'cmmsfeo0902u81no5aqp1ze5e';
const EMPTY_TRIP_IDS: string[] = [];

type TravelMapProps = {
  tripIds?: string[];
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export const TravelMap = ({ 
  tripIds = EMPTY_TRIP_IDS,
  onInteractionStart,
  onInteractionEnd
}: TravelMapProps) => {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const { visitedSigCodes, setVisitedSigCodes, isProcessing, setProcessing } = useStatsStore();
  const [visitedAreaLoadFailed, setVisitedAreaLoadFailed] = useState(false);
  const inFlightLogs = useTripStore((state) => state.inFlightLogs);

  useEffect(() => {
    if (!DATASET_ID || !MAPBOX_ACCESS_TOKEN) {
      return;
    }

    const url = `https://api.mapbox.com/datasets/v1/hoimook/${DATASET_ID}/features?access_token=${MAPBOX_ACCESS_TOKEN}`;
    fetch(url)
      .then((res) => res.json())
      .then((data: FeatureCollection) => {
        setGeoJsonData(data);
      })
      .catch((err) => console.error('[TravelMap] Dataset fetch error:', err));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadVisitedAreas = async () => {
      if (!geoJsonData?.features?.length || tripIds.length === 0) {
        if (visitedSigCodes.length > 0) {
          setVisitedSigCodes([]);
        }
        setVisitedAreaLoadFailed(false);
        setProcessing(false);
        return;
      }

      try {
        setProcessing(true);
        const routeResults = await Promise.all(
          tripIds.map(async (tripId) => {
            const routeDaysResponse = await getTripRouteDaysApi(tripId);
            if (!routeDaysResponse.success) {
              throw new Error(routeDaysResponse.message || `Failed to fetch route days for trip ${tripId}`);
            }

            const uniqueDays = Array.from(new Set(routeDaysResponse.data.routeDays.map((routeDay) => routeDay.day)));
            const routeResponses = await Promise.all(uniqueDays.map((day) => getTripRouteByDayApi(tripId, day)));

            return routeResponses.flatMap((response) => {
              if (!response.success) {
                return [];
              }

              return response.data.routeDays.flatMap((routeDay) => routeDay.coordinates);
            });
          }),
        );

        const placeResults = await Promise.all(tripIds.map((tripId) => getTripPlacesApi(tripId)));
        const placePoints = placeResults.flatMap((response) => {
          if (!response.success) {
            return [];
          }

          return response.data.places
            .filter((place) => Number.isFinite(place.centerLongitude) && Number.isFinite(place.centerLatitude))
            .map((place) => [place.centerLongitude, place.centerLatitude] as [number, number]);
        });

        const inFlightCoords = inFlightLogs.map((l: LocationLog) => [l.longitude, l.latitude] as [number, number]);

        const routeCoordinates = [
          ...routeResults.flatMap((coords) =>
            coords.filter(
              (coordinate): coordinate is [number, number] =>
                Array.isArray(coordinate) &&
                coordinate.length >= 2 &&
                Number.isFinite(coordinate[0]) &&
                Number.isFinite(coordinate[1]),
            ),
          ),
          ...inFlightCoords,
        ];

        const codeSet = new Set<string>();

        geoJsonData.features.forEach((feature) => {
          const sigCd = feature.properties?.SIG_CD;
          if (!sigCd || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
            return;
          }

          const intersectsRoute =
            routeCoordinates.length >= 2 && booleanIntersects(lineString(routeCoordinates), feature as any);
          const intersectsPlace = placePoints.some((coords) => booleanIntersects(point(coords), feature as any));

          if (intersectsRoute || intersectsPlace) {
            codeSet.add(String(sigCd));
          }
        });

        if (!isMounted) {
          return;
        }

        setVisitedSigCodes(Array.from(codeSet));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('[TravelMap] Failed to load visited areas.', error);
        setVisitedAreaLoadFailed(true);
      } finally {
        if (isMounted) {
          setProcessing(false);
        }
      }
    };

    void loadVisitedAreas();

    return () => {
      isMounted = false;
    };
  }, [geoJsonData, tripIds, inFlightLogs]);

  if (Platform.OS === 'web') {
    return (
      <View className="px-5 mt-6 mb-0">
        <Text className="text-lg font-bold text-[#333333] mb-4">여행 지도</Text>
        <View className="w-full h-[400px] rounded-3xl bg-[#ccc] justify-center items-center">
          <Text className="text-gray-600">웹에서는 지도를 지원하지 않습니다.</Text>
          <Text className="text-gray-500 text-sm mt-2">모바일 앱에서 확인해 주세요.</Text>
        </View>
      </View>
    );
  }

  const hasVisitedAreas = visitedSigCodes.length > 0;
  const sigCodesFilter = hasVisitedAreas ? visitedSigCodes : ['NONE_MATCH'];
  const statusMessage = (() => {
    if (isProcessing) {
      return '여행 경로와 장소 데이터를 불러오는 중입니다.';
    }
    if (visitedAreaLoadFailed) {
      return '방문 지역 데이터를 불러오지 못했습니다.';
    }
    if (tripIds.length === 0) {
      return '종료된 여행 데이터가 없어 표시할 방문 지역이 없습니다.';
    }
    if (!hasVisitedAreas) {
      return '정제된 여행 경로 또는 장소 데이터가 아직 없습니다.';
    }
    return `실제 여행 데이터 기준 방문 지역 ${visitedSigCodes.length}곳을 표시합니다.`;
  })();

  return (
    <View className="px-5 mt-6 mb-0">
      <Text className="text-lg font-bold text-[#333333] mb-4">여행 지도</Text>
      <View 
        className="w-full h-[400px] rounded-3xl overflow-hidden bg-[#ccc] relative"
        onTouchStart={onInteractionStart}
        onTouchEnd={onInteractionEnd}
        onTouchCancel={onInteractionEnd}
      >
        <Mapbox.MapView
          style={StyleSheet.absoluteFill}
          styleURL={Mapbox.StyleURL.Street}
          localizeLabels={{ locale: 'ko' }}
          logoEnabled
          attributionEnabled
          scrollEnabled
          zoomEnabled
          pitchEnabled
          rotateEnabled
        >
          <Mapbox.Camera
            zoomLevel={5.2}
            centerCoordinate={[127.7669, 36.4]}
            pitch={0}
            animationDuration={0}
            maxZoomLevel={12}
            minZoomLevel={3}
          />

          <Mapbox.VectorSource id="travelTilesetSource" url={`mapbox://${TILESET_ID}`}>
            <Mapbox.FillLayer
              id="fogLayer"
              sourceLayerID={SOURCE_LAYER_NAME}
              filter={['!', ['in', ['get', 'SIG_CD'], ['literal', sigCodesFilter]]]}
              style={{
                fillColor: '#151718',
                fillOpacity: 0.85,
              }}
            />
            <Mapbox.FillLayer
              id="visitedLayer"
              sourceLayerID={SOURCE_LAYER_NAME}
              filter={['in', ['get', 'SIG_CD'], ['literal', sigCodesFilter]]}
              style={{
                fillColor: '#00FF00',
                fillOpacity: 0.9,
              }}
            />
            <Mapbox.LineLayer
              id="travelTilesetLineLayer"
              sourceLayerID={SOURCE_LAYER_NAME}
              style={{
                lineColor: '#FFFFFF',
                lineOpacity: 1,
                lineWidth: 0.3,
              }}
            />
          </Mapbox.VectorSource>

          {geoJsonData ? (
            <Mapbox.ShapeSource id="travelDatasetSource" shape={geoJsonData}>
              <Mapbox.FillLayer
                id="travelDatasetFillLayer"
                layerIndex={101}
                style={{
                  fillColor: '#FFD700',
                  fillOpacity: 0,
                  fillOutlineColor: 'rgba(0,0,0,0)',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}
        </Mapbox.MapView>

        <View className="absolute top-4 left-4 right-4 bg-black/80 p-3 rounded-lg">
          <Text className="text-white text-xs font-medium">{statusMessage}</Text>
        </View>
      </View>
    </View>
  );
};
