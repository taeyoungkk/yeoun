import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking } from 'react-native';

import { getTripLocationLogStatusApi, LocationLog, uploadLocationsApi } from '../api/trip';
import { useTripStore } from '../store/trip.store';

const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';
const STORAGE_KEY_PREFIX = 'pending_location_logs_chunk_';
const STORAGE_INDEX_KEY = 'pending_location_logs_index';
const MAX_LOGS_PER_CHUNK = 100;

export type StartTrackingResult = {
  success: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
};

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background Location Task Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const newLogs = locations.map((loc) => ({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        recordedAt: new Date(loc.timestamp).toISOString(),
      }));

      await appendLogsToStorage(newLogs);
    }
  }
});

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
  } catch (error) {
    console.error('Failed to save location logs to storage:', error);
  }
}

type LocationListener = (location: LocationLog) => void;

let listeners: LocationListener[] = [];
let foregroundSubscription: Location.LocationSubscription | null = null;
const LOCATION_STATUS_POLL_INTERVAL_MS = 1500;
const LOCATION_STATUS_POLL_TIMEOUT_MS = 20000;

const setLocationSyncState = (
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed',
  message?: string | null,
) => {
  useTripStore.getState().setLocationSyncState(status, message ?? null);
};

const startForegroundWatcher = async () => {
  if (foregroundSubscription) {
    return;
  }

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
      listeners.forEach((listener) => listener(newLog));
    },
  );
  console.log('Foreground location watcher started');
};

const startBackgroundWatcher = async () => {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  if (isStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: '여행 기록 중',
      notificationBody: '백그라운드 위치를 수집해 여행 경로를 기록하고 있습니다.',
      notificationColor: '#344966',
    },
    pausesUpdatesAutomatically: false,
  });
  console.log('Background location tracking started');
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isLocationProcessingComplete = (status?: string | null) => {
  const normalizedStatus = String(status ?? '').toUpperCase();
  return normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'DONE';
};

const isLocationProcessingFailed = (status?: string | null) => {
  const normalizedStatus = String(status ?? '').toUpperCase();
  return normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR';
};

const pollLocationProcessingStatus = async (tripId: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOCATION_STATUS_POLL_TIMEOUT_MS) {
    const response = await getTripLocationLogStatusApi(tripId);

    if (!response.success) {
      console.warn('Failed to poll location processing status:', response.message);
      setLocationSyncState('failed', response.message || 'Failed to poll GPS processing status.');
      return false;
    }

    if (isLocationProcessingComplete(response.data.status)) {
      console.log('Location processing completed:', response.data.status);
      setLocationSyncState('completed', 'GPS data synchronized and route data refreshed.');
      useTripStore.getState().bumpRouteRefreshKey();
      return true;
    }

    if (isLocationProcessingFailed(response.data.status)) {
      console.error('Location processing failed:', response.data.lastErrorMessage ?? response.data.status);
      setLocationSyncState('failed', response.data.lastErrorMessage ?? 'GPS processing failed.');
      return false;
    }

    setLocationSyncState('processing', 'GPS logs uploaded. Waiting for worker processing.');
    await wait(LOCATION_STATUS_POLL_INTERVAL_MS);
  }

  console.warn('Location processing status polling timed out');
  setLocationSyncState('failed', 'GPS processing timed out. Try syncing again.');
  return false;
};

export const locationService = {
  subscribe: (callback: LocationListener) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((listener) => listener !== callback);
    };
  },

  startTracking: async (): Promise<StartTrackingResult> => {
    try {
      const currentForeground = await Location.getForegroundPermissionsAsync();
      const foregroundPermission =
        currentForeground.status === 'granted'
          ? currentForeground
          : await Location.requestForegroundPermissionsAsync();

      if (foregroundPermission.status !== 'granted') {
        console.warn('Foreground location permission denied');
        return {
          success: false,
          foregroundGranted: false,
          backgroundGranted: false,
        };
      }

      const currentBackground = await Location.getBackgroundPermissionsAsync();
      const backgroundPermission =
        currentBackground.status === 'granted'
          ? currentBackground
          : await Location.requestBackgroundPermissionsAsync();

      const backgroundGranted = backgroundPermission.status === 'granted';

      if (!backgroundGranted) {
        console.warn('Background location permission denied. Falling back to foreground tracking only.');
      }

      if (backgroundGranted) {
        await startBackgroundWatcher();
      }

      await startForegroundWatcher();

      return {
        success: true,
        foregroundGranted: true,
        backgroundGranted,
      };
    } catch (error) {
      console.error('Failed to start tracking:', error);
      return {
        success: false,
        foregroundGranted: false,
        backgroundGranted: false,
      };
    }
  },

  openLocationSettings: async () => {
    try {
      await Linking.openSettings();
      return true;
    } catch (error) {
      console.error('Failed to open app settings:', error);
      return false;
    }
  },

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
    } catch (error) {
      console.error('Failed to flush logs:', error);
      return [];
    }
  },

  syncLocations: async (tripId: string) => {
    try {
      const logs = await locationService.flushLogs();
      if (logs.length === 0) {
        console.log('No logs to sync');
        setLocationSyncState('completed', 'No new GPS logs to synchronize.');
        return true;
      }

      setLocationSyncState('uploading', `Uploading ${logs.length} GPS logs...`);
      console.log(`Syncing ${logs.length} location logs for trip ${tripId}...`);
      const response = await uploadLocationsApi(tripId, logs);

      if (!response.success) {
        await appendLogsToStorage(logs);
        console.error('Failed to sync logs, re-queued:', response.message);
        setLocationSyncState('failed', response.message || 'Failed to upload GPS logs.');
        return false;
      }

      console.log('Successfully synced logs to server');
      setLocationSyncState('processing', 'GPS logs uploaded. Waiting for worker processing.');
      const processed = await pollLocationProcessingStatus(tripId);

      if (!processed) {
        console.warn('Location logs uploaded but processing is not complete yet.');
      }

      return processed;
    } catch (error) {
      console.error('Sync process error:', error);
      setLocationSyncState('failed', 'Unexpected GPS sync error occurred.');
      return false;
    }
  },
};
