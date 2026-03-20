import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadLocationsApi, LocationLog } from '../api/trip';

const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';
const STORAGE_KEY_PREFIX = 'pending_location_logs_chunk_';
const STORAGE_INDEX_KEY = 'pending_location_logs_index';
const MAX_LOGS_PER_CHUNK = 100;

/**
 * Task manager definition for background location updates.
 * This MUST be defined in the global scope (outside of any hooks or components).
 */
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background Location Task Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const newLogs = locations.map(loc => ({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        recordedAt: new Date(loc.timestamp).toISOString(),
      }));

      await appendLogsToStorage(newLogs);
    }
  }
});

/**
 * Appends new location logs to AsyncStorage for later batch upload.
 */
async function appendLogsToStorage(newLogs: any[]) {
  try {
    const existingIndexRaw = await AsyncStorage.getItem(STORAGE_INDEX_KEY);
    const existingIndex = existingIndexRaw ? (JSON.parse(existingIndexRaw) as string[]) : [];
    const chunkKeys = [...existingIndex];

    for (let i = 0; i < newLogs.length; i += MAX_LOGS_PER_CHUNK) {
      const chunk = newLogs.slice(i, i + MAX_LOGS_PER_CHUNK);
      const chunkKey = `${STORAGE_KEY_PREFIX}${Date.now()}_${i}`;
      await AsyncStorage.setItem(chunkKey, JSON.stringify(chunk));
      chunkKeys.push(chunkKey);
    }

    await AsyncStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(chunkKeys));
  } catch (e) {
    console.error('Failed to save location logs to storage:', e);
  }
}

type LocationListener = (location: LocationLog) => void;
let listeners: LocationListener[] = [];
let foregroundSubscription: Location.LocationSubscription | null = null;

/**
 * Service to manage high-precision GPS tracking.
 */
export const locationService = {
  /**
   * Subscribes to live location updates (foreground only).
   */
  subscribe: (callback: LocationListener) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },
  /**
   * Checks permissions and starts high-accuracy background tracking.
   */
  startTracking: async () => {
    try {
      // 1. Request foreground permission
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return false;
      }

      // 2. Request background permission
      let hasBackgroundPermission = true;
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background location permission denied. Falling back to foreground tracking only.');
        hasBackgroundPermission = false;
      }

      // 3. Start high-accuracy background tracking
      if (hasBackgroundPermission) {
        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        if (!isStarted) {
          await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000, // 10 seconds
            distanceInterval: 10, // 10 meters
            foregroundService: {
              notificationTitle: '여행 기록 중',
              notificationBody: '현재 위치를 기반으로 여행 경로를 기록하고 있습니다.',
              notificationColor: '#344966',
            },
            pausesUpdatesAutomatically: false,
          });
          console.log('Background location tracking started');
        }
      }

      // 4. Start foreground watching for instant UI updates
      if (!foregroundSubscription) {
        foregroundSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (loc) => {
            const newLog = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
              recordedAt: new Date(loc.timestamp).toISOString(),
            };
            listeners.forEach(l => l(newLog));
          }
        );
        console.log('Foreground location watcher started');
      }

      return true;
    } catch (error) {
      console.error('Failed to start tracking:', error);
      return false;
    }
  },

  /**
   * Stops background tracking.
   */
  stopTracking: async () => {
    try {
      const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      if (isStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        console.log('Background location tracking stopped');
      }

      if (foregroundSubscription) {
        foregroundSubscription.remove();
        foregroundSubscription = null;
        console.log('Foreground location watcher stopped');
      }
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  },

  /**
   * Retrieves all pending logs and clears the storage.
   */
  flushLogs: async (): Promise<LocationLog[]> => {
    try {
      const existingIndexRaw = await AsyncStorage.getItem(STORAGE_INDEX_KEY);
      const chunkKeys = existingIndexRaw ? (JSON.parse(existingIndexRaw) as string[]) : [];
      if (chunkKeys.length === 0) {
        return [];
      }

      const chunkEntries = await AsyncStorage.multiGet(chunkKeys);
      await AsyncStorage.multiRemove(chunkKeys);
      await AsyncStorage.removeItem(STORAGE_INDEX_KEY);

      return chunkEntries.flatMap(([, value]) => {
        if (!value) {
          return [];
        }

        try {
          return JSON.parse(value) as LocationLog[];
        } catch (parseError) {
          console.error('Failed to parse location log chunk:', parseError);
          return [];
        }
      });
    } catch (e) {
      console.error('Failed to flush logs:', e);
      return [];
    }
  },

  /**
   * Syncs pending logs to the server.
   */
  syncLocations: async (tripId: string) => {
    try {
      const logs = await locationService.flushLogs();
      if (logs.length === 0) {
        console.log('No logs to sync');
        return true;
      }

      console.log(`Syncing ${logs.length} location logs for trip ${tripId}...`);
      const response = await uploadLocationsApi(tripId, logs);
      
      if (!response.success) {
        // If upload fails, put them back in the queue
        await appendLogsToStorage(logs);
        console.error('Failed to sync logs, re-queued:', response.message);
        return false;
      }

      console.log('Successfully synced logs to server');
      return true;
    } catch (error) {
      console.error('Sync process error:', error);
      return false;
    }
  }
};
