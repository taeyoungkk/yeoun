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
/**
 * Reverse geocodes [longitude, latitude] to a Korean address string using Mapbox Geocoding API.
 */
export async function reverseGeocodeKo(
  longitude: number,
  latitude: number
): Promise<string | null> {
  if (!MAPBOX_ACCESS_TOKEN) return null;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`;

  try {
    const response = await axios.get(url, {
      params: {
        access_token: MAPBOX_ACCESS_TOKEN,
        language: 'ko',
        types: 'district,place,locality,neighborhood',
        limit: 1,
      },
    });

    if (response.data.features && response.data.features.length > 0) {
      // Mapbox features have a 'place_name' which is usually a full localized address
      // or we can use the 'text' of the most specific feature.
      return response.data.features[0].place_name;
    }

    return null;
  } catch (error) {
    console.error('[Mapbox API] Error calling Reverse Geocoding API:', error);
    return null;
  }
}
