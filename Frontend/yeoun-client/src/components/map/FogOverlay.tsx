import React, { useMemo } from 'react';
import Mapbox from '@rnmapbox/maps';
import bboxPolygon from '@turf/bbox-polygon';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
// @ts-ignore
import { featureCollection } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

interface FogOverlayProps {
  /**
   * The geometry to carve out from the fog.
   * - Use a Point for a circular cutout.
   * - Use a LineString for a route-based custom cutout.
   */
  feature?: Feature<any>;
  /**
   * Radius of the clear area in kilometers. Default is 5.
   */
  radiusKm?: number;
}

export function FogOverlay({ feature, radiusKm = 1 }: FogOverlayProps) {
  const fogShape = useMemo(() => {
    const worldBox = bboxPolygon([-180, -90, 180, 90]);
    if (!feature || !feature.geometry) return featureCollection([worldBox]);

    const isLineString = feature.geometry.type === 'LineString' && (feature.geometry as any).coordinates?.length > 1;
    const isPoint = feature.geometry.type === 'Point';

    if (!isPoint && !isLineString) return featureCollection([worldBox]);

    const steps = 12; // 페이드 단계를 늘려 더 부드럽게 만듭니다.
    // 안개가 서서히 짙어지기 시작하는 지점
    const fadeStartKm = radiusKm * 0.3;
    const fadeEndKm = radiusKm;
    const maxOpacity = 1.0; // 1.0으로 설정하여 지도를 완전히 불투명하게 덮습니다 (진정한 페이드 아웃).

    const features: Feature<Polygon | MultiPolygon>[] = [];
    let prevBuffer: Feature<Polygon | MultiPolygon> | null = null;

    for (let i = 0; i <= steps; i++) {
      const fraction = i / steps;
      const currentRadius = fadeEndKm - ((fadeEndKm - fadeStartKm) * fraction);
      
      const curBuffer = buffer(feature, currentRadius, { units: 'kilometers', steps: 64 }) as Feature<Polygon | MultiPolygon>;
      
      if (i === 0) {
        // 반경 1km 완전 밖의 전 세계 영역 (가장 어두운 영역)
        const diff = difference(featureCollection([worldBox, curBuffer]));
        if (diff) {
          diff.properties = { opacity: maxOpacity };
          features.push(diff as Feature<Polygon | MultiPolygon>);
        }
      } else {
        // 이전 버퍼와 현재 버퍼 사이의 "도넛" 모양을 구해서 투명도를 점진적으로 줄입니다 (부드러운 그라데이션)
        if (prevBuffer && curBuffer) {
          const ring = difference(featureCollection([prevBuffer, curBuffer]));
          if (ring) {
            const prevFraction = (i - 1) / steps;
            const ringOpacity = maxOpacity * (1 - prevFraction);
            ring.properties = { opacity: ringOpacity };
            features.push(ring as Feature<Polygon | MultiPolygon>);
          }
        }
      }
      prevBuffer = curBuffer;
    }

    return featureCollection(features);
  }, [feature, radiusKm]);

  return (
    <Mapbox.ShapeSource id="fog-overlay-source" shape={fogShape}>
      <Mapbox.FillLayer
        id="fog-overlay-fill"
        style={{
          fillColor: '#EFF4EC', // 앱 배경색과 동일한 색상으로 안개를 설정하여 맵이 배경으로 서서히 녹아들도록(fade out) 합니다.
          // 생성한 각 도넛의 속성 opacity를 가져와 적용합니다.
          fillOpacity: ['get', 'opacity'],
        }}
        // 이 속성으로 안개를 마커와 라벨보다 아래로 또는 위로 보낼지 결정할 수 있습니다.
        // 위에 얹으면 마커들도 같이 어두워집니다 (의도한 바).
      />
    </Mapbox.ShapeSource>
  );
}
