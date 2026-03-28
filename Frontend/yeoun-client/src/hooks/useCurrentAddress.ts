import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';

import { locationService } from '@/src/services/locationService';
import { reverseGeocodeKo } from '@/src/api/mapbox';
import { useTripStore } from '../store/trip.store';
import { useUserStore } from '../store/user.store';

export function useCurrentAddress(isActive: boolean) {
  const [address, setAddress] = useState<string | null>(null);
  const lastCoords = useRef<{ latitude: number; longitude: number } | null>(null);
  const locationPerm = useUserStore((state) => state.settings.locationPerm);

  useEffect(() => {
    const setStoreAddress = useTripStore.getState().setCurrentAddress;

    const checkStatus = async () => {
      // 1. Check Store Permission
      if (!locationPerm) {
        setStoreAddress(null, 'DENIED');
        setAddress(null);
        return false;
      }

      // 2. Check System Permission
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          setStoreAddress(null, 'DENIED');
          setAddress(null);
          return false;
        }
      } catch (e) {
        return false;
      }

      // 3. Check GPS/Service Status
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          setStoreAddress(null, 'GPS_OFF');
          setAddress(null);
          return false;
        }
      } catch (e) {
        return false;
      }

      return true;
    };

    const resolveAddress = async (lat: number, lon: number) => {
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
          const cleaned = result
            .replace(/대한민국\s*\d*/g, '')
            .replace(/,/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          setAddress(cleaned || '위치 확인 중...');
          setStoreAddress(cleaned || '위치 확인 중...', 'SUCCESS');
          lastCoords.current = { latitude: lat, longitude: lon };
        }
      } catch (error) {
        console.warn('[useCurrentAddress] geocode failed:', error);
      }
    };

    // Main logic
    let unsubscribe: (() => void) | null = null;
    
    (async () => {
      const isOk = await checkStatus();
      if (!isOk) return;

      // Start loading
      setStoreAddress(null, 'LOADING');
      
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc) {
          await resolveAddress(loc.coords.latitude, loc.coords.longitude);
        }
      } catch (e) {
        // Potentially GPS turned off while checking
        const stillOk = await checkStatus();
        if (!stillOk) return;
      }

      // Subscribe to updates
      unsubscribe = locationService.subscribe((log) => {
        resolveAddress(log.latitude, log.longitude);
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isActive, locationPerm]);

  return address;
}
