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
  source: number | string;
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
  photoUrls?: string[];
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

const PHOTO_CONTRIBUTORS: PhotoContributor[] = [
  { id: 'user-1', name: '나', color: '#5B8DEF' },
  { id: 'user-2', name: '민지', color: '#63B995' },
  { id: 'user-3', name: '현우', color: '#F29E4C' },
];

const PHOTO_STACK = [
  "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?q=80&w=500&auto=format",
  "https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=500&auto=format",
  "https://images.unsplash.com/photo-1452626212852-811d58933cae?q=80&w=500&auto=format",
  "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=500&auto=format"
];

const INITIAL_TRIP_EVENTS: TimelineEvent[] = [
  {
    id: 'ev-1',
    day: 'day1',
    type: 'location',
    time: '10:00',
    title: '경복궁 투어',
    placeName: '경복궁',
    subtitle: '',
    chips: ['문화재', '오전 투어'],
    coordinate: [126.9768, 37.5796],
  },
  {
    id: 'ev-2',
    day: 'day1',
    type: 'photo',
    time: '11:30',
    title: '경복궁의 봄',
    subtitle: '',
    placeName: '경복궁 향원정',
    eventMemo: '한복 입고 찍은 사진들이 정말 잘 나왔어요! 날씨도 완벽했고요.',
    chips: ['사진 4장', '한복 체험'],
    photoUrls: [...PHOTO_STACK],
    photoContributors: PHOTO_CONTRIBUTORS,
    photoItems: [
      { id: 'ev-2-photo-1', source: PHOTO_STACK[0], contributorId: 'user-1', memo: '첫 장은 광장 정면 구도.' },
      { id: 'ev-2-photo-2', source: PHOTO_STACK[1], contributorId: 'user-2', memo: '이동하면서 잡은 거리 컷.' },
      { id: 'ev-2-photo-3', source: PHOTO_STACK[2], contributorId: 'user-3', memo: '건물 라인이 예쁘게 나온 장면.' },
      { id: 'ev-2-photo-4', source: PHOTO_STACK[3], contributorId: 'user-1', memo: '마지막으로 하늘까지 같이 담은 컷.' },
    ],
    coordinate: [126.9772, 37.5815],
  },
  {
    id: 'ev-3',
    day: 'day1',
    type: 'payment',
    time: '13:00',
    title: '광화문 일식당',
    subtitle: '',
    amount: '₩58,000',
    chips: ['점심식사', '내돈내산'],
    paymentStatus: 'confirmed',
    coordinate: [126.9755, 37.5721],
  },
  {
    id: 'ev-4',
    day: 'day1',
    type: 'location',
    time: '15:20',
    title: '남산 타워 전망대',
    subtitle: '',
    placeName: 'N서울타워',
    chips: ['랜드마크', '전망대'],
    coordinate: [126.9882, 37.5512],
  },
  {
    id: 'ev-5',
    day: 'day1',
    type: 'photo',
    time: '19:00',
    title: '강남의 야경',
    subtitle: '',
    placeName: '강남역 11번 출구',
    eventMemo: '사람이 정말 많았지만 화려한 불빛들이 예뻤어요.',
    chips: ['사진 2장', '도심 야경'],
    photoUrls: [PHOTO_STACK[0], PHOTO_STACK[1]],
    photoContributors: PHOTO_CONTRIBUTORS.slice(0, 2),
    photoItems: [
      { id: 'ev-5-photo-1', source: PHOTO_STACK[0], contributorId: 'user-1', memo: '야경 시작될 때 찍은 컷.' },
      { id: 'ev-5-photo-2', source: PHOTO_STACK[1], contributorId: 'user-2', memo: '조명 들어온 뒤 분위기 사진.' },
    ],
    coordinate: [127.0276, 37.4979],
  },
  {
    id: 'ev-6',
    day: 'day2',
    type: 'location',
    time: '10:30',
    title: '서울숲 산책',
    subtitle: '',
    placeName: '서울숲 성수동',
    chips: ['피크닉', '힐링'],
    coordinate: [127.0448, 37.5447],
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
