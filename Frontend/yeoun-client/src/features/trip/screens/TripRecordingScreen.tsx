import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Mapbox from '@rnmapbox/maps';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { configureMapbox } from '@/src/lib/mapbox';
import { globalUserState, subscribeUser, updateUser } from '@/src/store/userStore';

const hasMapboxToken = configureMapbox();
const MAX_MAP_HEIGHT = 620;
const MIN_MAP_HEIGHT = 250;
const MAP_COLLAPSE_DISTANCE = 260;
const INITIAL_PANEL_PEEK = 120;
const MAP_SIDE_MARGIN = 16;
const MAP_TOP_OFFSET = 82;
const PANEL_TOP_OFFSET = 118;

type DayFilter = 'all' | 'day1' | 'day2' | 'day3';
type TimelineEventType = 'location' | 'photo' | 'payment' | 'memo' | 'voice' | 'emotion';
type Coordinate = [number, number];
type MapFilterKey = 'showPhotoPins' | 'showPaymentPins' | 'showMemoPins';
type PhotoContributor = {
  id: string;
  name: string;
  color: string;
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
  photoItems?: {
    id: string;
    source: number;
    memo?: string;
    contributorId?: string;
  }[];
};

type TripDay = {
  id: Exclude<DayFilter, 'all'>;
  label: string;
  dateLabel: string;
  distanceKm: number;
  summary: string;
  route: Coordinate[];
};

const PHOTO_STACK = [
  require('@/assets/images/trip_placeholder_1.png'),
  require('@/assets/images/trip_placeholder_2.png'),
  require('@/assets/images/trip_placeholder_3.png'),
];

const TRIP_DAYS: TripDay[] = [
  {
    id: 'day1',
    label: 'Day 1',
    dateLabel: '03.11',
    distanceKm: 12.8,
    summary: '서울 도심을 걸으며 사진과 결제를 함께 기록한 날이에요.',
    route: [
      [126.9784, 37.5667],
      [126.9822, 37.5703],
      [126.9898, 37.5707],
      [126.9958, 37.5712],
      [127.0014, 37.5701],
    ],
  },
  {
    id: 'day2',
    label: 'Day 2',
    dateLabel: '03.12',
    distanceKm: 9.4,
    summary: '성수 일대에서 메모와 감정 기록이 중심이 된 구간이에요.',
    route: [
      [127.0437, 37.5447],
      [127.0479, 37.5466],
      [127.0502, 37.5479],
      [127.0534, 37.5454],
      [127.0574, 37.5442],
    ],
  },
  {
    id: 'day3',
    label: 'Day 3',
    dateLabel: '03.13',
    distanceKm: 14.2,
    summary: '한강 근처를 따라 이동하며 음성 메모와 결제가 쌓인 하루예요.',
    route: [
      [126.9837, 37.5392],
      [126.9873, 37.5372],
      [126.9919, 37.5346],
      [126.9972, 37.5314],
      [127.0028, 37.5289],
    ],
  },
];

export const TIMELINE_EVENTS: TimelineEvent[] = [
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

const EVENT_THEME: Record<TimelineEventType, { icon: keyof typeof MaterialIcons.glyphMap; accent: string; surface: string }> = {
  location: { icon: 'near-me', accent: '#1F78D1', surface: '#E9F3FF' },
  photo: { icon: 'photo-library', accent: '#4C8E5E', surface: '#EDF7EE' },
  payment: { icon: 'credit-card', accent: '#D15D36', surface: '#FFF0E8' },
  memo: { icon: 'edit-note', accent: '#7661D9', surface: '#F2EEFF' },
  voice: { icon: 'mic', accent: '#C44A7E', surface: '#FFEAF2' },
  emotion: { icon: 'favorite', accent: '#D67D2F', surface: '#FFF4E7' },
};

const MAP_FILTER_META: Array<{ key: MapFilterKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { key: 'showPhotoPins', label: '사진', icon: 'photo-library' },
  { key: 'showPaymentPins', label: '결제', icon: 'credit-card' },
  { key: 'showMemoPins', label: '메모', icon: 'edit-note' },
];

function getBounds(route: Coordinate[]) {
  const longitudes = route.map(([longitude]) => longitude);
  const latitudes = route.map(([, latitude]) => latitude);

  return {
    northEast: [Math.max(...longitudes), Math.max(...latitudes)] as Coordinate,
    southWest: [Math.min(...longitudes), Math.min(...latitudes)] as Coordinate,
  };
}

function getFilteredDays(activeFilter: DayFilter) {
  return activeFilter === 'all' ? TRIP_DAYS : TRIP_DAYS.filter((day) => day.id === activeFilter);
}

export default function TripRecordingScreen() {
  const router = useRouter();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const cardPositionsRef = useRef<Record<string, number>>({});
  const [scrollOffset, setScrollOffset] = useState(0);

  const [activeFilter, setActiveFilter] = useState<DayFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<{ eventId: string; photoIndex: number } | null>(null);
  const [mapPreferences, setMapPreferences] = useState({
    showPhotoPins: globalUserState.showPhotoPins,
    showPaymentPins: globalUserState.showPaymentPins,
    showMemoPins: globalUserState.showMemoPins,
  });

  const filteredDays = useMemo(() => getFilteredDays(activeFilter), [activeFilter]);
  const filteredEvents = useMemo(
    () => TIMELINE_EVENTS.filter((event) => activeFilter === 'all' || event.day === activeFilter),
    [activeFilter]
  );
  const routeOnlyMode = !mapPreferences.showPhotoPins && !mapPreferences.showPaymentPins && !mapPreferences.showMemoPins;
  const filteredMapEvents = useMemo(
    () =>
      filteredEvents.filter((event) => {
        if (!event.coordinate || routeOnlyMode) {
          return false;
        }

        if (event.type === 'photo') {
          return mapPreferences.showPhotoPins;
        }

        if (event.type === 'payment') {
          return mapPreferences.showPaymentPins;
        }

        if (event.type === 'memo') {
          return mapPreferences.showMemoPins;
        }

        return false;
      }),
    [filteredEvents, mapPreferences.showMemoPins, mapPreferences.showPaymentPins, mapPreferences.showPhotoPins, routeOnlyMode]
  );

  const routeCoordinates = useMemo(() => filteredDays.flatMap((day) => day.route), [filteredDays]);
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
    () => ({
      totalDistanceLabel: `${filteredDays.reduce((sum, day) => sum + day.distanceKm, 0).toFixed(1)}km`,
      visitedPlaceCount: filteredEvents.filter((event) => Boolean(event.coordinate)).length,
      photoCount: filteredEvents.reduce((sum, event) => sum + (event.photoItems?.length ?? 0), 0),
      paymentCount: filteredEvents.filter((event) => event.type === 'payment').length,
    }),
    [filteredDays, filteredEvents]
  );
  const selectedPhotoEvent = useMemo(
    () => filteredEvents.find((event) => event.id === photoViewer?.eventId) ?? null,
    [filteredEvents, photoViewer]
  );
  const selectedPhotoItem = selectedPhotoEvent?.photoItems?.[photoViewer?.photoIndex ?? -1] ?? null;
  const selectedPhotoContributor = useMemo(
    () =>
      selectedPhotoEvent?.photoContributors?.find((contributor) => contributor.id === selectedPhotoItem?.contributorId) ?? null,
    [selectedPhotoEvent, selectedPhotoItem]
  );
  const collapseProgress = Math.min(scrollOffset / MAP_COLLAPSE_DISTANCE, 1);
  const mapHeight = MAX_MAP_HEIGHT - (MAX_MAP_HEIGHT - MIN_MAP_HEIGHT) * collapseProgress;
  const mapRadius = 32 - 8 * collapseProgress;
  const panelLift = -145 * collapseProgress;

  useEffect(() => {
    if (routeCoordinates.length < 2) {
      return;
    }

    const { northEast, southWest } = getBounds(routeCoordinates);
    cameraRef.current?.fitBounds(northEast, southWest, 56, 900);
  }, [routeCoordinates]);

  useEffect(() => {
    const unsubscribe = subscribeUser(() => {
      setMapPreferences({
        showPhotoPins: globalUserState.showPhotoPins,
        showPaymentPins: globalUserState.showPaymentPins,
        showMemoPins: globalUserState.showMemoPins,
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedEventId && !filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);

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
    updateUser({ [key]: !mapPreferences[key] });
  };

  const toggleRouteOnlyMode = () => {
    if (routeOnlyMode) {
      updateUser({
        showPhotoPins: true,
        showPaymentPins: true,
        showMemoPins: true,
      });
      return;
    }

    updateUser({
      showPhotoPins: false,
      showPaymentPins: false,
      showMemoPins: false,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={22} color="#17201A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>제주도 여행</Text>
            <View style={styles.recordingInline}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingInlineText}>기록중</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.syncHeaderButton} activeOpacity={0.88}>
            <MaterialIcons name="sync" size={16} color="#274232" />
            <Text style={styles.syncHeaderButtonText}>동기화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreButton} onPress={() => setIsMenuOpen((prev) => !prev)} activeOpacity={0.85}>
            <MaterialIcons name="more-horiz" size={22} color="#274232" />
          </TouchableOpacity>
        </View>
      </View>

      {isMenuOpen ? (
        <Pressable style={styles.menuBackdrop} onPress={() => setIsMenuOpen(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); router.replace('/(tabs)'); }} activeOpacity={0.85}>
              <MaterialIcons name="flag" size={18} color="#244934" />
              <Text style={styles.menuItemText}>여행 종료</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); router.push('/trip/start'); }} activeOpacity={0.85}>
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

      <Modal visible={Boolean(photoViewer && selectedPhotoEvent && selectedPhotoItem)} transparent animationType="fade" onRequestClose={() => setPhotoViewer(null)}>
        <Pressable style={styles.photoModalBackdrop} onPress={() => setPhotoViewer(null)}>
          <Pressable style={styles.photoModalCard} onPress={() => undefined}>
            <View style={styles.photoModalHeader}>
              <View style={styles.photoModalHeaderCopy}>
                <Text style={styles.photoModalTitle}>{selectedPhotoEvent?.title}</Text>
                {selectedPhotoContributor ? (
                  <View style={styles.photoModalMetaRow}>
                    <View style={[styles.photoModalAvatar, { backgroundColor: selectedPhotoContributor.color }]}>
                      <Text style={styles.photoModalAvatarText}>{selectedPhotoContributor.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.photoModalMeta}>{`photo by ${selectedPhotoContributor.name}`}</Text>
                  </View>
                ) : (
                  <Text style={styles.photoModalMeta}>사진 상세</Text>
                )}
              </View>
              <View style={styles.photoModalHeaderActions}>
                <View style={styles.photoModalTextActionRow}>
                  <TouchableOpacity activeOpacity={0.85}>
                    <Text style={styles.photoModalTextAction}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85}>
                    <Text style={[styles.photoModalTextAction, styles.photoModalDeleteAction]}>삭제</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setPhotoViewer(null)} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={22} color="#223428" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedPhotoItem ? (
              <Image source={selectedPhotoItem.source} style={styles.photoModalImage} contentFit="cover" />
            ) : null}

            {selectedPhotoEvent?.placeName ? (
              <Text style={styles.photoModalSectionLabel}>장소</Text>
            ) : null}
            {selectedPhotoEvent?.placeName ? <Text style={styles.photoModalSectionBody}>{selectedPhotoEvent.placeName}</Text> : null}

            <Text style={styles.photoModalSectionLabel}>이벤트 메모</Text>
            <Text style={styles.photoModalSectionBody}>{selectedPhotoEvent?.eventMemo ?? selectedPhotoEvent?.subtitle}</Text>

            <Text style={styles.photoModalSectionLabel}>사진 메모</Text>
            <Text style={styles.photoModalSectionBody}>{selectedPhotoItem?.memo ?? '이 사진에 대한 메모가 아직 없어요.'}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.floatingMapWrap, { height: mapHeight, borderRadius: mapRadius }]}>
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
          <Mapbox.Camera ref={cameraRef} zoomLevel={13.4} centerCoordinate={routeCoordinates[0] ?? [126.9784, 37.5667]} />
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
            <Mapbox.CircleLayer
              id="trip-events-shadow"
              style={{
                circleColor: '#102118',
                circleOpacity: 0.12,
                circleRadius: ['case', ['==', ['get', 'selected'], 1], 12, 10],
                circleTranslate: [0, 2],
              }}
            />
            <Mapbox.CircleLayer
              id="trip-events-ring"
              style={{
                circleColor: '#FFFFFF',
                circleRadius: ['case', ['==', ['get', 'selected'], 1], 11, 9],
              }}
            />
            <Mapbox.CircleLayer
              id="trip-events-core"
              style={{
                circleColor: ['get', 'accent'],
                circleRadius: ['case', ['==', ['get', 'selected'], 1], 8, 6],
                circleStrokeColor: '#FFFFFF',
                circleStrokeWidth: ['case', ['==', ['get', 'selected'], 1], 2, 1],
              }}
            />
          </Mapbox.ShapeSource>
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
            const isActive = mapPreferences[filter.key];
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
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          setScrollOffset(event.nativeEvent.contentOffset.y);
        }}
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
        <View
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
            {TRIP_DAYS.map((day) => {
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
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.placeName ? <Text style={styles.eventPlaceName}>{event.placeName}</Text> : null}
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
                    {event.chips?.length ? (
                      <View style={styles.eventMetaRow}>
                        <View style={styles.chipRow}>
                          {event.chips.map((chip) => (
                            <View key={`${event.id}-${chip}`} style={[styles.eventChip, { backgroundColor: theme.surface }]}>
                              <Text style={[styles.eventChipText, { color: theme.accent }]}>{chip}</Text>
                            </View>
                          ))}
                        </View>
                        {event.photoItems?.length ? (
                          <View style={styles.photoEventActionRow}>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={(pressEvent) => {
                                pressEvent.stopPropagation();
                              }}
                            >
                              <Text style={styles.photoEventActionText}>수정</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={(pressEvent) => {
                                pressEvent.stopPropagation();
                              }}
                            >
                              <Text style={[styles.photoEventActionText, styles.photoEventDeleteText]}>삭제</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.ghostButton} activeOpacity={0.88}>
              <MaterialIcons name="playlist-add" size={18} color="#54655B" />
              <Text style={styles.ghostButtonText}>메모 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.88}>
              <Text style={styles.endButtonText}>여행 종료</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF4EC' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 20 },
  backButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  headerTextWrap: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordingInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recordingDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#F35B4F' },
  recordingInlineText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#F35B4F' },
  headerTitle: { fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#17201A' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncHeaderButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 18, backgroundColor: '#E3EBDD', paddingHorizontal: 12, height: 36 },
  syncHeaderButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#274232' },
  moreButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { position: 'absolute', top: 72, right: 16, left: 16, bottom: 0, zIndex: 30 },
  menuCard: { marginLeft: 'auto', width: 156, borderRadius: 20, backgroundColor: '#FCFEFB', paddingVertical: 8, shadowColor: '#223428', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  menuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  menuItemText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#244934' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18, 25, 20, 0.3)', justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: { borderRadius: 28, backgroundColor: '#FCFEFB', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119' },
  modalBody: { marginTop: 12, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 22, color: '#66756C' },
  photoModalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 18, 14, 0.45)', justifyContent: 'center', paddingHorizontal: 18 },
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
  photoModalImage: { width: '100%', aspectRatio: 1, borderRadius: 22, marginTop: 16, backgroundColor: '#E7ECE5' },
  photoModalSectionLabel: { marginTop: 16, fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#7A867F' },
  photoModalSectionBody: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#243028' },
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
  eventTitle: { marginTop: 6, fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#182119' },
  eventPlaceName: { marginTop: 6, fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#486356' },
  eventSubtitle: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#708076' },
  eventMemoText: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, color: '#55635B' },
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
  photoEventDeleteText: { color: '#A45A49' },
  eventActionDeleteText: { color: '#A45A49' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  eventChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  eventChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12 },
  bottomActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 14 },
  ghostButton: { flex: 1, height: 54, borderRadius: 27, backgroundColor: '#E3EAE0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, color: '#54655B' },
  endButton: { flex: 1.2, height: 54, borderRadius: 27, backgroundColor: '#234634', alignItems: 'center', justifyContent: 'center' },
  endButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F5FAF4' },
});
