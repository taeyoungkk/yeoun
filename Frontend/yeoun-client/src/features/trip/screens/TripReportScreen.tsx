import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const currentTrip = useTripStore((state) => state.currentTrip);
  const router = useRouter();
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineDays, setTimelineDays] = useState<TimelineDaySummary[]>([]);
  const [timelineDayDetails, setTimelineDayDetails] = useState<TimelineDayDetail[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const receiptAppear = useRef(new Animated.Value(0)).current;

  const handleGoHome = () => router.replace('/(tabs)');
  const handleBackToTimeline = () => router.replace('/trip/recording?mode=review');

  useEffect(() => {
    let mounted = true;

    const loadReport = async () => {
      if (!currentTrip?.tripId) {
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
          getTripTimelineDaysApi(currentTrip.tripId),
          getTripExpensesApi(currentTrip.tripId),
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
  }, [currentTrip?.tripId]);

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
    () => (timelineDays.length > 0 ? timelineDays.map(mapReportDay) : buildFallbackDays(currentTrip?.startDate, currentTrip?.endDate)),
    [currentTrip?.endDate, currentTrip?.startDate, timelineDays],
  );
  const timelineRows = useMemo(() => mapTimelineRows(timelineDayDetails), [timelineDayDetails]);
  const settlementRows = useMemo(
    () => mapSettlementRows(expenses, currentTrip?.memberCount ?? 0),
    [currentTrip?.memberCount, expenses],
  );

  const totalDistance = useMemo(() => reportDays.reduce((sum, day) => sum + day.distanceKm, 0), [reportDays]);
  const totalPhotos = useMemo(() => reportDays.reduce((sum, day) => sum + day.photoCount, 0), [reportDays]);
  const totalLogs = timelineRows.length;
  const totalUsed = useMemo(() => settlementRows.reduce((sum, row) => sum + row.amount, 0), [settlementRows]);
  const sharedPerPerson = useMemo(() => settlementRows.reduce((sum, row) => sum + row.share, 0), [settlementRows]);
  const travelerCount = String(currentTrip?.memberCount ?? 0).padStart(2, '0');
  const tripTitle = currentTrip?.tripName || 'Trip';
  const reportTitle = `${tripTitle} 종료`;
  const tripStartLabel = formatTripDate(currentTrip?.startDate);
  const tripEndLabel = formatTripDate(currentTrip?.endDate);
  const tripOrigin = currentTrip?.origin || '출발';
  const tripDestination = currentTrip?.destination || tripTitle;
  const confirmedRows = settlementRows.filter((row) => row.status === '확정');

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
            <View style={styles.ticketTop}>
              <Text style={styles.ticketKicker}>Trip Summary</Text>
              {isLoading ? <ActivityIndicator size="small" color="#3852D6" /> : null}
            </View>

            <View style={styles.routeRow}>
              <View style={styles.routeBlock}>
                <Text style={styles.routeCode}>{tripOrigin}</Text>
                <Text style={styles.routeDate}>{tripStartLabel}</Text>
              </View>
              <MaterialIcons name="flight-takeoff" size={22} color="#C0C9EA" />
              <View style={styles.routeBlock}>
                <Text style={[styles.routeCode, styles.routeCodeRight]}>{tripDestination}</Text>
                <Text style={[styles.routeDate, styles.routeDateRight]}>{tripEndLabel}</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              {[
                { label: 'Distance', value: `${totalDistance.toFixed(1)}km` },
                { label: 'Photos', value: String(totalPhotos).padStart(2, '0') },
                { label: 'Records', value: String(totalLogs).padStart(2, '0') },
                { label: 'Travelers', value: travelerCount },
                { label: 'Timeline Days', value: String(reportDays.length).padStart(2, '0') },
                { label: 'Total Cost', value: formatWon(totalUsed) },
              ].map((item) => (
                <View key={item.label} style={styles.infoCell}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>일정 요약</Text>
            {reportDays.length > 0 ? (
              reportDays.map((day) => (
                <View key={day.id} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <Text style={styles.dayValue}>
                    {`${day.distanceKm.toFixed(1)}km · 사진 ${day.photoCount}장 · 기록 ${day.eventCount}개`}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>아직 리포트에 표시할 일정 데이터가 없습니다.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsTimelineOpen((prev) => !prev)}>
              <Text style={styles.sectionHeaderTitle}>타임라인</Text>
              <MaterialIcons name={isTimelineOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color="#1C2751" />
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

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>최종 정산</Text>
            <Animated.View style={[styles.summaryCard, { opacity: receiptAppear }]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>총 사용 금액</Text>
                <Text style={styles.summaryValue}>{formatWon(totalUsed)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>1인당 금액</Text>
                <Text style={styles.summaryValue}>{formatWon(sharedPerPerson)}</Text>
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.toggleButton} onPress={() => setIsSettlementOpen((prev) => !prev)}>
              <Text style={styles.toggleButtonText}>내역 자세히 보기</Text>
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

          <TouchableOpacity style={styles.finishButton} onPress={handleGoHome}>
            <Text style={styles.finishButtonText}>홈으로 돌아가기</Text>
          </TouchableOpacity>
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
    borderRadius: 28,
    backgroundColor: '#FFF',
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8ECFA',
  },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  ticketKicker: { fontSize: 12, color: '#7B86AE', fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  routeBlock: { flex: 1 },
  routeCode: { fontSize: 26, fontWeight: '700', color: '#24305B' },
  routeCodeRight: { textAlign: 'right' },
  routeDate: { marginTop: 4, fontSize: 13, color: '#8D97BA' },
  routeDateRight: { textAlign: 'right' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginBottom: 22 },
  infoCell: { width: '33.3%' },
  infoLabel: { fontSize: 12, color: '#98A2C1', marginBottom: 4 },
  infoValue: { fontSize: 15, color: '#24305B', fontWeight: '700' },
  sectionTitle: { marginBottom: 12, fontSize: 14, color: '#56658F', fontWeight: '700' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  dayLabel: { fontSize: 15, color: '#24305B', fontWeight: '700' },
  dayValue: { flex: 1, textAlign: 'right', fontSize: 13, color: '#66759E' },
  sectionCard: {
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: '#FFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8ECFA',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderTitle: { fontSize: 18, color: '#1C2751', fontWeight: '700' },
  timelineBody: { marginTop: 18 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timelineRail: { width: 12, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5D73FF', marginTop: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E2E8FF' },
  timelineCard: { flex: 1, backgroundColor: '#F7F9FF', borderRadius: 15, padding: 15 },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timelineTime: { fontSize: 12, fontWeight: '700', color: '#24305B' },
  timelineChip: { borderRadius: 10, backgroundColor: '#E9EEFF', paddingHorizontal: 8, paddingVertical: 4 },
  timelineChipText: { fontSize: 10, color: '#5C70DF', fontWeight: '700' },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: '#20284D' },
  summaryCard: { marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: '#E8ECFA', padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  summaryLabel: { fontSize: 14, color: '#66708C' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#182245' },
  toggleButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECFA',
  },
  toggleButtonText: { marginRight: 4, fontSize: 14, color: '#66708C' },
  detailList: { marginTop: 12 },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  detailTitle: { fontSize: 14, color: '#25315C' },
  detailPrice: { fontSize: 14, color: '#25315C', fontWeight: '700' },
  emptyText: { marginTop: 14, fontSize: 13, color: '#8A95B4' },
  finishButton: {
    marginTop: 30,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#46C6D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: { fontSize: 18, color: '#FFF', fontWeight: '700' },
});
