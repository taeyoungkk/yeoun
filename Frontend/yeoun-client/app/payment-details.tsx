import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  createExpenseApi,
  deleteExpenseApi,
  getExpenseDetailApi,
  getTripExpensesApi,
  TripExpenseItem,
  updateExpenseApi,
} from '@/src/api/expense';
import { ExpenseCategory } from '@/src/api/paymentImport';
import { filterAcceptedTripMembers, getTripMembersApi, getTripsApi, isSettlementEligibleTrip, TripListItem, TripMemberItem } from '@/src/api/trip';
import { useTripStore } from '@/src/store';

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const CATEGORIES: ExpenseCategory[] = ['FOOD', 'CAFE', 'TRANSPORT', 'LODGING', 'SHOPPING', 'ETC'];
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: '식비',
  CAFE: '카페',
  TRANSPORT: '교통',
  LODGING: '숙소',
  SHOPPING: '쇼핑',
  ETC: '기타',
};
const SUMMARY_AVATAR_COLORS = ['#D7C2FF', '#FFCACA', '#BEEAD8', '#FFD6A5', '#C9D7FF'] as const;

type ManualExpenseForm = {
  merchantName: string;
  totalAmount: string;
  payerUserId: string;
  category: ExpenseCategory;
  participantUserIds: string[];
};

type EditableExpenseContext = {
  expenseId: string;
  paidAt: string;
};

type PeriodOption = {
  key: string;
  label: string;
  dateKey: string | null;
};

type MemberOption = {
  id: string | null;
  label: string;
};

type GroupedExpense = {
  dayLabel: string;
  dateKey: string;
  items: TripExpenseItem[];
};

type MemberSummaryRow = {
  userId: string;
  nickname: string;
  shareAmount: number;
  paidAmount: number;
};

const createEmptyManualExpenseForm = (): ManualExpenseForm => ({
  merchantName: '',
  totalAmount: '',
  payerUserId: '',
  category: 'ETC',
  participantUserIds: [],
});

const formatCurrency = (amount: number) => `${KRW_FORMATTER.format(Math.round(amount))}원`;
const formatDateKey = (value?: string | null) => (value ? value.slice(0, 10) : 'unknown');

const formatDateLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getMonth() + 1}.${parsed.getDate()}/${WEEKDAY_LABELS[parsed.getDay()]}`;
};

const formatPeriod = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} - ${end}`;
  }
  return `${startDate.getFullYear()}.${startDate.getMonth() + 1}.${startDate.getDate()} - ${endDate.getMonth() + 1}.${endDate.getDate()}`;
};

const resolveMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const buildDateRange = (startDate?: string | null, endDate?: string | null) => {
  if (!startDate || !endDate) return [] as string[];

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const getShareAmountForMember = (expense: TripExpenseItem, memberId: string | null) => {
  if (!memberId) return 0;
  const participantUserIds = expense.participantUserIds ?? [];
  if (!participantUserIds.includes(memberId)) return 0;
  return expense.totalAmount / Math.max(participantUserIds.length, 1);
};

const getCategoryIconName = (category: string) => {
  switch (category) {
    case 'FOOD':
      return 'restaurant';
    case 'CAFE':
      return 'cafe';
    case 'TRANSPORT':
      return 'airplane';
    case 'LODGING':
      return 'home';
    case 'SHOPPING':
      return 'cart';
    default:
      return 'receipt';
  }
};

export default function PaymentDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const currentTripId = useTripStore((state) => state.currentTripId);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const routeTripId = typeof params.tripId === 'string' && params.tripId.length > 0 ? params.tripId : null;

  const [tripId, setTripId] = useState<string | null>(routeTripId ?? currentTripId);
  const [tripOptions, setTripOptions] = useState<TripListItem[]>([]);
  const [tripMembers, setTripMembers] = useState<TripMemberItem[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualExpenseForm, setManualExpenseForm] = useState<ManualExpenseForm>(createEmptyManualExpenseForm());
  const [periodSelectorVisible, setPeriodSelectorVisible] = useState(false);
  const [memberSelectorVisible, setMemberSelectorVisible] = useState(false);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isMemberSummaryMode, setIsMemberSummaryMode] = useState(false);
  const [addExpenseMethodVisible, setAddExpenseMethodVisible] = useState(false);
  const [pendingExpenseDateKey, setPendingExpenseDateKey] = useState<string | null>(null);
  const [expenseActionVisible, setExpenseActionVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<TripExpenseItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<EditableExpenseContext | null>(null);

  const loadTripData = useCallback(async (selectedTripId: string) => {
    const [membersResponse, expensesResponse] = await Promise.all([
      getTripMembersApi(selectedTripId),
      getTripExpensesApi(selectedTripId),
    ]);

    if (!membersResponse.success) {
      throw new Error(membersResponse.message ?? '여행 멤버를 불러오지 못했습니다.');
    }
    if (!expensesResponse.success) {
      throw new Error(expensesResponse.message ?? '지출 내역을 불러오지 못했습니다.');
    }

    setTripMembers(filterAcceptedTripMembers(membersResponse.data.items));
    setExpenses(expensesResponse.data.items);
  }, []);

  const loadData = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        setErrorMessage(null);
        const tripsResponse = await getTripsApi();
        if (!tripsResponse.success) {
          throw new Error(tripsResponse.message ?? '여행 정보를 불러오지 못했습니다.');
        }

        const availableTrips = tripsResponse.data.items.filter(isSettlementEligibleTrip);
        setTripOptions(availableTrips);
        const nextTripId =
          (tripId && availableTrips.some((item) => item.tripId === tripId) ? tripId : null) ??
          (routeTripId && availableTrips.some((item) => item.tripId === routeTripId) ? routeTripId : null) ??
          (currentTripId && availableTrips.some((item) => item.tripId === currentTripId) ? currentTripId : null) ??
          null;

        setTripId(nextTripId);
        if (nextTripId) {
          await loadTripData(nextTripId);
        } else {
          setTripMembers([]);
          setExpenses([]);
        }
      } catch (error) {
        setErrorMessage(resolveMessage(error, '지출 내역을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentTripId, loadTripData, routeTripId, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const selectedTrip = useMemo(
    () => tripOptions.find((option) => option.tripId === tripId) ?? null,
    [tripId, tripOptions],
  );

  const participantMap = useMemo(
    () => new Map(tripMembers.map((member) => [member.userId, member.nickname])),
    [tripMembers],
  );

  const periodOptions = useMemo(() => {
    const labels = buildDateRange(selectedTrip?.startDate, selectedTrip?.endDate);
    const options: PeriodOption[] = [{ key: 'all', label: '전체 기간', dateKey: null }];

    labels.forEach((dateKey, index) => {
      options.push({
        key: dateKey,
        label: `day ${index + 1} ${formatDateLabel(dateKey)}`,
        dateKey,
      });
    });

    if (labels.length === 0) {
      const uniqueDates = Array.from(new Set(expenses.map((expense) => formatDateKey(expense.paidAt)))).sort();
      uniqueDates.forEach((dateKey, index) => {
        options.push({
          key: dateKey,
          label: `day ${index + 1} ${formatDateLabel(dateKey)}`,
          dateKey,
        });
      });
    }

    return options;
  }, [expenses, selectedTrip?.endDate, selectedTrip?.startDate]);

  useEffect(() => {
    if (!periodOptions.some((option) => option.key === selectedPeriodKey)) {
      setSelectedPeriodKey('all');
    }
  }, [periodOptions, selectedPeriodKey]);

  const memberOptions = useMemo<MemberOption[]>(
    () => [{ id: null, label: '멤버 전체' }, ...tripMembers.map((member) => ({ id: member.userId, label: member.nickname }))],
    [tripMembers],
  );

  useEffect(() => {
    if (selectedMemberId && !memberOptions.some((option) => option.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [memberOptions, selectedMemberId]);

  const selectedPeriod = useMemo(
    () =>
      periodOptions.find((option) => option.key === selectedPeriodKey) ?? {
        key: 'all',
        label: '전체 기간',
        dateKey: null,
      },
    [periodOptions, selectedPeriodKey],
  );

  const selectedMemberLabel = useMemo(
    () => memberOptions.find((option) => option.id === selectedMemberId)?.label ?? '멤버 전체',
    [memberOptions, selectedMemberId],
  );

  const tripPeriodLabel = useMemo(
    () => formatPeriod(selectedTrip?.startDate, selectedTrip?.endDate),
    [selectedTrip?.endDate, selectedTrip?.startDate],
  );

  const periodFilteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const dateKey = formatDateKey(expense.paidAt);
      return !selectedPeriod.dateKey || selectedPeriod.dateKey === dateKey;
    });
  }, [expenses, selectedPeriod.dateKey]);

  const filteredExpenses = useMemo(() => {
    return periodFilteredExpenses.filter((expense) => {
      if (!selectedMemberId) return true;
      return expense.payerUserId === selectedMemberId || (expense.participantUserIds ?? []).includes(selectedMemberId);
    });
  }, [periodFilteredExpenses, selectedMemberId]);

  const groupedExpenses = useMemo<GroupedExpense[]>(() => {
    const grouped = new Map<string, TripExpenseItem[]>();
    filteredExpenses.forEach((expense) => {
      const dateKey = formatDateKey(expense.paidAt);
      const current = grouped.get(dateKey) ?? [];
      current.push(expense);
      grouped.set(dateKey, current);
    });

    const dateSequence =
      selectedPeriod.dateKey !== null
        ? [selectedPeriod.dateKey]
        : periodOptions.filter((option) => option.dateKey).map((option) => option.dateKey as string);

    const orderedDates = dateSequence.length > 0 ? dateSequence : Array.from(grouped.keys()).sort();

    return orderedDates.map((dateKey, index) => ({
      dayLabel: `day ${index + 1}`,
      dateKey,
      items: (grouped.get(dateKey) ?? []).sort((a, b) => (a.paidAt ?? '').localeCompare(b.paidAt ?? '')),
    }));
  }, [filteredExpenses, periodOptions, selectedPeriod.dateKey]);

  const memberSummaryRows = useMemo<MemberSummaryRow[]>(() => {
    return tripMembers.map((member) => {
      const shareAmount = periodFilteredExpenses.reduce((sum, expense) => sum + getShareAmountForMember(expense, member.userId), 0);
      const paidAmount = periodFilteredExpenses.reduce(
        (sum, expense) => sum + (expense.payerUserId === member.userId ? expense.totalAmount : 0),
        0,
      );

      return {
        userId: member.userId,
        nickname: member.nickname,
        shareAmount,
        paidAmount,
      };
    });
  }, [periodFilteredExpenses, tripMembers]);

  const bottomSummaryAmount = useMemo(() => {
    if (isMemberSummaryMode) {
      return periodFilteredExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
    }
    if (selectedMemberId) {
      return filteredExpenses.reduce((sum, expense) => sum + getShareAmountForMember(expense, selectedMemberId), 0);
    }
    return filteredExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
  }, [filteredExpenses, isMemberSummaryMode, periodFilteredExpenses, selectedMemberId]);

  const openAddExpenseMethod = useCallback(
    (dateKey?: string | null) => {
      setEditingExpense(null);
      setManualExpenseForm(createEmptyManualExpenseForm());
      setPendingExpenseDateKey(dateKey ?? selectedPeriod.dateKey ?? null);
      setAddExpenseMethodVisible(true);
    },
    [selectedPeriod.dateKey],
  );

  const handleCreateManualExpense = async () => {
    if (!tripId) return;

    const parsedAmount = Number(manualExpenseForm.totalAmount);
    if (!manualExpenseForm.merchantName.trim() || !manualExpenseForm.payerUserId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('입력 확인', '상호명, 결제자, 금액을 확인해 주세요.');
      return;
    }
    if (manualExpenseForm.participantUserIds.length === 0) {
      Alert.alert('입력 확인', '함께한 멤버를 한 명 이상 선택해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const paidAt =
        editingExpense?.paidAt ??
        (pendingExpenseDateKey ? `${pendingExpenseDateKey}T12:00:00.000Z` : new Date().toISOString());

      const payload = {
        merchantName: manualExpenseForm.merchantName.trim(),
        category: manualExpenseForm.category,
        currencyCode: 'KRW',
        totalAmount: parsedAmount,
        paidAt,
        payerUserId: manualExpenseForm.payerUserId,
        memo: '',
        participantUserIds: manualExpenseForm.participantUserIds,
      };

      const response = editingExpense
        ? await updateExpenseApi(editingExpense.expenseId, payload)
        : await createExpenseApi(tripId, payload);

      if (!response.success) {
        throw new Error(response.message ?? (editingExpense ? '비용 수정에 실패했습니다.' : '비용 추가에 실패했습니다.'));
      }

      setManualExpenseForm(createEmptyManualExpenseForm());
      setManualModalVisible(false);
      setPendingExpenseDateKey(null);
      setEditingExpense(null);
      await loadTripData(tripId);
    } catch (error) {
      Alert.alert('오류', resolveMessage(error, editingExpense ? '비용 수정에 실패했습니다.' : '비용 추가에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const openExpenseActions = useCallback((expense: TripExpenseItem) => {
    setSelectedExpense(expense);
    setExpenseActionVisible(true);
  }, []);

  const handleEditExpense = useCallback(async () => {
    if (!selectedExpense) return;

    try {
      const response = await getExpenseDetailApi(selectedExpense.expenseId);
      if (!response.success) {
        throw new Error(response.message ?? '지출 상세를 불러오지 못했습니다.');
      }

      const detail = response.data;
      setEditingExpense({ expenseId: selectedExpense.expenseId, paidAt: detail.paidAt ?? selectedExpense.paidAt });
      setPendingExpenseDateKey(formatDateKey(detail.paidAt ?? selectedExpense.paidAt));
      setManualExpenseForm({
        merchantName: detail.merchantName ?? selectedExpense.merchantName,
        totalAmount: String(detail.totalAmount ?? selectedExpense.totalAmount ?? ''),
        payerUserId: detail.payerUserId ?? selectedExpense.payerUserId,
        category: (detail.category as ExpenseCategory) ?? (selectedExpense.category as ExpenseCategory) ?? 'ETC',
        participantUserIds:
          detail.participantUserIds && detail.participantUserIds.length > 0
            ? detail.participantUserIds
            : selectedExpense.participantUserIds ?? [],
      });
      setExpenseActionVisible(false);
      setManualModalVisible(true);
    } catch (error) {
      Alert.alert('오류', resolveMessage(error, '지출 상세를 불러오지 못했습니다.'));
    }
  }, [selectedExpense]);

  const handleDeleteExpense = useCallback(() => {
    if (!selectedExpense) return;

    Alert.alert('지출 삭제', '이 지출 내역을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsDeleting(true);
            const response = await deleteExpenseApi(selectedExpense.expenseId);
            if (!response.success) {
              throw new Error(response.message ?? '지출 삭제에 실패했습니다.');
            }

            setExpenseActionVisible(false);
            setSelectedExpense(null);
            if (tripId) {
              await loadTripData(tripId);
            }
          } catch (error) {
            Alert.alert('오류', resolveMessage(error, '지출 삭제에 실패했습니다.'));
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  }, [loadTripData, selectedExpense, tripId]);

  const renderExpenseRow = (expense: TripExpenseItem) => {
    const payerName = participantMap.get(expense.payerUserId) ?? expense.payerUserId;
    const participantUserIds = expense.participantUserIds ?? [];
    const participantNames = participantUserIds.map((id) => participantMap.get(id) ?? id);
    const totalParticipantCount = new Set([expense.payerUserId, ...participantUserIds]).size;

    const amountText = selectedMemberId
      ? formatCurrency(getShareAmountForMember(expense, selectedMemberId))
      : formatCurrency(expense.totalAmount);
    const togetherText = totalParticipantCount > 1 ? `${payerName} 외 ${totalParticipantCount - 1}명` : null;
    const metaText = togetherText ? `결제 : ${payerName} | 함께 : ${togetherText}` : `결제 : ${payerName}`;
    const categoryLabel = CATEGORY_LABELS[expense.category as ExpenseCategory] ?? '기타';

    return (
      <TouchableOpacity key={expense.expenseId} style={styles.expenseRowTable} activeOpacity={0.8} onPress={() => openExpenseActions(expense)}>
        <View style={styles.colCategory}>
          <View style={styles.categoryBadge}>
            <Ionicons name={getCategoryIconName(expense.category)} size={14} color="#6ED3BB" />
            <Text style={styles.categoryTextTable}>{categoryLabel}</Text>
          </View>
        </View>

        <View style={styles.colMerchant}>
          <Text style={styles.merchantTextTable}>{expense.merchantName}</Text>
        </View>

        <View style={styles.colAmount}>
          <Text style={styles.amountTextTable}>{amountText}</Text>
          <Text style={styles.metaTextDisplay}>{metaText}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>지출 상세 내역</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {selectedTrip?.title ?? currentTrip?.tripName ?? '여행'}
          </Text>
        </View>
        <View style={styles.headerIconsRow}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push({ pathname: '/payment-summary', params: tripId ? { tripId } : undefined })}
          >
            <Ionicons name="receipt-outline" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modeLink}
            onPress={() => router.push({ pathname: '/payment-member-summary', params: tripId ? { tripId } : undefined })}
          >
            <Text style={styles.modeLinkText}>1/N</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setPeriodSelectorVisible(true)}>
          <Text style={styles.filterButtonText}>{selectedPeriod.label}</Text>
          <Ionicons name="chevron-down" size={14} color="#4D8BEF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterButton} onPress={() => setMemberSelectorVisible(true)}>
          <Text style={styles.filterButtonText}>{selectedMemberLabel}</Text>
          <Ionicons name="chevron-down" size={14} color="#4D8BEF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadData(true)} />}
      >
        {errorMessage ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#A44A3F" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#65C4B8" />
          </View>
        ) : groupedExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>조건에 맞는 지출 내역이 없어요</Text>
            <TouchableOpacity style={styles.addExpenseButton} onPress={() => openAddExpenseMethod(selectedPeriod.dateKey)}>
              <Text style={styles.addExpenseButtonText}>비용 추가</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groupedExpenses.map((group, groupIndex) => (
            <View key={group.dateKey} style={[styles.daySection, groupIndex > 0 && styles.daySectionBorder]}>
              <Text style={styles.dayTitle}>
                {group.dayLabel} <Text style={styles.dayDate}>{formatDateLabel(group.dateKey)}</Text>
              </Text>

              {group.items.length > 0 ? (
                <View style={styles.listContainer}>
                  <View style={styles.listHeaderRow}>
                    <Text style={[styles.listHeaderCol, styles.colCategory]}>카테고리</Text>
                    <Text style={[styles.listHeaderCol, styles.colMerchant, styles.colMerchantHeader]}>결제 내역</Text>
                    <Text style={[styles.listHeaderCol, styles.colAmount]}>
                      {selectedMemberId ? '개인별 지출 금액' : '결제 금액'}
                    </Text>
                  </View>

                  {group.items.map(renderExpenseRow)}
                </View>
              ) : null}

              <TouchableOpacity style={styles.dayAddExpenseBlockButton} onPress={() => openAddExpenseMethod(group.dateKey)}>
                <Text style={styles.dayAddExpenseBlockButtonText}>비용 추가</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.floatingBottomSummary}>
        <Text style={styles.floatingBottomText}>{formatCurrency(bottomSummaryAmount)}</Text>
      </View>

      <SelectionModal visible={periodSelectorVisible} title="기간 선택" onClose={() => setPeriodSelectorVisible(false)}>
        <View style={styles.selectorList}>
          {periodOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.selectorItem, option.key === selectedPeriodKey && styles.selectorItemActive]}
              onPress={() => {
                setSelectedPeriodKey(option.key);
                setPeriodSelectorVisible(false);
              }}
            >
              <Text style={[styles.selectorItemText, option.key === selectedPeriodKey && styles.selectorItemTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SelectionModal>

      <SelectionModal visible={memberSelectorVisible} title="조회할 멤버 선택" onClose={() => setMemberSelectorVisible(false)}>
        <View style={styles.selectorList}>
          {memberOptions.map((option) => (
            <TouchableOpacity
              key={option.id ?? 'all'}
              style={[styles.selectorItem, option.id === selectedMemberId && styles.selectorItemActive]}
              onPress={() => {
                setSelectedMemberId(option.id);
                setMemberSelectorVisible(false);
              }}
            >
              <Text style={[styles.selectorItemText, option.id === selectedMemberId && styles.selectorItemTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SelectionModal>

      <SelectionModal visible={addExpenseMethodVisible} title="비용 추가 방식" onClose={() => setAddExpenseMethodVisible(false)}>
        <View style={styles.methodList}>
          <TouchableOpacity
            style={styles.methodItem}
            onPress={() => {
              setAddExpenseMethodVisible(false);
              setManualModalVisible(true);
            }}
          >
            <View style={styles.methodIconBox}>
              <Ionicons name="pencil" size={24} color="#65C4B8" />
            </View>
            <Text style={styles.methodItemText}>직접 입력</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.methodItem}
            onPress={() => {
              setAddExpenseMethodVisible(false);
              if (!tripId) {
                Alert.alert('알림', '여행 정보가 없어 영수증 스캔을 시작할 수 없습니다.');
                return;
              }
              router.push({ pathname: '/receipt-ocr', params: { tripId } });
            }}
          >
            <View style={styles.methodIconBox}>
              <Ionicons name="scan" size={24} color="#65C4B8" />
            </View>
            <Text style={styles.methodItemText}>영수증 스캔</Text>
          </TouchableOpacity>
        </View>
      </SelectionModal>

      <SelectionModal
        visible={manualModalVisible}
        title={editingExpense ? '비용 수정' : '비용 추가'}
        onClose={() => {
          setManualModalVisible(false);
          setEditingExpense(null);
          setPendingExpenseDateKey(null);
          setManualExpenseForm(createEmptyManualExpenseForm());
        }}
      >
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>상호명</Text>
          <TextInput
            value={manualExpenseForm.merchantName}
            onChangeText={(merchantName) => setManualExpenseForm((prev) => ({ ...prev, merchantName }))}
            placeholder="예: 스시야"
            style={styles.textInput}
            placeholderTextColor="#98A29A"
          />

          <Text style={styles.inputLabel}>카테고리</Text>
          <View style={styles.choiceWrap}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.choiceChip, manualExpenseForm.category === category && styles.choiceChipActive]}
                onPress={() => setManualExpenseForm((prev) => ({ ...prev, category }))}
              >
                <Text style={[styles.choiceChipText, manualExpenseForm.category === category && styles.choiceChipTextActive]}>
                  {CATEGORY_LABELS[category]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>금액</Text>
          <TextInput
            value={manualExpenseForm.totalAmount}
            onChangeText={(totalAmount) =>
              setManualExpenseForm((prev) => ({ ...prev, totalAmount: totalAmount.replace(/[^0-9]/g, '') }))
            }
            placeholder="예: 35000"
            keyboardType="number-pad"
            style={styles.textInput}
            placeholderTextColor="#98A29A"
          />

          <Text style={styles.inputLabel}>결제자</Text>
          <View style={styles.choiceWrap}>
            {tripMembers.map((member) => (
              <TouchableOpacity
                key={member.userId}
                style={[styles.choiceChip, manualExpenseForm.payerUserId === member.userId && styles.choiceChipActive]}
                onPress={() => setManualExpenseForm((prev) => ({ ...prev, payerUserId: member.userId }))}
              >
                <Text style={[styles.choiceChipText, manualExpenseForm.payerUserId === member.userId && styles.choiceChipTextActive]}>
                  {member.nickname}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>함께한 멤버</Text>
          <View style={styles.choiceWrap}>
            {tripMembers.map((member) => (
              <TouchableOpacity
                key={`member-${member.userId}`}
                style={[
                  styles.choiceChip,
                  manualExpenseForm.participantUserIds.includes(member.userId) && styles.choiceChipActive,
                ]}
                onPress={() =>
                  setManualExpenseForm((prev) => ({
                    ...prev,
                    participantUserIds: prev.participantUserIds.includes(member.userId)
                      ? prev.participantUserIds.filter((id) => id !== member.userId)
                      : [...prev.participantUserIds, member.userId],
                  }))
                }
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    manualExpenseForm.participantUserIds.includes(member.userId) && styles.choiceChipTextActive,
                  ]}
                >
                  {member.nickname}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.fullWidthButton, isSaving && styles.disabledButton]}
            disabled={isSaving}
            onPress={() => void handleCreateManualExpense()}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.fullWidthButtonText}>{editingExpense ? '수정하기' : '저장하기'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SelectionModal>

      <SelectionModal
        visible={expenseActionVisible}
        title={selectedExpense?.merchantName ?? '지출 관리'}
        onClose={() => {
          if (isDeleting) return;
          setExpenseActionVisible(false);
          setSelectedExpense(null);
        }}
      >
        <View style={styles.selectorList}>
          <TouchableOpacity style={styles.selectorItem} onPress={() => void handleEditExpense()}>
            <Text style={styles.selectorItemText}>수정하기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectorItem, styles.deleteItem]}
            disabled={isDeleting}
            onPress={handleDeleteExpense}
          >
            <Text style={[styles.selectorItemText, styles.deleteItemText]}>{isDeleting ? '삭제 중...' : '삭제하기'}</Text>
          </TouchableOpacity>
        </View>
      </SelectionModal>
    </SafeAreaView>
  );
}

function SelectionModal({
  children,
  onClose,
  title,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalScrollContent}>{children}</ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: '#333333',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: '#8E8E8E',
    marginTop: 2,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    padding: 8,
  },
  modeLink: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  modeLinkText: {
    fontSize: 17,
    fontFamily: 'Pretendard-Bold',
    color: '#333333',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#65C4B8',
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#65C4B8',
  },
  filterButtonDisabled: {
    borderColor: '#E0E0E0',
    backgroundColor: '#F7F7F7',
  },
  filterButtonDisabledText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#A0A0A0',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 168,
  },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#FDE5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#8E3B2F',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    gap: 12,
    marginTop: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#303030',
    marginBottom: 12,
  },
  daySection: {
    marginBottom: 28,
  },
  daySectionBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 28,
  },
  dayTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 17,
    color: '#333333',
    marginBottom: 18,
  },
  dayDate: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: '#A0A0A0',
  },
  listContainer: {
    marginBottom: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 12,
  },
  listHeaderCol: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: '#8E8E8E',
  },
  colCategory: {
    width: 84,
    paddingLeft: 8,
  },
  colMerchant: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: -25,
  },
  colMerchantHeader: {
    textAlign: 'center',
  },
  colAmount: {
    width: 132,
    alignItems: 'flex-start',
  },
  expenseRowTable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryTextTable: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: '#333333',
  },
  merchantTextTable: {
    width: '100%',
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    color: '#333333',
    marginTop: -1,
    textAlign: 'center',
  },
  amountTextTable: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    color: '#333333',
    marginBottom: 4,
  },
  metaTextTable: {
    display: 'none',
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: '#A0A0A0',
    textAlign: 'left',
  },
  metaTextDisplay: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: '#A0A0A0',
    textAlign: 'left',
  },
  addExpenseButton: {
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addExpenseButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#555555',
  },
  dayAddExpenseBlockButton: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dayAddExpenseBlockButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: '#333333',
  },
  summaryCard: {
    paddingTop: 8,
  },
  summaryScreen: {
    paddingTop: 8,
  },
  summaryHero: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  summaryPeriod: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 18,
    color: '#333333',
    marginBottom: 10,
  },
  summaryHeroTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 34,
    color: '#333333',
  },
  summaryHeroDescription: {
    marginTop: 28,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#7B7B7B',
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E3E3E3',
    borderStyle: 'dashed',
    marginVertical: 22,
  },
  summarySectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: '#333333',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  summaryRowSpaced: {
    marginTop: 18,
  },
  summaryIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  summaryAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95,
  },
  summaryAvatarText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  summaryName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#333333',
  },
  summaryAmountBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  summaryAmount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 19,
    color: '#333333',
  },
  summaryMeta: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: '#A0A0A0',
  },
  floatingBottomSummary: {
    position: 'absolute',
    bottom: 14,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 20,
  },
  floatingBottomText: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    color: '#333333',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#333333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  methodList: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  methodItem: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },
  methodIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E6F6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodItemText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: '#333333',
  },
  modalContent: {
    gap: 16,
  },
  inputLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#333333',
    marginBottom: -8,
  },
  textInput: {
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#333333',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choiceChipActive: {
    borderColor: '#65C4B8',
    backgroundColor: '#E6F6F4',
  },
  choiceChipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#666666',
  },
  choiceChipTextActive: {
    color: '#2C8E82',
    fontWeight: 'bold',
  },
  fullWidthButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#65C4B8',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  selectorList: {
    gap: 8,
  },
  selectorItem: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9F9F9',
  },
  selectorItemActive: {
    backgroundColor: '#E6F6F4',
  },
  selectorItemText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#333333',
  },
  selectorItemTextActive: {
    color: '#2C8E82',
    fontWeight: 'bold',
  },
  deleteItem: {
    backgroundColor: '#FFF3F1',
  },
  deleteItemText: {
    color: '#C4493D',
  },
});
