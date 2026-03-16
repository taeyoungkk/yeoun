type DayFilter = 'all' | 'day1' | 'day2' | 'day3';
type TimelineEventType = 'location' | 'photo' | 'payment' | 'memo' | 'voice' | 'emotion';
type Coordinate = [number, number];

export type PhotoContributor = {
  id: string;
  name: string;
  color: string;
};

export type TimelinePhotoItem = {
  id: string;
  source: number;
  memo?: string;
  contributorId?: string;
};

export type TimelineEvent = {
  id: string;
  day: Exclude<DayFilter, 'all'>;
  type: TimelineEventType;
  time: string;
  title: string;
  subtitle: string;
  amount?: string;
  chips?: string[];
  coordinate?: Coordinate;
  placeName?: string;
  eventMemo?: string;
  photoContributors?: PhotoContributor[];
  photoItems?: TimelinePhotoItem[];
};

export const CURRENT_USER_ID = 'user-1';

const PHOTO_STACK = [
  require('@/assets/images/trip_placeholder_1.png'),
  require('@/assets/images/trip_placeholder_2.png'),
  require('@/assets/images/trip_placeholder_3.png'),
];

const INITIAL_TRIP_EVENTS: TimelineEvent[] = [
  {
    id: 'ev-1',
    day: 'day1',
    type: 'location',
    time: '10:20',
    title: '여행 시작',
    placeName: '서울시청',
    subtitle: '',
    chips: ['기록 시작', '현재 위치 저장'],
    coordinate: [126.9822, 37.5703],
  },
  {
    id: 'ev-2',
    day: 'day1',
    type: 'photo',
    time: '11:05',
    title: '광안리 해변 산책',
    subtitle: '',
    placeName: '광안리 해수욕장',
    eventMemo: '바람은 좀 불었지만 해 질 무렵 분위기가 정말 좋았어요.',
    chips: ['사진 4장', '장소 자동 매칭'],
    coordinate: [126.9898, 37.5707],
    photoContributors: [
      { id: 'user-1', name: '민지', color: '#F08AA2' },
      { id: 'user-2', name: '지훈', color: '#77B6EA' },
      { id: 'user-3', name: '서연', color: '#88B97A' },
    ],
    photoItems: [
      { id: 'photo-1', source: PHOTO_STACK[0], memo: '노을이 퍼지기 시작하던 순간', contributorId: 'user-1' },
      { id: 'photo-2', source: PHOTO_STACK[1], memo: '파도 색이 예뻐서 바로 찍은 장면', contributorId: 'user-2' },
      { id: 'photo-3', source: PHOTO_STACK[2], memo: '야경이 켜지기 직전의 해변', contributorId: 'user-3' },
      { id: 'photo-4', source: PHOTO_STACK[0], memo: '같이 걷던 분위기를 남긴 사진', contributorId: 'user-1' },
    ],
  },
  {
    id: 'ev-3',
    day: 'day1',
    type: 'payment',
    time: '12:40',
    title: '점심 결제',
    subtitle: '영수증과 위치를 연결해서 이동 경로에 함께 표시해요.',
    amount: '₩17,000',
    chips: ['식사', '카드 결제'],
    coordinate: [127.0014, 37.5701],
  },
  {
    id: 'ev-4',
    day: 'day2',
    type: 'memo',
    time: '14:10',
    title: '메모 남김',
    subtitle: '걷다가 떠오른 생각을 메모로 저장했어요.',
    chips: ['텍스트 메모'],
    coordinate: [127.0479, 37.5466],
  },
  {
    id: 'ev-5',
    day: 'day2',
    type: 'emotion',
    time: '16:20',
    title: '감정 기록',
    subtitle: '오늘의 기분과 순간 인상을 함께 남겼어요.',
    chips: ['감정 체크'],
    coordinate: [127.0534, 37.5454],
  },
  {
    id: 'ev-6',
    day: 'day3',
    type: 'voice',
    time: '19:30',
    title: '음성 메모',
    subtitle: '짧은 음성 메모가 현재 위치와 함께 저장되었어요.',
    chips: ['00:42'],
    coordinate: [126.9919, 37.5346],
  },
  {
    id: 'ev-7',
    day: 'day3',
    type: 'payment',
    time: '20:15',
    title: '카페 결제',
    subtitle: '카페 영수증이 이동 경로 위에 자동 연결되었어요.',
    amount: '₩3,200',
    chips: ['카페', '간식'],
    coordinate: [127.0028, 37.5289],
  },
];

const listeners: Array<() => void> = [];

const cloneEvents = (events: TimelineEvent[]): TimelineEvent[] =>
  events.map((event) => ({
    ...event,
    chips: event.chips ? [...event.chips] : undefined,
    photoContributors: event.photoContributors ? event.photoContributors.map((contributor) => ({ ...contributor })) : undefined,
    photoItems: event.photoItems ? event.photoItems.map((photo) => ({ ...photo })) : undefined,
  }));

let tripEvents: TimelineEvent[] = cloneEvents(INITIAL_TRIP_EVENTS);

const emit = () => {
  listeners.forEach((listener) => listener());
};

const updatePhotoMetadata = (event: TimelineEvent) => {
  if (!event.photoItems) {
    return event;
  }

  const photoCount = event.photoItems.length;
  const nextChips = [...(event.chips ?? [])];
  const photoChipIndex = nextChips.findIndex((chip) => /^사진 \d+장$/.test(chip));

  if (photoChipIndex >= 0) {
    nextChips[photoChipIndex] = `사진 ${photoCount}장`;
  } else {
    nextChips.unshift(`사진 ${photoCount}장`);
  }

  const contributorIds = new Set(event.photoItems.map((photo) => photo.contributorId).filter(Boolean));
  const nextContributors = (event.photoContributors ?? []).filter((contributor) => contributorIds.has(contributor.id));

  return {
    ...event,
    chips: nextChips,
    photoContributors: nextContributors,
  };
};

export const getTripEvents = () => cloneEvents(tripEvents);

export const subscribeTripEvents = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
};

export const updateTripEvent = (eventId: string, updates: Partial<TimelineEvent>) => {
  tripEvents = tripEvents.map((event) => {
    if (event.id !== eventId) {
      return event;
    }

    const nextEvent = { ...event, ...updates };
    return nextEvent.photoItems ? updatePhotoMetadata(nextEvent) : nextEvent;
  });
  emit();
};

export const deleteTripEvent = (eventId: string) => {
  tripEvents = tripEvents.filter((event) => event.id !== eventId);
  emit();
};

export const updateTripPhoto = (eventId: string, photoId: string, updates: Partial<TimelinePhotoItem>) => {
  tripEvents = tripEvents.map((event) => {
    if (event.id !== eventId || !event.photoItems) {
      return event;
    }

    const nextEvent = {
      ...event,
      photoItems: event.photoItems.map((photo) => (photo.id === photoId ? { ...photo, ...updates } : photo)),
    };

    return updatePhotoMetadata(nextEvent);
  });
  emit();
};

export const deleteTripPhoto = (eventId: string, photoId: string) => {
  tripEvents = tripEvents
    .map((event) => {
      if (event.id !== eventId || !event.photoItems) {
        return event;
      }

      const nextPhotoItems = event.photoItems.filter((photo) => photo.id !== photoId);
      if (nextPhotoItems.length === 0) {
        return null;
      }

      return updatePhotoMetadata({
        ...event,
        photoItems: nextPhotoItems,
      });
    })
    .filter((event): event is TimelineEvent => Boolean(event));
  emit();
};
