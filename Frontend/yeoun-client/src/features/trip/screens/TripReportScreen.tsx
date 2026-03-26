import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getTripExpensesApi, type TripExpenseItem } from '@/src/api/expense';
import {
  getTimelineDayDetailApi,
  getTripTimelineDaysApi,
  type TimelineDayDetail,
  type TimelineDaySummary,
} from '@/src/api/timeline';
import { useTripStore } from '@/src/store/trip.store';

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

type SettlementRow = {
  id: string;
  title: string;
  amount: number;
  share: number;
  status: '확정' | '대기';
};

const BARCODE_SEGMENTS = [4, 2, 3, 1, 2, 5, 2, 1, 4, 2, 5, 1, 2, 3, 2, 4, 1, 3, 2, 5, 1, 2, 4, 2, 3, 1];

const EVENT_LABEL: Record<string, string> = {
  PLACE_VISIT: '장소',
  MOVE: '이동',
  OTHER: '기록',
};

const formatWon = (value: number) => `₩${value.toLocaleString('ko-KR')}`;
const formatTripDate = (date?: string) => (date ? date.slice(2, 10).replace(/-/g, '.') : '--.--.--');
const formatDayLabel = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
const formatTime = (date?: string | null) => (date ? date.slice(11, 16) : '--:--');

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

const mapSettlementRows = (expenses: TripExpenseItem[], memberCount: number): SettlementRow[] =>
  expenses
    .filter((expense) => expense.status !== 'DELETED')
    .map((expense) => ({
      id: expense.expenseId,
      title: expense.merchantName || '결제 내역',
      amount: expense.totalAmount,
      share: memberCount > 0 ? Math.round(expense.totalAmount / memberCount) : expense.totalAmount,
      status: expense.status === 'CONFIRMED' ? '확정' : '대기',
    }));

export default function TripReportScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const reviewTrip = useTripStore((state) => state.reviewTrip);
  const router = useRouter();
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineDays, setTimelineDays] = useState<TimelineDaySummary[]>([]);
  const [timelineDayDetails, setTimelineDayDetails] = useState<TimelineDayDetail[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isReviewMode = params.mode === 'review';
  const trip = isReviewMode ? reviewTrip ?? currentTrip : currentTrip;
  const receiptAppear = useRef(new Animated.Value(0)).current;

  const handleGoHome = () => router.replace('/(tabs)');
  const handleBackToTimeline = () => router.replace(isReviewMode ? '/trip/recording?mode=review' : '/trip/recording');

  useEffect(() => {
    let mounted = true;

    const loadReport = async () => {
      if (!trip?.tripId) {
        if (mounted) {
          setTimelineDays([]);
          setTimelineDayDetails([]);
          setExpenses([]);
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
        const timelineDetailResponses = await Promise.all(
          nextTimelineDays.map((day) => getTimelineDayDetailApi(day.timelineDayId)),
        );

        if (!mounted) {
          return;
        }

        setTimelineDays(nextTimelineDays);
        setTimelineDayDetails(
          timelineDetailResponses.filter((response) => response.success).map((response) => response.data),
        );
        setExpenses(expensesResponse.data.items ?? []);
      } catch (error) {
        console.error('Failed to load trip report data:', error);
        if (!mounted) {
          return;
        }

        setTimelineDays([]);
        setTimelineDayDetails([]);
        setExpenses([]);
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
  }, [trip?.tripId]);

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
  const settlementRows = useMemo(
    () => mapSettlementRows(expenses, trip?.memberCount ?? 0),
    [expenses, trip?.memberCount],
  );

  const totalDistance = useMemo(() => reportDays.reduce((sum, day) => sum + day.distanceKm, 0), [reportDays]);
  const totalPhotos = useMemo(() => reportDays.reduce((sum, day) => sum + day.photoCount, 0), [reportDays]);
  const totalLogs = timelineRows.length;
  const totalUsed = useMemo(() => settlementRows.reduce((sum, row) => sum + row.amount, 0), [settlementRows]);
  const sharedPerPerson = useMemo(() => settlementRows.reduce((sum, row) => sum + row.share, 0), [settlementRows]);
  const confirmedRows = settlementRows.filter((row) => row.status === '확정');
  const ticketNumber = (trip?.tripId ?? 'YEOUNTRIP').replace(/-/g, '').slice(0, 8).toUpperCase() || 'YEOUN000';
  const travelerCount = String(trip?.memberCount ?? 0).padStart(2, '0');
  const tripTitle = trip?.tripName || 'Trip';
  const reportTitle = `${tripTitle} 여행 종료`;
  const tripStartLabel = formatTripDate(trip?.startDate);
  const tripEndLabel = formatTripDate(trip?.endDate);
  const tripOrigin = trip?.origin || '출발';
  const tripDestination = trip?.destination || tripTitle;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#F7F8FF', '#EEF4FF', '#F8F6EF']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerButton} onPress={handleBackToTimeline}>
              <MaterialIcons name="arrow-back" size={22} color="#3852D6" />
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
                <Text style={styles.ticketSectionTitle}>일정 요약</Text>
                {reportDays.length > 0 ? (
                  reportDays.map((day) => (
                    <View key={day.id} style={styles.inlineDayRow}>
                      <Text style={styles.inlineDayLabel}>{day.label}</Text>
                      <Text style={styles.inlineDayValue}>
                        {`${day.distanceKm.toFixed(1)}km · 사진 ${day.photoCount}장 · 기록 ${day.eventCount}개`}
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
                <Text style={styles.sectionKicker}>타임라인</Text>
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
                  <Text style={styles.summaryBottomRight}>{`${confirmedRows.length}건`}</Text>
                </View>
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.detailButton} onPress={() => setIsSettlementOpen((prev) => !prev)}>
              <Text style={styles.detailButtonText}>내역 자세히 보기</Text>
              <MaterialIcons name={isSettlementOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#616978" />
            </TouchableOpacity>

            {isSettlementOpen ? (
              confirmedRows.length > 0 ? (
                <View style={styles.detailList}>
                  {confirmedRows.map((row) => (
                    <View key={row.id} style={styles.detailItem}>
                      <Text style={styles.detailTitle}>{row.title}</Text>
                      <Text style={styles.detailPrice}>{formatWon(row.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>표시할 정산 내역이 없습니다.</Text>
              )
            ) : null}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    marginLeft: -20,
    marginRight: 15,
  },
  punchHoleRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    marginRight: -20,
    marginLeft: 15,
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
  ticketInfoCell: { width: '33.3%' },
  ticketInfoLabel: { fontSize: 12, color: '#BBB', marginBottom: 4 },
  ticketInfoValue: { fontSize: 16, color: '#5B4F66', fontWeight: '700' },
  ticketSectionTitle: { fontSize: 13, color: '#999', marginBottom: 12, fontWeight: '700' },
  inlineDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inlineDayLabel: { fontSize: 16, color: '#5B4F66', fontWeight: '700' },
  inlineDayValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#7E8CB6', fontWeight: '700' },
  sectionCard: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFF', padding: 20, elevation: 2 },
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
  detailList: { marginTop: 10 },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    marginBottom: 5,
  },
  detailTitle: { fontSize: 14, color: '#333' },
  detailPrice: { fontSize: 14, fontWeight: '700' },
  emptyText: { marginTop: 14, fontSize: 13, color: '#8A95B4' },
});
