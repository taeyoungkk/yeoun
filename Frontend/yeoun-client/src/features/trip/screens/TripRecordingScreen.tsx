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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAPBOX_ACCESS_TOKEN, configureMapbox } from '@/src/lib/mapbox';

const hasMapboxToken = configureMapbox();
const MAX_MAP_HEIGHT = 620;
const MIN_MAP_HEIGHT = 250;
const MAP_COLLAPSE_DISTANCE = 260;
const INITIAL_PANEL_PEEK = 170;

type DayFilter = 'all' | 'day1' | 'day2' | 'day3';
type TimelineEventType = 'location' | 'photo' | 'payment' | 'memo' | 'voice' | 'emotion';
type Coordinate = [number, number];

type TimelineEvent = {
  id: string;
  day: Exclude<DayFilter, 'all'>;
  type: TimelineEventType;
  time: string;
  title: string;
  subtitle: string;
  amount?: string;
  chips?: string[];
  coordinate?: Coordinate;
  photoSources?: number[];
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
    summary: '도착 후 종로와 을지로를 천천히 걸은 날',
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
    summary: '성수 골목과 서울숲을 길게 머문 날',
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
    summary: '해방촌과 한강 야경까지 이어진 날',
    route: [
      [126.9837, 37.5392],
      [126.9873, 37.5372],
      [126.9919, 37.5346],
      [126.9972, 37.5314],
      [127.0028, 37.5289],
    ],
  },
];

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'ev-1',
    day: 'day1',
    type: 'location',
    time: '10:20',
    title: '안국역 도착',
    subtitle: 'GPS 이동 시작이 자동 기록되었어요.',
    chips: ['도보 1.2km', '정확도 양호'],
    coordinate: [126.9822, 37.5703],
  },
  {
    id: 'ev-2',
    day: 'day1',
    type: 'photo',
    time: '11:05',
    title: '북촌 골목 사진 동기화',
    subtitle: '촬영 시간을 기준으로 타임라인 중간에 삽입되었어요.',
    chips: ['사진 3장', '자동 매칭'],
    coordinate: [126.9898, 37.5707],
    photoSources: PHOTO_STACK,
  },
  {
    id: 'ev-3',
    day: 'day1',
    type: 'payment',
    time: '12:40',
    title: '런던베이글 결제',
    subtitle: '카드 내역에서 자동 인식된 지출이에요.',
    amount: '₩27,000',
    chips: ['식비', '수정 가능'],
    coordinate: [127.0014, 37.5701],
  },
  {
    id: 'ev-4',
    day: 'day2',
    type: 'memo',
    time: '14:10',
    title: '소품샵 메모 추가',
    subtitle: '향이 좋았던 캔들 브랜드를 다시 보기로 남겼어요.',
    chips: ['사용자 보정'],
    coordinate: [127.0479, 37.5466],
  },
  {
    id: 'ev-5',
    day: 'day2',
    type: 'emotion',
    time: '16:20',
    title: '오늘 감정 기록',
    subtitle: '산책하듯 여유롭고 기분이 좋아요.',
    chips: ['평온함', '맑음'],
    coordinate: [127.0534, 37.5454],
  },
  {
    id: 'ev-6',
    day: 'day3',
    type: 'voice',
    time: '19:30',
    title: '음성 메모 저장',
    subtitle: '해질 무렵 분위기가 좋아 바로 녹음했어요.',
    chips: ['00:42', '사용자 보정'],
    coordinate: [126.9919, 37.5346],
  },
  {
    id: 'ev-7',
    day: 'day3',
    type: 'payment',
    time: '20:15',
    title: '한강 편의점 결제',
    subtitle: '자동 인식된 결제 내역을 여정과 연결했어요.',
    amount: '₩13,200',
    chips: ['간식', '삭제 가능'],
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
  const scrollRef = useRef<Animated.ScrollView>(null);
  const cardPositionsRef = useRef<Record<string, number>>({});
  const scrollY = useRef(new Animated.Value(0)).current;

  const [activeFilter, setActiveFilter] = useState<DayFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [mapErrorDetail, setMapErrorDetail] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const filteredDays = useMemo(() => getFilteredDays(activeFilter), [activeFilter]);
  const filteredEvents = useMemo(
    () => TIMELINE_EVENTS.filter((event) => activeFilter === 'all' || event.day === activeFilter),
    [activeFilter]
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

  const animatedMapHeight = scrollY.interpolate({
    inputRange: [0, MAP_COLLAPSE_DISTANCE],
    outputRange: [MAX_MAP_HEIGHT, MIN_MAP_HEIGHT],
    extrapolate: 'clamp',
  });
  const animatedMapRadius = scrollY.interpolate({
    inputRange: [0, MAP_COLLAPSE_DISTANCE],
    outputRange: [32, 24],
    extrapolate: 'clamp',
  });
  const animatedPanelLift = scrollY.interpolate({
    inputRange: [0, MAP_COLLAPSE_DISTANCE],
    outputRange: [0, -110],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (routeCoordinates.length < 2) return;
    const { northEast, southWest } = getBounds(routeCoordinates);
    cameraRef.current?.fitBounds(northEast, southWest, 56, 900);
  }, [routeCoordinates]);

  const handleEventLayout = (eventId: string, event: LayoutChangeEvent) => {
    cardPositionsRef.current[eventId] = event.nativeEvent.layout.y;
  };

  const focusEvent = (eventId: string) => {
    const targetEvent = filteredEvents.find((event) => event.id === eventId);
    if (!targetEvent?.coordinate) return;

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

  const setMapFailureDetail = (event: unknown) => {
    const nativeEvent =
      typeof event === 'object' && event !== null && 'nativeEvent' in event
        ? (event as { nativeEvent?: unknown }).nativeEvent
        : null;
    const payload =
      nativeEvent && typeof nativeEvent === 'object' && 'payload' in nativeEvent
        ? (nativeEvent as { payload?: unknown }).payload
        : nativeEvent;

    if (typeof payload === 'string' && payload.trim()) {
      setMapErrorDetail(payload);
      return;
    }

    if (payload && typeof payload === 'object') {
      const message =
        'message' in payload && typeof (payload as { message?: unknown }).message === 'string'
          ? (payload as { message: string }).message
          : null;
      if (message) {
        setMapErrorDetail(message);
        return;
      }
      try {
        setMapErrorDetail(JSON.stringify(payload));
        return;
      } catch {
        setMapErrorDetail('Failed to parse the native Mapbox error payload.');
        return;
      }
    }

    setMapErrorDetail('Mapbox style or network loading failed.');
  };

  const totalDistanceLabel = `${filteredDays.reduce((sum, day) => sum + day.distanceKm, 0).toFixed(1)}km`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={22} color="#17201A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerEyebrow}>Spring Archive</Text>
          <Text style={styles.headerTitle}>서울 3박 4일</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingBadgeText}>기록중</Text>
          </View>
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
              <Text style={styles.menuItemText}>설명</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      ) : null}

      <Modal visible={isInfoOpen} transparent animationType="fade" onRequestClose={() => setIsInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>자동 기록 안내</Text>
              <TouchableOpacity onPress={() => setIsInfoOpen(false)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color="#223428" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>여행 중 페이지는 GPS 이동 경로와 사진, 결제 내역을 자동으로 쌓아두는 기록 화면입니다.</Text>
            <Text style={styles.modalBody}>사진은 촬영 시간 기준으로 타임라인 사이에 들어가고, 사용자는 필요한 순간에만 보정을 추가하면 됩니다.</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Animated.View style={[styles.floatingMapWrap, { height: animatedMapHeight, borderRadius: animatedMapRadius }]}>
        <Mapbox.MapView
          style={StyleSheet.absoluteFill}
          styleURL={Mapbox.StyleURL.Outdoors}
          scaleBarEnabled={false}
          attributionEnabled
          logoEnabled
          compassEnabled={false}
          onDidFinishLoadingMap={() => {
            setIsMapReady(true);
            setMapLoadFailed(false);
            setMapErrorDetail(null);
          }}
          onDidFailLoadingMap={(event) => {
            setIsMapReady(false);
            setMapLoadFailed(true);
            setMapFailureDetail(event);
          }}
        >
          <Mapbox.Camera ref={cameraRef} zoomLevel={13.4} centerCoordinate={routeCoordinates[0] ?? [126.9784, 37.5667]} />
          <Mapbox.ShapeSource id="trip-route" shape={routeShape}>
            <Mapbox.LineLayer
              id="trip-route-line"
              style={{ lineColor: '#3787FF', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.92 }}
            />
          </Mapbox.ShapeSource>
          {filteredEvents.filter((event) => event.coordinate).map((event) => {
            const theme = EVENT_THEME[event.type];
            const isSelected = selectedEventId === event.id;
            return (
              <Mapbox.PointAnnotation
                key={event.id}
                id={event.id}
                coordinate={event.coordinate as Coordinate}
                onSelected={() => focusEvent(event.id)}
              >
                <View style={[styles.markerOuter, { backgroundColor: isSelected ? theme.accent : '#FFFFFF' }]}>
                  <View style={[styles.markerInner, { backgroundColor: theme.surface }]}>
                    <MaterialIcons name={theme.icon} size={16} color={theme.accent} />
                  </View>
                </View>
              </Mapbox.PointAnnotation>
            );
          })}
        </Mapbox.MapView>

        {!isMapReady ? (
          <View style={styles.mapStatusOverlay} pointerEvents="none">
            <View style={styles.mapStatusCard}>
              <MaterialIcons name={!hasMapboxToken || mapLoadFailed ? 'wifi-off' : 'map'} size={18} color={!hasMapboxToken || mapLoadFailed ? '#A65F4B' : '#415D4C'} />
              <Text style={styles.mapStatusTitle}>
                {!hasMapboxToken ? 'Mapbox token is missing' : mapLoadFailed ? 'Map load failed' : 'Loading map'}
              </Text>
              <Text style={styles.mapStatusText}>
                {!hasMapboxToken
                  ? 'Add a valid public Mapbox token first.'
                  : mapLoadFailed
                    ? 'The style request failed. This usually means the token is invalid or restricted.'
                    : 'Preparing the initial style and route data.'}
              </Text>
              {!hasMapboxToken ? (
                <View style={styles.mapErrorBox}>
                  <Text style={styles.mapErrorLabel}>Setup</Text>
                  <Text style={styles.mapErrorValue}>Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk...` to `.env` and restart the app.</Text>
                </View>
              ) : (
                <View style={styles.mapErrorBox}>
                  <Text style={styles.mapErrorLabel}>Current token tail</Text>
                  <Text style={styles.mapErrorValue}>{MAPBOX_ACCESS_TOKEN.slice(-10)}</Text>
                </View>
              )}
              {mapLoadFailed && mapErrorDetail ? (
                <View style={styles.mapErrorBox}>
                  <Text style={styles.mapErrorLabel}>Mapbox detail</Text>
                  <Text style={styles.mapErrorValue}>{mapErrorDetail}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.mapOverlayTop}>
          <View style={styles.autoRecordPill}>
            <MaterialIcons name="auto-awesome" size={16} color="#264837" />
            <Text style={styles.autoRecordText}>GPS 경로 자동 기록중</Text>
          </View>
          <TouchableOpacity style={styles.syncButton} activeOpacity={0.88}>
            <MaterialIcons name="sync" size={18} color="#203629" />
            <Text style={styles.syncButtonText}>사진 동기화</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapOverlayBottom}>
          <View style={styles.metricChip}>
            <MaterialIcons name="route" size={16} color="#356AF4" />
            <Text style={styles.metricLabel}>{totalDistanceLabel}</Text>
          </View>
          <View style={styles.metricChip}>
            <MaterialIcons name="schedule" size={16} color="#2F6A4B" />
            <Text style={styles.metricLabel}>{filteredEvents.length}개 이벤트</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        refreshControl={
          <RefreshControl
            refreshing={false}
            tintColor="#5C6D61"
            progressViewOffset={8}
            onRefresh={() => {
              setIsMapReady(false);
              setMapLoadFailed(false);
              setMapErrorDetail(null);
            }}
          />
        }
      >
        <Animated.View
          style={[
            styles.panel,
            {
              paddingTop: MAX_MAP_HEIGHT - INITIAL_PANEL_PEEK,
              transform: [{ translateY: animatedPanelLift }],
            },
          ]}
        >
          <View style={styles.panelHandle} />
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabRow}>
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
          </Animated.ScrollView>
          {filteredDays.map((day) => (
            <View key={day.id} style={styles.daySummaryRow}>
              <View>
                <Text style={styles.daySummaryTitle}>{day.label} · {day.dateLabel}</Text>
                <Text style={styles.daySummaryText}>{day.summary}</Text>
              </View>
              <View style={styles.dayDistanceBadge}>
                <MaterialIcons name="directions-walk" size={16} color="#5A6D61" />
                <Text style={styles.dayDistanceText}>{day.distanceKm.toFixed(1)}km</Text>
              </View>
            </View>
          ))}
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
                      {event.amount ? <Text style={styles.eventAmount}>{event.amount}</Text> : null}
                    </View>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
                    {event.photoSources ? (
                      <View style={styles.photoRow}>
                        {event.photoSources.map((photoSource, photoIndex) => (
                          <Image key={`${event.id}-${photoIndex}`} source={photoSource} style={styles.photoThumb} contentFit="cover" />
                        ))}
                      </View>
                    ) : null}
                    {event.chips?.length ? (
                      <View style={styles.chipRow}>
                        {event.chips.map((chip) => (
                          <View key={`${event.id}-${chip}`} style={[styles.eventChip, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.eventChipText, { color: theme.accent }]}>{chip}</Text>
                          </View>
                        ))}
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
        </Animated.View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF4EC' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6EDE3', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  headerEyebrow: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#87948B', letterSpacing: 0.3 },
  headerTitle: { marginTop: 4, fontFamily: 'Pretendard-Bold', fontSize: 28, color: '#17201A' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#DCE8DA' },
  recordingDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#3F8B57' },
  recordingBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#325240' },
  moreButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCE8DA', alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { position: 'absolute', top: 72, right: 16, left: 16, bottom: 0, zIndex: 30 },
  menuCard: { marginLeft: 'auto', width: 156, borderRadius: 20, backgroundColor: '#FCFEFB', paddingVertical: 8, shadowColor: '#223428', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  menuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  menuItemText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#244934' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18, 25, 20, 0.3)', justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: { borderRadius: 28, backgroundColor: '#FCFEFB', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119' },
  modalBody: { marginTop: 12, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 22, color: '#66756C' },
  floatingMapWrap: { position: 'absolute', top: 96, left: 16, right: 16, overflow: 'hidden', backgroundColor: '#CBD7CE', shadowColor: '#1E2B22', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8, zIndex: 1 },
  content: { paddingBottom: 34 },
  mapOverlayTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  autoRecordPill: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, backgroundColor: 'rgba(244, 248, 242, 0.94)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 11 },
  autoRecordText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#264837' },
  syncButton: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 14, paddingVertical: 11 },
  syncButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#203629' },
  mapOverlayBottom: { position: 'absolute', left: 14, bottom: 22, flexDirection: 'row', gap: 10 },
  mapStatusOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(194, 206, 198, 0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  mapStatusCard: { width: '100%', borderRadius: 24, backgroundColor: 'rgba(248, 250, 247, 0.96)', paddingHorizontal: 18, paddingVertical: 18 },
  mapStatusTitle: { marginTop: 10, fontFamily: 'Pretendard-Bold', fontSize: 17, color: '#1B261E' },
  mapStatusText: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, color: '#65746B' },
  mapErrorBox: { marginTop: 12, borderRadius: 16, backgroundColor: '#EEF2EC', paddingHorizontal: 12, paddingVertical: 10 },
  mapErrorLabel: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#6E7F74' },
  mapErrorValue: { marginTop: 4, fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18, color: '#44554B' },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 },
  metricLabel: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#243128' },
  markerOuter: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', shadowColor: '#223227', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  markerInner: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  panel: { marginTop: 180, backgroundColor: '#EFF4EC', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 16, minHeight: 1200 },
  panelHandle: { width: 54, height: 5, borderRadius: 999, backgroundColor: '#CDD6CA', alignSelf: 'center', marginBottom: 18 },
  dayTabRow: { gap: 10, paddingTop: 8, paddingBottom: 18 },
  dayTab: { minWidth: 76, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, backgroundColor: '#E4ECE2', alignItems: 'center' },
  dayTabActive: { backgroundColor: '#244934' },
  dayTabText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#536258' },
  dayTabTextActive: { color: '#F7FBF6' },
  dayTabSubText: { marginTop: 2, fontFamily: 'Pretendard-Medium', fontSize: 11, color: '#8A978F' },
  dayTabSubTextActive: { color: '#C6D8CC' },
  daySummaryRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 6 },
  daySummaryTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: '#1A241D' },
  daySummaryText: { marginTop: 4, fontFamily: 'Pretendard-Regular', fontSize: 13, color: '#728077' },
  dayDistanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#E3ECE2' },
  dayDistanceText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#5A6D61' },
  timelineWrap: { marginTop: 22, paddingBottom: 8 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  timelineRail: { width: 30, alignItems: 'center' },
  timelineDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 3, flex: 1, marginTop: 8, marginBottom: -2, borderRadius: 999, backgroundColor: '#9ABCEA' },
  eventCard: { flex: 1, marginBottom: 18, borderRadius: 26, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 16 },
  eventCardSelected: { borderWidth: 2, borderColor: '#9ABCEA' },
  eventHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eventTime: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#91A19A' },
  eventAmount: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#CF643B' },
  eventTitle: { marginTop: 6, fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#182119' },
  eventSubtitle: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#708076' },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  photoThumb: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#E7ECE5' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  eventChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  eventChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12 },
  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 14 },
  ghostButton: { flex: 1, height: 54, borderRadius: 27, backgroundColor: '#E3EAE0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, color: '#54655B' },
  endButton: { flex: 1.2, height: 54, borderRadius: 27, backgroundColor: '#234634', alignItems: 'center', justifyContent: 'center' },
  endButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F5FAF4' },
});
