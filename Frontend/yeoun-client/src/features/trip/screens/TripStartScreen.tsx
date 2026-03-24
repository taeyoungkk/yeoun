import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTripApi, getTripDetailApi, startTripApi, updateTripApi } from '@/src/api/trip';
import { useTripStore } from '@/src/store/trip.store';
import { useUserStore } from '@/src/store/user.store';
import { locationService } from '../../../services/locationService';

import { TripStartCalendar } from '../components/TripStartCalendar';
import { TripMemberCounter, TripStartField, TripStartInputField } from '../components/TripStartField';
import { TripStartHeader } from '../components/TripStartHeader';

type PickerMode = 'month' | 'year' | null;
type NoticeModalType = 'missing' | 'start' | null;

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatDateLabel(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function formatApiDate(date: Date) {
  return formatDateLabel(date).replace(/\./g, '-');
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
  isEditing,
  tripName,
  dateLabel,
  memberCount,
  missingLabels,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  type: NoticeModalType;
  isEditing: boolean;
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
              <Text style={styles.modalTitle}>입력 정보가 부족합니다</Text>
              <Text style={styles.modalDescription}>아래 항목을 채운 뒤 다시 진행해 주세요.</Text>

              <View style={styles.modalTagWrap}>
                {missingLabels.map((label) => (
                  <View key={label} style={styles.modalTag}>
                    <Text style={styles.modalTagText}>{label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.modalPrimaryButton} onPress={onClose} activeOpacity={0.88}>
                <Text style={styles.modalPrimaryButtonText}>확인</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>{isEditing ? '여행 정보를 수정할까요?' : '이 여행을 시작할까요?'}</Text>
              <Text style={styles.modalDescription}>
                {isEditing ? '현재 입력한 내용으로 여행 정보를 갱신합니다.' : '여행을 생성하고 바로 기록을 시작합니다.'}
              </Text>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>여행 이름</Text>
                  <Text style={styles.summaryValue}>{tripName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>여행 일정</Text>
                  <Text style={styles.summaryValue}>{dateLabel}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>인원</Text>
                  <Text style={styles.summaryValue}>{`${memberCount}명`}</Text>
                </View>
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.modalSecondaryButton} onPress={onClose} activeOpacity={0.88}>
                  <Text style={styles.modalSecondaryButtonText}>취소</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalPrimaryHalfButton} onPress={onConfirm} activeOpacity={0.88}>
                  <Text style={styles.modalPrimaryButtonText}>{isEditing ? '수정하기' : '시작하기'}</Text>
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
  const params = useLocalSearchParams<{ mode?: string }>();
  const profileNickname = useUserStore((state) => state.profile?.nickname);
  const startTrip = useTripStore((state) => state.startTrip);
  const updateCurrentTrip = useTripStore((state) => state.updateCurrentTrip);
  const setActiveTrip = useTripStore((state) => state.setActiveTrip);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const isTripActive = useTripStore((state) => state.isTripActive);
  const isCreateMode = params.mode !== 'edit';
  const editSourceTrip = !isCreateMode ? currentTrip : null;

  const [tripName, setTripName] = useState(editSourceTrip?.tripName ?? '');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(editSourceTrip?.startDate ? new Date(editSourceTrip.startDate) : new Date());
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [startDate, setStartDate] = useState<Date | null>(editSourceTrip?.startDate ? new Date(editSourceTrip.startDate) : null);
  const [endDate, setEndDate] = useState<Date | null>(editSourceTrip?.endDate ? new Date(editSourceTrip.endDate) : null);
  const [memberCount, setMemberCount] = useState(editSourceTrip?.memberCount ?? 2);
  const [noticeModalType, setNoticeModalType] = useState<NoticeModalType>(null);

  const headerNickname = profileNickname?.trim() || '여행자';
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const hasTripName = tripName.trim().length > 0;
  const hasDateRange = Boolean(startDate && endDate);
  const hasMemberCount = memberCount > 0;
  const isFormComplete = hasTripName && hasDateRange && hasMemberCount;
  const isEditingActiveTrip = !isCreateMode && Boolean(currentTrip?.tripId && isTripActive);

  useEffect(() => {
    if (isCreateMode) {
      setTripName('');
      setCalendarMonth(new Date());
      setStartDate(null);
      setEndDate(null);
      setMemberCount(2);
      return;
    }

    setTripName(editSourceTrip?.tripName ?? '');
    setCalendarMonth(editSourceTrip?.startDate ? new Date(editSourceTrip.startDate) : new Date());
    setStartDate(editSourceTrip?.startDate ? new Date(editSourceTrip.startDate) : null);
    setEndDate(editSourceTrip?.endDate ? new Date(editSourceTrip.endDate) : null);
    setMemberCount(editSourceTrip?.memberCount ?? 2);
  }, [editSourceTrip?.endDate, editSourceTrip?.memberCount, editSourceTrip?.startDate, editSourceTrip?.tripId, editSourceTrip?.tripName, isCreateMode]);

  const missingLabels = useMemo(() => {
    const nextMissing: string[] = [];
    if (!hasTripName) nextMissing.push('여행 이름');
    if (!hasDateRange) nextMissing.push('여행 일정');
    if (!hasMemberCount) nextMissing.push('인원');
    return nextMissing;
  }, [hasDateRange, hasMemberCount, hasTripName]);

  const dateLabel = useMemo(() => {
    if (!startDate || !endDate) return undefined;
    return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
  }, [endDate, startDate]);

  const tripDraft = useMemo(
    () => ({
      tripId: currentTrip?.tripId ?? 'trip-demo-uuid',
      tripName: tripName.trim(),
      startDate: startDate?.toISOString() ?? new Date().toISOString(),
      endDate: endDate?.toISOString() ?? startDate?.toISOString() ?? new Date().toISOString(),
      memberCount,
      origin: editSourceTrip?.origin ?? 'Korea',
      destination: editSourceTrip?.destination ?? tripName.trim(),
    }),
    [currentTrip?.tripId, editSourceTrip?.destination, editSourceTrip?.origin, endDate, memberCount, startDate, tripName],
  );

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

  const handlePressNext = () => {
    setNoticeModalType(isFormComplete ? 'start' : 'missing');
  };

  const startTrackingAndNavigate = async (tripId: string) => {
    const trackingResult = await locationService.startTracking();

    if (!trackingResult.success) {
      Alert.alert('위치 추적 실패', '여행 기록을 시작했지만 위치 추적 권한을 확인하지 못했습니다.');
    } else if (!trackingResult.backgroundGranted) {
      Alert.alert('백그라운드 위치 권한 필요', '앱이 꺼져 있어도 기록하려면 설정에서 항상 허용으로 변경해 주세요.', [
        { text: '나중에' },
        {
          text: '설정 열기',
          onPress: () => {
            void locationService.openLocationSettings();
          },
        },
      ]);
    }

    startTrip({ ...tripDraft, tripId });

    try {
      const detailRes = await getTripDetailApi(tripId);
      if (detailRes.success) {
        console.log('[TripStart] Trip detail loaded successfully.', {
          tripId,
          status: detailRes.data.status,
          title: detailRes.data.title,
        });
        setActiveTrip(detailRes.data);
      } else {
        console.warn('[TripStart] Trip detail request completed without success.', {
          tripId,
          message: detailRes.message,
          code: detailRes.code,
        });
      }
    } catch (error) {
      console.error('[TripStart] Failed to fetch trip detail after start.', {
        tripId,
        error,
      });
    }

    router.replace('/trip/recording');
  };

  const handleConfirmStartTrip = async () => {
    setNoticeModalType(null);

    if (isEditingActiveTrip) {
      if (!currentTrip?.tripId || !startDate || !endDate) {
        Alert.alert('?수정 ?실패', '?수정할 여행 정보를 확인하지 못했습니다.');
        return;
      }

      const updateResponse = await updateTripApi(currentTrip.tripId, {
        title: tripName || '?ы뻾',
        startDate: formatApiDate(startDate),
        endDate: formatApiDate(endDate),
      });

      if (!updateResponse.success) {
        Alert.alert('?수정 ?실패', updateResponse.message || '?여행 정보를 수정하지 못했습니다.');
        return;
      }

      updateCurrentTrip({
        ...tripDraft,
        tripId: currentTrip.tripId,
      });

      try {
        const detailRes = await getTripDetailApi(currentTrip.tripId);
        if (detailRes.success) {
          setActiveTrip(detailRes.data);
        }
      } catch (error) {
        console.error('[TripStart] Failed to refresh trip detail after update.', {
          tripId: currentTrip.tripId,
          error,
        });
      }

      Alert.alert('?수정 ?완료', '?여행 정보가 수정되었습니다.');
      router.replace('/trip/recording');
      return;
    }

    if (!startDate || !endDate) {
      setNoticeModalType('missing');
      return;
    }

    try {
      const createResponse = await createTripApi({
        title: tripName || '여행',
        startDate: formatApiDate(startDate),
        endDate: formatApiDate(endDate),
      });

      if (!createResponse.success || !createResponse.data?.tripId) {
        console.warn('[TripStart] Trip creation failed.', {
          message: createResponse.message,
          code: createResponse.code,
        });
        Alert.alert('여행 생성 실패', createResponse.message || '여행을 생성하지 못했습니다.');
        return;
      }

      const tripId = createResponse.data.tripId;
      console.log('[TripStart] Trip created successfully.', {
        tripId,
        title: createResponse.data.title,
        startDate: createResponse.data.startDate,
        endDate: createResponse.data.endDate,
        status: createResponse.data.status,
      });

      const startResponse = await startTripApi(tripId);

      if (!startResponse.success) {
        console.warn('[TripStart] Trip start failed after create.', {
          tripId,
          message: startResponse.message,
          code: startResponse.code,
        });
        Alert.alert('여행 시작 실패', startResponse.message || '여행을 시작하지 못했습니다.');
        return;
      }

      console.log('[TripStart] Trip started successfully.', {
        tripId,
        status: startResponse.data.status,
        startedAt: startResponse.data.startedAt,
      });

      await startTrackingAndNavigate(tripId);
    } catch (error) {
      console.error('[TripStart] Failed during create/start flow.', error);
      Alert.alert('여행 시작 실패', '여행을 생성하거나 시작하는 중 오류가 발생했습니다.');
    }
  };

  const handleOpenMockTrip = () => {
    if (!isFormComplete) {
      setNoticeModalType('missing');
      return;
    }

    startTrip({ ...tripDraft, tripId: 'mock-trip-preview' });
    router.push('/trip/mock-recording');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TripStartHeader nickname={headerNickname} isEditing={isEditingActiveTrip} />

        <View style={styles.formStack}>
          <TripStartInputField icon="edit" placeholder="여행 이름" value={tripName} onChangeText={setTripName} />

          <TripStartField
            icon="calendar-today"
            label="여행 일정"
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
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()} activeOpacity={0.88}>
            <Text style={styles.secondaryButtonText}>취소</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, !isFormComplete && styles.primaryButtonDisabled]}
            onPress={handlePressNext}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>{isEditingActiveTrip ? '수정하기' : '시작하기'}</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ ? (
          <TouchableOpacity style={styles.mockButton} onPress={handleOpenMockTrip} activeOpacity={0.88}>
            <Text style={styles.mockButtonText}>Mock 기록 화면 열기</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <FieldNoticeModal
        visible={noticeModalType !== null}
        type={noticeModalType}
        isEditing={isEditingActiveTrip}
        tripName={tripName.trim()}
        dateLabel={dateLabel}
        memberCount={memberCount}
        missingLabels={missingLabels}
        onClose={() => setNoticeModalType(null)}
        onConfirm={handleConfirmStartTrip}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6F2',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#465346',
  },
  primaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCE6D9',
  },
  primaryButtonDisabled: {
    backgroundColor: '#E7ECE5',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A211C',
  },
  mockButton: {
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: '#40503F',
  },
  mockButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5F8F3',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 18, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 30,
    backgroundColor: '#F7FAF4',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
  },
  modalIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E4EDE1',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#19211B',
    textAlign: 'center',
  },
  modalDescription: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#5E6962',
    textAlign: 'center',
  },
  modalTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 22,
  },
  modalTag: {
    borderRadius: 18,
    backgroundColor: '#E9EFE6',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalTagText: {
    fontSize: 13,
    color: '#4E5A54',
    fontWeight: '600',
  },
  summaryCard: {
    marginTop: 18,
    marginBottom: 22,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#7A877E',
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#1D2620',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6ECE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#425047',
  },
  modalPrimaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#355D49',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryHalfButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#355D49',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F7FBF5',
  },
});
