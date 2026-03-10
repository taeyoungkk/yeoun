export interface LocationLog {
  locationLogId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
}

export type MatchStatus = 'MATCHED' | 'UNMATCHED';

export interface Photo {
  photoId: string;
  thumbnailUrl: string;
  storageUrl?: string;
  takenAt: string;
  matchStatus: MatchStatus;
  isExcluded: boolean;
  memo?: string;
}

export type EventType = 'PLACE_VISIT' | 'PAYMENT' | 'PHOTO' | 'MOVEMENT';

export interface TimelineEvent {
  eventId: string;
  eventType: EventType;
  title: string;
  placeName?: string;
  startAt: string;
  endAt?: string;
  isHidden: boolean;
  representativePhotoUrl?: string;
  summaryText?: string;
}

export interface TimelineDay {
  timelineDayId: string;
  dayDate: string;
  summaryText: string;
  distanceM: number;
  photoCount: number;
  eventCount: number;
  events?: TimelineEvent[];
}
