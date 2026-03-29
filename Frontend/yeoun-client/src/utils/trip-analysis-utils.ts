import { getTripPlacesApi, getTripRouteDaysApi, TripPlaceItem, TripRouteDayListItem } from '@/src/api/trip';
import { reverseGeocodeKo } from '@/src/api/mapbox';

/**
 * Shortens formal Korean administrative names (e.g., "서울특별시" -> "서울", "경기도" -> "경기").
 * Also removes common suffixes like "광역시", "시", "군", "구".
 */
export const shortenLocationName = (name?: string | null): string => {
  if (!name) return '';
  const doMap: Record<string, string> = {
    경기도: '경기',
    강원도: '강원',
    충청북도: '충북',
    충청남도: '충남',
    전라북도: '전북',
    전라남도: '전남',
    경상북도: '경북',
    경상남도: '경남',
    제주특별자치도: '제주',
    '제주 특별자치도': '제주',
  };

  if (doMap[name]) return doMap[name];

  return name
    .replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구)$/, '')
    .trim();
};

/**
 * Cleans a reverse geocoding result by prioritizing specific administrative areas (Si, Gun, Gu) over Provinces.
 * E.g., "대한민국 경기도 의정부시 낙양동" -> "의정부시" -> "의정부".
 */
export const cleanLocationLabel = (address: string): string => {
  const parts = address
    .replace(/대한민국\s*\d*/g, '')
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/);

  if (parts.length === 0) return '';

  // Prioritize nouns ending with Si, Gun, or Gu
  const specificPart = parts.find((part) => /(시|군|구)$/.test(part));
  if (specificPart) {
    return specificPart;
  }

  // Fallback to the first part (usually the province)
  return parts[0] || '';
};

export interface DestinationRank {
  name: string;
  totalDurationSeconds: number;
}

/**
 * Analyzes a trip's places to find where the user stayed the longest.
 * Grouped by administrative area (e.g., "부산시", "서울특별시").
 */
export async function identifyMainDestinations(tripId: string): Promise<DestinationRank[]> {
  try {
    const response = await getTripPlacesApi(tripId);
    if (!response.success || !response.data.places) return [];

    const places = response.data.places;
    const durationMap: Record<string, number> = {};

    // For each place, resolve its administrative name
    await Promise.all(
      places.map(async (place: TripPlaceItem) => {
        const fullAddress = await reverseGeocodeKo(place.centerLongitude, place.centerLatitude);
        if (fullAddress) {
          const cityPart = cleanLocationLabel(fullAddress);
          if (cityPart) {
            durationMap[cityPart] = (durationMap[cityPart] || 0) + place.durationSeconds;
          }
        }
      })
    );

    // Convert to sorted list
    const results = Object.entries(durationMap)
      .map(([name, totalDurationSeconds]) => ({ name, totalDurationSeconds }))
      .sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds);

    return results;
  } catch (error) {
    console.error('[TripAnalysis] Failed to identify main destinations:', error);
    return [];
  }
}

/**
 * Convenience function to get just the top destination name.
 */
export async function getTopDestinationName(tripId: string): Promise<string | null> {
  const ranks = await identifyMainDestinations(tripId);
  return ranks.length > 0 ? ranks[0].name : null;
}

/**
 * Fallback to geographic endpoint identification via the route logs.
 * Returns the administrative name of the very last coordinate in the route.
 */
export async function getRouteEndPointDestination(tripId: string): Promise<string | null> {
  try {
    const response = await getTripRouteDaysApi(tripId);
    if (!response.success || !response.data?.routeDays) return null;

    const routeDays = response.data.routeDays;
    if (routeDays.length === 0) return null;

    // Sort by day and find the last coordinate
    const sortedDays = [...routeDays].sort((a, b) => a.day.localeCompare(b.day));
    const lastDay = sortedDays[sortedDays.length - 1];
    
    if (!lastDay.coordinates || lastDay.coordinates.length === 0) return null;
    
    const lastCoord = lastDay.coordinates[lastDay.coordinates.length - 1];
    const [lon, lat] = lastCoord;

    const fullAddress = await reverseGeocodeKo(lon, lat);
    if (!fullAddress) return null;

    return cleanLocationLabel(fullAddress);
  } catch (error) {
    console.error('[TripAnalysis] Endpoint identification failed:', error);
    return null;
  }
}

/**
 * Calculates total distance of a route in kilometers using Haversine formula.
 */
export function calculateDistance(route: [number, number][]): number {
  if (route.length < 2) return 0;
  
  let totalKm = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const p1 = route[i];
    const p2 = route[i+1];
    
    if (!p1 || !p2 || p1.length < 2 || p2.length < 2) continue;
    
    const [lon1, lat1] = p1;
    const [lon2, lat2] = p2;
    
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }
  return totalKm;
}
