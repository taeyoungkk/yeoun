import { useEffect, useState } from 'react';
import { getTopDestinationName, getRouteEndPointDestination, shortenLocationName } from '@/src/utils/trip-analysis-utils';
import { getTripDetailApi } from '@/src/api/trip';

/**
 * Hook to resolve and format a trip's destination name.
 * Priority: Analyzed (Top Destination) -> Route End-Point -> Detail API Fallback -> Initial Location -> '대한민국'.
 * All results are passed through shortenLocationName for consistency.
 */
export function useMainDestination(tripId: string, initialLocation?: string) {
  // Use initialLocation shortened, or '대한민국' as the base
  const getInitialValue = () => {
    const shortenedInitial = shortenLocationName(initialLocation);
    if (shortenedInitial && shortenedInitial !== '위치 확인 중...' && shortenedInitial !== '' && shortenedInitial !== '대한민국') {
      return shortenedInitial;
    }
    return '대한민국';
  };

  const [location, setLocation] = useState<string>(getInitialValue);

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;
    
    const analyze = async () => {
      // 1. Try GPS-based analysis (Stays/Stopovers)
      const gpsResult = await getTopDestinationName(tripId);
      
      if (!mounted) return;

      if (gpsResult) {
        const shortened = shortenLocationName(gpsResult);
        if (shortened && shortened !== '대한민국') {
          console.log(`[useMainDestination] ${tripId} GPS analysis found: ${shortened}`);
          setLocation(shortened);
          return;
        }
      }

      // 2. Try Route End-Point geocoding (Best for trips without long stops)
      const routeResult = await getRouteEndPointDestination(tripId);
      
      if (!mounted) return;

      if (routeResult) {
        const shortened = shortenLocationName(routeResult);
        if (shortened && shortened !== '대한민국') {
          console.log(`[useMainDestination] ${tripId} Route end-point found: ${shortened}`);
          setLocation(shortened);
          return;
        }
      }

      console.log(`[useMainDestination] ${tripId} GPS & Route analysis returned nothing. Trying Detail fallback...`);

      // 3. Fallback: Detail fetch
      try {
        const detailResponse = await getTripDetailApi(tripId);
        if (mounted && detailResponse.success && detailResponse.data) {
          const detail = detailResponse.data;
          const detailLocation = detail.region || detail.country;
          const shortened = shortenLocationName(detailLocation);
          
          if (shortened && shortened !== '대한민국' && shortened !== '') {
            console.log(`[useMainDestination] ${tripId} Detail fallback found: ${shortened}`);
            setLocation(shortened);
          } else {
            console.log(`[useMainDestination] ${tripId} Detail fallback returned generic data: ${detailLocation}`);
          }
        }
      } catch (error) {
        console.debug(`[useMainDestination] ${tripId} Detail fallback failed:`, error);
      }
    };

    void analyze();
    
    return () => {
      mounted = false;
    };
  }, [tripId, initialLocation]);

  return location;
}
