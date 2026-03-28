import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Mapbox from '@rnmapbox/maps';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  Animated,
  InteractionManager,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { configureMapbox } from '@/src/lib/mapbox';
import {
  deleteExpenseApi,
  getExpenseDetailApi,
  getTripExpensesApi,
  updateExpenseApi,
} from '@/src/api/expense';
import {
  deletePhotoMemoApi,
  getPhotoDetailApi,
  updatePhotoApi,
  upsertPhotoMemoApi,
  type PhotoDetail,
} from '@/src/api/photo';
import {
  getEventDetailApi,
  getTimelineDayDetailApi,
  getTripTimelineDaysApi,
  updateEventApi,
  upsertEventMemoApi,
  type EventDetail,
  type TimelineDayDetail,
} from '@/src/api/timeline';
import {
  deleteTripApi,
  endTripApi,
  getTripDetailApi,
  getTripMembersApi,
  getTripRouteByDayApi,
  leaveTripApi,
  type TripDetail,
  type TripMemberItem,
  type LocationLog,
} from '@/src/api/trip';
import { matchMapTrace } from '@/src/api/mapbox';
import { useTripStore, useUserStore } from '@/src/store';
import { locationService } from '../../../services/locationService';
import { PhotoMarker, PaymentMarker, LocationMarker } from '@/src/components/map/EventMarkers';
import { requestTripPhotoPermission, syncTripPhotosForDateRange } from '../../../services/photoSyncService';
import { type LocationSyncStatus } from '@/src/store/trip.store';
import { calculateDistance } from '@/src/utils/trip-analysis-utils';
import MockTripRecordingScreen from './MockTripRecordingScreen';

const hasMapboxToken = configureMapbox();
const MAX_MAP_HEIGHT = 620;
const MIN_MAP_HEIGHT = 250;
const MAP_COLLAPSE_DISTANCE = 260;
const INITIAL_PANEL_PEEK = 120;
const MAP_SIDE_MARGIN = 16;
const MAP_TOP_OFFSET = 112;
const PANEL_TOP_OFFSET = 118;
const AUTO_PHOTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;

type DayKey = `day${number}`;
type DayFilter = 'all' | DayKey;
type TimelineEventType = 'location' | 'photo' | 'payment';
type Coordinate = [number, number];
type MapFilterKey = 'showPhotoPins' | 'showPaymentPins';
type ActionConfirmKind = 'end' | 'leave' | 'delete';
type PaymentDialogMode = 'edit';
type PaymentSplitType = 'equal';
type PhotoSyncOutcome = 'synced' | 'empty' | 'skipped_permission' | 'skipped_range' | 'failed';

type PhotoContributor = {
  id: string;
  name: string;
  color: string;
};

type TimelinePhotoItem = {
  id: string;
  source: number | string;
  memo?: string;
  contributorId?: string;
};

type TimelineEvent = {
  id: string;
  day: DayKey;
  type: TimelineEventType;
  time: string;
  title: string;
  subtitle: string;
  amount?: string;
  chips?: string[];
  coordinate?: Coordinate;
  placeName?: string;
  placeProvider?: string;
  providerPlaceId?: string;
  eventMemo?: string;
  photoUrls?: string[];
  photoContributors?: PhotoContributor[];
  photoItems?: TimelinePhotoItem[];
  paymentStatus?: 'confirmed';
  paymentCardName?: string;
  paymentPayerName?: string;
  paymentPayerUserId?: string;
  paymentSplitLabel?: string;
  paymentExpenseId?: string;
  paymentParticipantUserIds?: string[];
  paymentParticipantNames?: string[];
  paymentSplitType?: PaymentSplitType;
  emotionEmoji?: string;
  emotionLabel?: string;
  emotionOwnerId?: string;
};

type TripDay = {
  id: DayKey;
  label: string;
  dateLabel: string;
  lastRecordedAt?: string; // Track the latest point in this day
  distanceKm: number;
  summary: string;
  route: Coordinate[];
};

const TRIP_DAY_TEMPLATES: Omit<TripDay, 'id' | 'label' | 'dateLabel'>[] = [
  {
    distanceKm: 15.2,
    summary: '경복궁에서 시작해 남산을 거쳐 강남까지 이동하며 서울의 중심을 가로지른 날이에요.',
    route: [
      [126.9768, 37.5796], // 경복궁
      [126.9822, 37.5703], // 시청
      [126.9882, 37.5512], // 남산타워
      [127.0090, 37.5450], // 한남
      [127.0276, 37.4979], // 강남역
    ],
  },
  {
    distanceKm: 8.5,
    summary: '서울숲과 성수동 일대에서 여유로운 시간을 보내며 힐링한 하루예요.',
    route: [
      [127.0437, 37.5447], // 서울숲 입구
      [127.0448, 37.5447], // 서울숲 중앙
      [127.0479, 37.5466], // 성수동
      [127.0574, 37.5442], // 성수역
    ],
  },
  {
    distanceKm: 12.0,
    summary: '한강변을 따라 걸으며 사진과 장소를 기록한 평화로운 구간이에요.',
    route: [
      [126.9837, 37.5392],
      [127.0028, 37.5289],
      [127.0200, 37.5200],
    ],
  },
];

const EVENT_THEME: Record<TimelineEventType, { icon: keyof typeof MaterialIcons.glyphMap; accent: string; surface: string }> = {
  location: { icon: 'near-me', accent: '#1F78D1', surface: '#E9F3FF' },
  photo: { icon: 'photo-library', accent: '#4C8E5E', surface: '#EDF7EE' },
  payment: { icon: 'credit-card', accent: '#D15D36', surface: '#FFF0E8' },
};

const MAP_FILTER_META: Array<{ key: MapFilterKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { key: 'showPhotoPins', label: '사진', icon: 'photo-library' },
  { key: 'showPaymentPins', label: '결제', icon: 'credit-card' },
];
const EMOTION_OPTIONS = [
  { emoji: '😊', label: '설렘' },
  { emoji: '😌', label: '든든함' },
  { emoji: '😍', label: '행복' },
  { emoji: '😮', label: '신기함' },
  { emoji: '😴', label: '피곤함' },
  { emoji: '🥲', label: '뭉클함' },
] as const;
function getBounds(route: Coordinate[]) {
  const longitudes = route.map(([longitude]) => longitude);
  const latitudes = route.map(([, latitude]) => latitude);

  return {
    northEast: [Math.max(...longitudes), Math.max(...latitudes)] as Coordinate,
    southWest: [Math.min(...longitudes), Math.min(...latitudes)] as Coordinate,
  };
}

function formatDayTabLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function buildTripDays(startDate?: string, endDate?: string): TripDay[] {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return TRIP_DAY_TEMPLATES.map((template, index) => ({
      id: `day${index + 1}`,
      label: `DAY ${index + 1}`,
      dateLabel: formatDayTabLabel(new Date(2025, 2, 11 + index)),
      ...template,
    }));
  }

  const normalizedStart = new Date(start);
  const normalizedEnd = new Date(end);
  normalizedStart.setHours(0, 0, 0, 0);
  normalizedEnd.setHours(0, 0, 0, 0);

  const diffDays =
    Math.max(
      1,
      Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );

  return Array.from({ length: diffDays }, (_, index) => {
    const targetDate = new Date(normalizedStart);
    targetDate.setDate(normalizedStart.getDate() + index);
    const template = TRIP_DAY_TEMPLATES[Math.min(index, TRIP_DAY_TEMPLATES.length - 1)];

    return {
      id: `day${index + 1}`,
      label: `DAY ${index + 1}`,
      dateLabel: formatDayTabLabel(targetDate),
      ...template,
    };
  });
}

function getFilteredDays(activeFilter: DayFilter, tripDays: TripDay[]) {
  return activeFilter === 'all' ? tripDays : tripDays.filter((day) => day.id === activeFilter);
}

function formatTimeLabel(value?: string | null) {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--.--';
  }

  return formatDayTabLabel(date);
}

function formatWon(value: number) {
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

function normalizeRouteCoordinates(routeDays: Array<{ coordinates: number[][] }>): Coordinate[] {
  return routeDays.flatMap((routeDay) =>
    routeDay.coordinates
      .filter((coordinate): coordinate is Coordinate => Array.isArray(coordinate) && coordinate.length >= 2)
      .map(([longitude, latitude]) => [longitude, latitude] as Coordinate),
  );
}

function buildRealTripDays(
  timelineDays: TimelineDayDetail[],
  routeByDate: Map<string, Coordinate[]>,
  activeTripId: string,
  tripStartDate?: string,
  tripEndDate?: string,
): TripDay[] {
  // If timelineDays is empty, we must at least show Day 1 for active trips
  const dates = timelineDays.map(d => d.dayDate);
  const today = new Date().toISOString().split('T')[0];
  if (!dates.includes(today) && activeTripId) {
    dates.push(today);
  }

  // If we still have no dates, fallback to startDate or today
  if (dates.length === 0) {
    dates.push(tripStartDate?.split('T')[0] || today);
  }

  return dates.map((date, index) => {
    const timelineDay = timelineDays.find(d => d.dayDate === date);
    const route = routeByDate.get(date) ?? [];
    return {
      id: `day${index + 1}` as DayKey,
      label: `DAY ${index + 1}`,
      dateLabel: formatDateLabel(date),
      distanceKm: timelineDay ? Math.round((timelineDay.distanceM / 1000) * 10) / 10 : 0,
      summary: timelineDay?.summaryText || '',
      route,
      // We don't have timestamps for server route points easily here, 
      // so we use the day's date as a baseline if needed.
    };
  });
}

function buildEmptyRealTripDays(startDate?: string, endDate?: string): TripDay[] {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [
      {
        id: 'day1',
        label: 'DAY 1',
        dateLabel: '--.--',
        distanceKm: 0,
        summary: '',
        route: [],
      },
    ];
  }

  const normalizedStart = new Date(start);
  const normalizedEnd = new Date(end);
  normalizedStart.setHours(0, 0, 0, 0);
  normalizedEnd.setHours(0, 0, 0, 0);

  const diffDays =
    Math.max(
      1,
      Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );

  return Array.from({ length: diffDays }, (_, index) => {
    const targetDate = new Date(normalizedStart);
    targetDate.setDate(normalizedStart.getDate() + index);

    return {
      id: `day${index + 1}` as DayKey,
      label: `DAY ${index + 1}`,
      dateLabel: formatDayTabLabel(targetDate),
      distanceKm: 0,
      summary: '',
      route: [],
    };
  });
}

const CONTRIBUTOR_COLORS = ['#5E8B7E', '#C96C50', '#6A7FDB', '#D19A32', '#8F5FB5', '#3F8C87'];

const getContributorColor = (userId: string) => {
  let seed = 0;

  for (let index = 0; index < userId.length; index += 1) {
    seed = (seed + userId.charCodeAt(index)) % CONTRIBUTOR_COLORS.length;
  }

  return CONTRIBUTOR_COLORS[seed];
};

const buildPhotoChipLabel = (photoCount: number) => `photo ${photoCount}`;

const replacePhotoChip = (chips: string[] | undefined, photoCount: number) => {
  const nextChips = (chips ?? []).filter((chip) => !chip.startsWith('photo '));
  if (photoCount > 0) {
    nextChips.push(buildPhotoChipLabel(photoCount));
  }

  return nextChips;
};

const getEventDisplayTitle = (event: TimelineEvent) => event.title || event.placeName || 'Trip event';

const shouldShowEventPlaceName = (event: TimelineEvent) =>
  Boolean(event.placeName) && event.placeName !== getEventDisplayTitle(event);

function buildRealTripEvents(
  timelineDays: TimelineDayDetail[],
  eventDetailsById: Record<string, EventDetail>,
  photoDetailsById: Record<string, PhotoDetail>,
  memberMap: Record<string, TripMemberItem>,
  currentUserId?: string | null,
  currentUserNickname?: string | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  timelineDays.forEach((timelineDay, dayIndex) => {
    const dayKey = `day${dayIndex + 1}` as DayKey;

    timelineDay.events
      .filter((event) => !event.hidden)
      .forEach((event) => {
        const eventDetail = eventDetailsById[event.eventId];
        const visiblePhotos = (eventDetail?.photos ?? [])
          .map((eventPhoto) => {
            const photoDetail = photoDetailsById[eventPhoto.photoId];
            if (!photoDetail || photoDetail.isExcluded) {
              return null;
            }

            return {
              photoId: eventPhoto.photoId,
              sortOrder: eventPhoto.sortOrder,
              source: photoDetail.thumbnailUrl || photoDetail.originalUrl,
              memo: photoDetail.myMemo?.content,
              contributorId: photoDetail.ownerUserId,
            };
          })
          .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
          .sort((left, right) => left.sortOrder - right.sortOrder);
        const contributorIds = Array.from(new Set(visiblePhotos.map((photo) => photo.contributorId).filter(Boolean)));
        const photoContributors = contributorIds.map((userId) => {
          const matchedMember = memberMap[userId];
          const fallbackName = userId === currentUserId ? currentUserNickname : null;

          return {
            id: userId,
            name: matchedMember?.nickname ?? fallbackName ?? '여행 메이트',
            color: getContributorColor(userId),
          };
        });
        const hasPhotos = visiblePhotos.length > 0;
        const eventType = eventDetail?.eventType ?? event.eventType;
        const startAt = eventDetail?.startAt ?? event.startAt;
        const endAt = eventDetail?.endAt ?? event.endAt;
        const placeName = eventDetail?.placeName ?? event.placeName ?? undefined;

        events.push({
          id: event.eventId,
          day: dayKey,
          type: hasPhotos ? 'photo' : 'location',
          time: formatTimeLabel(startAt ?? endAt),
          title: eventDetail?.title || event.title || '',
          subtitle: hasPhotos ? '' : placeName ?? '',
          placeName,
          placeProvider: eventDetail?.placeProvider ?? event.placeProvider ?? undefined,
          providerPlaceId: eventDetail?.providerPlaceId ?? event.providerPlaceId ?? undefined,
          chips: [eventType, hasPhotos ? buildPhotoChipLabel(visiblePhotos.length) : null].filter(Boolean) as string[],
          eventMemo: eventDetail?.myMemo?.content?.trim() || undefined,
          photoContributors: hasPhotos ? photoContributors : undefined,
          photoUrls: hasPhotos ? visiblePhotos.map((photo) => String(photo.source)) : [],
          photoItems: hasPhotos
            ? visiblePhotos.map((photo) => ({
                id: photo.photoId,
                source: photo.source,
                memo: photo.memo,
                contributorId: photo.contributorId,
              }))
            : undefined,
          coordinate:
            eventDetail?.centerLatitude != null && eventDetail?.centerLongitude != null
              ? [eventDetail.centerLongitude, eventDetail.centerLatitude]
              : undefined,
        });
      });
  });

  return events;
}

function appendRealExpenseEvents(
  events: TimelineEvent[],
  timelineDays: TimelineDayDetail[],
  expenses: Awaited<ReturnType<typeof getTripExpensesApi>>['data']['items'],
  memberMap: Record<string, TripMemberItem>,
  currentUserId?: string | null,
  currentUserNickname?: string | null,
) {
  const dayIndexByDate = new Map(timelineDays.map((day, index) => [day.dayDate, index]));

  expenses.forEach((expense) => {
    const expenseDate = expense.paidAt?.slice(0, 10);
    const dayIndex = expenseDate && dayIndexByDate.has(expenseDate) ? dayIndexByDate.get(expenseDate)! : 0;
    const payerFallbackName = expense.payerUserId === currentUserId ? currentUserNickname : null;
    const payerName = memberMap[expense.payerUserId]?.nickname ?? payerFallbackName ?? '여행 메이트';
    events.push({
      id: `expense-${expense.expenseId}`,
      day: `day${dayIndex + 1}` as DayKey,
      type: 'payment',
      time: formatTimeLabel(expense.paidAt),
      title: expense.merchantName || 'Expense',
      subtitle: expense.category || 'Trip expense',
      amount: formatWon(expense.totalAmount),
      chips: [expense.category, expense.sourceType].filter(Boolean),
      paymentStatus: 'confirmed',
      paymentCardName: expense.sourceType || undefined,
      paymentPayerName: payerName,
      paymentPayerUserId: expense.payerUserId,
      paymentSplitLabel: expense.splitType === 'EQUAL' ? '균등 분할' : expense.splitType || undefined,
      paymentExpenseId: expense.expenseId,
      paymentParticipantUserIds: expense.participantUserIds ?? [],
      paymentSplitType: 'equal',
      eventMemo: `${expense.currencyCode} ${expense.totalAmount.toLocaleString('ko-KR')}`,
    });
  });

  return [...events].sort((left, right) => {
    const leftDay = Number(left.day.replace('day', ''));
    const rightDay = Number(right.day.replace('day', ''));
    if (leftDay !== rightDay) {
      return leftDay - rightDay;
    }

    return left.time.localeCompare(right.time);
  });
}

function RealTripRecordingScreen({
  reportRoute = '/trip/report',
}: {
  reportRoute?: '/trip/report' | '/trip/mock-report';
}) {
  const router = useRouter();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const photoPagerRef = useRef<ScrollView | null>(null);
  const cardPositionsRef = useRef<Record<string, number>>({});
  const scrollY = useRef(new Animated.Value(0)).current;
  const [tripEvents, setTripEvents] = useState<TimelineEvent[]>([]);
  const [tripMembers, setTripMembers] = useState<TripMemberItem[]>([]);
  const params = useLocalSearchParams();
  const endTrip = useTripStore((state) => state.endTrip);
  const clearTrip = useTripStore((state) => state.clearTrip);
  const clearReviewTrip = useTripStore((state) => state.clearReviewTrip);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const reviewTrip = useTripStore((state) => state.reviewTrip);
  const currentTripId = useTripStore((state) => state.currentTripId);
  const activeTrip = useTripStore((state) => state.activeTrip);
  const setActiveTrip = useTripStore((state) => state.setActiveTrip);
  const routeRefreshKey = useTripStore((state) => state.routeRefreshKey);
  const locationSyncStatus = useTripStore((state) => state.locationSyncStatus);
  const locationSyncMessage = useTripStore((state) => state.locationSyncMessage);
  const locationSyncUpdatedAt = useTripStore((state) => state.locationSyncUpdatedAt);
  const setLocationSyncState = useTripStore((state) => state.setLocationSyncState);
  const resetLocationSyncState = useTripStore((state) => state.resetLocationSyncState);
  const currentUserId = useUserStore((state) => state.profile?.userId);
  const currentUserNickname = useUserStore((state) => state.profile?.nickname ?? null);
  const removeTrip = useTripStore((state) => state.removeTrip);
  const fetchTrips = useTripStore((state) => state.fetchTrips);

  const [activeFilter, setActiveFilter] = useState<DayFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [loadedTripDetail, setLoadedTripDetail] = useState<TripDetail | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ eventId: string; photoIndex: number } | null>(null);
  const [photoViewerWidth, setPhotoViewerWidth] = useState(0);
  const [eventEditor, setEventEditor] = useState<{ eventId: string; title: string; placeName: string; body: string } | null>(null);
  const [photoEditor, setPhotoEditor] = useState<{ eventId: string; photoId: string; memo: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<
    | { kind: 'event'; eventId: string; expenseId?: string; title: string; message: string }
    | { kind: 'photo'; eventId: string; photoId: string; title: string; message: string }
    | null
  >(null);
  const [paymentImportDialog, setPaymentImportDialog] = useState<{
    mode: PaymentDialogMode;
    eventId: string;
    expenseId: string;
    payerUserId: string;
    selectedMemberUserIds: string[];
    memo: string;
  } | null>(null);
  const [emotionPicker, setEmotionPicker] = useState<{
    eventId: string;
    selectedEmoji?: string;
    selectedLabel?: string;
  } | null>(null);
  const settings = useUserStore((state) => state.settings);
  const { showPhotoPins, showPaymentPins } = settings;
  const updateSettings = useUserStore((state) => state.updateSettings);
  const [realTripDays, setRealTripDays] = useState<TripDay[] | null>(null);
  const [sessionTrail, setSessionTrail] = useState<LocationLog[]>([]);
  const [liveCurrentLocation, setLiveCurrentLocation] = useState<Coordinate | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{
    kind: ActionConfirmKind;
    title: string;
    description: string;
    confirmLabel: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [initialCurrentLocation, setInitialCurrentLocation] = useState<Coordinate | null>(null);
  const [syncToast, setSyncToast] = useState<{ status: LocationSyncStatus; message: string } | null>(null);
  const syncToastOpacity = useRef(new Animated.Value(0)).current;
  const syncToastTranslateY = useRef(new Animated.Value(-14)).current;
  const syncToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // -- Map Matching states --
  const [matchedSessionTrail, setMatchedSessionTrail] = useState<Coordinate[]>([]);
  const lastMatchedIndexRef = useRef(0);
  const isMatchingRef = useRef(false);
  // -------------------------

  const autoPhotoSyncInFlightRef = useRef(false);
  const autoPhotoSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoPhotoSyncAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const stopAutoPhotoSync = useCallback(() => {
    autoPhotoSyncInFlightRef.current = false;
    lastAutoPhotoSyncAtRef.current = 0;
    if (autoPhotoSyncTimerRef.current) {
      clearInterval(autoPhotoSyncTimerRef.current);
      autoPhotoSyncTimerRef.current = null;
    }
  }, []);
  const isReviewMode = params.mode === 'review';
  const displayTrip = isReviewMode ? reviewTrip ?? currentTrip : currentTrip;

  const tripDays = useMemo(() => {
    return realTripDays ?? buildEmptyRealTripDays(displayTrip?.startDate, displayTrip?.endDate);
  }, [displayTrip?.endDate, displayTrip?.startDate, realTripDays]);

  const filteredDays = useMemo(() => getFilteredDays(activeFilter, tripDays), [activeFilter, tripDays]);
  const filteredEvents = useMemo(
    () => tripEvents.filter((event) => activeFilter === 'all' || event.day === activeFilter),
    [activeFilter, tripEvents]
  );
  const routeOnlyMode = !showPhotoPins && !showPaymentPins;
  const filteredMapEvents = useMemo(
    () =>
      filteredEvents.filter((event) => {
        if (!event.coordinate || routeOnlyMode) {
          return false;
        }

        if (event.type === 'photo') {
          return showPhotoPins;
        }

        if (event.type === 'payment') {
          return showPaymentPins;
        }

        return false;
      }),
    [filteredEvents, showPaymentPins, showPhotoPins, routeOnlyMode]
  );

  const routeCoordinates = useMemo(() => {
    const serverRoute = filteredDays.flatMap((day) => day.route);
    // Only append session trail if we are looking at 'all' or the last day
    if (activeFilter === 'all' || activeFilter === `day${tripDays.length}`) {
      // Show already matched trail + raw points that haven't been matched yet
      const rawTrailCoords = sessionTrail.slice(lastMatchedIndexRef.current).map(l => [l.longitude, l.latitude] as Coordinate);
      return [...serverRoute, ...matchedSessionTrail, ...rawTrailCoords];
    }
    return serverRoute;
  }, [activeFilter, filteredDays, sessionTrail, matchedSessionTrail, tripDays.length]);

  const currentLocationCoordinate = useMemo(
    () => liveCurrentLocation ?? initialCurrentLocation,
    [initialCurrentLocation, liveCurrentLocation]
  );

  const routeShape = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: routeCoordinates },
    }),
    [routeCoordinates]
  );

  const eventFeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: filteredMapEvents.map((event) => {
        const theme = EVENT_THEME[event.type];

        return {
          type: 'Feature' as const,
          id: event.id,
          properties: {
            eventId: event.id,
            type: event.type,
            accent: theme.accent,
            selected: selectedEventId === event.id ? 1 : 0,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: event.coordinate as Coordinate,
          },
        };
      }),
    }),
    [filteredMapEvents, selectedEventId]
  );

  const summaryStats = useMemo(
    () => {
      const totalDistance = calculateDistance(routeCoordinates);
      
      return {
        totalDistanceLabel: `${totalDistance.toFixed(1)}km`,
        visitedPlaceCount: filteredEvents.filter((event) => Boolean(event.coordinate)).length,
        photoCount: filteredEvents.reduce((sum, event) => sum + (event.photoItems?.length ?? 0), 0),
        paymentCount: filteredEvents.filter((event) => event.type === 'payment').length,
      };
    },
    [activeFilter, filteredDays, filteredEvents, sessionTrail, tripDays.length]
  );
  const selectedPhotoEvent = useMemo(
    () => filteredEvents.find((event) => event.id === photoViewer?.eventId) ?? null,
    [filteredEvents, photoViewer]
  );
  const selectedPhotoItem = selectedPhotoEvent?.photoItems?.[photoViewer?.photoIndex ?? -1] ?? null;
  const selectedPhotoItems = selectedPhotoEvent?.photoItems ?? [];
  const selectedPhotoEmotion =
    selectedPhotoEvent?.emotionOwnerId === currentUserId && selectedPhotoEvent?.emotionEmoji && selectedPhotoEvent?.emotionLabel
      ? `${selectedPhotoEvent.emotionEmoji} ${selectedPhotoEvent.emotionLabel}`
      : null;
  const mapHeight = scrollY.interpolate({
    inputRange: [0, MAP_COLLAPSE_DISTANCE],
    outputRange: [MAX_MAP_HEIGHT, MIN_MAP_HEIGHT],
    extrapolate: 'clamp',
  });
  const mapRadius = scrollY.interpolate({
    inputRange: [0, MAP_COLLAPSE_DISTANCE],
    outputRange: [32, 24],
    extrapolate: 'clamp',
  });
  const panelLift = scrollY.interpolate({
    inputRange: [0, MAP_COLLAPSE_DISTANCE],
    outputRange: [0, -145],
    extrapolate: 'clamp',
  });
  const routeTripId = typeof params.tripId === 'string' ? params.tripId.trim() : '';
  const storeTripId = isReviewMode ? reviewTrip?.tripId ?? currentTrip?.tripId ?? '' : currentTripId ?? currentTrip?.tripId ?? '';
  const activeTripId = (routeTripId || storeTripId || '').trim();
  const tripTitle = (displayTrip as { title?: string; tripName?: string } | null)?.title || displayTrip?.tripName || 'Trip';
  const isTripOwner = Boolean(
    loadedTripDetail?.ownerUserId && currentUserId && loadedTripDetail.ownerUserId === currentUserId,
  );
  const recordingStatusText = isReviewMode ? '기록완료' : '기록중';
  const canUseActiveTripActions = !isReviewMode && loadedTripDetail?.status === 'ACTIVE';
  const canEndActiveTrip = canUseActiveTripActions && isTripOwner;

  const syncActionInFlight =
    isSyncing || locationSyncStatus === 'uploading' || locationSyncStatus === 'processing';
  const syncStatusMeta: Record<LocationSyncStatus, { icon: keyof typeof MaterialIcons.glyphMap; tint: string; surface: string }> = {
    idle: { icon: 'info-outline', tint: '#5F6E65', surface: '#EFF3EE' },
    uploading: { icon: 'cloud-upload', tint: '#2362A8', surface: '#E8F2FF' },
    processing: { icon: 'schedule', tint: '#8A5A11', surface: '#FFF3DD' },
    completed: { icon: 'check-circle', tint: '#2F7A47', surface: '#EAF6EE' },
    failed: { icon: 'error-outline', tint: '#B25543', surface: '#FDEEEA' },
  };
  const syncToastMeta = syncToast ? syncStatusMeta[syncToast.status] : null;
  const memberNameByUserId = useMemo(
    () =>
      Object.fromEntries(
        tripMembers.map((member) => [member.userId, member.nickname] as const),
      ) as Record<string, string>,
    [tripMembers],
  );

  const updateRealTimelinePhotoMemo = useCallback((eventId: string, photoId: string, memo?: string) => {
    setTripEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId || !event.photoItems) {
          return event;
        }

        return {
          ...event,
          photoItems: event.photoItems.map((photo) =>
            photo.id === photoId
              ? {
                  ...photo,
                  memo,
                }
              : photo,
          ),
        };
      }),
    );
  }, []);

  const removeRealTimelinePhoto = useCallback((eventId: string, photoId: string) => {
    setTripEvents((prev) =>
      prev.flatMap((event) => {
        if (event.id !== eventId || !event.photoItems) {
          return [event];
        }

        const nextPhotoItems = event.photoItems.filter((photo) => photo.id !== photoId);
        if (nextPhotoItems.length === 0 && event.chips?.[0] === 'OTHER') {
          return [];
        }

        const nextContributorIds = new Set(nextPhotoItems.map((photo) => photo.contributorId).filter(Boolean));

        return [
          {
            ...event,
            type: nextPhotoItems.length > 0 ? 'photo' : 'location',
            chips: replacePhotoChip(event.chips, nextPhotoItems.length),
            photoItems: nextPhotoItems.length > 0 ? nextPhotoItems : undefined,
            photoUrls: nextPhotoItems.length > 0 ? nextPhotoItems.map((photo) => String(photo.source)) : undefined,
            photoContributors:
              nextPhotoItems.length > 0
                ? event.photoContributors?.filter((contributor) => nextContributorIds.has(contributor.id))
                : undefined,
          },
        ];
      }),
    );
  }, []);

  const updateRealTimelineEvent = useCallback(
    (eventId: string, updates: Partial<Pick<TimelineEvent, 'title' | 'placeName' | 'subtitle' | 'eventMemo'>>) => {
      setTripEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? {
                ...event,
                ...updates,
              }
            : event,
        ),
      );
    },
    [],
  );

  const removeRealTimelineEvent = useCallback((eventId: string) => {
    setTripEvents((prev) => prev.filter((event) => event.id !== eventId));
  }, []);

  const updateRealExpenseEvent = useCallback(
    (
      eventId: string,
      updates: Partial<
        Pick<
          TimelineEvent,
          | 'paymentPayerName'
          | 'paymentPayerUserId'
          | 'paymentParticipantNames'
          | 'paymentParticipantUserIds'
          | 'paymentSplitLabel'
          | 'eventMemo'
        >
      >,
    ) => {
      setTripEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? {
                ...event,
                ...updates,
              }
            : event,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const loadInitialCurrentLocation = async () => {
      try {
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        if (isMounted && loc) {
          setInitialCurrentLocation([loc.coords.longitude, loc.coords.latitude]);
        }
      } catch (error) {
        console.warn('Failed to load initial current location:', error);
      }
    };

    void loadInitialCurrentLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (routeCoordinates.length < 2) {
      return;
    }

    if (!currentLocationCoordinate) {
      return;
    }

    const { northEast, southWest } = getBounds(routeCoordinates);
    cameraRef.current?.fitBounds(northEast, southWest, 56, 900);
  }, [currentLocationCoordinate, routeCoordinates]);

  useEffect(() => {
    if (!activeTripId) {
      setTripEvents([]);
      setRealTripDays(null);
      setTripMembers([]);
      setLoadedTripDetail(null);
      return;
    }

    let cancelled = false;

    const loadRealTripData = async () => {
      try {
        const [tripDetailResponse, timelineDaysResponse, expensesResponse, tripMembersResponse] = await Promise.all([
          getTripDetailApi(activeTripId),
          getTripTimelineDaysApi(activeTripId),
          getTripExpensesApi(activeTripId),
          getTripMembersApi(activeTripId),
        ]);

        const timelineDays = (await Promise.all(
          timelineDaysResponse.data.timelineDays.map(async (timelineDay) => {
            try {
              const detailResponse = await getTimelineDayDetailApi(timelineDay.timelineDayId);
              return detailResponse.success ? detailResponse.data : null;
            } catch (e) {
              console.warn(`Failed to fetch detail for day ${timelineDay.timelineDayId}`, e);
              return null;
            }
          }),
        )).filter((d): d is TimelineDayDetail => Boolean(d));
        const eventDetails = await Promise.all(
          timelineDays.flatMap((timelineDay) =>
            timelineDay.events
              .filter((event) => !event.hidden)
              .map(async (event) => {
                const detailResponse = await getEventDetailApi(event.eventId);
                return detailResponse.success ? detailResponse.data : null;
              }),
          ),
        );
        const validEventDetails = eventDetails.filter((eventDetail): eventDetail is EventDetail => Boolean(eventDetail));
        const uniquePhotoIds = Array.from(
          new Set(validEventDetails.flatMap((eventDetail) => eventDetail.photos.map((photo) => photo.photoId))),
        );
        const photoDetails = await Promise.all(
          uniquePhotoIds.map(async (photoId) => {
            const photoDetailResponse = await getPhotoDetailApi(photoId);
            return photoDetailResponse.success ? photoDetailResponse.data : null;
          }),
        );
        const routeByDate = new Map<string, Coordinate[]>();
        const uniqueDates = Array.from(new Set([
          ...timelineDays.map(d => d.dayDate),
          new Date().toISOString().split('T')[0]
        ]));

        await Promise.all(
          uniqueDates.map(async (date) => {
            try {
              const routeResponse = await getTripRouteByDayApi(activeTripId, date);
              if (routeResponse.success) {
                routeByDate.set(date, normalizeRouteCoordinates(routeResponse.data.routeDays));
              }
            } catch (e) {
              console.warn(`Failed to fetch route for date ${date}`, e);
            }
          })
        );

        if (cancelled) {
          return;
        }

        const eventDetailsById = Object.fromEntries(validEventDetails.map((eventDetail) => [eventDetail.eventId, eventDetail]));
        const photoDetailsById = Object.fromEntries(
          photoDetails
            .filter((photoDetail): photoDetail is PhotoDetail => Boolean(photoDetail))
            .map((photoDetail) => [photoDetail.photoId, photoDetail]),
        );
        const memberMap = tripMembersResponse.success
          ? Object.fromEntries(tripMembersResponse.data.items.map((member) => [member.userId, member]))
          : {};

        if (tripDetailResponse.success) {
          setLoadedTripDetail(tripDetailResponse.data);
          if (!isReviewMode && tripDetailResponse.data.status !== 'ACTIVE') {
            setActiveTrip(tripDetailResponse.data);
            router.replace({
              pathname: '/trip/recording',
              params: { mode: 'review', tripId: activeTripId },
            });
            return;
          }

          if (!isReviewMode) {
            setActiveTrip(tripDetailResponse.data);
          }
        }
        setTripMembers(tripMembersResponse.success ? tripMembersResponse.data.items : []);
        setRealTripDays(buildRealTripDays(
          timelineDays, 
          routeByDate, 
          activeTripId, 
          tripDetailResponse.data?.startDate,
          tripDetailResponse.data?.endDate
        ));
        setTripEvents(
          appendRealExpenseEvents(
            buildRealTripEvents(
              timelineDays,
              eventDetailsById,
              photoDetailsById,
              memberMap,
              currentUserId,
              currentUserNickname,
            ),
            timelineDays,
            expensesResponse?.data?.items ?? [],
            memberMap,
            currentUserId,
            currentUserNickname,
          ),
        );
        
        // Prune session trail based on the last synced log.
        const lastSyncedUuid = useTripStore.getState().lastSyncedLogUuid;
        if (lastSyncedUuid) {
          setSessionTrail(prev => {
            const syncedIndex = prev.findIndex(l => l.clientLogUuid === lastSyncedUuid);
            if (syncedIndex !== -1) {
              return prev.slice(syncedIndex + 1);
            }
            return prev;
          });
          // Reset matched trail so it starts fresh from the pruned session trail
          setMatchedSessionTrail([]);
          lastMatchedIndexRef.current = 0;
        } else {
          // Fallback to time-based pruning if no UUID (e.g. initial load)
          setSessionTrail(prev => {
            const twoMinsAgo = new Date(Date.now() - 120000).toISOString();
            return prev.filter(l => l.recordedAt > twoMinsAgo);
          });
          setMatchedSessionTrail([]);
          lastMatchedIndexRef.current = 0;
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to load real trip data', error);
        setLoadedTripDetail(null);
        setRealTripDays(null);
        setTripEvents([]);
        setTripMembers([]);
        Alert.alert('Trip data load failed', 'Could not load real trip data.');
      }
    };

    void loadRealTripData();

    return () => {
      cancelled = true;
    };
  }, [activeTripId, currentUserId, currentUserNickname, isReviewMode, routeRefreshKey, setActiveTrip]);


  useEffect(() => {
    if (selectedEventId && !filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);

  useEffect(() => {
    const unsubscribe = locationService.subscribe((location) => {
      const coord: Coordinate = [location.longitude, location.latitude];
      setLiveCurrentLocation(coord);
      if (!isReviewMode) {
        setSessionTrail((prev) => {
          // Avoid duplicates
          if (prev.length > 0 && prev[prev.length - 1].recordedAt === location.recordedAt) return prev;
          return [...prev, location];
        });
      }
    });

    if (!isReviewMode && activeTripId) {
      locationService.startAutoSync(activeTripId);
      
      const refreshPendingLogs = () => {
        locationService.getPendingLogs().then((logs) => {
          setSessionTrail((prev) => {
            const combined = [...logs, ...prev];
            const unique = Array.from(new Map(combined.map(l => [l.recordedAt, l])).values())
              .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
            return unique;
          });
        });
      };

      // Initial load
      refreshPendingLogs();

      // Refresh when app comes to foreground
      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          refreshPendingLogs();
        }
      });

      return () => {
        unsubscribe();
        locationService.stopAutoSync();
        appStateSub.remove();
      };
    }

    return () => {
      unsubscribe();
      locationService.stopAutoSync();
    };
  }, [activeTripId, isReviewMode]);

  useEffect(() => {
    if (isReviewMode || !activeTripId || isMatchingRef.current) {
      return;
    }

    const rawCoords = sessionTrail.map(l => [l.longitude, l.latitude] as Coordinate);
    const unMatchedCount = rawCoords.length - lastMatchedIndexRef.current;

    // Minimum 3 points to match, and at least 5 new points since last match
    if (unMatchedCount < 5) {
      return;
    }

    const processMatching = async () => {
      isMatchingRef.current = true;
      try {
        // Take up to 100 points for matching (Mapbox limit)
        // We overlap by 1 point to ensure continuity
        const startIndex = Math.max(0, lastMatchedIndexRef.current - 1);
        const chunkToMatch = rawCoords.slice(startIndex, startIndex + 100);
        
        if (chunkToMatch.length < 2) {
          isMatchingRef.current = false;
          return;
        }

        try {
          const matched = await matchMapTrace(chunkToMatch, 'walking');
          if (matched && matched.length > 0) {
            setMatchedSessionTrail(prev => {
              const nextBase = startIndex === 0 ? [] : prev;
              return [...nextBase, ...matched];
            });
          } else {
            // Fallback: use raw points if matching fails (e.g. non-road path like a train)
            setMatchedSessionTrail(prev => {
              const nextBase = startIndex === 0 ? [] : prev;
              return [...nextBase, ...chunkToMatch];
            });
          }
          // Advance index regardless to avoid infinite retries of failing segments
          lastMatchedIndexRef.current = startIndex + chunkToMatch.length;
        } catch (error) {
          console.warn('[Map Matching] Failed to match segment, falling back to raw:', error);
          setMatchedSessionTrail(prev => {
            const nextBase = startIndex === 0 ? [] : prev;
            return [...nextBase, ...chunkToMatch];
          });
          lastMatchedIndexRef.current = startIndex + chunkToMatch.length;
        }
      } finally {
        isMatchingRef.current = false;
      }
    };

    void processMatching();
  }, [sessionTrail, activeTripId, isReviewMode]);

  useEffect(() => {
    if (activeFilter !== 'all' && !tripDays.some((day) => day.id === activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, tripDays]);


  useEffect(() => {
    if (photoViewer && (!selectedPhotoEvent || !selectedPhotoItem)) {
      setPhotoViewer(null);
    }
  }, [photoViewer, selectedPhotoEvent, selectedPhotoItem]);

  useEffect(() => {
    if (!photoViewer || !photoPagerRef.current || photoViewerWidth <= 0) {
      return;
    }

    photoPagerRef.current.scrollTo({
      x: photoViewer.photoIndex * photoViewerWidth,
      animated: false,
    });
  }, [photoViewer, photoViewerWidth]);

  const handlePhotoPagerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!photoViewer || photoViewerWidth <= 0) {
        return;
      }

      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / photoViewerWidth);
      if (nextIndex === photoViewer.photoIndex) {
        return;
      }

      const maxIndex = Math.max(0, selectedPhotoItems.length - 1);
      setPhotoViewer({
        eventId: photoViewer.eventId,
        photoIndex: Math.min(Math.max(nextIndex, 0), maxIndex),
      });
    },
    [photoViewer, photoViewerWidth, selectedPhotoItems.length],
  );

  useEffect(() => {
    return () => {
      if (syncToastTimerRef.current) {
        clearTimeout(syncToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (syncToastTimerRef.current) {
      clearTimeout(syncToastTimerRef.current);
      syncToastTimerRef.current = null;
    }

    if (!locationSyncMessage || locationSyncStatus === 'idle') {
      Animated.parallel([
        Animated.timing(syncToastOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(syncToastTranslateY, {
          toValue: -14,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setSyncToast(null);
        }
      });
      return;
    }

    setSyncToast({ status: locationSyncStatus, message: locationSyncMessage });
    Animated.parallel([
      Animated.timing(syncToastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(syncToastTranslateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    if (locationSyncStatus === 'completed' || locationSyncStatus === 'failed') {
      syncToastTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(syncToastOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(syncToastTranslateY, {
            toValue: -14,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            setSyncToast(null);
            resetLocationSyncState();
          }
        });
      }, 2200);
    }
  }, [
    locationSyncMessage,
    locationSyncStatus,
    locationSyncUpdatedAt,
    resetLocationSyncState,
    syncToastOpacity,
    syncToastTranslateY,
  ]);

  const syncTripPhotosOnly = useCallback(
    async ({ showStatus = false }: { showStatus?: boolean } = {}): Promise<{ outcome: PhotoSyncOutcome; syncedCount: number }> => {
      if (!activeTripId) {
        return { outcome: 'failed', syncedCount: 0 };
      }

      try {
        const photoPermission = await requestTripPhotoPermission();

        if (!photoPermission.granted) {
          return { outcome: 'skipped_permission', syncedCount: 0 };
        }

        if (!photoPermission.mediaLocationGranted) {
          Alert.alert(
            '사진 위치 권한이 필요해요',
            '사진의 촬영 위치(EXIF)를 읽을 수 없어 여행 타임라인에 자동으로 반영할 수 없어요. 설정에서 사진 위치 권한을 허용해 주세요.',
            photoPermission.mediaLocationCanAskAgain
              ? [{ text: '확인' }]
              : [
                  { text: '나중에' },
                  {
                    text: '설정 열기',
                    onPress: () => {
                      void locationService.openLocationSettings();
                    },
                  },
                ],
          );
          return { outcome: 'skipped_permission', syncedCount: 0 };
        }

        if (!displayTrip?.startDate || !displayTrip?.endDate) {
          return { outcome: 'skipped_range', syncedCount: 0 };
        }

        if (showStatus) {
          setLocationSyncState('processing', '여행 사진을 동기화하는 중입니다.');
        }

        const photoResult = await syncTripPhotosForDateRange({
          tripId: activeTripId,
          tripStartedAt: (displayTrip as { startedAt?: string | null } | null)?.startedAt ?? null,
          startDate: displayTrip.startDate,
          endDate: displayTrip.endDate,
          syncRequestedAt: new Date().toISOString(),
        });

        if (!photoResult.success) {
          return { outcome: 'failed', syncedCount: 0 };
        }

        if (photoResult.syncedCount > 0) {
          useTripStore.getState().bumpRouteRefreshKey();
          return { outcome: 'synced', syncedCount: photoResult.syncedCount };
        }

        return { outcome: 'empty', syncedCount: 0 };
      } catch (error) {
        console.error('Failed to sync trip photos', error);
        return { outcome: 'failed', syncedCount: 0 };
      }
    },
    [activeTripId, displayTrip?.endDate, displayTrip?.startDate, setLocationSyncState],
  );

  const runAutoPhotoSync = useCallback(
    async (force = false) => {
      if (isReviewMode || !activeTripId || isSyncing || autoPhotoSyncInFlightRef.current) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastAutoPhotoSyncAtRef.current < AUTO_PHOTO_SYNC_INTERVAL_MS) {
        return;
      }

      autoPhotoSyncInFlightRef.current = true;
      lastAutoPhotoSyncAtRef.current = now;

      try {
        await syncTripPhotosOnly();
      } finally {
        autoPhotoSyncInFlightRef.current = false;
      }
    },
    [activeTripId, isReviewMode, isSyncing, syncTripPhotosOnly],
  );

  const syncTripAssets = useCallback(async () => {
    if (!activeTripId) {
      return false;
    }

    const photoResult = await syncTripPhotosOnly({ showStatus: true });
    const locationSynced = await locationService.syncLocations(activeTripId);

    if (!locationSynced) {
      return false;
    }

    if (photoResult.outcome === 'synced') {
      setLocationSyncState('completed', `위치 기록과 여행 사진 ${photoResult.syncedCount}장을 동기화했습니다.`);
      return true;
    }

    if (photoResult.outcome === 'failed') {
      setLocationSyncState('completed', '위치 기록은 동기화했고, 사진 동기화는 실패했습니다.');
      return true;
    }

    if (photoResult.outcome === 'skipped_permission') {
      setLocationSyncState('completed', '위치 기록은 동기화했고, 사진 권한이 없어 사진은 건너뛰었습니다.');
      return true;
    }

    if (photoResult.outcome === 'skipped_range') {
      setLocationSyncState('completed', '위치 기록은 동기화했고, 여행 기간 정보가 없어 사진은 건너뛰었습니다.');
      return true;
    }

    setLocationSyncState('completed', '위치 기록 동기화가 완료되었습니다. 새로 가져올 여행 사진은 없습니다.');
    return true;
  }, [activeTripId, setLocationSyncState, syncTripPhotosOnly]);

  const handleManualSync = async () => {
    if (!activeTripId) {
      Alert.alert('진행 중인 여행이 없어요', '동기화할 여행 정보를 찾지 못했습니다.');
      return;
    }

    try {
      setIsSyncing(true);
      await syncTripAssets();
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isReviewMode || !activeTripId) {
      if (autoPhotoSyncTimerRef.current) {
        clearInterval(autoPhotoSyncTimerRef.current);
        autoPhotoSyncTimerRef.current = null;
      }
      return;
    }

    void runAutoPhotoSync(false);

    autoPhotoSyncTimerRef.current = setInterval(() => {
      void runAutoPhotoSync(false);
    }, AUTO_PHOTO_SYNC_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if ((previousAppState === 'background' || previousAppState === 'inactive') && nextAppState === 'active') {
        void locationService.ensureForegroundCollector();
        void runAutoPhotoSync(false);
      }
    });

    return () => {
      appStateSubscription.remove();
      if (autoPhotoSyncTimerRef.current) {
        clearInterval(autoPhotoSyncTimerRef.current);
        autoPhotoSyncTimerRef.current = null;
      }
    };
  }, [activeTripId, isReviewMode, runAutoPhotoSync]);

  const handleOpenReport = () => {
    router.push(isReviewMode ? `${reportRoute}?mode=review` : reportRoute);
  };

  const handleEndTrip = () => {
    if (!activeTripId) {
      Alert.alert('진행 중인 여행이 없어요', '종료할 여행 정보를 찾지 못했습니다.');
      return;
    }

    setActionConfirm({
      kind: 'end',
      title: '여행을 종료할까요?',
      description: '현재까지 기록된 모든 경로가 저장됩니다.',
      confirmLabel: '종료하기',
    });
  };

  const handleLeaveTrip = () => {
    if (!activeTripId) {
      Alert.alert('진행 중인 여행이 없어요', '나갈 여행 정보를 찾지 못했습니다.');
      return;
    }

    if (isTripOwner) {
      Alert.alert('여행 떠나기 불가', '여행 생성자는 여행을 떠날 수 없습니다. 여행을 삭제해주세요.');
      return;
    }

    setActionConfirm({
      kind: 'leave',
      title: '여행에서 떠나시겠습니까?',
      description: '떠나면 이 여행의 진행 화면에서 나가게 됩니다.',
      confirmLabel: '떠나기',
    });
  };

  const handleDeleteTrip = () => {
    if (!activeTripId) {
      Alert.alert('진행 중인 여행이 없어요', '삭제할 여행 정보를 찾지 못했습니다.');
      return;
    }

    setActionConfirm({
      kind: 'delete',
      title: '여행을 삭제할까요?',
      description: '여행을 삭제하면 여행에 초대된 사람들의 여행도 삭제됩니다.\n정말로 여행을 삭제할 건가요?\n되돌릴 수 없습니다.',
      confirmLabel: '삭제하기',
    });
  };

  const handleConfirmAction = async () => {
    const currentAction = actionConfirm;
    setActionConfirm(null);
    setIsMenuOpen(false);

    if (!currentAction || isSubmittingAction) {
      return;
    }

    if (!activeTripId) {
      Alert.alert('진행 중인 여행이 없어요', '이 작업을 처리할 여행 정보를 찾지 못했습니다.');
      return;
    }

    setIsSubmittingAction(true);

    if (currentAction.kind === 'end') {
      try {
        setIsSyncing(true);
        stopAutoPhotoSync();
        await syncTripAssets();
        const response = await endTripApi(activeTripId);

        if (!response.success) {
          if (response.code === 'CONFLICT') {
            Alert.alert('여행 종료 불가', response.message || '이미 종료된 여행이거나 종료할 수 없는 상태입니다.');
            return;
          }

          Alert.alert('여행 종료 실패', response.message || '여행을 종료하지 못했습니다.');
          return;
        }

        await locationService.stopTracking();
        locationService.stopAutoSync();
        endTrip();
        void fetchTrips(true);
        router.replace(`${reportRoute}?mode=review`);
      } finally {
        setIsSyncing(false);
        setIsSubmittingAction(false);
      }
      return;
    }

    if (currentAction.kind === 'leave') {
      const response = await leaveTripApi(activeTripId);

      if (!response.success) {
        if (response.code === 'CONFLICT') {
          Alert.alert('여행 떠나기 불가', '여행 생성자는 여행을 떠날 수 없습니다. 여행을 삭제해주세요.');
          return;
        }

        Alert.alert('여행 떠나기 실패', response.message || '여행에서 나가지 못했습니다.');
        return;
      }

      InteractionManager.runAfterInteractions(() => {
        stopAutoPhotoSync();
        locationService.stopAutoSync();
        removeTrip(activeTripId);
        void fetchTrips(true);
        clearTrip();
        clearReviewTrip();
        router.replace('/(tabs)');
      });
      return;
    }

    const response = await deleteTripApi(activeTripId);

    if (!response.success) {
      Alert.alert('여행 삭제 실패', response.message || '여행을 삭제하지 못했습니다.');
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      stopAutoPhotoSync();
      locationService.stopAutoSync();
      removeTrip(activeTripId);
      void fetchTrips(true);
      clearTrip();
      clearReviewTrip();
      router.replace('/(tabs)');
    });
  };

  const handleMapReady = () => {
    setIsMapReady(true);
    setMapLoadFailed(false);
  };

  const handleEventLayout = (eventId: string, event: LayoutChangeEvent) => {
    cardPositionsRef.current[eventId] = event.nativeEvent.layout.y;
  };

  const focusEvent = (eventId: string) => {
    const targetEvent = filteredEvents.find((event) => event.id === eventId);
    if (!targetEvent?.coordinate) {
      return;
    }

    setSelectedEventId(eventId);
    cameraRef.current?.setCamera({
      centerCoordinate: targetEvent.coordinate,
      zoomLevel: 14.5,
      animationDuration: 700,
    });

    const y = cardPositionsRef.current[eventId];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(y + MAX_MAP_HEIGHT - 220, 0), animated: true });
    }
  };

  const handleMapLoadFailure = () => {
    setIsMapReady(false);
    setMapLoadFailed(true);
  };

  const toggleMapPreference = (key: MapFilterKey) => {
    updateSettings({ [key]: !settings[key] });
  };

  const toggleRouteOnlyMode = () => {
    if (routeOnlyMode) {
      updateSettings({
        showPhotoPins: true,
        showPaymentPins: true,
      });
      return;
    }

    updateSettings({
      showPhotoPins: false,
      showPaymentPins: false,
    });
  };

  const openEventEditor = (event: TimelineEvent) => {
    setEventEditor({
      eventId: event.id,
      title: event.title,
      placeName: event.placeName ?? '',
      body: event.eventMemo ?? event.subtitle ?? '',
    });
  };

  const saveEventEditor = async () => {
    if (!eventEditor) {
      return;
    }

    const originalEvent = tripEvents.find((event) => event.id === eventEditor.eventId);
    if (!originalEvent) {
      setEventEditor(null);
      return;
    }

    const nextBody = eventEditor.body.trim();
    const nextTitle = eventEditor.title.trim();
    const nextPlaceName = eventEditor.placeName.trim() || null;

    const eventResponse = await updateEventApi(eventEditor.eventId, {
      title: nextTitle,
      placeName: nextPlaceName,
    });

    if (!eventResponse.success) {
      Alert.alert('이벤트 수정 실패', eventResponse.message ?? '이벤트를 수정하지 못했어요.');
      return;
    }

    updateRealTimelineEvent(eventEditor.eventId, {
      title: nextTitle,
      placeName: nextPlaceName ?? undefined,
      subtitle: nextPlaceName ?? '',
    });

    if (nextBody.length > 0) {
      const memoResponse = await upsertEventMemoApi(eventEditor.eventId, {
        content: nextBody,
      });

      if (!memoResponse.success) {
        Alert.alert('메모 저장 실패', memoResponse.message ?? '이벤트 메모를 저장하지 못했어요.');
        setEventEditor(null);
        return;
      }

      updateRealTimelineEvent(eventEditor.eventId, {
        eventMemo: nextBody,
      });
    } else if (originalEvent.eventMemo) {
      Alert.alert('메모 삭제 미지원', '이벤트 메모 삭제는 아직 연결되지 않았어요. 제목과 장소만 수정했어요.');
    } else {
      updateRealTimelineEvent(eventEditor.eventId, {
        eventMemo: undefined,
      });
    }
    setEventEditor(null);
  };

  const confirmDeleteEvent = (event: TimelineEvent) => {
    setDeleteDialog({
      kind: 'event',
      eventId: event.id,
      expenseId: event.paymentExpenseId,
      title: event.type === 'payment' ? '이 비용을 삭제할까요?' : '이 이벤트를 삭제할까요?',
      message:
        event.type === 'payment'
          ? '삭제하면 여행 비용 목록과 타임라인에서 바로 사라져요.'
          : '삭제하면 타임라인과 지도에서 바로 사라져요.',
    });
  };

  const openPhotoEditor = (eventId: string, photoId: string, memo?: string) => {
    setPhotoEditor({ eventId, photoId, memo: memo ?? '' });
  };

  const savePhotoEditor = async () => {
    if (!photoEditor) {
      return;
    }

    const nextMemo = photoEditor.memo.trim();

    try {
      const response = nextMemo
        ? await upsertPhotoMemoApi(photoEditor.photoId, { content: nextMemo })
        : await deletePhotoMemoApi(photoEditor.photoId);

      if (!response.success) {
        Alert.alert('메모 저장 실패', response.message ?? '사진 메모를 저장하지 못했어요.');
        return;
      }

      updateRealTimelinePhotoMemo(photoEditor.eventId, photoEditor.photoId, nextMemo || undefined);
    } catch (error) {
      console.error('Failed to save real photo memo', error);
      Alert.alert('메모 저장 실패', '사진 메모를 저장하지 못했어요.');
      return;
    }

    setPhotoEditor(null);
  };

  const confirmDeletePhoto = (eventId: string, photoId: string, isOwner: boolean) => {
    if (!isOwner) {
      Alert.alert('삭제할 수 없어요', '내가 올린 사진만 삭제할 수 있어요.');
      return;
    }

    setDeleteDialog({
      kind: 'photo',
      eventId,
      photoId,
      title: '이 사진을 삭제할까요?',
      message: '사진 메모와 함께 목록에서 사라져요. 삭제 후에는 이 화면에서 되돌릴 수 없습니다.',
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog) {
      return;
    }

    if (deleteDialog.kind === 'event') {
      if (deleteDialog.expenseId) {
        try {
          const response = await deleteExpenseApi(deleteDialog.expenseId);
          if (!response.success) {
            Alert.alert('비용 삭제 실패', '비용을 삭제하지 못했어요.');
            return;
          }

          removeRealTimelineEvent(deleteDialog.eventId);
        } catch (error) {
          console.error('Failed to delete expense', error);
          Alert.alert('비용 삭제 실패', '비용을 삭제하지 못했어요.');
          return;
        }
      } else {
        const response = await updateEventApi(deleteDialog.eventId, { hidden: true });
        if (!response.success) {
          Alert.alert('이벤트 삭제 실패', response.message ?? '이벤트를 삭제하지 못했어요.');
          return;
        }

        removeRealTimelineEvent(deleteDialog.eventId);
      }

      if (photoViewer?.eventId === deleteDialog.eventId) {
        setPhotoViewer(null);
      }
      setDeleteDialog(null);
      return;
    }

    try {
      const response = await updatePhotoApi(deleteDialog.photoId, { isExcluded: true });
      if (!response.success) {
        Alert.alert('사진 삭제 실패', response.message ?? '사진을 제외하지 못했어요.');
        return;
      }

      removeRealTimelinePhoto(deleteDialog.eventId, deleteDialog.photoId);
    } catch (error) {
      console.error('Failed to exclude real photo', error);
      Alert.alert('사진 삭제 실패', '사진을 제외하지 못했어요.');
      return;
    }

    setPhotoViewer(null);
    setDeleteDialog(null);
  };

  const openPaymentImportDialog = async (event: TimelineEvent) => {
    if (!event.paymentExpenseId) {
      Alert.alert('비용 정보를 찾을 수 없어요', '다시 시도해 주세요.');
      return;
    }

    try {
      const response = await getExpenseDetailApi(event.paymentExpenseId);
      if (!response.success) {
        Alert.alert('비용 정보를 불러오지 못했어요', '다시 시도해 주세요.');
        return;
      }

      setPaymentImportDialog({
        mode: 'edit',
        eventId: event.id,
        expenseId: response.data.expenseId,
        payerUserId: response.data.payerUserId,
        selectedMemberUserIds:
          response.data.participantUserIds && response.data.participantUserIds.length > 0
            ? response.data.participantUserIds
            : tripMembers.map((member) => member.userId),
        memo: response.data.memo ?? '',
      });
    } catch (error) {
      console.error('Failed to load expense detail', error);
      Alert.alert('비용 정보를 불러오지 못했어요', '다시 시도해 주세요.');
      return;
    }
  };

  const togglePaymentMember = (memberUserId: string) => {
    setPaymentImportDialog((prev) => {
      if (!prev) {
        return prev;
      }

      const nextMembers = prev.selectedMemberUserIds.includes(memberUserId)
        ? prev.selectedMemberUserIds.filter((member) => member !== memberUserId)
        : [...prev.selectedMemberUserIds, memberUserId];

      return {
        ...prev,
        selectedMemberUserIds: nextMembers.length > 0 ? nextMembers : [memberUserId],
      };
    });
  };

  const confirmPaymentImport = async () => {
    if (!paymentImportDialog) {
      return;
    }

    if (paymentImportDialog.selectedMemberUserIds.length === 0) {
      Alert.alert('정산 대상이 필요해요', '함께 나누는 사람을 한 명 이상 선택해 주세요.');
      return;
    }

    try {
      const response = await updateExpenseApi(paymentImportDialog.expenseId, {
        payerUserId: paymentImportDialog.payerUserId,
        participantUserIds: paymentImportDialog.selectedMemberUserIds,
        memo: paymentImportDialog.memo.trim() || undefined,
      });

      if (!response.success) {
        Alert.alert('비용 수정 실패', '비용 정산 정보를 저장하지 못했어요.');
        return;
      }

      updateRealExpenseEvent(paymentImportDialog.eventId, {
        paymentPayerName: memberNameByUserId[paymentImportDialog.payerUserId] ?? '여행 메이트',
        paymentPayerUserId: paymentImportDialog.payerUserId,
        paymentParticipantUserIds: paymentImportDialog.selectedMemberUserIds,
        paymentParticipantNames: paymentImportDialog.selectedMemberUserIds.map(
          (memberUserId) => memberNameByUserId[memberUserId] ?? '여행 메이트',
        ),
        paymentSplitLabel: `${paymentImportDialog.selectedMemberUserIds.length}명 균등 분할`,
        eventMemo: paymentImportDialog.memo.trim() || undefined,
      });

      setPaymentImportDialog(null);
    } catch (error) {
      console.error('Failed to update expense', error);
      Alert.alert('비용 수정 실패', '비용 정산 정보를 저장하지 못했어요.');
    }
  };

  const openEmotionPicker = (event: TimelineEvent) => {
    Alert.alert('감정 기능 준비 중', '감정 기록은 아직 실데이터와 연결되지 않았어요.');
  };

  const selectEmotion = (_emoji: string, _label: string) => {
    if (!emotionPicker) {
      return;
    }

    Alert.alert('감정 기능 준비 중', '감정 기록은 아직 실데이터와 연결되지 않았어요.');
    setEmotionPicker(null);
  };

  const clearEmotion = () => {
    if (!emotionPicker) {
      return;
    }

    Alert.alert('감정 기능 준비 중', '감정 기록은 아직 실데이터와 연결되지 않았어요.');
    setEmotionPicker(null);
  };

  if (!activeTripId && !isReviewMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>吏꾪뻾 以묒씤 ?ы뻾???놁뒿?덈떎.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/trip/start?mode=create')}>
            <Text style={styles.primaryButtonText}>?ы뻾 ?쒖옉 ?붾㈃?쇰줈 ?대룞</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {syncToast && syncToastMeta ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.syncToastWrap,
            {
              opacity: syncToastOpacity,
              transform: [{ translateY: syncToastTranslateY }],
            },
          ]}
        >
          <View style={[styles.syncToastCard, { backgroundColor: syncToastMeta.surface }]}>
            <MaterialIcons name={syncToastMeta.icon} size={16} color={syncToastMeta.tint} />
            <Text style={[styles.syncToastText, { color: syncToastMeta.tint }]} numberOfLines={2}>
              {syncToast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={22} color="#17201A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{tripTitle}</Text>
            <View style={styles.recordingInline}>
              <View style={[styles.recordingDot, isReviewMode && styles.recordingDotCompleted]} />
              <Text style={[styles.recordingStatusText, isReviewMode && styles.recordingStatusTextCompleted]}>{recordingStatusText}</Text>
              <Text style={styles.recordingInlineText}>기록중</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.headerActionsTopRow}>
          {canUseActiveTripActions ? (
            <TouchableOpacity 
              style={[styles.syncHeaderButton, syncActionInFlight && styles.syncHeaderButtonDisabled]} 
              activeOpacity={0.88}
              onPress={handleManualSync}
              disabled={syncActionInFlight}
            >
              <MaterialIcons name={syncActionInFlight ? 'hourglass-top' : 'sync'} size={16} color="#274232" />
              <Text style={styles.syncHeaderButtonText}>{syncActionInFlight ? '동기화 중' : '동기화'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.moreButton} onPress={() => setIsMenuOpen((prev) => !prev)} activeOpacity={0.85}>
            <MaterialIcons name="more-horiz" size={22} color="#274232" />
          </TouchableOpacity>
          </View>
          {canUseActiveTripActions ? (
            <TouchableOpacity style={styles.hiddenAction} onPress={() => router.push('/trip/invite')} activeOpacity={0.88}>
              <MaterialIcons name="group-add" size={16} color="#274232" />
              <Text style={styles.inviteQuickButtonText}>친구 초대하기</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isMenuOpen ? (
        <Pressable style={styles.menuBackdrop} onPress={() => setIsMenuOpen(false)}>
          <View style={styles.menuCard}>
            {isReviewMode ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); handleOpenReport(); }} activeOpacity={0.85}>
                <MaterialIcons name="article" size={18} color="#244934" />
                <Text style={styles.menuItemText}>여행 리포트 확인</Text>
              </TouchableOpacity>
            ) : null}
            {isReviewMode && isTripOwner ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); handleDeleteTrip(); }} activeOpacity={0.85} disabled={isSubmittingAction}>
                <MaterialIcons name="delete-outline" size={18} color="#244934" />
                <Text style={styles.menuItemText}>여행 삭제</Text>
              </TouchableOpacity>
            ) : null}
            {isReviewMode && !isTripOwner ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); handleLeaveTrip(); }} activeOpacity={0.85} disabled={isSubmittingAction}>
                <MaterialIcons name="logout" size={18} color="#244934" />
                <Text style={styles.menuItemText}>여행 떠나기</Text>
              </TouchableOpacity>
            ) : null}
            {canUseActiveTripActions ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); router.push('/trip/invite'); }} activeOpacity={0.85}>
                <MaterialIcons name="group-add" size={18} color="#244934" />
                <Text style={styles.menuItemText}>친구 초대하기</Text>
              </TouchableOpacity>
            ) : null}
            {displayTrip?.tripId ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push({ pathname: '/trip/photo-album', params: { tripId: displayTrip.tripId } } as never);
                }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="photo-library" size={18} color="#244934" />
                <Text style={styles.menuItemText}>앨범 보기</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.menuItem, !canEndActiveTrip && styles.hiddenAction]} onPress={() => { setIsMenuOpen(false); handleEndTrip(); }} activeOpacity={0.85}>
              <MaterialIcons name="flag" size={18} color="#244934" />
              <Text style={styles.menuItemText}>여행 종료</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, (isTripOwner || !canUseActiveTripActions || isReviewMode) && styles.hiddenAction]} onPress={() => { setIsMenuOpen(false); handleLeaveTrip(); }} activeOpacity={0.85} disabled={isSubmittingAction}>
              <MaterialIcons name="logout" size={18} color="#244934" />
              <Text style={styles.menuItemText}>여행 떠나기</Text>
            </TouchableOpacity>
            {isTripOwner && !isReviewMode ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); handleDeleteTrip(); }} activeOpacity={0.85} disabled={isSubmittingAction}>
                <MaterialIcons name="delete-outline" size={18} color="#244934" />
                <Text style={styles.menuItemText}>여행 삭제</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.menuItem, !canUseActiveTripActions && styles.hiddenAction]} onPress={() => { setIsMenuOpen(false); router.push('/trip/start?mode=edit'); }} activeOpacity={0.85}>
              <MaterialIcons name="edit" size={18} color="#244934" />
              <Text style={styles.menuItemText}>여행 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); setIsInfoOpen(true); }} activeOpacity={0.85}>
              <MaterialIcons name="info-outline" size={18} color="#244934" />
              <Text style={styles.menuItemText}>안내</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      ) : null}

      <Modal visible={isInfoOpen} transparent animationType="fade" onRequestClose={() => setIsInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>여행 기록 안내</Text>
              <TouchableOpacity onPress={() => setIsInfoOpen(false)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color="#223428" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>
              GPS 기반 경로와 사진, 결제, 메모가 하나의 여행 흐름으로 정리됩니다.
            </Text>
            <Text style={styles.modalBody}>
              지도 위 필터를 이용해 표시 항목을 줄이거나 동선만 깔끔하게 볼 수 있어요.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(actionConfirm)} transparent animationType="fade" onRequestClose={() => setActionConfirm(null)}>
        <Pressable style={styles.actionConfirmBackdrop} onPress={() => setActionConfirm(null)}>
          <Pressable style={styles.actionConfirmCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.actionConfirmIconWrap}>
              <MaterialIcons
                name={actionConfirm?.kind === 'delete' ? 'delete-outline' : actionConfirm?.kind === 'leave' ? 'logout' : 'flag'}
                size={26}
                color={actionConfirm?.kind === 'delete' ? '#6E4336' : '#355D49'}
              />
            </View>
            <Text style={styles.actionConfirmTitle}>
              {actionConfirm?.kind === 'end'
                ? '여행을 종료할까요?'
                : actionConfirm?.kind === 'leave'
                  ? '여행에서 떠나시겠습니까?'
                  : '여행을 삭제할까요?'}
            </Text>
            <Text style={styles.actionConfirmDescription}>
              {actionConfirm?.kind === 'end'
                ? '현재까지 기록된 모든 경로가 저장됩니다.'
                : actionConfirm?.kind === 'leave'
                  ? '떠나면 이 여행의 진행 화면에서 나가게 됩니다.'
                  : '여행을 삭제하면 여행에 초대된 사람들의 여행도 삭제됩니다.\n정말로 여행을 삭제할 건가요?\n되돌릴 수 없습니다.'}
            </Text>
            <View style={styles.actionConfirmRow}>
              <TouchableOpacity style={styles.actionConfirmSecondaryButton} onPress={() => setActionConfirm(null)} activeOpacity={0.88}>
                <Text style={styles.actionConfirmSecondaryText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionConfirmPrimaryButton} onPress={handleConfirmAction} activeOpacity={0.88}>
                <Text style={styles.actionConfirmPrimaryText}>
                  {actionConfirm?.kind === 'end'
                    ? '종료하기'
                    : actionConfirm?.kind === 'leave'
                      ? '떠나기'
                      : '삭제하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(photoViewer && selectedPhotoEvent && selectedPhotoItem)} transparent animationType="fade" onRequestClose={() => setPhotoViewer(null)}>
        <Pressable style={styles.photoModalBackdrop} onPress={() => setPhotoViewer(null)}>
          <Pressable style={styles.photoModalViewport} onPress={() => undefined}>
            <View
              onLayout={(event) => {
                const nextWidth = Math.round(event.nativeEvent.layout.width);
                if (nextWidth > 0 && nextWidth !== photoViewerWidth) {
                  setPhotoViewerWidth(nextWidth);
                }
              }}
            >
              <ScrollView
                ref={photoPagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handlePhotoPagerMomentumEnd}
                scrollEventThrottle={16}
              >
                {selectedPhotoItems.map((photoItem) => {
                  const photoContributor =
                    selectedPhotoEvent?.photoContributors?.find(
                      (contributor) => contributor.id === photoItem.contributorId,
                    ) ?? null;
                  const photoIsOwner = currentUserId != null && photoItem.contributorId === currentUserId;

                  return (
                    <View
                      key={photoItem.id}
                      style={[
                        styles.photoModalSlide,
                        photoViewerWidth > 0 ? { width: photoViewerWidth } : null,
                      ]}
                    >
                      <View style={styles.photoModalCard}>
                        <View style={styles.photoModalHeader}>
                          <View style={styles.photoModalHeaderCopy}>
                            <Text style={styles.photoModalTitle}>{selectedPhotoEvent?.title}</Text>
                            {photoContributor ? (
                              <View style={styles.photoModalMetaRow}>
                                <View style={[styles.photoModalAvatar, { backgroundColor: photoContributor.color }]}>
                                  <Text style={styles.photoModalAvatarText}>{photoContributor.name.slice(0, 1)}</Text>
                                </View>
                                <Text style={styles.photoModalMeta}>{`photo by ${photoContributor.name}`}</Text>
                              </View>
                            ) : (
                              <Text style={styles.photoModalMeta}>사진 상세</Text>
                            )}
                          </View>
                          <View style={styles.photoModalHeaderActions}>
                            <View style={styles.photoModalTextActionRow}>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => {
                                  openPhotoEditor(selectedPhotoEvent!.id, photoItem.id, photoItem.memo);
                                }}
                              >
                                <Text style={[styles.photoModalTextAction, !photoIsOwner && styles.photoModalDisabledAction]}>
                                  수정
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => {
                                  confirmDeletePhoto(selectedPhotoEvent!.id, photoItem.id, Boolean(photoIsOwner));
                                }}
                              >
                                <Text
                                  style={[
                                    styles.photoModalTextAction,
                                    styles.photoModalDeleteAction,
                                    !photoIsOwner && styles.photoModalDisabledAction,
                                  ]}
                                >
                                  삭제
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => setPhotoViewer(null)} activeOpacity={0.85}>
                              <MaterialIcons name="close" size={22} color="#223428" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Image source={photoItem.source} style={styles.photoModalImage} contentFit="cover" />

                        {selectedPhotoItems.length > 1 ? (
                          <Text style={styles.photoModalPagerText}>
                            {`${selectedPhotoItems.findIndex((item) => item.id === photoItem.id) + 1} / ${selectedPhotoItems.length}`}
                          </Text>
                        ) : null}

                        {selectedPhotoEvent?.placeName ? (
                          <Text style={styles.photoModalSectionLabel}>장소</Text>
                        ) : null}
                        {selectedPhotoEvent?.placeName ? (
                          <Text style={styles.photoModalSectionBody}>{selectedPhotoEvent.placeName}</Text>
                        ) : null}

                        <Text style={styles.photoModalSectionLabel}>이벤트 메모</Text>
                        <Text style={styles.photoModalSectionBody}>
                          {selectedPhotoEvent?.eventMemo ?? selectedPhotoEvent?.subtitle}
                        </Text>

                        {selectedPhotoEmotion ? <Text style={styles.photoModalSectionLabel}>내 감정 기록</Text> : null}
                        {selectedPhotoEmotion ? (
                          <Text style={styles.photoModalSectionBody}>{selectedPhotoEmotion}</Text>
                        ) : null}

                        <Text style={styles.photoModalSectionLabel}>사진 메모</Text>
                        <Text style={styles.photoModalSectionBody}>
                          {photoItem.memo ?? '이 사진에 대한 메모가 아직 없어요.'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(deleteDialog)} transparent animationType="fade" onRequestClose={() => setDeleteDialog(null)}>
        <Pressable style={styles.deleteDialogBackdrop} onPress={() => setDeleteDialog(null)}>
          <Pressable style={styles.deleteDialogCard} onPress={() => undefined}>
            <View style={styles.deleteDialogIconWrap}>
              <MaterialIcons name="delete-outline" size={24} color="#B25543" />
            </View>
            <Text style={styles.deleteDialogTitle}>{deleteDialog?.title}</Text>
            <Text style={styles.deleteDialogBody}>{deleteDialog?.message}</Text>
            <View style={styles.deleteDialogButtonRow}>
              <TouchableOpacity style={styles.deleteDialogGhostButton} onPress={() => setDeleteDialog(null)} activeOpacity={0.88}>
                <Text style={styles.deleteDialogGhostButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteDialogPrimaryButton} onPress={handleConfirmDelete} activeOpacity={0.88}>
                <Text style={styles.deleteDialogPrimaryButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(paymentImportDialog)} transparent animationType="slide" onRequestClose={() => setPaymentImportDialog(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPaymentImportDialog(null)}>
          <Pressable style={styles.importSheetCard} onPress={() => undefined}>
            <View style={styles.importSheetHandle} />
            <Text style={styles.importSheetEyebrow}>여행 비용 수정</Text>
            <Text style={styles.importSheetTitle}>결제자와 정산 대상을 다시 조정할 수 있어요</Text>

            <Text style={styles.importSheetLabel}>결제자</Text>
            <View style={styles.importPayerRow}>
              {tripMembers.map((member) => {
                const isActive = paymentImportDialog?.payerUserId === member.userId;
                return (
                  <TouchableOpacity
                    key={member.userId}
                    style={[styles.importPayerChip, isActive && styles.importPayerChipActive]}
                    activeOpacity={0.85}
                    onPress={() =>
                      setPaymentImportDialog((prev) => (prev ? { ...prev, payerUserId: member.userId } : prev))
                    }
                  >
                    <Text style={[styles.importPayerChipText, isActive && styles.importPayerChipTextActive]}>
                      {member.nickname}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.importSheetLabel}>함께 나누는 사람</Text>
            <View style={styles.importMemberWrap}>
              {tripMembers.map((member) => {
                const isActive = paymentImportDialog?.selectedMemberUserIds.includes(member.userId);
                return (
                  <TouchableOpacity
                    key={member.userId}
                    style={[styles.importMemberChip, isActive && styles.importMemberChipActive]}
                    activeOpacity={0.85}
                    onPress={() => togglePaymentMember(member.userId)}
                  >
                    <Text style={[styles.importMemberChipText, isActive && styles.importMemberChipTextActive]}>
                      {member.nickname}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.importSheetLabel}>메모</Text>
            <TextInput
              value={paymentImportDialog?.memo ?? ''}
              onChangeText={(memo) => setPaymentImportDialog((prev) => (prev ? { ...prev, memo } : prev))}
              placeholder="결제 메모"
              placeholderTextColor="#94A098"
              style={[styles.editorInput, styles.importMemoInput]}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.importSummaryCard}>
              <Text style={styles.importSummaryText}>
                {paymentImportDialog
                  ? `${paymentImportDialog.selectedMemberUserIds.length}명 기준으로 정산 정보가 다시 계산돼요.`
                  : ''}
              </Text>
            </View>

            <View style={styles.importActionRow}>
              <TouchableOpacity style={styles.deleteDialogGhostButton} onPress={() => setPaymentImportDialog(null)} activeOpacity={0.88}>
                <Text style={styles.deleteDialogGhostButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.importConfirmButton} onPress={confirmPaymentImport} activeOpacity={0.88}>
                <Text style={styles.importConfirmButtonText}>정산 정보 저장</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(emotionPicker)} transparent animationType="slide" onRequestClose={() => setEmotionPicker(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setEmotionPicker(null)}>
          <Pressable style={styles.importSheetCard} onPress={() => undefined}>
            <View style={styles.importSheetHandle} />
            <Text style={styles.importSheetEyebrow}>내 감정 기록</Text>
            <Text style={styles.importSheetTitle}>이 이벤트에 대한 내 기분을 남겨보세요.</Text>
            <View style={styles.emotionOptionGrid}>
              {EMOTION_OPTIONS.map((option) => {
                const isActive =
                  emotionPicker?.selectedEmoji === option.emoji && emotionPicker?.selectedLabel === option.label;

                return (
                  <TouchableOpacity
                    key={`${option.emoji}-${option.label}`}
                    style={[styles.emotionOptionCard, isActive && styles.emotionOptionCardActive]}
                    activeOpacity={0.88}
                    onPress={() => selectEmotion(option.emoji, option.label)}
                  >
                    <Text style={styles.emotionOptionEmoji}>{option.emoji}</Text>
                    <Text style={[styles.emotionOptionLabel, isActive && styles.emotionOptionLabelActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.importActionRow}>
              <TouchableOpacity style={styles.deleteDialogGhostButton} onPress={() => setEmotionPicker(null)} activeOpacity={0.88}>
                <Text style={styles.deleteDialogGhostButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emotionClearButton} onPress={clearEmotion} activeOpacity={0.88}>
                <Text style={styles.emotionClearButtonText}>기록 삭제</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(eventEditor)} transparent animationType="fade" onRequestClose={() => setEventEditor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEventEditor(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>이벤트 수정</Text>
              <TouchableOpacity onPress={() => setEventEditor(null)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color="#223428" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={eventEditor?.title ?? ''}
              onChangeText={(title) => setEventEditor((prev) => (prev ? { ...prev, title } : prev))}
              placeholder="제목"
              placeholderTextColor="#94A098"
              style={styles.editorInput}
            />
            <TextInput
              value={eventEditor?.placeName ?? ''}
              onChangeText={(placeName) => setEventEditor((prev) => (prev ? { ...prev, placeName } : prev))}
              placeholder="장소"
              placeholderTextColor="#94A098"
              style={styles.editorInput}
            />
            <TextInput
              value={eventEditor?.body ?? ''}
              onChangeText={(body) => setEventEditor((prev) => (prev ? { ...prev, body } : prev))}
              placeholder="메모 또는 설명"
              placeholderTextColor="#94A098"
              style={[styles.editorInput, styles.editorTextArea]}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.editorSaveButton} onPress={saveEventEditor} activeOpacity={0.88}>
              <Text style={styles.editorSaveButtonText}>저장</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(photoEditor)} transparent animationType="fade" onRequestClose={() => setPhotoEditor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPhotoEditor(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>사진 메모 수정</Text>
              <TouchableOpacity onPress={() => setPhotoEditor(null)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color="#223428" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={photoEditor?.memo ?? ''}
              onChangeText={(memo) => setPhotoEditor((prev) => (prev ? { ...prev, memo } : prev))}
              placeholder="사진 메모"
              placeholderTextColor="#94A098"
              style={[styles.editorInput, styles.editorTextArea]}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.editorSaveButton} onPress={savePhotoEditor} activeOpacity={0.88}>
              <Text style={styles.editorSaveButtonText}>저장</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Animated.View style={[styles.floatingMapWrap, { height: mapHeight, borderRadius: mapRadius }]}>
        <Mapbox.MapView
          style={StyleSheet.absoluteFill}
          styleURL={Mapbox.StyleURL.Outdoors}
          localizeLabels={{ locale: 'ko' }}
          scaleBarEnabled={false}
          attributionEnabled
          logoEnabled
          compassEnabled={false}
          onDidFinishLoadingMap={handleMapReady}
          onDidFinishLoadingStyle={handleMapReady}
          onMapIdle={handleMapReady}
          onDidFailLoadingMap={handleMapLoadFailure}
        >
          <Mapbox.Camera
            ref={cameraRef}
            zoomLevel={13.4}
            centerCoordinate={currentLocationCoordinate ?? routeCoordinates[0] ?? [126.9784, 37.5667]}
          />
          <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />
          <Mapbox.ShapeSource id="trip-route" shape={routeShape}>
            <Mapbox.LineLayer
              id="trip-route-line"
              style={{ lineColor: '#3787FF', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.92 }}
            />
          </Mapbox.ShapeSource>
          <Mapbox.ShapeSource
            id="trip-events"
            shape={eventFeatureCollection}
            onPress={(event) => {
              const pressedFeature = event.features?.[0];
              const eventId =
                pressedFeature && typeof pressedFeature.properties?.eventId === 'string'
                  ? pressedFeature.properties.eventId
                  : null;

              if (eventId) {
                focusEvent(eventId);
              }
            }}
          >
            {/* Background markers for location/payment - CircleLayer for efficiency */}
            <Mapbox.CircleLayer
              id="trip-events-shadow"
              style={{
                circleColor: '#102118',
                circleOpacity: ['case', ['any', ['==', ['get', 'type'], 'location'], ['==', ['get', 'type'], 'payment']], 0.12, 0],
                circleRadius: ['case', ['==', ['get', 'selected'], 1], 12, 10],
                circleTranslate: [0, 2],
              }}
            />
            <Mapbox.CircleLayer
              id="trip-events-ring"
              style={{
                circleColor: '#FFFFFF',
                circleOpacity: ['case', ['any', ['==', ['get', 'type'], 'location'], ['==', ['get', 'type'], 'payment']], 1, 0],
                circleRadius: ['case', ['==', ['get', 'selected'], 1], 11, 9],
              }}
            />
            <Mapbox.CircleLayer
              id="trip-events-core"
              style={{
                circleColor: ['get', 'accent'],
                circleOpacity: ['case', ['any', ['==', ['get', 'type'], 'location'], ['==', ['get', 'type'], 'payment']], 1, 0],
                circleRadius: ['case', ['==', ['get', 'selected'], 1], 8, 6],
                circleStrokeColor: '#FFFFFF',
                circleStrokeOpacity: ['case', ['any', ['==', ['get', 'type'], 'location'], ['==', ['get', 'type'], 'payment']], 1, 0],
                circleStrokeWidth: ['case', ['==', ['get', 'selected'], 1], 2, 1],
              }}
            />
          </Mapbox.ShapeSource>

          {/* Individual Photo Markers for the "Stack" effect */}
          {filteredMapEvents.filter(e => e.type === 'photo').map((event) => (
            <PhotoMarker 
              key={event.id}
              id={event.id}
              coordinate={event.coordinate as [number, number]}
              isSelected={selectedEventId === event.id}
              photoUrls={event.photoUrls || (event.photoItems?.map(p => String(p.source)))}
              onPress={() => focusEvent(event.id)}
            />
          ))}
        </Mapbox.MapView>

        {!isMapReady ? (
          <View style={styles.mapStatusOverlay} pointerEvents="none">
            <View style={styles.mapStatusCard}>
              <MaterialIcons name={!hasMapboxToken || mapLoadFailed ? 'wifi-off' : 'map'} size={18} color={!hasMapboxToken || mapLoadFailed ? '#A65F4B' : '#415D4C'} />
              <Text style={styles.mapStatusTitle}>
                {!hasMapboxToken ? '지도를 불러올 수 없어요' : mapLoadFailed ? '지도 로딩에 실패했어요' : '지도를 불러오는 중이에요'}
              </Text>
              <Text style={styles.mapStatusText}>
                {!hasMapboxToken
                  ? '지도를 표시하기 위한 설정이 아직 완료되지 않았어요.'
                  : mapLoadFailed
                    ? '잠시 후 다시 시도해주세요.'
                    : '지도를 준비하고 경로 정보를 불러오고 있어요.'}
              </Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mapFilterScroll}
          contentContainerStyle={styles.mapFilterRow}
        >
          <TouchableOpacity
            style={[styles.mapFilterChip, routeOnlyMode && styles.mapFilterChipActive]}
            onPress={toggleRouteOnlyMode}
            activeOpacity={0.88}
          >
            <MaterialIcons name="route" size={15} color={routeOnlyMode ? '#F7FBF6' : '#315240'} />
            <Text style={[styles.mapFilterChipText, routeOnlyMode && styles.mapFilterChipTextActive]}>동선만</Text>
          </TouchableOpacity>
          {MAP_FILTER_META.map((filter) => {
            const isActive = settings[filter.key];
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.mapFilterChip, isActive && styles.mapFilterChipActive]}
                onPress={() => toggleMapPreference(filter.key)}
                activeOpacity={0.88}
              >
                <MaterialIcons name={filter.icon} size={15} color={isActive ? '#F7FBF6' : '#315240'} />
                <Text style={[styles.mapFilterChipText, isActive && styles.mapFilterChipTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        refreshControl={
          <RefreshControl
            refreshing={false}
            tintColor="#5C6D61"
            progressViewOffset={8}
            onRefresh={() => {
              setIsMapReady(false);
              setMapLoadFailed(false);
            }}
          />
        }
      >
        <Animated.View
          style={[
            styles.panel,
            {
              paddingTop: MAX_MAP_HEIGHT - INITIAL_PANEL_PEEK,
              transform: [{ translateY: panelLift }],
            },
          ]}
        >
          <View style={styles.contentSheet}>
            <View style={styles.panelHandle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabRow}>
            <Pressable style={[styles.dayTab, activeFilter === 'all' && styles.dayTabActive]} onPress={() => setActiveFilter('all')}>
              <Text style={[styles.dayTabText, activeFilter === 'all' && styles.dayTabTextActive]}>전체</Text>
            </Pressable>
            {tripDays.map((day) => {
              const isActive = activeFilter === day.id;
              return (
                <Pressable key={day.id} style={[styles.dayTab, isActive && styles.dayTabActive]} onPress={() => setActiveFilter(day.id)}>
                  <Text style={[styles.dayTabText, isActive && styles.dayTabTextActive]}>{day.label}</Text>
                  <Text style={[styles.dayTabSubText, isActive && styles.dayTabSubTextActive]}>{day.dateLabel}</Text>
                </Pressable>
              );
            })}
            </ScrollView>

          {filteredDays.map((day) => (
            <View key={day.id} style={styles.daySummaryRow}>
              <View style={styles.daySummaryCopy}>
                <Text style={styles.daySummaryTitle}>{day.label} · {day.dateLabel}</Text>
                <Text style={styles.daySummaryText}>{day.summary}</Text>
              </View>
              <View style={styles.dayDistanceBadge}>
                <MaterialIcons name="directions-walk" size={16} color="#5A6D61" />
                <Text style={styles.dayDistanceText}>{day.distanceKm.toFixed(1)}km</Text>
              </View>
            </View>
          ))}

          <View style={styles.summarySection}>
            <View style={styles.summaryStatRow}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatValue}>{summaryStats.totalDistanceLabel}</Text>
                <Text style={styles.summaryStatLabel}>방문한 거리</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatValue}>{summaryStats.visitedPlaceCount}</Text>
                <Text style={styles.summaryStatLabel}>방문한 곳</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatValue}>{summaryStats.photoCount}</Text>
                <Text style={styles.summaryStatLabel}>사진</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatValue}>{summaryStats.paymentCount}</Text>
                <Text style={styles.summaryStatLabel}>결제</Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineWrap}>
            {filteredEvents.map((event, index) => {
              const theme = EVENT_THEME[event.type];
              const isSelected = selectedEventId === event.id;
              const isPaymentConfirmed = event.type === 'payment' && event.paymentStatus === 'confirmed';
              const emotionValue =
                event.emotionOwnerId === currentUserId && event.emotionEmoji && event.emotionLabel
                  ? `${event.emotionEmoji} ${event.emotionLabel}`
                  : null;

              return (
                <View key={event.id} style={styles.timelineRow} onLayout={(layoutEvent) => handleEventLayout(event.id, layoutEvent)}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { borderColor: theme.accent }]}>
                      <MaterialIcons name={theme.icon} size={14} color={theme.accent} />
                    </View>
                    {index !== filteredEvents.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <Pressable style={[styles.eventCard, isSelected && styles.eventCardSelected]} onPress={() => focusEvent(event.id)}>
                    <View style={styles.eventHeaderRow}>
                      <Text style={styles.eventTime}>{event.time}</Text>
                      {event.amount ? (
                        <Text style={styles.eventAmount}>{event.amount}</Text>
                      ) : event.photoContributors?.length ? (
                        <View style={styles.photoByWrap}>
                          <Text style={styles.photoByText}>photo by</Text>
                          <View style={styles.avatarStack}>
                            {event.photoContributors.map((contributor, contributorIndex) => (
                              <View
                                key={contributor.id}
                                style={[
                                  styles.avatarCircle,
                                  {
                                    backgroundColor: contributor.color,
                                    marginLeft: contributorIndex === 0 ? 0 : -10,
                                    zIndex: event.photoContributors!.length - contributorIndex,
                                  },
                                ]}
                              >
                                <Text style={styles.avatarText}>{contributor.name.slice(0, 1)}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.eventTitle}>{getEventDisplayTitle(event)}</Text>
                    {shouldShowEventPlaceName(event) ? <Text style={styles.eventPlaceName}>{event.placeName}</Text> : null}
                    {event.type === 'payment' ? (
                      <View style={styles.paymentMetaBlock}>
                        <View style={styles.paymentMetaTopRow}>
                          {event.amount ? <Text style={styles.paymentAmountInline}>{event.amount}</Text> : null}
                          {event.paymentCardName ? <Text style={styles.paymentCardName}>{event.paymentCardName}</Text> : null}
                        </View>
                        {event.paymentPayerName || event.paymentSplitLabel ? (
                          <Text style={styles.paymentHelperText}>
                            {[event.paymentPayerName ? `${event.paymentPayerName} 결제` : null, event.paymentSplitLabel].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {event.photoItems?.length ? (
                      <View style={styles.photoRow}>
                        {event.photoItems.slice(0, 3).map((photoItem, photoIndex) => {
                          const remainingCount = event.photoItems ? event.photoItems.length - 2 : 0;
                          const shouldShowOverlay = photoIndex === 2 && (event.photoItems?.length ?? 0) >= 3;

                          return (
                            <Pressable
                              key={photoItem.id}
                              style={styles.photoThumbWrap}
                              onPress={(pressEvent) => {
                                pressEvent.stopPropagation();
                                if (shouldShowOverlay) {
                                  router.push({ pathname: '/trip/photo-album', params: { eventId: event.id } } as never);
                                  return;
                                }

                                setPhotoViewer({ eventId: event.id, photoIndex });
                              }}
                            >
                              <Image source={photoItem.source} style={styles.photoThumb} contentFit="cover" />
                              {shouldShowOverlay ? (
                                <View style={styles.photoThumbOverlay}>
                                  <Text style={styles.photoThumbOverlayText}>+{remainingCount}장</Text>
                                </View>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    {event.photoItems?.length ? (
                      <>
                        {event.eventMemo ? <Text style={styles.eventMemoText}>{event.eventMemo}</Text> : null}
                      </>
                    ) : null}
                    {!event.photoItems?.length && event.subtitle ? <Text style={styles.eventSubtitle}>{event.subtitle}</Text> : null}
                    {!event.photoItems?.length && event.eventMemo ? <Text style={styles.eventMemoText}>{event.eventMemo}</Text> : null}
                    <View style={styles.eventMetaRow}>
                      <View style={styles.chipRow}>
                        {event.chips?.map((chip) => (
                          <View key={`${event.id}-${chip}`} style={[styles.eventChip, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.eventChipText, { color: theme.accent }]}>{chip}</Text>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={[styles.eventEmotionChip, emotionValue && styles.eventEmotionChipActive]}
                          activeOpacity={0.82}
                          onPress={(pressEvent) => {
                            pressEvent.stopPropagation();
                            openEmotionPicker(event);
                          }}
                        >
                          <MaterialIcons name="mood" size={13} color={emotionValue ? '#8C561A' : '#7A867F'} />
                          <Text style={[styles.eventEmotionChipText, emotionValue && styles.eventEmotionChipTextActive]}>
                            {emotionValue ?? '감정 추가'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.photoEventActionRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={(pressEvent) => {
                            pressEvent.stopPropagation();
                            if (isPaymentConfirmed) {
                              void openPaymentImportDialog(event);
                              return;
                            }
                            openEventEditor(event);
                          }}
                        >
                          <Text style={styles.photoEventActionText}>{isPaymentConfirmed ? '정산 수정' : '수정'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={(pressEvent) => {
                            pressEvent.stopPropagation();
                            confirmDeleteEvent(event);
                          }}
                        >
                          <Text style={[styles.photoEventActionText, styles.photoEventDeleteText]}>
                            {isPaymentConfirmed ? '비용 삭제' : '삭제'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {isReviewMode ? (
            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.endButton} onPress={handleOpenReport} activeOpacity={0.88}>
                <Text style={styles.endButtonText}>여행 리포트 확인</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={[styles.bottomActions, !canEndActiveTrip && styles.hiddenAction]}>
            <TouchableOpacity style={styles.endButton} onPress={handleEndTrip} activeOpacity={0.88}>
              <Text style={styles.endButtonText}>여행 종료</Text>
            </TouchableOpacity>
          </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

export default function TripRecordingScreen({
  reportRoute = '/trip/report',
  useMockData = false,
}: {
  reportRoute?: '/trip/report' | '/trip/mock-report';
  useMockData?: boolean;
}) {
  if (useMockData) {
    return <MockTripRecordingScreen reportRoute="/trip/mock-report" useMockData />;
  }

  return <RealTripRecordingScreen reportRoute={reportRoute} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF4EC' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#17201A', marginBottom: 16 },
  primaryButton: {
    minWidth: 220,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#244934',
  },
  primaryButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F7FBF6' },
  header: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 20 },
  backButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  headerTextWrap: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteQuickButton: {
    alignSelf: 'flex-end',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E3EBDD',
  },
  inviteQuickButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#274232' },
  recordingInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerMeta: { marginTop: 4, fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#5F6E65' },
  recordingDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#F35B4F' },
  recordingInlineText: { width: 0, height: 0, opacity: 0 },
  recordingDotCompleted: { backgroundColor: '#4C8E5E' },
  recordingStatusText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#F35B4F' },
  recordingStatusTextCompleted: { color: '#4C8E5E' },
  headerTitle: { fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#17201A' },
  headerActions: { alignItems: 'flex-end', gap: 6 },
  headerActionsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncHeaderButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 18, backgroundColor: '#E3EBDD', paddingHorizontal: 12, height: 36 },
  syncHeaderButtonDisabled: { opacity: 0.7 },
  syncHeaderButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#274232' },
  syncToastWrap: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    bottom: 0,
    zIndex: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncToastCard: {
    maxWidth: 320,
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#182119',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  syncToastText: { flexShrink: 1, fontFamily: 'Pretendard-SemiBold', fontSize: 13, lineHeight: 18 },
  moreButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { position: 'absolute', top: 72, right: 16, left: 16, bottom: 0, zIndex: 30 },
  menuCard: { marginLeft: 'auto', width: 156, borderRadius: 20, backgroundColor: '#FCFEFB', paddingVertical: 8, shadowColor: '#223428', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  menuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  menuItemText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#244934' },
  hiddenAction: { display: 'none' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18, 25, 20, 0.3)', justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: { borderRadius: 28, backgroundColor: '#FCFEFB', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119' },
  modalBody: { marginTop: 12, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 22, color: '#66756C' },
  photoModalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 18, 14, 0.45)', justifyContent: 'center', paddingHorizontal: 18 },
  photoModalViewport: { width: '100%' },
  photoModalCard: { borderRadius: 28, backgroundColor: '#FCFEFB', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  photoModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  photoModalHeaderCopy: { flex: 1 },
  photoModalTitle: { fontFamily: 'Pretendard-Bold', fontSize: 19, color: '#182119' },
  photoModalMeta: { marginTop: 4, fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#738078' },
  photoModalMetaRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoModalAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModalAvatarText: { fontFamily: 'Pretendard-Bold', fontSize: 10, color: '#FFFFFF' },
  photoModalHeaderActions: { alignItems: 'flex-end', gap: 6 },
  photoModalTextActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoModalTextAction: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#4F5F56' },
  photoModalDeleteAction: { color: '#A45A49' },
  photoModalDisabledAction: { color: '#A3B0A8' },
  photoModalImage: { width: '100%', aspectRatio: 1, borderRadius: 22, marginTop: 16, backgroundColor: '#E7ECE5' },
  photoModalSlide: { paddingHorizontal: 4 },
  photoModalPagerText: { marginTop: 10, fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#738078', textAlign: 'center' },
  photoModalSectionLabel: { marginTop: 16, fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#7A867F' },
  photoModalSectionBody: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#243028' },
  deleteDialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 20, 16, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  deleteDialogCard: {
    width: '100%',
    borderRadius: 30,
    backgroundColor: '#FCFEFB',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#17231C',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  deleteDialogIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogTitle: {
    marginTop: 16,
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    color: '#182119',
    textAlign: 'center',
  },
  deleteDialogBody: {
    marginTop: 10,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#66756C',
    textAlign: 'center',
  },
  deleteDialogButtonRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 22 },
  deleteDialogGhostButton: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#EFF3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogGhostButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, color: '#536258' },
  deleteDialogPrimaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#B25543',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogPrimaryButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#FFF8F6' },
  actionConfirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 18, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  actionConfirmCard: {
    width: '100%',
    borderRadius: 30,
    backgroundColor: '#F7FAF4',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
  },
  actionConfirmIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E4EDE1',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  actionConfirmTitle: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    color: '#17201A',
  },
  actionConfirmDescription: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 22,
    color: '#5F6E65',
  },
  actionConfirmRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionConfirmSecondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6F2',
  },
  actionConfirmSecondaryText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#465346',
  },
  actionConfirmPrimaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCE6D9',
  },
  actionConfirmPrimaryText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#1A211C',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 20, 16, 0.32)',
    justifyContent: 'flex-end',
  },
  importSheetCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FCFEFB',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    shadowColor: '#17231C',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  importSheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D2DAD4',
    alignSelf: 'center',
  },
  importSheetEyebrow: {
    marginTop: 16,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: '#C56A43',
  },
  importSheetTitle: {
    marginTop: 6,
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    lineHeight: 30,
    color: '#182119',
  },
  importSheetLabel: {
    marginTop: 18,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#607067',
  },
  importPayerRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  importPayerChip: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importPayerChipActive: { backgroundColor: '#244934' },
  importPayerChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#4F5F56' },
  importPayerChipTextActive: { color: '#F7FBF6' },
  importMemberWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  importMemberChip: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4F7F3',
    borderWidth: 1,
    borderColor: '#DCE4DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importMemberChipActive: {
    backgroundColor: '#244934',
    borderColor: '#244934',
  },
  importMemberChipText: { fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#52635A' },
  importMemberChipTextActive: { color: '#F7FBF6' },
  importMemoInput: { minHeight: 92 },
  emotionOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  emotionOptionCard: {
    width: '31%',
    minWidth: 92,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F3',
    borderWidth: 1,
    borderColor: '#DCE4DE',
  },
  emotionOptionCardActive: {
    backgroundColor: '#FFF1E3',
    borderColor: '#D98935',
  },
  emotionOptionEmoji: { fontSize: 24 },
  emotionOptionLabel: { marginTop: 8, fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#52635A' },
  emotionOptionLabelActive: { color: '#9A5B16' },
  emotionClearButton: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#FFF1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionClearButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, color: '#B25543' },
  importSummaryCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#F6F8F4',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  importSummaryText: { fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#5E6D65' },
  importActionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  importConfirmButton: {
    flex: 1.3,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#C56A43',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importConfirmButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#FFF8F5' },
  editorInput: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7E1DA',
    backgroundColor: '#F8FBF7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#223428',
  },
  editorTextArea: { minHeight: 116 },
  editorSaveButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#244934',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorSaveButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F7FBF6' },
  floatingMapWrap: {
    position: 'absolute',
    top: MAP_TOP_OFFSET,
    left: MAP_SIDE_MARGIN,
    right: MAP_SIDE_MARGIN,
    overflow: 'hidden',
    backgroundColor: '#CBD7CE',
    shadowColor: '#1E2B22',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    zIndex: 1,
  },
  content: { paddingBottom: 34 },
  mapFilterScroll: { position: 'absolute', left: 14, right: 14, top: 22 },
  mapFilterRow: { gap: 8, paddingRight: 14 },
  mapFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  mapFilterChipActive: { backgroundColor: '#244934' },
  mapFilterChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#315240' },
  mapFilterChipTextActive: { color: '#F7FBF6' },
  mapStatusOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(194, 206, 198, 0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  mapStatusCard: { width: '100%', borderRadius: 24, backgroundColor: 'rgba(248, 250, 247, 0.96)', paddingHorizontal: 18, paddingVertical: 18 },
  mapStatusTitle: { marginTop: 10, fontFamily: 'Pretendard-Bold', fontSize: 17, color: '#1B261E' },
  mapStatusText: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, color: '#65746B' },
  panel: {
    marginTop: PANEL_TOP_OFFSET,
    marginHorizontal: MAP_SIDE_MARGIN,
    backgroundColor: 'transparent',
    minHeight: 1200,
    zIndex: 3,
  },
  contentSheet: {
    backgroundColor: '#EFF4EC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 16,
  },
  panelHandle: { width: 54, height: 5, borderRadius: 999, backgroundColor: '#CDD6CA', alignSelf: 'center', marginBottom: 14 },
  dayTabRow: { gap: 10, paddingTop: 18, paddingBottom: 18 },
  dayTab: { minWidth: 76, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, backgroundColor: '#E4ECE2', alignItems: 'center' },
  dayTabActive: { backgroundColor: '#244934' },
  dayTabText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#536258' },
  dayTabTextActive: { color: '#F7FBF6' },
  dayTabSubText: { marginTop: 2, fontFamily: 'Pretendard-Medium', fontSize: 11, color: '#8A978F' },
  dayTabSubTextActive: { color: '#C6D8CC' },
  daySummaryRow: { display: 'none' },
  daySummaryCopy: { flex: 1, minWidth: 0 },
  daySummaryTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: '#1A241D' },
  daySummaryText: { marginTop: 4, fontFamily: 'Pretendard-Regular', fontSize: 13, color: '#728077' },
  dayDistanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#E3ECE2' },
  dayDistanceText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#5A6D61' },
  summarySection: { marginTop: 6, paddingHorizontal: 2 },
  summaryStatRow: { flexDirection: 'row', alignItems: 'stretch' },
  summaryStatItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  summaryStatValue: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#182119' },
  summaryStatLabel: { marginTop: 4, fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#7B8780' },
  summaryStatDivider: { width: 1, backgroundColor: '#D9E2DB', marginVertical: 4 },
  timelineWrap: { width: '100%', marginTop: 22, paddingBottom: 8 },
  timelineRow: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  timelineRail: { width: 30, alignItems: 'center' },
  timelineDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 3, flex: 1, marginTop: 8, marginBottom: -2, borderRadius: 999, backgroundColor: '#9ABCEA' },
  eventCard: { flex: 1, minWidth: 0, marginBottom: 18, borderRadius: 26, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 16 },
  eventCardSelected: { borderWidth: 2, borderColor: '#9ABCEA' },
  eventHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eventTime: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#91A19A' },
  eventAmount: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#CF643B' },
  paymentCandidateBadge: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF1E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentCandidateBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#C56A43' },
  eventTitle: { marginTop: 6, fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#182119' },
  eventPlaceName: { marginTop: 6, fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#486356' },
  paymentMetaBlock: { marginTop: 10, gap: 4 },
  paymentMetaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paymentAmountInline: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#C85E37' },
  paymentCardName: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#7A867F' },
  paymentHelperText: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#6E7B74' },
  eventSubtitle: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#708076' },
  eventMemoText: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, color: '#55635B' },
  eventEmotionChip: {
    height: 30,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#F5F7F4',
    borderWidth: 1,
    borderColor: '#DEE5DF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eventEmotionChipActive: {
    backgroundColor: '#FFF5E8',
    borderColor: '#E7CDA5',
  },
  eventEmotionChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#78857D' },
  eventEmotionChipTextActive: { color: '#86531C' },
  photoByWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoByText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#708076' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Pretendard-Bold', fontSize: 10, color: '#FFFFFF' },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  photoThumbWrap: { width: 72, height: 72, borderRadius: 16, overflow: 'hidden' },
  photoThumb: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#E7ECE5' },
  photoThumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12, 12, 12, 0.48)', alignItems: 'center', justifyContent: 'center' },
  photoThumbOverlayText: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#FFFFFF' },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  photoEventActionRow: { flexDirection: 'row', gap: 12, flexShrink: 0 },
  photoEventActionText: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#738078' },
  paymentImportActionText: { color: '#C56A43' },
  photoEventDeleteText: { color: '#A45A49' },
  eventActionDeleteText: { color: '#A45A49' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  eventChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  eventChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12 },
  bottomActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 14 },
  endButton: { flex: 1.2, height: 54, borderRadius: 27, backgroundColor: '#234634', alignItems: 'center', justifyContent: 'center' },
  endButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F5FAF4' },
});
