import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';

import { locationService } from '@/src/services/locationService';
import { reverseGeocodeKo } from '@/src/api/mapbox';

export function useCurrentAddress(isActive: boolean) {
  const [address, setAddress] = useState<string | null>(null);
  const lastCoords = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!isActive) {
      setAddress(null);
      return;
    }

    const resolveAddress = async (lat: number, lon: number) => {
      // Avoid excessive geocoding if moved less than ~50m
      if (lastCoords.current) {
        const dist = Math.sqrt(
          Math.pow(lastCoords.current.latitude - lat, 2) + 
          Math.pow(lastCoords.current.longitude - lon, 2)
        );
        if (dist < 0.0005) return; 
      }

      try {
        const result = await reverseGeocodeKo(lon, lat);

        if (result) {
          // Clean up address (remove country "대한민국" and postal codes)
          const cleaned = result
            .replace(/대한민국\s*\d*/g, '')
            .replace(/,/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          setAddress(cleaned || '위치 확인 중...');
          lastCoords.current = { latitude: lat, longitude: lon };
        }
      } catch (error) {
        console.warn('[useCurrentAddress] Mapbox geocode failed:', error);
      }
    };

    // Initial check
    const checkCurrent = async () => {
      try {
        const loc = await Location.getLastKnownPositionAsync();
        if (loc) {
          resolveAddress(loc.coords.latitude, loc.coords.longitude);
        }
      } catch (e) {}
    };
    checkCurrent();

    // Subscribe to updates
    const unsubscribe = locationService.subscribe((log) => {
      resolveAddress(log.latitude, log.longitude);
    });

    return unsubscribe;
  }, [isActive]);

  return address;
}
