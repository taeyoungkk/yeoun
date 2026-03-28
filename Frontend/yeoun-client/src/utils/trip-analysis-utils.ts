import { getTripPlacesApi, TripPlaceItem } from '@/src/api/trip';
import { reverseGeocodeKo } from '@/src/api/mapbox';

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
      places.map(async (place) => {
        const address = await reverseGeocodeKo(place.centerLongitude, place.centerLatitude);
        if (address) {
          // Extract the City/Province level (e.g., "부산광역시", "서울특별시")
          // Mapbox reverseGeocodeKo returns full address, so we need to parse it.
          // Usually the first or second part of a Korean address after country.
          const parts = address.split(' ');
          // Handle "대한민국 서울특별시 ..." or "서울특별시 ..."
          const cityPart = parts[0] === '대한민국' ? parts[1] : parts[0];
          
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
 * Calculates total distance of a route in kilometers using Haversine formula.
 */
export function calculateDistance(route: [number, number][]): number {
  if (route.length < 2) return 0;
  
  let totalKm = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const [lon1, lat1] = route[i];
    const [lon2, lat2] = route[i+1];
    
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
