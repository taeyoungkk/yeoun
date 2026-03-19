import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { CURRENT_USER_ID, getTripEvents, type TimelineEvent } from '@/src/features/trip/store/tripMockStore';
import { useTripStore } from '@/src/store/trip.store';

// --- 상수 및 데이터 (기존 유지) ---
const REPORT_DAYS = [
  { id: 'day1', label: '1일차', dateLabel: '03.11', distanceKm: 12.8 },
  { id: 'day2', label: '2일차', dateLabel: '03.12', distanceKm: 9.4 },
  { id: 'day3', label: '3일차', dateLabel: '03.13', distanceKm: 7.6 },
];

const EMOTION_TONES = [
  { label: '설렘', emoji: '😊', color: '#FF8A5B' },
  { label: '든든함', emoji: '😌', color: '#F2B84B' },
  { label: '만족', emoji: '😄', color: '#62B56A' },
  { label: '차분함', emoji: '🙂', color: '#6EA1EE' },
  { label: '아쉬움', emoji: '🥲', color: '#8D7DE8' },
];

const DAY_COPY: Record<string, string> = {
  day1: '도착 직후부터 사진과 결제가 빠르게 쌓이면서 여행 기록의 리듬이 열린 날입니다.',
  day2: '이동량은 많았지만 흐름이 안정적이어서 전체 여행 페이스가 가장 매끈했던 날입니다.',
  day3: '속도를 줄이고 정리하듯 움직이며 감정과 비용이 또렷하게 남은 마무리 구간입니다.',
};

const BARCODE_SEGMENTS = [4, 2, 3, 1, 2, 5, 2, 1, 4, 2, 5, 1, 2, 3, 2, 4, 1, 3, 2, 5, 1, 2, 4, 2, 3, 1];
const EVENT_LABEL: Record<string, string> = { location: '장소', photo: '사진', payment: '결제' };

const parseAmount = (amount?: string) => {
  if (!amount) return 0;
  const digits = amount.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
};
const formatWon = (value: number) => `₩${value.toLocaleString('ko-KR')}`;
const formatTripDate = (date?: string) => (date ? date.slice(2, 10).replace(/-/g, '.') : '--.--.--');

const getEmotionSnapshot = (events: TimelineEvent[]) => {
  const counts = new Map();
  events.forEach((event) => {
    if (!event.emotionLabel || event.emotionOwnerId !== CURRENT_USER_ID) return;
    counts.set(event.emotionLabel, (counts.get(event.emotionLabel) ?? 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return EMOTION_TONES.map((tone) => ({
    ...tone,
    count: counts.get(tone.label) ?? 0,
    ratio: total > 0 ? (counts.get(tone.label) ?? 0) / total : 0,
  })).filter((tone) => tone.count > 0);
};

const getSettlementRows = (events: TimelineEvent[]) =>
  events
    .filter((event) => event.type === 'payment')
    .map((event) => {
      const amount = parseAmount(event.amount);
      const participants = event.paymentParticipantNames?.length ?? 0;
      const share = participants > 0 ? Math.round(amount / participants) : amount;
      return {
        id: event.id,
        title: event.title,
        payer: event.paymentPayerName ?? '미정',
        amount,
        share,
        splitLabel: event.paymentSplitLabel ?? '분할 정보 없음',
        status: event.paymentStatus === 'confirmed' ? '확정' : '대기',
      };
    });

export default function TripReportScreen() {
  const currentTrip = useTripStore((state) => state.currentTrip);
  const router = useRouter();
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const receiptAppear = useRef(new Animated.Value(0)).current;
  const handleGoHome = () => router.replace('/(tabs)');
  const handleBackToTimeline = () => router.replace('/trip/recording?mode=review');

  const events = useMemo(() => getTripEvents(), []);
  const totalDistance = useMemo(() => REPORT_DAYS.reduce((sum, day) => sum + day.distanceKm, 0), []);
  const totalPhotos = useMemo(() => events.reduce((sum, event) => sum + (event.photoItems?.length ?? 0), 0), [events]);
  const totalLogs = useMemo(() => events.length, [events]);
  const timelineEvents = useMemo(() => [...events], [events]);
  const emotionSnapshot = useMemo(() => getEmotionSnapshot(events), [events]);
  const settlementRows = useMemo(() => getSettlementRows(events), [events]);

  const totalUsed = useMemo(() => settlementRows.reduce((sum, row) => sum + row.amount, 0), [settlementRows]);
  const sharedPerPerson = useMemo(() => Math.round(settlementRows.reduce((sum, row) => sum + row.share, 0)), [settlementRows]);
  const remainingAmount = Math.max(2000000 - totalUsed, 0);
  const remainingPerPerson = Math.round(remainingAmount / 2);
  const unsettledAmount = settlementRows.filter((row) => row.status === '대기').reduce((sum, row) => sum + row.amount, 0);
  const tripTitle = currentTrip?.tripName || 'Trip';
  const tripStartLabel = formatTripDate(currentTrip?.startDate);
  const tripEndLabel = formatTripDate(currentTrip?.endDate);
  const travelerCount = String(currentTrip?.memberCount ?? 4).padStart(2, '0');
  const tripOrigin = currentTrip?.origin || '대전';
  const tripDestination = currentTrip?.destination || tripTitle;
  const emotionCount = String(emotionSnapshot.reduce((sum, emotion) => sum + emotion.count, 0)).padStart(2, '0');
  const totalCostLabel = formatWon(totalUsed);
  const confirmedRows = settlementRows.filter((row) => row.status === '확정');
  const candidateRows = settlementRows.filter((row) => row.status === '대기');

  useEffect(() => {
    Animated.spring(receiptAppear, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 140,
      mass: 0.9,
    }).start();
  }, [receiptAppear]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#F7F8FF', '#EEF4FF', '#F8F6EF']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* 헤더 */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerButton} onPress={handleBackToTimeline}>
              <MaterialIcons name="arrow-back" size={22} color="#3852D6" />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{tripTitle}</Text>
            </View>
            <TouchableOpacity style={styles.headerActionButton} onPress={handleGoHome}>
              <Text style={styles.headerActionText}>완료</Text>
            </TouchableOpacity>
          </View>

          {/* 메인 티켓 */}
          <View style={styles.ticketWrap}>
            <View style={styles.barcodeSection}>
              <View style={styles.barcodeStrip}>
                {BARCODE_SEGMENTS.map((width, index) => (
                  <View key={index} style={[styles.barcodeBar, { width: width * 3.5 }]} />
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
                <Text style={styles.ticketNumberValue}>AD90542</Text>
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
                  <MaterialIcons name="flight" size={18} color="#D1D1D1" style={styles.flightIconTop} />
                  <MaterialIcons name="flight" size={18} color="#D1D1D1" style={styles.flightIconBottom} />
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
                  { label: 'Emotions', value: emotionCount },
                  { label: 'Total Cost', value: totalCostLabel },
                ].map((item, idx) => (
                  <View key={idx} style={styles.ticketInfoCell}>
                    <Text style={styles.ticketInfoLabel}>{item.label}</Text>
                    <Text style={styles.ticketInfoValue}>{item.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.ticketRule} />

              <View>
                <Text style={styles.ticketSectionTitle}>일정 요약</Text>
                {REPORT_DAYS.map((day, idx) => {
                  const mockPhotos = idx === 0 ? 8 : idx === 1 ? 5 : 2;
                  const mockPlaces = idx === 0 ? 3 : idx === 1 ? 2 : 1;
                  return (
                    <View key={day.id} style={styles.inlineDayRow}>
                      <Text style={styles.inlineDayLabel}>{day.label}</Text>
                      <Text style={styles.inlineDayValue}>
                        {`${day.distanceKm.toFixed(1)}km · 사진 ${mockPhotos}장 · 장소 ${mockPlaces}곳`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.ticketRule} />

              <View>
                <Text style={styles.ticketSectionTitle}>감정 추이</Text>
                <View style={styles.emotionList}>
                  {emotionSnapshot.map((emotion) => (
                    <View key={emotion.label} style={styles.emotionRow}>
                      <Text style={styles.emotionEmoji}>{emotion.emoji}</Text>
                      <Text style={styles.emotionLabel}>{emotion.label}</Text>
                      <View style={styles.emotionBarTrack}>
                        <View style={[styles.emotionBarFill, { width: `${emotion.ratio * 100}%`, backgroundColor: emotion.color }]} />
                      </View>
                      <Text style={styles.emotionCount}>{`${emotion.count}회`}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* 타임라인 */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.timelineHeader}
              activeOpacity={0.8}
              onPress={() => setIsTimelineOpen(!isTimelineOpen)}
            >
              <View style={styles.timelineHeaderCopy}>
                <Text style={styles.sectionKicker}>타임라인</Text>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>여행 상세보기</Text>
              </View>
              <MaterialIcons name={isTimelineOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={28} color="#1C2751" />
            </TouchableOpacity>

            {isTimelineOpen && (
              <View style={styles.timelineBody}>
                {timelineEvents.map((event, index) => (
                  <View key={event.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {index < timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineCard}>
                      <View style={styles.timelineTop}>
                        <Text style={styles.timelineTime}>{event.time}</Text>
                        <View style={styles.timelineChip}><Text style={styles.timelineChipText}>{EVENT_LABEL[event.type]}</Text></View>
                      </View>
                      <Text style={styles.timelineTitle}>{event.title}</Text>
                      {event.emotionLabel && (
                        <View style={styles.timelineEmotion}>
                          <Text style={styles.timelineEmotionText}>{`${event.emotionEmoji} ${event.emotionLabel}`}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 정산 섹션 */}
          <View style={styles.settlementSection}>
            <Text style={styles.settlementTitle}>최종정산</Text>
            <Animated.View style={[styles.summaryTicket, { opacity: receiptAppear }]}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryRow}><Text style={styles.summaryLeft}>총 사용 금액</Text><Text style={styles.summaryRight}>{formatWon(totalUsed)}</Text></View>
                <View style={styles.summaryRow}><Text style={styles.summaryLeft}>1인당 금액</Text><Text style={styles.summaryRight}>{formatWon(sharedPerPerson)}</Text></View>
              </View>
              <View style={styles.summaryBottom}>
                <View style={styles.summaryRow}><Text style={styles.summaryBottomLeft}>남은 금액</Text><Text style={styles.summaryBottomRight}>{formatWon(remainingAmount)}</Text></View>
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.detailButton} onPress={() => setIsSettlementOpen(!isSettlementOpen)}>
              <Text style={styles.detailButtonText}>내역 자세히 보기</Text>
              <MaterialIcons name={isSettlementOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#616978" />
            </TouchableOpacity>

            {isSettlementOpen && (
              <View style={styles.detailList}>
                {confirmedRows.map((row) => (
                  <View key={row.id} style={styles.detailItem}>
                    <Text style={styles.detailTitle}>{row.title}</Text>
                    <Text style={styles.detailPrice}>{formatWon(row.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
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
  headerButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE4FF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerKicker: { fontSize: 11, color: '#7281B8', fontWeight: '600' },
  headerTitle: { fontSize: 22, color: '#182245', fontWeight: 'bold' },
  headerActionButton: { minWidth: 56, height: 38, borderRadius: 19, backgroundColor: '#3852D6', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  headerActionText: { fontSize: 14, color: '#FFF', fontWeight: '700' },

  // 티켓 스타일
  ticketWrap: { borderBottomLeftRadius: 35, borderBottomRightRadius: 35, backgroundColor: '#FFF', overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },
  barcodeSection: { height: 74, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 0, backgroundColor: '#FFFFFF' },
  barcodeStrip: { flexDirection: 'row', height: 44, gap: 3 },
  barcodeBar: { backgroundColor: '#5B4F66' },

  perforationContainer: { flexDirection: 'row', alignItems: 'center', height: 40 },
  ticketPerforation: { flex: 1, borderTopWidth: 1.5, borderColor: '#5B4F66', borderStyle: 'dashed', opacity: 0.2 },

  // 펀치홀 컬러를 배경색(#F7F8FF)과 일치시켜 파여 보이게 함
  punchHoleLeft: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F8FF', marginLeft: -20, marginRight: 15 },
  punchHoleRight: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F8FF', marginRight: -20, marginLeft: 15 },

  ticketContent: { paddingHorizontal: 24, paddingBottom: 30 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  ticketNumberLabel: { fontSize: 14, color: '#999' },
  ticketNumberValue: { fontSize: 18, color: '#5B4F66', fontWeight: 'bold' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketRouteBlock: { flex: 1 },
  ticketCode: { fontSize: 36, color: '#5B4F66', fontWeight: 'bold' },
  ticketCodeRight: { textAlign: 'right' },
  ticketDateText: { fontSize: 14, color: '#BBB', marginTop: 4 },
  ticketDateTextRight: { textAlign: 'right' },

  ticketRouteCenter: { width: 120, height: 60, alignItems: 'center', justifyContent: 'center' },
  flightIconTop: { position: 'absolute', top: 0, transform: [{ rotate: '90deg' }] },
  flightIconBottom: { position: 'absolute', bottom: 0, transform: [{ rotate: '270deg' }] },

  ticketRule: { height: 1, backgroundColor: '#EEE', marginVertical: 25 },
  ticketInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 25 },
  ticketInfoCell: { width: '33.3%' },
  ticketInfoLabel: { fontSize: 12, color: '#BBB', marginBottom: 4 },
  ticketInfoValue: { fontSize: 16, color: '#5B4F66', fontWeight: 'bold' },

  ticketSectionTitle: { fontSize: 13, color: '#999', marginBottom: 12, fontWeight: 'bold' },
  inlineDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inlineDayLabel: { fontSize: 16, color: '#5B4F66', fontWeight: 'bold' },
  inlineDayValue: { fontSize: 14, color: '#7E8CB6', fontWeight: 'bold' },

  // 하단 공통 카드 스타일
  sectionCard: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFF', padding: 20, elevation: 2, borderWidth: 1, borderColor: '#EEE' },
  sectionKicker: { fontSize: 11, color: '#7182BC', fontWeight: '600' },
  sectionTitle: { fontSize: 19, color: '#1C2751', marginTop: 4, fontWeight: 'bold', marginBottom: 15 },

  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineHeaderCopy: { flex: 1 },
  timelineBody: { marginTop: 20 },

  emotionList: { gap: 10 },
  emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emotionEmoji: { fontSize: 18 },
  emotionLabel: { width: 50, fontSize: 13, color: '#30406C' },
  emotionBarTrack: { flex: 1, height: 12, backgroundColor: '#EDF1FF', borderRadius: 6, overflow: 'hidden' },
  emotionBarFill: { height: '100%', borderRadius: 6 },
  emotionCount: { fontSize: 12, color: '#7F8CB4' },

  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  timelineRail: { width: 12, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5D73FF', marginTop: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E2E8FF' },
  timelineCard: { flex: 1, backgroundColor: '#F7F9FF', borderRadius: 15, padding: 15 },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  timelineTime: { fontSize: 12, fontWeight: 'bold', color: '#24305B' },
  timelineChip: { backgroundColor: '#E9EEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  timelineChipText: { fontSize: 10, color: '#5C70DF', fontWeight: 'bold' },
  timelineTitle: { fontSize: 16, fontWeight: 'bold', color: '#20284D' },
  timelineEmotion: { marginTop: 8, backgroundColor: '#FFF1E4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, alignSelf: 'flex-start' },
  timelineEmotionText: { fontSize: 11, color: '#B76A2E' },

  settlementSection: { marginTop: 20, borderRadius: 25, backgroundColor: '#FFF', padding: 20 },
  settlementTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  summaryTicket: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE' },
  summaryTop: { padding: 15 },
  summaryBottom: { padding: 15, backgroundColor: '#DFF7FF' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  summaryLeft: { fontSize: 14, color: '#666' },
  summaryRight: { fontSize: 16, fontWeight: 'bold' },
  summaryBottomLeft: { fontSize: 15, fontWeight: 'bold' },
  summaryBottomRight: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },

  detailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, marginTop: 15, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  detailButtonText: { fontSize: 14, color: '#666', marginRight: 5 },
  detailList: { marginTop: 10 },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#FAFAFA', borderRadius: 10, marginBottom: 5 },
  detailTitle: { fontSize: 14, color: '#333' },
  detailPrice: { fontSize: 14, fontWeight: 'bold' },

  finishButton: { marginTop: 30, height: 60, borderRadius: 20, backgroundColor: '#46C6D9', alignItems: 'center', justifyContent: 'center' },
  finishButtonText: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
});
