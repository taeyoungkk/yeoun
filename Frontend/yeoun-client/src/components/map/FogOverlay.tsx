import Mapbox from '@rnmapbox/maps';
import bboxPolygon from '@turf/bbox-polygon';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import dissolve from '@turf/dissolve';
import truncate from '@turf/truncate';
import { featureCollection } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import React, { useState, useEffect } from 'react';

interface FogOverlayProps {
  /**
   * The geometry to carve out from the fog.
   * - Use a Point for a circular cutout.
   * - Use a LineString for a route-based custom cutout.
   * - Use a MultiLineString for multiple past routes.
   */
  feature?: Feature<any>;
  /**
   * Radius of the clear area in kilometers. Default is 5.
   */
  radiusKm?: number;
}

function flattenToPolygons(features: Feature<Polygon | MultiPolygon>[]): Feature<Polygon>[] {
  const result: Feature<Polygon>[] = [];
  for (const f of features) {
    if (!f || !f.geometry) continue;
    
    // FeatureCollection이 반환되는 특수한 경우 평탄화
    const anyF = f as any;
    if (anyF.type === 'FeatureCollection') {
      if (anyF.features) {
         result.push(...flattenToPolygons(anyF.features));
      }
      continue;
    }

    if (f.geometry && f.geometry.type === 'Polygon') {
      result.push(f as Feature<Polygon>);
    } else if (f.geometry.type === 'MultiPolygon') {
      for (const coords of f.geometry.coordinates) {
        result.push({
          type: 'Feature',
          properties: f.properties || {},
          geometry: { type: 'Polygon', coordinates: coords }
        });
      }
    }
  }
  return result;
}

function combineToMultiPolygon(features: Feature<Polygon | MultiPolygon>[]): Feature<MultiPolygon> | null {
  if (!features || features.length === 0) return null;
  const coordinates: Polygon['coordinates'][] = [];
  for (const f of features) {
    if (!f || !f.geometry) continue;
    if (f.geometry.type === 'Polygon') {
      coordinates.push(f.geometry.coordinates);
    } else if (f.geometry.type === 'MultiPolygon') {
      coordinates.push(...f.geometry.coordinates);
    }
  }
  if (coordinates.length === 0) return null;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates
    }
  };
}

// 공통 헬퍼: 입력된 Feature(Point, LineString, MultiLineString, GeometryCollection)를 기반으로
// 모두 'Polygon'들로 변환 후 배열로 묶어줍니다. 이때 거리 0.02km 정도의 아주 미세한 기본 버퍼를 주어
// 선이나 점을 면(Polygon)으로 안전하게 변환합니다.
function normalizeToPolygons(feature: Feature<any>): Feature<Polygon>[] {
  const polys: Feature<Polygon>[] = [];
  
  const processGeom = (geom: any) => {
    if (!geom) return;
    
    // MultiLineString인 경우 각각의 LineString으로 분해하여 버퍼 처리
    if (geom.type === 'MultiLineString') {
      for (const coords of geom.coordinates) {
        if (!coords || coords.length < 2) continue;
        const lineFeature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
        // 미세한 버퍼를 주어 면으로 변환 (성능을 위해 steps를 8로 축소)
        const buf = buffer(lineFeature as any, 0.02, { units: 'kilometers', steps: 8 });
        if (buf) polys.push(...flattenToPolygons([truncate(buf as any, { precision: 6 })]));
      }
      return;
    }

    const tempFeature = { type: 'Feature', properties: {}, geometry: geom };
    const buf = buffer(tempFeature as any, 0.02, { units: 'kilometers', steps: 8 });
    if (buf) {
      polys.push(...flattenToPolygons([truncate(buf as any, { precision: 6 })]));
    }
  };

  if (feature.geometry.type === 'GeometryCollection') {
    for (const g of feature.geometry.geometries) processGeom(g);
  } else {
    // 잦은 연산 부하를 줄이기 위해 포인트 밀도를 낮춥니다 (약 10m 이내 포인트 제거)
    const geom = feature.geometry;
    if (geom.type === 'LineString') {
      const coords = geom.coordinates;
      if (coords.length > 2) {
        const simplified: any[] = [coords[0]];
        for (let i = 1; i < coords.length - 1; i++) {
          const last = simplified[simplified.length - 1];
          const curr = coords[i];
          const dist = Math.sqrt(Math.pow(curr[0] - last[0], 2) + Math.pow(curr[1] - last[1], 2));
          if (dist > 0.0001) simplified.push(curr); // 약 10m
        }
        simplified.push(coords[coords.length - 1]);
        processGeom({ ...geom, coordinates: simplified });
        return polys;
      }
    } else if (geom.type === 'MultiLineString') {
      const simplifiedMulti = geom.coordinates.map((line: any[]) => {
        if (line.length <= 2) return line;
        const simplified: any[] = [line[0]];
        for (let i = 1; i < line.length - 1; i++) {
          const last = simplified[simplified.length - 1];
          const curr = line[i];
          const dist = Math.sqrt(Math.pow(curr[0] - last[0], 2) + Math.pow(curr[1] - last[1], 2));
          if (dist > 0.0001) simplified.push(curr);
        }
        simplified.push(line[line.length - 1]);
        return simplified;
      });
      processGeom({ ...geom, coordinates: simplifiedMulti });
      return polys;
    }
    processGeom(feature.geometry);
  }
  
  return polys;
}

export function FogOverlay({ feature, radiusKm = 1 }: FogOverlayProps) {
  const [fogShape, setFogShape] = useState<any>(null);

  useEffect(() => {
    // 잦은 업데이트 방지를 위해 100ms 디버운싱을 적용합니다. (성능 최적화 핵심)
    const timeout = setTimeout(() => {
      const worldBox = bboxPolygon([-180, -90, 180, 90]);
      try {
        if (!feature || !feature.geometry) {
           setFogShape(featureCollection([worldBox]));
           return;
        };

        const type = feature.geometry.type;
        const isValidLineString = type === 'LineString' && (feature.geometry as any).coordinates?.length > 1;
        const isValidMultiLine = type === 'MultiLineString' && (feature.geometry as any).coordinates?.length > 0;
        const isValidPoint = type === 'Point';
        const isGeometryCollection = type === 'GeometryCollection' && (feature.geometry as any).geometries?.length > 0;

        if (!isValidPoint && !isValidLineString && !isValidMultiLine && !isGeometryCollection) {
          setFogShape(featureCollection([worldBox]));
          return;
        }

        const steps = 4; // 단계를 4로 축소하여 연산량 절반으로 감소 (성능 최적화)
        const fadeStartKm = radiusKm * 0.4;
        const fadeEndKm = radiusKm;
        const maxOpacity = 0.95; // 완전 불투명보다 약간 투명하게 하여 부드러움 유지

        const features: Feature<Polygon | MultiPolygon>[] = [];
        let prevBuffer: Feature<Polygon | MultiPolygon> | null = null;
        const stepSize = (fadeEndKm - fadeStartKm) / steps;

        // 1. 모든 인풋 지오메트리를 Polygon 배열로 정규화합니다.
        const basePolygons = normalizeToPolygons(feature);
        if (basePolygons.length === 0) {
          setFogShape(featureCollection([worldBox]));
          return;
        }

        // 2. 여러 폴리곤을 하나의 단일 MultiPolygon/Polygon으로 통합합니다.
        let baseGeometry: Feature<Polygon | MultiPolygon> | null = null;
        try {
          const fc = featureCollection(basePolygons);
          const dissolved = dissolve(fc);
          if (dissolved && dissolved.features.length > 0) {
            baseGeometry = combineToMultiPolygon(dissolved.features as Feature<Polygon|MultiPolygon>[]);
          } else {
            baseGeometry = combineToMultiPolygon(basePolygons);
          }
        } catch (e) {
          baseGeometry = combineToMultiPolygon(basePolygons);
        }

        if (!baseGeometry) {
          setFogShape(featureCollection([worldBox]));
          return;
        }

        // 3. 통합된 단일 baseGeometry에 대해서만 그라데이션 루프를 돕니다.
        for (let i = 0; i <= steps; i++) {
          const currentRadiusKm = fadeStartKm + stepSize * i;
          
          let currentBuffer: Feature<Polygon | MultiPolygon> | null = null;
          try {
            const buf = buffer(baseGeometry, currentRadiusKm, { units: 'kilometers', steps: 8 });
            currentBuffer = truncate(buf as any, { precision: 5 }) as Feature<Polygon | MultiPolygon>;
          } catch (e) { continue; }

          if (!currentBuffer) continue;

          // Outermost: 가장 바깥쪽 반경(radiusKm) 밖으로 온 세상을 덮는 판
          if (i === steps) {
            try {
              const solidPlate = difference(featureCollection([worldBox, currentBuffer]));
              if (solidPlate) {
                solidPlate.properties = { opacity: maxOpacity };
                features.push(solidPlate as Feature<Polygon | MultiPolygon>);
              }
            } catch (e) {}
          }

          // Transition: 안쪽(fadeStartKm)부터 바깥쪽(fadeEndKm) 사이의 그라데이션 링
          if (i > 0 && prevBuffer && currentBuffer) {
            try {
              const ring = difference(featureCollection([currentBuffer, prevBuffer]));
              if (ring) {
                const opacity = (i / steps) * maxOpacity;
                ring.properties = { opacity: opacity };
                features.push(ring as Feature<Polygon | MultiPolygon>);
              }
            } catch (e) {}
          }
          prevBuffer = currentBuffer;
        }

        setFogShape(featureCollection(features));
      } catch (e) {
        console.error('[FogOverlay] Error:', e);
        setFogShape(featureCollection([worldBox]));
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [feature, radiusKm]);

  if (!fogShape) return null;

  return (
    <Mapbox.ShapeSource id="fog-overlay-source" shape={fogShape}>
      <Mapbox.FillLayer
        id="fog-overlay-fill"
        style={{
          fillColor: '#EFF4EC',
          fillOpacity: ['get', 'opacity'],
        }}
      />
    </Mapbox.ShapeSource>
  );
}
