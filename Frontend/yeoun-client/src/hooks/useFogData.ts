import { useEffect, useState, useMemo } from 'react';
import { useTripStore } from '../store/trip.store';
import { getTripRouteDaysApi } from '../api/trip';
import type { Feature, GeometryCollection, MultiLineString, Point } from 'geojson';

export function useFogData(currentLocation: [number, number] | null) {
  const trips = useTripStore((state) => state.trips);
  const [pastRoutes, setPastRoutes] = useState<number[][][]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchAllPastRoutes = async () => {
      // Only fetch for ended trips
      const endedTrips = trips.filter((t) => t.status === 'ENDED' || t.status === 'COMPLETED');
      if (endedTrips.length === 0) return;

      setIsLoading(true);
      try {
        const routePromises = endedTrips.map(async (trip) => {
          try {
            const response = await getTripRouteDaysApi(trip.tripId);
            if (response.success) {
              return response.data.routeDays.flatMap((rd) => rd.coordinates);
            }
          } catch (e) {
            console.warn(`[useFogData] Failed to fetch route for trip ${trip.tripId}:`, e);
          }
          return [];
        });

        const allRoutes = await Promise.all(routePromises);
        if (isMounted) {
          setPastRoutes(allRoutes.filter((r) => r.length > 0));
        }
      } catch (error) {
        console.error('[useFogData] Error fetching all past routes:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAllPastRoutes();

    return () => {
      isMounted = false;
    };
  }, [trips.length]); // Re-fetch only if number of trips changes

  const fogFeature: Feature<GeometryCollection> | null = useMemo(() => {
    const geometries: (Point | MultiLineString)[] = [];

    // 1. Current Location (Always clear fog around user)
    if (currentLocation) {
      geometries.push({
        type: 'Point',
        coordinates: currentLocation,
      });
    }

    // 2. Past Routes (Clear fog along all past travels)
    if (pastRoutes.length > 0) {
      geometries.push({
        type: 'MultiLineString',
        coordinates: pastRoutes,
      });
    }

    if (geometries.length === 0) return null;

    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'GeometryCollection',
        geometries: geometries as any,
      },
    };
  }, [currentLocation, pastRoutes]);

  return useMemo(() => ({ fogFeature, isLoading }), [fogFeature, isLoading]);
}
