import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  InviteCandidate,
  InviteMember,
  TripInviteScreen,
} from '../components/TripInviteScreen';
import { TripStartCalendar } from '../components/TripStartCalendar';
import {
  TripMemberCounter,
  TripStartField,
  TripStartInputField,
} from '../components/TripStartField';
import { TripStartHeader } from '../components/TripStartHeader';
import { startTripApi } from '@/src/api/trip';
import { locationService } from '@/src/services/locationService';
import { Alert } from 'react-native';

type ScreenMode = 'form' | 'invite';
type PickerMode = 'month' | 'year' | null;
type NoticeModalType = 'missing' | 'start' | null;

const DUMMY_NICKNAME = '지우';
const DUMMY_INVITE_LINK = 'https://yeoun.app/invite/trip-demo-2026';
const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
];
const SEARCH_CANDIDATES: InviteCandidate[] = [
  { id: 101, name: '김세현', nickname: 'sehyeon' },
  { id: 102, name: '김승수', nickname: 'seungsoo' },
  { id: 103, name: '유동훈', nickname: 'donghoon' },
  { id: 104, name: '박지우', nickname: 'jiwoo' },
  { id: 105, name: '이민아', nickname: 'mina' },
  { id: 106, name: '최하린', nickname: 'harin' },
  { id: 107, name: '정예준', nickname: 'yejun' },
];
const INITIAL_INVITE_MEMBERS: InviteMember[] = [
  { id: 1, name: '김세현', nickname: 'sehyeon', status: 'pending' },
  { id: 2, name: '김승수', nickname: 'seungsoo', status: 'accepted' },
  { id: 3, name: '유동훈', nickname: 'donghoon', status: 'expired' },
];

function formatDateLabel(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function getCalendarDays(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days: { date: Date; currentMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    days.push({ date: new Date(year, month, -i), currentMonth: false });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push({ date: new Date(year, month, day), currentMonth: true });
  }

  while (days.length % 7 !== 0) {
    const nextDay = days.length - (startOffset + totalDays) + 1;
    days.push({ date: new Date(year, month + 1, nextDay), currentMonth: false });
  }

  return days;
}

function FieldNoticeModal({
  visible,
  type,
  tripName,
  dateLabel,
  memberCount,
  missingLabels,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  type: NoticeModalType;
  tripName: string;
  dateLabel?: string;
  memberCount: number;
  missingLabels: string[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!type) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalIconWrap}>
            <MaterialIcons
              name={type === 'missing' ? 'playlist-add-check-circle' : 'auto-awesome'}
              size={26}
              color={type === 'missing' ? '#5D6C63' : '#355D49'}
            />
          </View>

          {type === 'missing' ? (
            <>
              <Text style={styles.modalTitle}>입력이 더 필요해요</Text>
              <Text style={styles.modalDescription}>
                여행을 시작하려면 아래 항목을 먼저 선택해 주세요.
              </Text>

              <View style={styles.modalTagWrap}>
                {missingLabels.map((label) => (
                  <View key={label} style={styles.modalTag}>
                    <Text style={styles.modalTagText}>{label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.modalPrimaryButton} onPress={onClose} activeOpacity={0.88}>
                <Text style={styles.modalPrimaryButtonText}>확인했어요</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>여행 기록을 시작합니다</Text>
              <Text style={styles.modalDescription}>
                아래 설정으로 여행 기록 페이지로 이동할게요.
              </Text>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>여행 이름</Text>
                  <Text style={styles.summaryValue}>{tripName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>여행 날짜</Text>
                  <Text style={styles.summaryValue}>{dateLabel}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>인원</Text>
                  <Text style={styles.summaryValue}>{memberCount}명</Text>
                </View>
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={onClose}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalSecondaryButtonText}>취소</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalPrimaryHalfButton}
                  onPress={onConfirm}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalPrimaryButtonText}>시작하기</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function TripStartScreen() {
  const router = useRouter();
  const [tripName, setTripName] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2025, 8, 1));
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [memberCount, setMemberCount] = useState(2);
  const [screenMode, setScreenMode] = useState<ScreenMode>('form');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteMembers, setInviteMembers] = useState<InviteMember[]>(INITIAL_INVITE_MEMBERS);
  const [noticeModalType, setNoticeModalType] = useState<NoticeModalType>(null);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const hasTripName = tripName.trim().length > 0;
  const hasDateRange = Boolean(startDate && endDate);
  const hasMemberCount = memberCount > 0;
  const isFormComplete = hasTripName && hasDateRange && hasMemberCount;

  const missingLabels = useMemo(() => {
    const nextMissing: string[] = [];

    if (!hasTripName) nextMissing.push('여행 이름');
    if (!hasDateRange) nextMissing.push('날짜');
    if (!hasMemberCount) nextMissing.push('인원');

    return nextMissing;
  }, [hasDateRange, hasMemberCount, hasTripName]);

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const invitedUserIds = new Set(inviteMembers.map((member) => member.id));

    return SEARCH_CANDIDATES.filter((candidate) => {
      if (invitedUserIds.has(candidate.id)) return false;
      if (!query) return true;

      return (
        candidate.name.toLowerCase().includes(query) ||
        candidate.nickname.toLowerCase().includes(query)
      );
    });
  }, [inviteMembers, searchQuery]);

  const dateLabel = useMemo(() => {
    if (!startDate || !endDate) return undefined;
    return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
  }, [endDate, startDate]);

  const handlePickDay = (date: Date) => {
    if (!startDate || endDate) {
      setStartDate(date);
      setEndDate(null);
      return;
    }

    if (date < startDate) {
      setEndDate(startDate);
      setStartDate(date);
      return;
    }

    setEndDate(date);
  };

  const handleInviteMember = (candidate: InviteCandidate) => {
    setInviteMembers((prev) => [
      { id: candidate.id, name: candidate.name, nickname: candidate.nickname, status: 'pending' },
      ...prev,
    ]);
    setSearchQuery('');
  };

  const handleCancelInvite = (memberId: number) => {
    setInviteMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, status: 'canceled' } : member
      )
    );
  };

  const handlePressNext = () => {
    setNoticeModalType(isFormComplete ? 'start' : 'missing');
  };

  const handleStartTrip = async () => {
    setNoticeModalType(null);
    
    // 1. API 호출로 여행 시작 상태 변경
    const response = await startTripApi('trip-demo-uuid'); // 임시 UUID 사용
    
    if (response.success) {
      // 2. GPS 트래킹 시작
      const trackingSuccess = await locationService.startTracking();
      if (!trackingSuccess) {
        Alert.alert(
          '위치 권한 필요',
          '여행 경로를 기록하려면 항시 위치 허용 권한이 필요합니다. 설정에서 확인해 주세요.'
        );
      }
      
      // 3. 기록 화면으로 이동
      router.push('/trip/recording');
    } else {
      Alert.alert('오류', response.message);
    }
  };

  if (screenMode === 'invite') {
    return (
      <TripInviteScreen
        query={searchQuery}
        candidates={filteredCandidates}
        members={inviteMembers}
        inviteLink={DUMMY_INVITE_LINK}
        onBack={() => setScreenMode('form')}
        onChangeQuery={setSearchQuery}
        onInviteMember={handleInviteMember}
        onCancelInvite={handleCancelInvite}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TripStartHeader nickname={DUMMY_NICKNAME} />

        <View style={styles.formStack}>
          <TripStartInputField
            icon="edit"
            placeholder="여행 이름"
            value={tripName}
            onChangeText={setTripName}
          />

          <TripStartField
            icon="calendar-today"
            label="날짜 선택"
            value={dateLabel}
            onPress={() => {
              setPickerMode(null);
              setCalendarVisible((prev) => !prev);
            }}
          />

          {calendarVisible ? (
            <TripStartCalendar
              monthLabels={MONTH_LABELS}
              weekLabels={WEEK_LABELS}
              calendarMonth={calendarMonth}
              days={calendarDays}
              pickerMode={pickerMode}
              startDate={startDate}
              endDate={endDate}
              onPrevMonth={() =>
                setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              onNextMonth={() =>
                setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              onPickDay={handlePickDay}
              onConfirm={() => {
                setCalendarVisible(false);
                setPickerMode(null);
              }}
              onTogglePicker={setPickerMode}
              onSelectMonth={(monthIndex) =>
                setCalendarMonth((prev) => new Date(prev.getFullYear(), monthIndex, 1))
              }
              onSelectYear={(year) =>
                setCalendarMonth((prev) => new Date(year, prev.getMonth(), 1))
              }
            />
          ) : null}

          <TripStartField
            icon="groups-2"
            label="인원"
            centerSlot={
              <TripMemberCounter
                count={memberCount}
                onDecrease={() => setMemberCount((prev) => Math.max(1, prev - 1))}
                onIncrease={() => setMemberCount((prev) => Math.min(20, prev + 1))}
              />
            }
          />

          <TripStartField
            icon="group-add"
            label="여행 멤버 초대"
            value="여행 멤버 초대"
            onPress={() => setScreenMode('invite')}
            rightSlot={<MaterialIcons name="chevron-right" size={22} color="#151A17" />}
          />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryButtonText}>이전</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, !isFormComplete && styles.primaryButtonDisabled]}
            onPress={handlePressNext}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FieldNoticeModal
        visible={noticeModalType !== null}
        type={noticeModalType}
        tripName={tripName.trim()}
        dateLabel={dateLabel}
        memberCount={memberCount}
        missingLabels={missingLabels}
        onClose={() => setNoticeModalType(null)}
        onConfirm={handleStartTrip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF3EA',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  formStack: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 44,
  },
  secondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F4F6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#465346',
  },
  primaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#DCE6D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#E7ECE5',
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#1A211C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 28, 22, 0.26)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 30,
    backgroundColor: '#FCFEFB',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: '#243128',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E6EEE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  modalTitle: {
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    fontSize: 21,
    color: '#162018',
  },
  modalDescription: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#6C7870',
  },
  modalTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    marginBottom: 20,
  },
  modalTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF3EC',
  },
  modalTagText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#4B5B52',
  },
  summaryCard: {
    marginTop: 18,
    marginBottom: 20,
    borderRadius: 22,
    backgroundColor: '#F4F8F2',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#7A857D',
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#1D2620',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#5F6E65',
  },
  modalPrimaryButton: {
    marginTop: 2,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCE6D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryHalfButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DCE6D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#2E3F34',
  },
});
