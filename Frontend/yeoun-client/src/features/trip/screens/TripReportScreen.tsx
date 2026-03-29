import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getTripExpensesApi, type TripExpenseItem } from '@/src/api/expense';
import {
  getLatestSettlementApi,
  type SettlementDetail,
} from '@/src/api/settlement';
import {
  getTimelineDayDetailApi,
  getTripTimelineDaysApi,
  type TimelineDayDetail,
  type TimelineDaySummary,
} from '@/src/api/timeline';
import { getTripDetailApi, getTripRouteDaysApi, type TripDetail, type TripRouteDayListItem } from '@/src/api/trip';
import { HouseSvg } from '@/src/components/icons/HouseSvg';
import { useUserStore } from '@/src/store';
import { useTripStore, type CurrentTrip } from '@/src/store/trip.store';
import { getTopDestinationName, calculateDistance, shortenLocationName, cleanLocationLabel } from '@/src/utils/trip-analysis-utils';

type ReportDay = {
  id: string;
  label: string;
  dateLabel: string;
  distanceKm: number;
  photoCount: number;
  eventCount: number;
};

type TimelineRow = {
  id: string;
  time: string;
  label: string;
  title: string;
};

const BARCODE_SEGMENTS = [4, 2, 3, 1, 2, 5, 2, 1, 4, 2, 5, 1, 2, 3, 2, 4, 1, 3, 2, 5, 1, 2, 4, 2, 3, 1];

const EVENT_LABEL: Record<string, string> = {
  PLACE_VISIT: '장소',
  MOVE: '이동',
  OTHER: '기록',
};

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const formatTripDate = (date?: string) => (date ? date.slice(2, 10).replace(/-/g, '.') : '--.--.--');
const formatDayLabel = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
const formatTime = (value?: string | null) => {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const normalizeRouteCoordinate = (coordinate?: number[]) =>
  Array.isArray(coordinate) && coordinate.length >= 2 ? ([coordinate[0], coordinate[1]] as [number, number]) : null;

const getRouteBoundaryCoordinates = (
  routeDays: TripRouteDayListItem[],
  inFlightLogs: { longitude: number; latitude: number }[],
) => {
  const sortedRouteDays = [...routeDays].sort((left, right) => left.day.localeCompare(right.day));
  const routeCoordinates = sortedRouteDays.flatMap((routeDay) =>
    routeDay.coordinates
      .map((coordinate) => normalizeRouteCoordinate(coordinate))
      .filter((coordinate): coordinate is [number, number] => coordinate !== null),
  );

  if (routeCoordinates.length > 0) {
    return {
      start: routeCoordinates[0],
      end: routeCoordinates[routeCoordinates.length - 1],
    };
  }

  if (inFlightLogs.length > 0) {
    return {
      start: [inFlightLogs[0].longitude, inFlightLogs[0].latitude] as [number, number],
      end: [inFlightLogs[inFlightLogs.length - 1].longitude, inFlightLogs[inFlightLogs.length - 1].latitude] as [number, number],
    };
  }

  return null;
};

const buildFallbackDays = (startDate?: string, endDate?: string): ReportDay[] => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const normalizedStart = new Date(start);
  const normalizedEnd = new Date(end);
  normalizedStart.setHours(0, 0, 0, 0);
  normalizedEnd.setHours(0, 0, 0, 0);

  const diffDays = Math.max(
    1,
    Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  return Array.from({ length: diffDays }, (_, index) => {
    const targetDate = new Date(normalizedStart);
    targetDate.setDate(normalizedStart.getDate() + index);

    return {
      id: `fallback-${index + 1}`,
      label: `${index + 1}일차`,
      dateLabel: formatDayLabel(targetDate),
      distanceKm: 0,
      photoCount: 0,
      eventCount: 0,
    };
  });
};

const normalizeDateKey = (value?: string) => value?.slice(0, 10) ?? '';
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const buildDateKeys = (startDate?: string, endDate?: string, fallbackDates: string[] = []) => {
  const normalizedFallback = Array.from(
    new Set(fallbackDates.map((value) => normalizeDateKey(value)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  if (!startDate || !endDate) {
    return normalizedFallback;
  }

  const start = new Date(`${normalizeDateKey(startDate)}T00:00:00`);
  const end = new Date(`${normalizeDateKey(endDate)}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return normalizedFallback;
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const mapTripDetailToCurrentTrip = (trip: TripDetail): CurrentTrip => ({
  tripId: trip.tripId,
  tripName: trip.title,
  startDate: trip.startDate,
  endDate: trip.endDate,
  memberCount: trip.memberCount ?? trip.participants ?? 0,
  origin: trip.country ?? '',
  destination: trip.region ?? trip.country ?? trip.title,
});

const buildReportDays = (
  timelineDays: TimelineDaySummary[],
  routeDays: TripRouteDayListItem[],
  startDate?: string,
  endDate?: string,
): ReportDay[] => {
  const timelineDayByDate = new Map(timelineDays.map((day) => [normalizeDateKey(day.dayDate), day]));
  const routeByDate = new Map<string, [number, number][]>();

  routeDays.forEach((routeDay) => {
    const dateKey = normalizeDateKey(routeDay.day);
    const coordinates = routeDay.coordinates
      .filter((coordinate): coordinate is [number, number] => Array.isArray(coordinate) && coordinate.length >= 2)
      .map(([longitude, latitude]) => [longitude, latitude] as [number, number]);

    if (coordinates.length > 0) {
      routeByDate.set(dateKey, [...(routeByDate.get(dateKey) ?? []), ...coordinates]);
    }
  });

  const dateKeys = buildDateKeys(startDate, endDate, [
    ...timelineDayByDate.keys(),
    ...routeByDate.keys(),
  ]);

  if (dateKeys.length === 0) {
    return buildFallbackDays(startDate, endDate);
  }

  return dateKeys.map((dateKey, index) => {
    const timelineDay = timelineDayByDate.get(dateKey);
    const routeCoordinates = routeByDate.get(dateKey) ?? [];

    return {
      id: timelineDay?.timelineDayId ?? `fallback-${index + 1}`,
      label: `DAY ${index + 1}`,
      dateLabel: formatDayLabel(new Date(`${dateKey}T00:00:00`)),
      distanceKm:
        timelineDay && timelineDay.distanceM > 0
          ? timelineDay.distanceM / 1000
          : calculateDistance(routeCoordinates),
      photoCount: timelineDay?.photoCount ?? 0,
      eventCount: timelineDay?.eventCount ?? 0,
    };
  });
};

const mapTimelineRows = (dayDetails: TimelineDayDetail[]): TimelineRow[] =>
  dayDetails
    .flatMap((day) =>
      day.events.map((event) => ({
        id: event.eventId,
        time: formatTime(event.startAt),
        label: EVENT_LABEL[event.eventType] ?? '기록',
        title: event.title || event.placeName || '기록',
        sortKey: event.startAt ?? `${day.dayDate}T00:00:00`,
      })),
    )
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _sortKey, ...row }) => row);

export default function TripReportScreen() {
  const params = useLocalSearchParams<{ mode?: string; tripId?: string; id?: string }>();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const reviewTrip = useTripStore((state) => state.reviewTrip);
  const inFlightLogs = useTripStore((state) => state.inFlightLogs);
  const currentUserId = useUserStore((state) => state.profile?.userId ?? null);
  const routeRefreshKey = useTripStore((state) => state.routeRefreshKey);
  const router = useRouter();

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineDays, setTimelineDays] = useState<TimelineDaySummary[]>([]);
  const [timelineDayDetails, setTimelineDayDetails] = useState<TimelineDayDetail[]>([]);
  const [routeDays, setRouteDays] = useState<TripRouteDayListItem[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [settlementDetail, setSettlementDetail] = useState<SettlementDetail | null>(null);
  const [mainDestination, setMainDestination] = useState<string | null>(null);
  const [originAddress, setOriginAddress] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeTrip, setRouteTrip] = useState<TripDetail | null>(null);

  const isReviewMode = params.mode === 'review';
  const routeTripId =
    typeof params.tripId === 'string'
      ? params.tripId
      : typeof params.id === 'string'
        ? params.id
        : null;
  const storeTrip = isReviewMode ? reviewTrip ?? currentTrip : currentTrip;
  const trip = useMemo<CurrentTrip | null>(() => {
    if (routeTrip && routeTripId && storeTrip?.tripId !== routeTripId) {
      return mapTripDetailToCurrentTrip(routeTrip);
    }

    return storeTrip;
  }, [routeTrip, routeTripId, storeTrip]);
  const receiptAppear = useRef(new Animated.Value(0)).current;

  const handleGoHome = () => router.replace('/(tabs)');
  const handleBackToTimeline = () => {
    if (trip?.tripId) {
      router.push({
        pathname: '/trip/recording',
        params: { tripId: trip.tripId, mode: isReviewMode ? 'review' : undefined },
      });
    } else {
      router.back();
    }
  };
  const handleOpenSettlementDetail = () => {
    if (!trip?.tripId) return;
    router.push({
      pathname: '/payment-member-summary',
      params: { tripId: trip.tripId },
    });
  };

  useEffect(() => {
    let mounted = true;

    const loadRouteTrip = async () => {
      if (!routeTripId || storeTrip?.tripId === routeTripId) {
        if (mounted) {
          setRouteTrip(null);
        }
        return;
      }

      const response = await getTripDetailApi(routeTripId);
      if (mounted) {
        setRouteTrip(response.success ? response.data : null);
      }
    };

    void loadRouteTrip();

    return () => {
      mounted = false;
    };
  }, [routeTripId, storeTrip?.tripId]);

  useEffect(() => {
    let mounted = true;

    const loadReport = async () => {
      if (!trip?.tripId) {
        if (mounted) {
          setTimelineDays([]);
          setTimelineDayDetails([]);
          setRouteDays([]);
          setExpenses([]);
          setSettlementDetail(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);

        const [timelineDaysResponse, expensesResponse] = await Promise.all([
          getTripTimelineDaysApi(trip.tripId),
          getTripExpensesApi(trip.tripId),
        ]);

        const nextTimelineDays = timelineDaysResponse.data.timelineDays ?? [];
        const nextExpenses = expensesResponse.data.items ?? [];

        if (mounted) {
          setTimelineDays(nextTimelineDays);
          setExpenses(nextExpenses);
        }

        const [destinationName, latestSettlementResponse, timelineDetailResponses, routeDaysResponse] = await Promise.all([
          getTopDestinationName(trip.tripId),
          getLatestSettlementApi(trip.tripId),
          Promise.all(nextTimelineDays.map((day) => getTimelineDayDetailApi(day.timelineDayId))),
          getTripRouteDaysApi(trip.tripId),
        ]);

        if (mounted) {
          setMainDestination(destinationName);

          const settledTimelineDetails = timelineDetailResponses
            .filter((res) => res.success)
            .map((res) => res.data);

          setTimelineDayDetails(settledTimelineDetails);
          setRouteDays(routeDaysResponse.success ? routeDaysResponse.data.routeDays : []);
          setSettlementDetail(latestSettlementResponse.success ? latestSettlementResponse.data : null);
        }
      } catch (error) {
        console.error('[TripReport] Failed to load details:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadReport();

    return () => {
      mounted = false;
    };
  }, [routeRefreshKey, trip?.tripId]); // Reload when trip data is invalidated elsewhere

  // Derive current distance locally to avoid loop
  const totalInFlightDistance = useMemo(() => {
    if (inFlightLogs.length < 2) return 0;
    const coords = inFlightLogs.map(l => [l.longitude, l.latitude] as [number, number]);
    return calculateDistance(coords);
  }, [inFlightLogs]);

  useEffect(() => {
    let mounted = true;

    if (!trip?.tripId) {
      setOriginAddress(null);
      setDestinationAddress(null);
      return () => {
        mounted = false;
      };
    }

    const boundaryCoordinates = getRouteBoundaryCoordinates(routeDays, inFlightLogs);
    if (!boundaryCoordinates) {
      setOriginAddress(null);
      setDestinationAddress(null);
      return () => {
        mounted = false;
      };
    }

    const geocodeRouteBoundaries = async () => {
      try {
        const { reverseGeocodeKo } = await import('@/src/api/mapbox');
        const [startAddress, endAddress] = await Promise.all([
          reverseGeocodeKo(boundaryCoordinates.start[0], boundaryCoordinates.start[1]),
          reverseGeocodeKo(boundaryCoordinates.end[0], boundaryCoordinates.end[1]),
        ]);

        if (!mounted) {
          return;
        }

        setOriginAddress(startAddress ? cleanLocationLabel(startAddress) : null);
        setDestinationAddress(endAddress ? cleanLocationLabel(endAddress) : null);
      } catch {
        if (!mounted) {
          return;
        }

        setOriginAddress(null);
        setDestinationAddress(null);
      }
    };

    void geocodeRouteBoundaries();

    return () => {
      mounted = false;
    };
  }, [inFlightLogs, routeDays, trip?.tripId]);

  useEffect(() => {
    Animated.spring(receiptAppear, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 140,
      mass: 0.9,
    }).start();
  }, [receiptAppear]);

  const reportDays = useMemo(
    () => buildReportDays(timelineDays, routeDays, trip?.startDate, trip?.endDate),
    [routeDays, timelineDays, trip?.endDate, trip?.startDate],
  );
  const timelineRows = useMemo(() => mapTimelineRows(timelineDayDetails), [timelineDayDetails]);

  const totalDistance = useMemo(() => {
    const serverDist = reportDays.reduce((sum, day) => sum + day.distanceKm, 0);
    return serverDist > 0 ? serverDist : totalInFlightDistance;
  }, [reportDays, totalInFlightDistance]);
  const totalPhotos = useMemo(() => reportDays.reduce((sum, day) => sum + day.photoCount, 0), [reportDays]);
  const totalLogs = timelineRows.length > 0 ? timelineRows.length : reportDays.reduce((sum, day) => sum + day.eventCount, 0);
  const activeExpenses = useMemo(
    () => expenses.filter((expense) => expense.status !== 'DELETED'),
    [expenses],
  );
  const totalUsed = settlementDetail?.totalConfirmedAmount ?? activeExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
  const mySettlement = useMemo(
    () => settlementDetail?.memberSettlements.find((member) => member.userId === currentUserId) ?? null,
    [currentUserId, settlementDetail],
  );
  const myUsedAmount =
    mySettlement?.paidAmount ??
    activeExpenses.reduce(
      (sum, expense) => sum + (currentUserId && expense.payerUserId === currentUserId ? expense.totalAmount : 0),
      0,
    );
  const ticketNumber = (trip?.tripId ?? 'YEOUNTRIP').replace(/-/g, '').slice(0, 8).toUpperCase() || 'YEOUN000';
  const travelerCount = String(trip?.memberCount ?? 0).padStart(2, '0');
  const tripTitle = trip?.tripName || 'Trip';
  const reportTitle = `${tripTitle} 여행 종료`;
  const tripStartLabel = formatTripDate(trip?.startDate);
  const tripEndLabel = formatTripDate(trip?.endDate);
  const tripOrigin = shortenLocationName(originAddress || trip?.origin || 'KR');
  const tripDestination = shortenLocationName(destinationAddress || mainDestination || trip?.destination || tripTitle);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerButton} onPress={handleBackToTimeline}>
              <Image 
                source={require('@/assets/images/timeline_nav_icon.svg')} 
                style={{ width: 28, height: 28 }} 
                contentFit="contain" 
              />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{reportTitle}</Text>
            </View>
            <TouchableOpacity style={styles.headerActionButton} onPress={handleGoHome}>
              <HouseSvg color="#244934" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.ticketWrap}>
            <View style={styles.barcodeSection}>
              <View style={styles.barcodeStrip}>
                {BARCODE_SEGMENTS.map((width, index) => (
                  <View key={`barcode-${index}`} style={[styles.barcodeBar, { width: width * 3.5 }]} />
                ))}
              </View>
            </View>

            <View style={styles.perforationContainer}>
              <View style={styles.punchHoleLeft} />
              <View style={styles.ticketPerforation} />
              <View style={styles.punchHoleRight} />
            </View>

            <View style={styles.ticketContent}>
              <View style={styles.ticketTop}>
                <Text style={styles.ticketNumberLabel}>Ticket Number</Text>
                <View style={styles.ticketTopRight}>
                  <Text style={styles.ticketNumberValue}>{ticketNumber}</Text>
                  {isLoading ? <ActivityIndicator size="small" color="#315B45" /> : null}
                </View>
              </View>

              <View style={styles.ticketRow}>
                <View style={styles.ticketRouteBlock}>
                  <Text style={styles.ticketCode}>{tripOrigin}</Text>
                  <Text style={styles.ticketDateText}>{tripStartLabel}</Text>
                </View>

                <View style={styles.ticketRouteCenter}>
                  <Svg width="120" height="60" viewBox="0 0 120 60">
                    <Path d="M 5,30 Q 60,0 115,30" stroke="#DCE4DE" strokeWidth="1.5" fill="none" />
                    <Path d="M 5,30 Q 60,60 115,30" stroke="#DCE4DE" strokeWidth="1.5" fill="none" />
                  </Svg>
                  <MaterialIcons name="flight-takeoff" size={20} color="#A9B8AD" style={styles.flightIconCenter} />
                </View>

                <View style={styles.ticketRouteBlock}>
                  <Text style={[styles.ticketCode, styles.ticketCodeRight]}>{tripDestination}</Text>
                  <Text style={[styles.ticketDateText, styles.ticketDateTextRight]}>{tripEndLabel}</Text>
                </View>
              </View>

              <View style={styles.ticketRule} />

              <View style={styles.ticketInfoGrid}>
                {[
                  { label: 'Distance', value: `${totalDistance.toFixed(1)}km` },
                  { label: 'Photos', value: String(totalPhotos).padStart(2, '0') },
                  { label: 'Records', value: String(totalLogs).padStart(2, '0') },
                  { label: 'Travelers', value: travelerCount },
                  { label: 'Days', value: String(reportDays.length).padStart(2, '0') },
                  { label: 'Total Cost', value: formatWon(totalUsed) },
                ].map((item) => (
                  <View key={item.label} style={styles.ticketInfoCell}>
                    <Text style={styles.ticketInfoLabel}>{item.label}</Text>
                    <Text style={styles.ticketInfoValue}>{item.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.ticketRule} />

              <View>
                {reportDays.length > 0 ? (
                  reportDays.map((day) => (
                    <View key={day.id} style={styles.inlineDayRow}>
                      <Text style={styles.inlineDayLabel}>{day.label}</Text>
                      <Text style={styles.inlineDayValue}>
                        {day.distanceKm > 0 || day.photoCount > 0 || day.eventCount > 0 ? (
                          `${day.distanceKm.toFixed(1)}km · 사진 ${day.photoCount}장 · 기록 ${day.eventCount}개`
                        ) : (
                          '기록 없음'
                        )}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>표시할 일정 요약이 없습니다.</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.timelineHeader} activeOpacity={0.8} onPress={() => setIsTimelineOpen((prev) => !prev)}>
              <View style={styles.timelineHeaderCopy}>
                <Text style={styles.sectionKicker}>Timeline</Text>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>여행 상세보기</Text>
              </View>
              <MaterialIcons name={isTimelineOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={28} color="#244934" />
            </TouchableOpacity>

            {isTimelineOpen ? (
              timelineRows.length > 0 ? (
                <View style={styles.timelineBody}>
                  {timelineRows.map((row, index) => (
                    <View key={row.id} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View style={styles.timelineDot} />
                        {index < timelineRows.length - 1 ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={styles.timelineCard}>
                        <View style={styles.timelineTop}>
                          <Text style={styles.timelineTime}>{row.time}</Text>
                          <View style={styles.timelineChip}>
                            <Text style={styles.timelineChipText}>{row.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.timelineTitle}>{row.title}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>표시할 타임라인 이벤트가 없습니다.</Text>
              )
            ) : null}
          </View>

          <View style={styles.settlementSection}>
            <Text style={styles.settlementTitle}>최종정산</Text>
            <Animated.View style={[styles.summaryTicket, { opacity: receiptAppear }]}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>총 사용 금액</Text>
                  <Text style={styles.summaryRight}>{formatWon(totalUsed)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>내가 사용한 금액</Text>
                  <Text style={styles.summaryRight}>{formatWon(myUsedAmount)}</Text>
                </View>
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.detailButton} onPress={handleOpenSettlementDetail}>
              <Text style={styles.detailButtonText}>내역 자세히 보기</Text>
              <MaterialIcons name="chevron-right" size={20} color="#607067" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EBF3EA' },
  background: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FCFEFB',
    borderWidth: 1,
    borderColor: '#D7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 20, color: '#223428', fontFamily: 'Pretendard-SemiBold' },
  headerActionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketWrap: {
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  barcodeSection: {
    height: 74,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    backgroundColor: '#FFFFFF',
  },
  barcodeStrip: { flexDirection: 'row', height: 44, gap: 3 },
  barcodeBar: { backgroundColor: '#000000' },
  perforationContainer: { flexDirection: 'row', alignItems: 'center', height: 40 },
  ticketPerforation: { flex: 1, borderTopWidth: 1.5, borderColor: '#315B45', borderStyle: 'dashed', opacity: 0.18 },
  punchHoleLeft: {
    width: 24,
    height: 48,
    backgroundColor: '#EBF3EA',
    marginLeft: -12,
    marginRight: 15,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  punchHoleRight: {
    width: 24,
    height: 48,
    backgroundColor: '#EBF3EA',
    marginRight: -12,
    marginLeft: 15,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  ticketContent: { paddingHorizontal: 24, paddingBottom: 30 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  ticketTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketNumberLabel: { fontSize: 14, color: '#000000', fontFamily: 'Pretendard-Regular' },
  ticketNumberValue: { fontSize: 18, color: '#000000', fontFamily: 'Pretendard-Bold' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketRouteBlock: { flex: 1 },
  ticketCode: { fontSize: 30, color: '#000000', fontFamily: 'Pretendard-SemiBold' },
  ticketCodeRight: { textAlign: 'right' },
  ticketDateText: { fontSize: 14, color: '#000000', marginTop: 4, fontFamily: 'Pretendard-Regular' },
  ticketDateTextRight: { textAlign: 'right' },
  ticketRouteCenter: { width: 120, height: 60, alignItems: 'center', justifyContent: 'center' },
  flightIconCenter: { position: 'absolute' },
  ticketRule: { height: 1, backgroundColor: '#E3EBDF', marginVertical: 25 },
  ticketInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 25 },
  ticketInfoCell: { width: '33.3%', alignItems: 'center' },
  ticketInfoLabel: { fontSize: 12, color: '#000000', marginBottom: 4, textAlign: 'center', fontFamily: 'Pretendard-Regular' },
  ticketInfoValue: { fontSize: 16, color: '#000000', fontFamily: 'Pretendard-Bold', textAlign: 'center' },
  ticketSectionTitle: { fontSize: 13, color: '#000000', marginBottom: 12, fontFamily: 'Pretendard-Bold' },
  inlineDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inlineDayLabel: { fontSize: 16, color: '#000000', fontFamily: 'Pretendard-SemiBold' },
  inlineDayValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#000000', fontFamily: 'Pretendard-Medium' },
  sectionCard: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFFFFF', padding: 20 },
  sectionKicker: { fontSize: 11, color: '#607067', fontFamily: 'Pretendard-SemiBold' },
  sectionTitle: { fontSize: 19, color: '#223428', marginTop: 4, fontFamily: 'Pretendard-Bold', marginBottom: 15 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineHeaderCopy: { flex: 1 },
  timelineBody: { marginTop: 20 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  timelineRail: { width: 12, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#315B45', marginTop: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#DCE4DE' },
  timelineCard: {
    flex: 1,
    backgroundColor: '#F8FAF6',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E3EBDF',
  },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  timelineTime: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: '#315B45' },
  timelineChip: { backgroundColor: '#EEF3EC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  timelineChipText: { fontSize: 10, color: '#315B45', fontFamily: 'Pretendard-Bold' },
  timelineTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', color: '#223428' },
  settlementSection: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFFFFF', padding: 20 },
  settlementTitle: { fontSize: 20, fontFamily: 'Pretendard-Bold', textAlign: 'left', marginBottom: 15, color: '#223428' },
  summaryTicket: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#D7E1DA' },
  summaryTop: { padding: 15, backgroundColor: '#FFFFFF' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  summaryLeft: { fontSize: 14, color: '#607067', fontFamily: 'Pretendard-Regular' },
  summaryRight: { fontSize: 16, color: '#223428', fontFamily: 'Pretendard-Bold' },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginTop: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D7E1DA',
  },
  detailButtonText: { fontSize: 14, color: '#607067', marginRight: 5, fontFamily: 'Pretendard-Regular' },
  emptyText: { marginTop: 14, fontSize: 13, color: '#728077', fontFamily: 'Pretendard-Regular' },
});
