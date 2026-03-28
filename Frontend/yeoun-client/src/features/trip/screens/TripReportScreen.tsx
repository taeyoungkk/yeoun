import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getTripExpensesApi, type TripExpenseItem } from '@/src/api/expense';
import {
  createSettlementApi,
  getSettlementDetailApi,
  getTripSettlementsApi,
  type SettlementDetail,
} from '@/src/api/settlement';
import {
  getTimelineDayDetailApi,
  getTripTimelineDaysApi,
  type TimelineDayDetail,
  type TimelineDaySummary,
} from '@/src/api/timeline';
import { CommonApiResponse, getTripRouteDaysApi } from '@/src/api/trip';
import { useTripStore } from '@/src/store/trip.store';
import { getTopDestinationName, calculateDistance } from '@/src/utils/trip-analysis-utils';

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
const formatTime = (date?: string | null) => (date ? date.slice(11, 16) : '--:--');

const shortenLocationName = (name: string) => {
  if (!name) return '';
  const doMap: Record<string, string> = {
    경기도: '경기',
    강원도: '강원',
    충청북도: '충북',
    충청남도: '충남',
    전라북도: '전북',
    전라남도: '전남',
    경상북도: '경북',
    경상남도: '경남',
    제주특별자치도: '제주',
  };

  if (doMap[name]) return doMap[name];

  return name
    .replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구)$/, '')
    .trim()
    .slice(0, 3);
};

const getExpenseSnapshot = (items: TripExpenseItem[]) => {
  const confirmedExpenses = items.filter((expense) => expense.status !== 'DELETED');
  return {
    count: confirmedExpenses.length,
    totalAmount: confirmedExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0),
  };
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

const mapReportDay = (day: TimelineDaySummary, index: number): ReportDay => ({
  id: day.timelineDayId,
  label: `${index + 1}일차`,
  dateLabel: formatDayLabel(new Date(day.dayDate)),
  distanceKm: day.distanceM / 1000,
  photoCount: day.photoCount,
  eventCount: day.eventCount,
});

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
  const params = useLocalSearchParams<{ mode?: string }>();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const reviewTrip = useTripStore((state) => state.reviewTrip);
  const inFlightLogs = useTripStore((state) => state.inFlightLogs);
  const router = useRouter();

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineDays, setTimelineDays] = useState<TimelineDaySummary[]>([]);
  const [timelineDayDetails, setTimelineDayDetails] = useState<TimelineDayDetail[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [settlementDetail, setSettlementDetail] = useState<SettlementDetail | null>(null);
  const [mainDestination, setMainDestination] = useState<string | null>(null);
  const [originAddress, setOriginAddress] = useState<string | null>(null);
  const [fallbackDistance, setFallbackDistance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const isReviewMode = params.mode === 'review';
  const trip = isReviewMode ? reviewTrip ?? currentTrip : currentTrip;
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

    const loadReport = async () => {
      if (!trip?.tripId) {
        if (mounted) {
          setTimelineDays([]);
          setTimelineDayDetails([]);
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
          setIsLoading(false);
        }

        const [destinationName, settlementsResponse, timelineDetailResponses, routeResponse] = await Promise.all([
          getTopDestinationName(trip.tripId),
          getTripSettlementsApi(trip.tripId),
          Promise.all(nextTimelineDays.map((day) => getTimelineDayDetailApi(day.timelineDayId))),
          getTripRouteDaysApi(trip.tripId),
        ]);

        if (mounted) {
          setMainDestination(destinationName);

          const settledTimelineDetails = timelineDetailResponses
            .filter((res) => res.success)
            .map((res) => res.data);

          setTimelineDayDetails(settledTimelineDetails);

          const serverCoords = routeResponse.success 
            ? routeResponse.data.routeDays.flatMap((rd) => (rd.coordinates || []).map(c => c as [number, number]))
            : [];
          
          const inFlightCoords = inFlightLogs.map(l => [l.longitude, l.latitude] as [number, number]);
          const allCoords = [...serverCoords, ...inFlightCoords];
          
          if (allCoords.length > 0) {
            const calculated = calculateDistance(allCoords);
            setFallbackDistance(calculated);

            if (!trip.origin) {
              const [lon, lat] = allCoords[0];
              import('@/src/api/mapbox').then(({ reverseGeocodeKo }) => {
                reverseGeocodeKo(lon, lat).then((addr) => {
                  if (mounted && addr) {
                    const cleaned = addr.replace(/대한민국\s*\d*/g, '').replace(/,/g, '').trim().split(' ')[0];
                    setOriginAddress(cleaned);
                  }
                });
              });
            }
          }

          let nextSettlementDetail: SettlementDetail | null = null;
          const expenseSnapshot = getExpenseSnapshot(nextExpenses);

          if (settlementsResponse.success) {
            let latestSettlement = [...settlementsResponse.data.items].sort((a, b) => {
              const createdAtA = new Date(a.createdAt).getTime();
              const createdAtB = new Date(b.createdAt).getTime();
              return createdAtB - createdAtA;
            })[0];

            if (!latestSettlement && expenseSnapshot.count > 0) {
              const createResponse = await createSettlementApi(trip.tripId, {});
              if (createResponse.success) {
                latestSettlement = createResponse.data;
              }
            }

            if (latestSettlement) {
              let detailResponse = await getSettlementDetailApi(latestSettlement.settlementId);

              if (detailResponse.success) {
                const needsRecalculation =
                  expenseSnapshot.count > 0 &&
                  (detailResponse.data.confirmedExpenseCount !== expenseSnapshot.count ||
                    detailResponse.data.totalConfirmedAmount !== expenseSnapshot.totalAmount);

                if (needsRecalculation) {
                  const recreateResponse = await createSettlementApi(trip.tripId, {});
                  if (recreateResponse.success) {
                    detailResponse = await getSettlementDetailApi(recreateResponse.data.settlementId);
                  }
                }

                if (detailResponse.success) {
                  nextSettlementDetail = detailResponse.data;
                }
              }
            }
          }
          setSettlementDetail(nextSettlementDetail);
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
  }, [trip?.tripId, inFlightLogs]);

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
    () => (timelineDays.length > 0 ? timelineDays.map(mapReportDay) : buildFallbackDays(trip?.startDate, trip?.endDate)),
    [timelineDays, trip?.endDate, trip?.startDate],
  );
  const timelineRows = useMemo(() => mapTimelineRows(timelineDayDetails), [timelineDayDetails]);

  const totalDistance = useMemo(() => {
    const serverDist = reportDays.reduce((sum, day) => sum + day.distanceKm, 0);
    return serverDist > 0 ? serverDist : fallbackDistance;
  }, [reportDays, fallbackDistance]);
  const totalPhotos = useMemo(() => reportDays.reduce((sum, day) => sum + day.photoCount, 0), [reportDays]);
  const totalLogs = timelineRows.length;
  const totalUsed = settlementDetail?.totalConfirmedAmount ?? expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
  const sharedPerPerson =
    settlementDetail && settlementDetail.memberCount > 0
      ? Math.round(settlementDetail.totalConfirmedAmount / settlementDetail.memberCount)
      : trip?.memberCount
        ? Math.round(totalUsed / trip.memberCount)
        : totalUsed;
  const confirmedExpenseCount = settlementDetail?.confirmedExpenseCount ?? expenses.filter((expense) => expense.status !== 'DELETED').length;
  const ticketNumber = (trip?.tripId ?? 'YEOUNTRIP').replace(/-/g, '').slice(0, 8).toUpperCase() || 'YEOUN000';
  const travelerCount = String(trip?.memberCount ?? 0).padStart(2, '0');
  const tripTitle = trip?.tripName || 'Trip';
  const reportTitle = `${tripTitle} 여행 종료`;
  const tripStartLabel = formatTripDate(trip?.startDate);
  const tripEndLabel = formatTripDate(trip?.endDate);
  const tripOrigin = shortenLocationName(originAddress || trip?.origin || 'KR');
  const tripDestination = shortenLocationName(mainDestination || trip?.destination || tripTitle);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#F7F8FF', '#EEF4FF', '#F8F6EF']} style={styles.background}>
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
              <Text style={styles.headerActionText}>홈</Text>
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
                  {isLoading ? <ActivityIndicator size="small" color="#5B4F66" /> : null}
                </View>
              </View>

              <View style={styles.ticketRow}>
                <View style={styles.ticketRouteBlock}>
                  <Text style={styles.ticketCode}>{tripOrigin}</Text>
                  <Text style={styles.ticketDateText}>{tripStartLabel}</Text>
                </View>

                <View style={styles.ticketRouteCenter}>
                  <Svg width="120" height="60" viewBox="0 0 120 60">
                    <Path d="M 5,30 Q 60,0 115,30" stroke="#EAEAEA" strokeWidth="1.5" fill="none" />
                    <Path d="M 5,30 Q 60,60 115,30" stroke="#EAEAEA" strokeWidth="1.5" fill="none" />
                  </Svg>
                  <MaterialIcons name="flight-takeoff" size={20} color="#C0C9EA" style={styles.flightIconCenter} />
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
                          '분석 중...'
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

          {totalDistance === 0 && !isLoading && (
            <View style={styles.processingNotice}>
              <MaterialIcons name="info-outline" size={16} color="#7182BC" />
              <Text style={styles.processingNoticeText}>서버에서 상세 데이터 분석이 아직 진행 중입니다. 잠시 후 상단 '새로고침'을 해주세요.</Text>
            </View>
          )}

          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.timelineHeader} activeOpacity={0.8} onPress={() => setIsTimelineOpen((prev) => !prev)}>
              <View style={styles.timelineHeaderCopy}>
                <Text style={styles.sectionKicker}>Timeline</Text>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>여행 상세보기</Text>
              </View>
              <MaterialIcons name={isTimelineOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={28} color="#1C2751" />
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
                  <Text style={styles.summaryLeft}>1인당 금액</Text>
                  <Text style={styles.summaryRight}>{formatWon(sharedPerPerson)}</Text>
                </View>
              </View>
              <View style={styles.summaryBottom}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryBottomLeft}>확정 내역 수</Text>
                  <Text style={styles.summaryBottomRight}>{`${confirmedExpenseCount}건`}</Text>
                </View>
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.detailButton} onPress={handleOpenSettlementDetail}>
              <Text style={styles.detailButtonText}>내역 자세히 보기</Text>
              <MaterialIcons name="chevron-right" size={20} color="#616978" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FF' },
  background: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DCE4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 22, color: '#182245', fontWeight: '700' },
  headerActionButton: {
    minWidth: 56,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3852D6',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: { fontSize: 14, color: '#FFF', fontWeight: '700' },
  ticketWrap: {
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    backgroundColor: '#FFF',
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
  barcodeBar: { backgroundColor: '#5B4F66' },
  perforationContainer: { flexDirection: 'row', alignItems: 'center', height: 40 },
  ticketPerforation: { flex: 1, borderTopWidth: 1.5, borderColor: '#5B4F66', borderStyle: 'dashed', opacity: 0.2 },
  punchHoleLeft: {
    width: 24,
    height: 48,
    backgroundColor: '#F7F8FF',
    marginLeft: -12,
    marginRight: 15,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  punchHoleRight: {
    width: 24,
    height: 48,
    backgroundColor: '#F7F8FF',
    marginRight: -12,
    marginLeft: 15,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  ticketContent: { paddingHorizontal: 24, paddingBottom: 30 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  ticketTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketNumberLabel: { fontSize: 14, color: '#999' },
  ticketNumberValue: { fontSize: 18, color: '#5B4F66', fontWeight: '700' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketRouteBlock: { flex: 1 },
  ticketCode: { fontSize: 36, color: '#5B4F66', fontWeight: '700' },
  ticketCodeRight: { textAlign: 'right' },
  ticketDateText: { fontSize: 14, color: '#BBB', marginTop: 4 },
  ticketDateTextRight: { textAlign: 'right' },
  ticketRouteCenter: { width: 120, height: 60, alignItems: 'center', justifyContent: 'center' },
  flightIconCenter: { position: 'absolute' },
  ticketRule: { height: 1, backgroundColor: '#EEE', marginVertical: 25 },
  ticketInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 25 },
  ticketInfoCell: { width: '33.3%', alignItems: 'center' },
  ticketInfoLabel: { fontSize: 12, color: '#BBB', marginBottom: 4, textAlign: 'center' },
  ticketInfoValue: { fontSize: 16, color: '#5B4F66', fontWeight: '700', textAlign: 'center' },
  ticketSectionTitle: { fontSize: 13, color: '#999', marginBottom: 12, fontWeight: '700' },
  inlineDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inlineDayLabel: { fontSize: 16, color: '#5B4F66', fontWeight: '700' },
  inlineDayValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#7E8CB6', fontWeight: '700' },
  sectionCard: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFF', padding: 20 },
  sectionKicker: { fontSize: 11, color: '#7182BC', fontWeight: '600' },
  sectionTitle: { fontSize: 19, color: '#1C2751', marginTop: 4, fontWeight: '700', marginBottom: 15 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineHeaderCopy: { flex: 1 },
  timelineBody: { marginTop: 20 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  timelineRail: { width: 12, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5D73FF', marginTop: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E2E8FF' },
  timelineCard: { flex: 1, backgroundColor: '#F7F9FF', borderRadius: 15, padding: 15 },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  timelineTime: { fontSize: 12, fontWeight: '700', color: '#24305B' },
  timelineChip: { backgroundColor: '#E9EEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  timelineChipText: { fontSize: 10, color: '#5C70DF', fontWeight: '700' },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#20284D' },
  settlementSection: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFF', padding: 20 },
  settlementTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 15 },
  summaryTicket: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },
  summaryTop: { padding: 15 },
  summaryBottom: { padding: 15, backgroundColor: '#DFF7FF' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  summaryLeft: { fontSize: 14, color: '#666' },
  summaryRight: { fontSize: 16, fontWeight: '700' },
  summaryBottomLeft: { fontSize: 15, fontWeight: '700' },
  summaryBottomRight: { fontSize: 18, fontWeight: '700', color: '#007AFF' },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginTop: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  detailButtonText: { fontSize: 14, color: '#666', marginRight: 5 },
  emptyText: { marginTop: 14, fontSize: 13, color: '#8A95B4' },
  processingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 15,
    padding: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  processingNoticeText: { fontSize: 12, color: '#7182BC', fontWeight: '500' },
});
