import * as MediaLibrary from 'expo-media-library';
import { PermissionsAndroid, Platform } from 'react-native';

import { PhotoSyncItemRequest, syncTripPhotosApi } from '@/src/api/photo';

const MEDIA_PAGE_SIZE = 100;
const PHOTO_PERMISSIONS: MediaLibrary.GranularPermission[] = ['photo'];
const PHOTO_SYNC_BATCH_SIZE = 2;

type SyncFile = {
  uri: string;
  name: string;
  type: string;
};

type SyncCandidate = {
  metadata: PhotoSyncItemRequest;
  file: SyncFile;
};

export type TripPhotoPermissionResult = Awaited<
  ReturnType<typeof MediaLibrary.requestPermissionsAsync>
>;

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

const requestMediaLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_MEDIA_LOCATION);
  if (granted) {
    logPhotoSync('ACCESS_MEDIA_LOCATION already granted.');
    return true;
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_MEDIA_LOCATION, {
    title: '사진 위치 정보 접근 권한',
    message: '사진의 촬영 위치(EXIF GPS)를 읽어 여행 기록과 연결하려면 권한이 필요합니다.',
    buttonPositive: '허용',
    buttonNegative: '거부',
  });

  const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
  logPhotoSync('ACCESS_MEDIA_LOCATION permission requested.', {
    result,
    granted: isGranted,
  });
  return isGranted;
};

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const getStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
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

  if (!uri) {
    return null;
  }

  return {
    metadata: {
      fileName: asset.filename,
      takenAt: getTakenAt(asset.creationTime),
      takenTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      exifLatitude: assetInfo.location?.latitude ?? null,
      exifLongitude: assetInfo.location?.longitude ?? null,
    },
    file: {
      uri,
      name: asset.filename || `trip-photo-${asset.id}.jpg`,
      type: guessMimeType(asset.filename),
    },
  };
};

const collectSyncCandidates = async (
  startDate: string,
  endDate: string,
): Promise<SyncCandidate[]> => {
  const createdAfter = getStartOfDay(startDate);
  const createdBefore = getEndOfDay(endDate);

  logPhotoSync('Collecting sync candidates.', {
    startDate,
    endDate,
    createdAfter: createdAfter.toISOString(),
    createdBefore: createdBefore.toISOString(),
  });

  if (!isValidDate(createdAfter) || !isValidDate(createdBefore)) {
    logPhotoSync('Invalid date range supplied.', {
      startDate,
      endDate,
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
    await requestMediaLocationPermission();
    return currentPermission;
  }

  const nextPermission = await MediaLibrary.requestPermissionsAsync(false, PHOTO_PERMISSIONS);
  logPhotoSync('Requested photo permission.', {
    status: nextPermission.status,
    granted: nextPermission.granted,
    canAskAgain: nextPermission.canAskAgain,
  });
  if (nextPermission.granted) {
    await requestMediaLocationPermission();
  }
  return nextPermission;
};

export const syncTripPhotosForDateRange = async ({
  tripId,
  startDate,
  endDate,
}: {
  tripId: string;
  startDate: string;
  endDate: string;
}): Promise<TripPhotoSyncResult> => {
  const candidates = await collectSyncCandidates(startDate, endDate);

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

  const candidateBatches = chunkArray(candidates, PHOTO_SYNC_BATCH_SIZE);
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

  return {
    success,
    syncedCount,
    candidateCount: candidates.length,
    message: lastMessage,
  };
};
