import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { PermissionsAndroid, Platform } from 'react-native';

import { PhotoSyncItemRequest, syncTripPhotosApi } from '@/src/api/photo';

const MEDIA_PAGE_SIZE = 100;
const PHOTO_PERMISSIONS: MediaLibrary.GranularPermission[] = ['photo'];
const PHOTO_SYNC_BATCH_SIZE = 2;
const PHOTO_SYNC_CURSOR_KEY_PREFIX = 'trip_photo_sync_cursor_';

type SyncFile = {
  uri: string;
  name: string;
  type: string;
};

type SyncCandidate = {
  metadata: PhotoSyncItemRequest;
  file: SyncFile;
};

type MediaPermissionBase = Awaited<ReturnType<typeof MediaLibrary.requestPermissionsAsync>>;

export type TripPhotoPermissionResult = MediaPermissionBase & {
  mediaLocationGranted: boolean;
  mediaLocationCanAskAgain: boolean;
};

export interface TripPhotoSyncResult {
  success: boolean;
  syncedCount: number;
  candidateCount: number;
  message?: string;
}

const logPhotoSync = (message: string, payload?: Record<string, unknown>) => {
  if (payload) {
    console.log(`[PhotoSync] ${message}`, payload);
    return;
  }

  console.log(`[PhotoSync] ${message}`);
};

const requestMediaLocationPermission = async (): Promise<{ granted: boolean; canAskAgain: boolean }> => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }

  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_MEDIA_LOCATION);
  if (granted) {
    logPhotoSync('ACCESS_MEDIA_LOCATION already granted.');
    return { granted: true, canAskAgain: true };
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_MEDIA_LOCATION, {
    title: '사진 위치 정보 접근 권한',
    message: '사진의 촬영 위치(EXIF GPS)를 읽어 여행 기록과 연결하려면 권한이 필요합니다.',
    buttonPositive: '허용',
    buttonNegative: '거부',
  });

  const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
  // Reduce noise for repetitive permission checks
  if (isGranted) {
    logPhotoSync('ACCESS_MEDIA_LOCATION permission granted.');
  }
  return {
    granted: isGranted,
    canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  };
};

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const getStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const clampDate = (value: Date, min?: Date | null, max?: Date | null) => {
  let next = value;
  if (min && next < min) {
    next = min;
  }
  if (max && next > max) {
    next = max;
  }
  return next;
};

const subtractMilliseconds = (value: Date, amount: number) => new Date(value.getTime() - amount);

const parseIsoDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

const getPhotoSyncCursorKey = (tripId: string) => `${PHOTO_SYNC_CURSOR_KEY_PREFIX}${tripId}`;

const getStoredPhotoSyncCursor = async (tripId: string) => {
  try {
    const rawValue = await AsyncStorage.getItem(getPhotoSyncCursorKey(tripId));
    return parseIsoDate(rawValue);
  } catch (error) {
    console.warn('[PhotoSync] Failed to read stored sync cursor.', {
      tripId,
      error,
    });
    return null;
  }
};

const setStoredPhotoSyncCursor = async (tripId: string, value: Date) => {
  try {
    await AsyncStorage.setItem(getPhotoSyncCursorKey(tripId), value.toISOString());
  } catch (error) {
    console.warn('[PhotoSync] Failed to persist sync cursor.', {
      tripId,
      value: value.toISOString(),
      error,
    });
  }
};

const getEndOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const guessMimeType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
};

const getFileExtension = (fileName: string | undefined) => {
  const extension = fileName?.split('.').pop()?.trim().toLowerCase();
  if (!extension) {
    return 'jpg';
  }

  if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(extension)) {
    return extension;
  }

  return 'jpg';
};

const buildUploadFileName = (asset: MediaLibrary.Asset) => {
  const extension = getFileExtension(asset.filename);
  const createdAt = typeof asset.creationTime === 'number' && Number.isFinite(asset.creationTime)
    ? Math.trunc(asset.creationTime)
    : Date.now();

  return `trip-photo-${createdAt}-${asset.id}.${extension}`;
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const sortCandidatesByTakenAtAsc = (candidates: SyncCandidate[]) =>
  [...candidates].sort((left, right) => {
    const leftTime = left.metadata.takenAt ? new Date(left.metadata.takenAt).getTime() : Number.NEGATIVE_INFINITY;
    const rightTime = right.metadata.takenAt ? new Date(right.metadata.takenAt).getTime() : Number.NEGATIVE_INFINITY;
    return leftTime - rightTime;
  });

const getTakenAt = (creationTime: number | undefined) => {
  if (typeof creationTime !== 'number' || !Number.isFinite(creationTime) || creationTime <= 0) {
    return null;
  }

  return new Date(creationTime).toISOString();
};

const mapAssetToCandidate = async (asset: MediaLibrary.Asset): Promise<SyncCandidate | null> => {
  const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
    shouldDownloadFromNetwork: false,
  });
  const uri = assetInfo.localUri ?? asset.uri;
  const uploadFileName = buildUploadFileName(asset);

  if (!uri) {
    return null;
  }

  return {
    metadata: {
      fileName: uploadFileName,
      takenAt: getTakenAt(asset.creationTime),
      takenTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      exifLatitude: assetInfo.location?.latitude ?? null,
      exifLongitude: assetInfo.location?.longitude ?? null,
    },
    file: {
      uri,
      name: uploadFileName,
      type: guessMimeType(uploadFileName),
    },
  };
};

const collectSyncCandidates = async (
  createdAfter: Date,
  createdBefore: Date,
): Promise<SyncCandidate[]> => {
  logPhotoSync('Collecting sync candidates.', {
    createdAfter: createdAfter.toISOString(),
    createdBefore: createdBefore.toISOString(),
  });

  if (!isValidDate(createdAfter) || !isValidDate(createdBefore)) {
    logPhotoSync('Invalid date range supplied.', {
      createdAfter: createdAfter.toString(),
      createdBefore: createdBefore.toString(),
    });
    return [];
  }

  const candidates: SyncCandidate[] = [];
  let after: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await MediaLibrary.getAssetsAsync({
      first: MEDIA_PAGE_SIZE,
      after,
      mediaType: 'photo',
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      createdAfter,
      createdBefore,
    });

    if (page.assets.length === 0) {
      logPhotoSync('No more assets returned for date range.', {
        after: after ?? null,
      });
      break;
    }

    logPhotoSync('Fetched media page.', {
      pageAssetCount: page.assets.length,
      hasNextPage: page.hasNextPage,
      endCursor: page.endCursor ?? null,
    });

    const pageCandidates = await Promise.all(
      page.assets.map(async (asset) => {
        try {
          return await mapAssetToCandidate(asset);
        } catch (error) {
          console.warn('[PhotoSync] Failed to inspect asset.', {
            assetId: asset.id,
            error,
          });
          return null;
        }
      }),
    );

    candidates.push(...pageCandidates.filter((item): item is SyncCandidate => item !== null));
    hasNextPage = page.hasNextPage;
    after = page.endCursor ?? undefined;
  }

  return candidates;
};

export const requestTripPhotoPermission = async (): Promise<TripPhotoPermissionResult> => {
  const currentPermission = await MediaLibrary.getPermissionsAsync(false, PHOTO_PERMISSIONS);

  logPhotoSync('Current photo permission checked.', {
    status: currentPermission.status,
    granted: currentPermission.granted,
    canAskAgain: currentPermission.canAskAgain,
  });

  if (currentPermission.granted) {
    const mediaLocationPermission = await requestMediaLocationPermission();
    return {
      ...currentPermission,
      mediaLocationGranted: mediaLocationPermission.granted,
      mediaLocationCanAskAgain: mediaLocationPermission.canAskAgain,
    };
  }

  const nextPermission = await MediaLibrary.requestPermissionsAsync(false, PHOTO_PERMISSIONS);
  logPhotoSync('Requested photo permission.', {
    status: nextPermission.status,
    granted: nextPermission.granted,
    canAskAgain: nextPermission.canAskAgain,
  });
  let mediaLocationPermission = { granted: false, canAskAgain: true };
  if (nextPermission.granted) {
    mediaLocationPermission = await requestMediaLocationPermission();
  }
  return {
    ...nextPermission,
    mediaLocationGranted: mediaLocationPermission.granted,
    mediaLocationCanAskAgain: mediaLocationPermission.canAskAgain,
  };
};

export const syncTripPhotosForDateRange = async ({
  tripId,
  tripStartedAt,
  startDate,
  endDate,
  syncRequestedAt,
}: {
  tripId: string;
  tripStartedAt?: string | null;
  startDate: string;
  endDate: string;
  syncRequestedAt?: string;
}): Promise<TripPhotoSyncResult> => {
  const tripStartBoundary = parseIsoDate(tripStartedAt) ?? getStartOfDay(startDate);
  const tripEndBoundary = parseIsoDate(syncRequestedAt) ?? getEndOfDay(endDate);
  const storedCursor = await getStoredPhotoSyncCursor(tripId);
  const normalizedStoredCursor =
    storedCursor && storedCursor >= tripStartBoundary && storedCursor <= tripEndBoundary ? storedCursor : null;
  const effectiveCursor = normalizedStoredCursor ?? tripStartBoundary;
  const createdAfter = clampDate(
    effectiveCursor.getTime() === tripStartBoundary.getTime()
      ? effectiveCursor
      : subtractMilliseconds(effectiveCursor, 1000),
    tripStartBoundary,
    tripEndBoundary,
  );
  const createdBefore = clampDate(tripEndBoundary, tripStartBoundary, tripEndBoundary);

  logPhotoSync('Resolved sync candidate window.', {
    tripId,
    tripStartedAt: tripStartedAt ?? null,
    startDate,
    endDate,
    storedCursor: storedCursor?.toISOString() ?? null,
    normalizedStoredCursor: normalizedStoredCursor?.toISOString() ?? null,
    createdAfter: createdAfter.toISOString(),
    createdBefore: createdBefore.toISOString(),
  });

  if (createdAfter > createdBefore) {
    return {
      success: true,
      syncedCount: 0,
      candidateCount: 0,
    };
  }

  const candidates = await collectSyncCandidates(createdAfter, createdBefore);

  logPhotoSync('Photo sync candidates collected.', {
    tripId,
    candidateCount: candidates.length,
  });

  if (candidates.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      candidateCount: 0,
    };
  }

  const orderedCandidates = sortCandidatesByTakenAtAsc(candidates);
  const candidateBatches = chunkArray(orderedCandidates, PHOTO_SYNC_BATCH_SIZE);
  let syncedCount = 0;
  let success = true;
  let lastMessage: string | undefined;

  for (const [index, batch] of candidateBatches.entries()) {
    logPhotoSync('Uploading photo sync batch.', {
      tripId,
      batchIndex: index + 1,
      batchCount: candidateBatches.length,
      batchSize: batch.length,
    });

    const response = await syncTripPhotosApi(
      tripId,
      {
        items: batch.map((candidate) => candidate.metadata),
      },
      batch.map((candidate) => candidate.file),
    );

    syncedCount += response.data?.syncedCount ?? 0;
    lastMessage = response.message;

    logPhotoSync('Photo sync batch completed.', {
      tripId,
      batchIndex: index + 1,
      batchCount: candidateBatches.length,
      success: response.success,
      batchSyncedCount: response.data?.syncedCount ?? 0,
      accumulatedSyncedCount: syncedCount,
      message: response.message ?? null,
    });

    if (!response.success) {
      success = false;
      break;
    }
  }

  logPhotoSync('Photo sync request completed.', {
    tripId,
    success,
    candidateCount: candidates.length,
    syncedCount,
    message: lastMessage ?? null,
    batchCount: candidateBatches.length,
    batchSize: PHOTO_SYNC_BATCH_SIZE,
  });

  if (success) {
    await setStoredPhotoSyncCursor(tripId, createdBefore);
  }

  return {
    success,
    syncedCount,
    candidateCount: candidates.length,
    message: lastMessage,
  };
};
