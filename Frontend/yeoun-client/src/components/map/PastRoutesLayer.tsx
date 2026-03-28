import React, { useMemo } from 'react';
import Mapbox from '@rnmapbox/maps';
import type { FeatureCollection, LineString } from 'geojson';
import { FogOverlay } from './FogOverlay';

interface PastRoutesLayerProps {
  /**
   * 서버에서 불러온 과거 여행 경로들의 배열입니다.
   * 각 경로는 [longitude, latitude] 형태의 좌표 배열입니다.
   */
  routes: number[][][];
  /**
   * 안개 효과를 활성화할지 여부입니다.
   */
  isFogEnabled?: boolean;
}

/**
 * 과거 여행 기록을 지도에 표시하고, 해당 기록 주변의 안개를 걷어내는 컴포넌트입니다.
 */
export function PastRoutesLayer({ routes, isFogEnabled = true }: PastRoutesLayerProps) {
  // 여러 개의 과거 경로를 하나의 GeoJSON 객체(FeatureCollection)로 묶습니다.
  const pastRoutesShape: FeatureCollection<LineString> = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: routes.map((routeCoordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      })),
    };
  }, [routes]);
 
  // 안개를 걷어내기 위해 모든 과거 경로들과 현재 활성화된 요소를 합친 MultiLineString을 만들 수 있지만,
  // 현재 구조상 FogOverlay는 하나의 Feature만을 받습니다. 
  // Mapbox 상에서는 여러 안개 레이어(다수의 뚫린 구멍)를 그려 겹칠 수 있으므로 과거 경로 전체를 하나의 지오메트리로 병합하여 보냅니다.
  const fogFeature = useMemo<GeoJSON.Feature<GeoJSON.MultiLineString> | null>(() => {
    if (!routes || routes.length === 0) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiLineString',
        coordinates: routes, // 여러 선분 배열
      },
    };
  }, [routes]);


  if (!routes || routes.length === 0) return null;

  return (
    <>
      {/* 1. 과거 이동 경로를 흐린 회색 선으로 표시 (현재 목적지 붉은선과 구분하기 위함) */}
      <Mapbox.ShapeSource id="past-trips-routes" shape={pastRoutesShape}>
        <Mapbox.LineLayer
          id="past-trips-routes-line"
          style={{
            lineColor: '#B0BEC5', // 흐린 청회색
            lineWidth: 4,
            lineCap: 'round',
            lineJoin: 'round',
            lineOpacity: 0.6,
          }}
        />
      </Mapbox.ShapeSource>

      {/* 2. 과거 이동 경로 전체를 감싸는 1km 반경 밖을 어둡게 처리하는 안개 오버레이 */}
      {isFogEnabled && fogFeature && (
        <FogOverlay feature={fogFeature} radiusKm={1} />
      )}
    </>
  );
}
