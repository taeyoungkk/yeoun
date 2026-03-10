import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TripInviteScreen } from '../components/TripInviteScreen';
import { TripStartCalendar } from '../components/TripStartCalendar';
import {
  TripMemberCounter,
  TripStartField,
  TripStartInputField,
} from '../components/TripStartField';
import { TripStartHeader } from '../components/TripStartHeader';

type InviteStatus = 'pending' | 'accepted' | 'expired';
type InviteMember = { id: number; name: string; status: InviteStatus };
type ScreenMode = 'form' | 'invite';
type PickerMode = 'month' | 'year' | null;

const DUMMY_NICKNAME = '지우';
const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const INVITE_MEMBERS: InviteMember[] = [
  { id: 1, name: '김세현', status: 'pending' },
  { id: 2, name: '김승수', status: 'accepted' },
  { id: 3, name: '유동훈', status: 'expired' },
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

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const isFormComplete = tripName.trim().length > 0 && startDate && endDate && memberCount > 0;

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return INVITE_MEMBERS;
    return INVITE_MEMBERS.filter((member) => member.name.includes(query));
  }, [searchQuery]);

  const dateLabel = useMemo(() => {
    if (!startDate || !endDate) return undefined;
    return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
  }, [endDate, startDate]);

  const handlePickDay = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
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

  if (screenMode === 'invite') {
    return (
      <TripInviteScreen
        query={searchQuery}
        members={filteredMembers}
        onBack={() => setScreenMode('form')}
        onChangeQuery={setSearchQuery}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TripStartHeader nickname={DUMMY_NICKNAME} onBack={() => router.back()} />

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
              onPrevMonth={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              onNextMonth={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              onPickDay={handlePickDay}
              onConfirm={() => {
                setCalendarVisible(false);
                setPickerMode(null);
              }}
              onTogglePicker={setPickerMode}
              onSelectMonth={(monthIndex) => setCalendarMonth((prev) => new Date(prev.getFullYear(), monthIndex, 1))}
              onSelectYear={(year) => setCalendarMonth((prev) => new Date(year, prev.getMonth(), 1))}
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
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()} activeOpacity={0.88}>
            <Text style={styles.secondaryButtonText}>이전</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, !isFormComplete && styles.primaryButtonDisabled]}
            disabled={!isFormComplete}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#1A211C',
  },
});
