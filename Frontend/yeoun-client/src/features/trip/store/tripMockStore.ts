type DayKey = `day${number}`;
type TimelineEventType = 'location' | 'photo' | 'payment';
type Coordinate = [number, number];
type PaymentStatus = 'candidate' | 'confirmed';
type PaymentSplitType = 'equal' | 'selected';

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
  day: DayKey;
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
  paymentStatus?: PaymentStatus;
  paymentCardName?: string;
  paymentPayerName?: string;
  paymentSplitLabel?: string;
  paymentImportId?: string;
  paymentParticipantNames?: string[];
  paymentSplitType?: PaymentSplitType;
  emotionEmoji?: string;
  emotionLabel?: string;
  emotionOwnerId?: string;
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
    emotionEmoji: '😊',
    emotionLabel: '설렘',
    emotionOwnerId: CURRENT_USER_ID,
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
    time: '12:38',
    title: '광안리횟집 결제 후보',
    subtitle: '카드 승인 내역을 여행 비용으로 가져올 수 있어요.',
    amount: '₩120,000',
    chips: ['자동 가져오기', '식사'],
    paymentStatus: 'candidate',
    paymentImportId: 'pi_001',
    paymentCardName: '현대카드',
    paymentPayerName: '민지',
    paymentSplitLabel: '3명 균등 분할 예정',
    paymentParticipantNames: ['민지', '지훈', '서연'],
    paymentSplitType: 'equal',
    emotionEmoji: '😌',
    emotionLabel: '든든함',
    emotionOwnerId: CURRENT_USER_ID,
    coordinate: [127.0014, 37.5701],
  },
  {
    id: 'ev-7',
    day: 'day3',
    type: 'payment',
    time: '20:15',
    title: '카페 결제',
    subtitle: '여행 비용에 반영된 결제예요.',
    amount: '₩3,200',
    chips: ['카페', '간식'],
    paymentStatus: 'confirmed',
    paymentCardName: '토스카드',
    paymentPayerName: '민지',
    paymentSplitLabel: '2명 균등 분할',
    paymentParticipantNames: ['민지', '서연'],
    paymentSplitType: 'equal',
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

export const selectTripPaymentCandidate = (
  eventId: string,
  options?: {
    payerName?: string;
    participantNames?: string[];
    splitType?: PaymentSplitType;
    memo?: string;
  }
) => {
  tripEvents = tripEvents.map((event) => {
    if (event.id !== eventId || event.type !== 'payment' || event.paymentStatus !== 'candidate') {
      return event;
    }

    const participantNames = options?.participantNames?.length ? options.participantNames : event.paymentParticipantNames ?? [];
    const splitLabel =
      participantNames.length > 0
        ? `${participantNames.length}명 ${options?.splitType === 'selected' ? '선택 분할' : '균등 분할'}`
        : event.paymentSplitLabel;

    return {
      ...event,
      title: '광안리횟집 비용 추가',
      subtitle: '여행 비용에 반영된 결제예요.',
      chips: ['식사', '자동 가져오기'],
      paymentStatus: 'confirmed',
      paymentPayerName: options?.payerName ?? event.paymentPayerName,
      paymentParticipantNames: participantNames,
      paymentSplitType: options?.splitType ?? event.paymentSplitType,
      paymentSplitLabel: splitLabel,
      eventMemo: options?.memo?.trim() || '자동 가져온 결제를 여행 비용으로 확정했어요.',
    };
  });
  emit();
};

export const ignoreTripPaymentCandidate = (eventId: string) => {
  tripEvents = tripEvents.filter((event) => !(event.id === eventId && event.type === 'payment' && event.paymentStatus === 'candidate'));
  emit();
};

export const updateTripPaymentDetails = (
  eventId: string,
  options: {
    payerName?: string;
    participantNames?: string[];
    splitType?: PaymentSplitType;
    memo?: string;
  }
) => {
  tripEvents = tripEvents.map((event) => {
    if (event.id !== eventId || event.type !== 'payment' || event.paymentStatus !== 'confirmed') {
      return event;
    }

    const participantNames = options.participantNames?.length ? options.participantNames : event.paymentParticipantNames ?? [];
    const splitLabel =
      participantNames.length > 0
        ? `${participantNames.length}명 ${options.splitType === 'selected' ? '선택 분할' : '균등 분할'}`
        : event.paymentSplitLabel;

    return {
      ...event,
      paymentPayerName: options.payerName ?? event.paymentPayerName,
      paymentParticipantNames: participantNames,
      paymentSplitType: options.splitType ?? event.paymentSplitType,
      paymentSplitLabel: splitLabel,
      eventMemo: options.memo?.trim() || event.eventMemo,
    };
  });
  emit();
};
