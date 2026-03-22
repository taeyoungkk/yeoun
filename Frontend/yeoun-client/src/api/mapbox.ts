import axios from 'axios';
import { MAPBOX_ACCESS_TOKEN } from '../lib/mapbox';

export interface MapMatchingResponse {
  code: string;
  matchings: {
    confidence: number;
    geometry: {
      coordinates: [number, number][];
      type: 'LineString';
    };
    legs: any[];
    distance: number;
    duration: number;
    weight: number;
    weight_name: string;
  }[];
  tracepoints: {
    matchings_index: number;
    waypoint_index: number;
    name: string;
    location: [number, number];
  }[];
}

/**
 * Snaps a series of GPS coordinates to the road network using Mapbox Map Matching API.
 * 
 * @param coordinates Array of [longitude, latitude] pairs (max 100)
 * @param profile Routing profile (driving, walking, cycling, driving-traffic)
 * @returns The matched geometry as a GeoJSON LineString or null if match failed
 */
export async function matchMapTrace(
  coordinates: [number, number][],
  profile: 'driving' | 'walking' | 'cycling' | 'driving-traffic' = 'walking'
): Promise<[number, number][] | null> {
  if (coordinates.length < 2) return null;
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error('[Mapbox API] Missing access token');
    return null;
  }

  // Mapbox expects coordinates in lon,lat;lon,lat;... format
  const coordString = coordinates
    .map(coord => `${coord[0]},${coord[1]}`)
    .join(';');

  const url = `https://api.mapbox.com/matching/v5/mapbox/${profile}/${coordString}`;

  try {
    const response = await axios.get<MapMatchingResponse>(url, {
      params: {
        access_token: MAPBOX_ACCESS_TOKEN,
        geometries: 'geojson',
        overview: 'full',
        tidy: true,
      },
    });

    if (response.data.code === 'Ok' && response.data.matchings.length > 0) {
      // Return the geometry of the first (highest confidence) match
      return response.data.matchings[0].geometry.coordinates;
    }

    console.warn('[Mapbox API] Map matching failed with code:', response.data.code);
    return null;
  } catch (error) {
    console.error('[Mapbox API] Error calling Map Matching API:', error);
    return null;
  }
}
