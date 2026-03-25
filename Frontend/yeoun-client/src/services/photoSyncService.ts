import * as MediaLibrary from 'expo-media-library';

import { PhotoSyncItemRequest, syncTripPhotosApi } from '@/src/api/photo';

const MEDIA_PAGE_SIZE = 100;
const PHOTO_PERMISSIONS: MediaLibrary.GranularPermission[] = ['photo'];

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

  if (!isValidDate(createdAfter) || !isValidDate(createdBefore)) {
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
      break;
    }

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

  if (currentPermission.granted) {
    return currentPermission;
  }

  return MediaLibrary.requestPermissionsAsync(false, PHOTO_PERMISSIONS);
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

  if (candidates.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      candidateCount: 0,
    };
  }

  const response = await syncTripPhotosApi(
    tripId,
    {
      items: candidates.map((candidate) => candidate.metadata),
    },
    candidates.map((candidate) => candidate.file),
  );

  return {
    success: response.success,
    syncedCount: response.data?.syncedCount ?? 0,
    candidateCount: candidates.length,
    message: response.message,
  };
};
