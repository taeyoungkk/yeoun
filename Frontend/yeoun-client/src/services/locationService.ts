import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, type AppStateStatus, Linking } from 'react-native';

import { getTripSyncStatusApi, type TripSyncStatusData, LocationLog, uploadLocationsApi } from '../api/trip';
import { useTripStore } from '../store/trip.store';

const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';
const STORAGE_KEY_PREFIX = 'pending_location_logs_chunk_';
const STORAGE_INDEX_KEY = 'pending_location_logs_index';
const MAX_LOGS_PER_CHUNK = 100;
const LOG_DEDUPE_WINDOW_MS = 2000;

export type StartTrackingResult = {
  success: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
};

type CollectorMode = 'idle' | 'foreground' | 'background';
type TrackingSessionConfig = {
  backgroundGranted: boolean;
};

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background Location Task Error:', error.message);
    return;
  }

  if (activeCollectorMode !== 'background') {
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const newLogs = locations.map(toLocationLog);

      await appendLogsToStorage(newLogs);
    }
  }
});

const toOptionalNumber = (value: number | null | undefined) => (typeof value === 'number' ? value : undefined);

const toLocationLog = (location: Location.LocationObject): LocationLog => ({
  clientLogUuid: Crypto.randomUUID(),
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  accuracy: toOptionalNumber(location.coords.accuracy),
  accuracyM: toOptionalNumber(location.coords.accuracy),
  recordedAt: new Date(location.timestamp).toISOString(),
  speedMps: toOptionalNumber(location.coords.speed),
  heading: toOptionalNumber(location.coords.heading),
  source: 'GPS',
});

async function appendLogsToStorage(newLogs: LocationLog[], options: { dedupe?: boolean } = {}) {
  return runQueuedStorageOperation(async () => {
    try {
      const shouldDedupe = options.dedupe ?? true;
      const normalizedLogs: LocationLog[] = [];
      let rollingSnapshot = lastQueuedLogSnapshot;

      for (const log of newLogs) {
        if (shouldDedupe && shouldDropAsDuplicate(log, rollingSnapshot)) {
          continue;
        }

        normalizedLogs.push(log);
        const nextSnapshot = toQueuedLogSnapshot(log);
        if (nextSnapshot) {
          rollingSnapshot = nextSnapshot;
        }
      }

      if (normalizedLogs.length === 0) {
        return;
      }

      const existingIndexRaw = await AsyncStorage.getItem(STORAGE_INDEX_KEY);
      const existingIndex = existingIndexRaw ? (JSON.parse(existingIndexRaw) as string[]) : [];
      const chunkKeys = [...existingIndex];

      for (let i = 0; i < normalizedLogs.length; i += MAX_LOGS_PER_CHUNK) {
        const chunk = normalizedLogs.slice(i, i + MAX_LOGS_PER_CHUNK);
        const chunkKey = `${STORAGE_KEY_PREFIX}${Date.now()}_${i}_${Crypto.randomUUID()}`;
        await AsyncStorage.setItem(chunkKey, JSON.stringify(chunk));
        chunkKeys.push(chunkKey);
      }

      normalizedLogs.forEach(rememberQueuedLog);
      await AsyncStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(chunkKeys));
    } catch (error) {
      console.error('Failed to save location logs to storage:', error);
    }
  });
}

type LocationListener = (location: LocationLog) => void;

let listeners: LocationListener[] = [];
let foregroundSubscription: Location.LocationSubscription | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let trackingSessionConfig: TrackingSessionConfig | null = null;
let trackingEnabled = false;
let activeCollectorMode: CollectorMode = 'idle';
let lastKnownAppState: AppStateStatus = AppState.currentState;
let collectorTransitionQueue: Promise<void> = Promise.resolve();
let storageOperationQueue: Promise<unknown> = Promise.resolve();
let lastQueuedLogSnapshot:
  | {
      latitude: number;
      longitude: number;
      recordedAtMs: number;
    }
  | null = null;
const LOCATION_STATUS_POLL_INTERVAL_MS = 1500;
const LOCATION_STATUS_POLL_TIMEOUT_MS = 20000;

const logLocationDebug = (message: string, payload?: Record<string, unknown>) => {
  if (payload) {
    console.log(`[LocationService] ${message}`, payload);
    return;
  }

  console.log(`[LocationService] ${message}`);
};

const setLocationSyncState = (
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed',
  message?: string | null,
) => {
  useTripStore.getState().setLocationSyncState(status, message ?? null);
};

const runQueuedStorageOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const nextOperation = storageOperationQueue.catch(() => undefined).then(operation);
  storageOperationQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
};

const toQueuedLogSnapshot = (log: LocationLog) => {
  const recordedAtMs = Date.parse(log.recordedAt);
  if (!Number.isFinite(recordedAtMs)) {
    return null;
  }

  return {
    latitude: log.latitude,
    longitude: log.longitude,
    recordedAtMs,
  };
};

const shouldDropAsDuplicate = (
  log: LocationLog,
  snapshot:
    | {
        latitude: number;
        longitude: number;
        recordedAtMs: number;
      }
    | null,
) => {
  if (!snapshot) {
    return false;
  }

  const nextSnapshot = toQueuedLogSnapshot(log);
  if (!nextSnapshot) {
    return false;
  }

  return (
    Math.abs(snapshot.recordedAtMs - nextSnapshot.recordedAtMs) <= LOG_DEDUPE_WINDOW_MS &&
    Math.abs(snapshot.latitude - nextSnapshot.latitude) < 0.00001 &&
    Math.abs(snapshot.longitude - nextSnapshot.longitude) < 0.00001
  );
};

const rememberQueuedLog = (log: LocationLog) => {
  lastQueuedLogSnapshot = toQueuedLogSnapshot(log);
};

const startForegroundWatcher = async () => {
  if (foregroundSubscription) {
    logLocationDebug('Foreground watcher already active.', {
      activeCollectorMode,
      appState: AppState.currentState,
    });
    return;
  }

  logLocationDebug('Starting foreground watcher.', {
    activeCollectorMode,
    appState: AppState.currentState,
  });

  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 5,
    },
    (loc) => {
      if (activeCollectorMode !== 'foreground') {
        return;
      }

      const newLog = toLocationLog(loc);
      void appendLogsToStorage([newLog]);
      listeners.forEach((listener) => listener(newLog));
    },
  );
  console.log('Foreground location watcher started');
};

const stopForegroundWatcher = async () => {
  if (!foregroundSubscription) {
    logLocationDebug('Foreground watcher already stopped.', {
      activeCollectorMode,
      appState: AppState.currentState,
    });
    return;
  }

  foregroundSubscription.remove();
  foregroundSubscription = null;
  console.log('Foreground location watcher stopped');
};

const startBackgroundWatcher = async () => {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  logLocationDebug('Starting background watcher check.', {
    isStarted,
    activeCollectorMode,
    appState: AppState.currentState,
  });
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

const stopBackgroundWatcher = async () => {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  logLocationDebug('Stopping background watcher check.', {
    isStarted,
    activeCollectorMode,
    appState: AppState.currentState,
  });
  if (!isStarted) {
    return;
  }

  await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  console.log('Background location tracking stopped');
};

const syncCollectorsForAppState = async (nextAppState: AppStateStatus) => {
  logLocationDebug('Switching collectors for app state.', {
    nextAppState,
    trackingEnabled,
    backgroundGranted: trackingSessionConfig?.backgroundGranted ?? false,
    activeCollectorMode,
  });
  if (!trackingEnabled) {
    activeCollectorMode = 'idle';
    return;
  }

  if (nextAppState === 'active') {
    activeCollectorMode = 'foreground';
    await startForegroundWatcher();
    return;
  }

  await stopForegroundWatcher();

  if (trackingSessionConfig?.backgroundGranted) {
    activeCollectorMode = 'background';
    return;
  }

  activeCollectorMode = 'idle';
};

const runCollectorTransition = async (nextAppState: AppStateStatus) => {
  logLocationDebug('Queueing collector transition.', {
    nextAppState,
    previousAppState: lastKnownAppState,
    activeCollectorMode,
  });
  const transition = collectorTransitionQueue.catch(() => undefined).then(async () => {
    lastKnownAppState = nextAppState;
    await syncCollectorsForAppState(nextAppState);
  });

  collectorTransitionQueue = transition;
  return transition;
};

const ensureAppStateSubscription = () => {
  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
    void runCollectorTransition(nextAppState).catch((error) => {
      console.error('Failed to switch location collectors:', error);
    });
  });
};

const removeAppStateSubscription = () => {
  appStateSubscription?.remove();
  appStateSubscription = null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeStatus = (status?: string | null) => String(status ?? '').toUpperCase();

const isTripSyncComplete = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  return (
    normalizedStatus === 'IDLE' ||
    normalizedStatus === 'READY' ||
    normalizedStatus === 'SUCCESS' ||
    normalizedStatus === 'COMPLETED' ||
    normalizedStatus === 'DONE'
  );
};

const isTripSyncProcessing = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  return normalizedStatus === 'PENDING' || normalizedStatus === 'QUEUED' || normalizedStatus === 'PROCESSING';
};

const isTripSyncFailed = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  return normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR';
};

const hasSyncVersionChanged = (
  baseline: TripSyncStatusData | null,
  nextStatus: TripSyncStatusData,
) =>
  baseline == null ||
  baseline.routeVersion !== nextStatus.routeVersion ||
  baseline.timelineVersion !== nextStatus.timelineVersion ||
  baseline.photoVersion !== nextStatus.photoVersion;

const pollTripSyncStatus = async (tripId: string, baseline: TripSyncStatusData | null) => {
  const startedAt = Date.now();
  let observedProcessing = false;

  logLocationDebug('Polling trip sync status started.', {
    tripId,
    baselineSyncStatus: baseline?.syncStatus ?? null,
    baselineRouteVersion: baseline?.routeVersion ?? null,
    baselineTimelineVersion: baseline?.timelineVersion ?? null,
    baselinePhotoVersion: baseline?.photoVersion ?? null,
    timeoutMs: LOCATION_STATUS_POLL_TIMEOUT_MS,
  });

  while (Date.now() - startedAt < LOCATION_STATUS_POLL_TIMEOUT_MS) {
    const response = await getTripSyncStatusApi(tripId);
    logLocationDebug('Trip sync status polled.', {
      tripId,
      success: response.success,
      syncStatus: response.data?.syncStatus ?? null,
      routeVersion: response.data?.routeVersion ?? null,
      timelineVersion: response.data?.timelineVersion ?? null,
      photoVersion: response.data?.photoVersion ?? null,
      elapsedMs: Date.now() - startedAt,
    });

    if (!response.success) {
      console.warn('Failed to poll trip sync status:', response.message);
      setLocationSyncState('failed', response.message || '여행 동기화 상태를 확인하지 못했습니다.');
      return false;
    }

    if (isTripSyncProcessing(response.data.syncStatus)) {
      observedProcessing = true;
      setLocationSyncState('processing', '여행 데이터를 동기화하는 중입니다. 경로와 타임라인 업데이트를 기다리고 있어요.');
      await wait(LOCATION_STATUS_POLL_INTERVAL_MS);
      continue;
    }

    if (isTripSyncFailed(response.data.syncStatus)) {
      console.error('Trip sync failed:', response.data.lastErrorMessage ?? response.data.syncStatus);
      setLocationSyncState('failed', response.data.lastErrorMessage ?? '여행 동기화에 실패했습니다.');
      return false;
    }

    if (
      hasSyncVersionChanged(baseline, response.data) ||
      (observedProcessing && isTripSyncComplete(response.data.syncStatus))
    ) {
      console.log('Trip sync completed:', response.data);
      setLocationSyncState('completed', '여행 데이터 동기화가 완료되었습니다.');
      useTripStore.getState().bumpRouteRefreshKey();
      return true;
    }

    setLocationSyncState('processing', 'GPS 기록을 업로드했습니다. 동기화 상태 업데이트를 기다리고 있어요.');
    await wait(LOCATION_STATUS_POLL_INTERVAL_MS);
  }

  console.warn('Trip sync status polling timed out');
  setLocationSyncState('failed', '여행 동기화가 시간 초과되었습니다. 다시 시도해 주세요.');
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
      logLocationDebug('startTracking called.', {
        appState: AppState.currentState,
        activeCollectorMode,
      });
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

      logLocationDebug('Location permissions resolved.', {
        foregroundStatus: foregroundPermission.status,
        backgroundStatus: backgroundPermission.status,
        backgroundGranted,
      });

      if (!backgroundGranted) {
        console.warn('Background location permission denied. Falling back to foreground tracking only.');
      }

      trackingSessionConfig = {
        backgroundGranted,
      };
      trackingEnabled = true;
      if (backgroundGranted && AppState.currentState === 'active') {
        await startBackgroundWatcher();
      }
      lastKnownAppState = AppState.currentState;
      ensureAppStateSubscription();
      await runCollectorTransition(lastKnownAppState);

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
      logLocationDebug('stopTracking called.', {
        appState: AppState.currentState,
        activeCollectorMode,
      });
      trackingEnabled = false;
      trackingSessionConfig = null;
      removeAppStateSubscription();
      lastKnownAppState = AppState.currentState;
      await runCollectorTransition(lastKnownAppState);
      await stopBackgroundWatcher();
      await stopForegroundWatcher();
      activeCollectorMode = 'idle';
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  },

  flushLogs: async (): Promise<LocationLog[]> => {
    return runQueuedStorageOperation(async () => {
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
    });
  },

  syncLocations: async (tripId: string) => {
    try {
      const logs = await locationService.flushLogs();
      logLocationDebug('syncLocations called.', {
        tripId,
        flushedLogCount: logs.length,
      });
      if (logs.length === 0) {
        console.log('No logs to sync');
        setLocationSyncState('completed', '새로 동기화할 GPS 기록이 없습니다.');
        return true;
      }

      setLocationSyncState('uploading', `GPS 기록 ${logs.length}개를 업로드하는 중입니다.`);
      console.log(`Syncing ${logs.length} location logs for trip ${tripId}...`);
      const baselineSyncStatusResponse = await getTripSyncStatusApi(tripId);
      const baselineSyncStatus = baselineSyncStatusResponse.success ? baselineSyncStatusResponse.data : null;
      logLocationDebug('Baseline sync status fetched before upload.', {
        tripId,
        success: baselineSyncStatusResponse.success,
        syncStatus: baselineSyncStatus?.syncStatus ?? null,
        routeVersion: baselineSyncStatus?.routeVersion ?? null,
        timelineVersion: baselineSyncStatus?.timelineVersion ?? null,
        photoVersion: baselineSyncStatus?.photoVersion ?? null,
      });
      const response = await uploadLocationsApi(tripId, logs);

      if (!response.success) {
        await appendLogsToStorage(logs, { dedupe: false });
        console.error('Failed to sync logs, re-queued:', response.message);
        setLocationSyncState('failed', response.message || 'GPS 기록 업로드에 실패했습니다.');
        return false;
      }

      console.log('Successfully synced logs to server');
      setLocationSyncState('processing', 'GPS 기록을 업로드했습니다. 동기화 상태 업데이트를 기다리고 있어요.');
      const processed = await pollTripSyncStatus(tripId, baselineSyncStatus);

      if (!processed) {
        console.warn('Location logs uploaded but processing is not complete yet.');
      }

      return processed;
    } catch (error) {
      console.error('Sync process error:', error);
      setLocationSyncState('failed', 'GPS 동기화 중 예기치 않은 오류가 발생했습니다.');
      return false;
    }
  },
};
