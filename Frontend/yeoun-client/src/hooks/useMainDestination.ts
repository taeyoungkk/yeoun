import { useEffect, useState } from 'react';
import { getTopDestinationName } from '@/src/utils/trip-analysis-utils';

export function useMainDestination(tripId: string, initialLocation?: string) {
  // Use initialLocation immediately if it's not a generic placeholder
  const [location, setLocation] = useState<string>(initialLocation || '위치 확인 중...');

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;
    
    const analyze = async () => {
      const result = await getTopDestinationName(tripId);
      if (mounted && result) {
        setLocation(result);
      }
    };

    void analyze();
    
    return () => {
      mounted = false;
    };
  }, [tripId]);

  return location;
}
