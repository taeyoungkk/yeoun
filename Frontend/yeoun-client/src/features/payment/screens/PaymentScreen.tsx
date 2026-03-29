import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getTripExpensesApi, TripExpenseItem } from '@/src/api/expense';
import { FinanceCardItem, FinanceProfile, getMyFinanceProfileApi, syncMyFinanceProfileApi } from '@/src/api/finance';
import { getTripsApi, isSettlementEligibleTrip, TripListItem } from '@/src/api/trip';
import { useTripStore } from '@/src/store';

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');

const formatCurrency = (amount: number) => `${KRW_FORMATTER.format(amount)}원`;
const getDateKey = (value?: string | null) => (value ? value.slice(5, 10).replace('-', '/') : '-');
const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type ExpenseCategories = 'FOOD' | 'CAFE' | 'TRANSPORT' | 'LODGING' | 'SHOPPING' | 'ETC';

type CategoryMap = Partial<Record<ExpenseCategories, number>>;

type CategoryStatItem = {
  key: ExpenseCategories;
  label: string;
  color: string;
};

const CATEGORY_ORDER: ExpenseCategories[] = ['FOOD', 'CAFE', 'TRANSPORT', 'LODGING', 'SHOPPING', 'ETC'];

const CATEGORY_META: Record<ExpenseCategories, CategoryStatItem> = {
  FOOD: { key: 'FOOD', label: '식비', color: '#B2C981' },
  CAFE: { key: 'CAFE', label: '카페', color: '#C8DDA0' },
  TRANSPORT: { key: 'TRANSPORT', label: '교통비', color: '#6F5D54' },
  LODGING: { key: 'LODGING', label: '숙소비', color: '#AA866D' },
  SHOPPING: { key: 'SHOPPING', label: '쇼핑', color: '#D7E6F5' },
  ETC: { key: 'ETC', label: '기타', color: '#E2EAC7' },
};

export default function PaymentScreen() {
  const router = useRouter();
  const isTripActive = useTripStore((state) => state.isTripActive);
  const currentTripId = useTripStore((state) => state.currentTripId);

  const [financeProfile, setFinanceProfile] = useState<FinanceProfile | null>(null);
  const [tripOptions, setTripOptions] = useState<TripListItem[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tripSelectorVisible, setTripSelectorVisible] = useState(false);

  const fetchExpenses = useCallback(async (tripId: string | null) => {
    if (!tripId) {
      setExpenses([]);
      setExpensesTotal(0);
      return;
    }

    const expenseResponse = await getTripExpensesApi(tripId);
    setExpenses(expenseResponse.data.items);
    setExpensesTotal(expenseResponse.data.items.reduce((sum, item) => sum + item.totalAmount, 0));
  }, []);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      setErrorMessage(null);

      const tripsResponse = await getTripsApi();
      if (!tripsResponse.success) {
        throw new Error(tripsResponse.message ?? '여행 목록을 불러오지 못했습니다.');
      }
      console.log(
        '[PaymentScreen] settlement trip candidates',
        tripsResponse.data.items.map((trip) => ({
          tripId: trip.tripId,
          title: trip.title,
          status: trip.status,
          startedAt: trip.startedAt ?? null,
          actualEndedAt: trip.actualEndedAt ?? null,
        })),
      );
      const availableTrips = tripsResponse.data.items.filter(isSettlementEligibleTrip);
      console.log(
        '[PaymentScreen] settlement eligible trips',
        availableTrips.map((trip) => ({
          tripId: trip.tripId,
          title: trip.title,
          status: trip.status,
        })),
      );
      setTripOptions(availableTrips);

      const fallbackTripId = isTripActive
        ? availableTrips.find((trip) => trip.tripId === currentTripId)?.tripId ??
          availableTrips.find((trip) => trip.status === 'ACTIVE')?.tripId ??
          null
        : null;

      const nextSelectedTripId =
        selectedTripId && availableTrips.some((trip) => trip.tripId === selectedTripId)
          ? selectedTripId
          : fallbackTripId;

      setSelectedTripId(nextSelectedTripId);

      const financeResponse = await getMyFinanceProfileApi();
      if (!financeResponse.success) {
        throw new Error(financeResponse.message ?? '카드/계좌 정보를 불러오지 못했습니다.');
      }
      setFinanceProfile(financeResponse.data);

      await fetchExpenses(nextSelectedTripId);
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '정산 정보를 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentTripId, fetchExpenses, isTripActive, selectedTripId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);

    try {
      const response = await syncMyFinanceProfileApi();
      if (!response.success) {
        throw new Error(response.message ?? '카드/계좌 동기화에 실패했습니다.');
      }

      setFinanceProfile(response.data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '카드/계좌 동기화에 실패했습니다.'));
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleSelectTrip = useCallback(
    async (trip: TripListItem) => {
      setSelectedTripId(trip.tripId);
      setTripSelectorVisible(false);
      setErrorMessage(null);

      try {
        await fetchExpenses(trip.tripId);
      } catch (error) {
        setExpenses([]);
        setExpensesTotal(0);
        setErrorMessage(resolveErrorMessage(error, '정산 정보를 불러오지 못했습니다.'));
      }
    },
    [fetchExpenses],
  );

  const cards = financeProfile?.cards ?? [];
  const accounts = financeProfile?.accounts ?? [];
  const selectedTrip = useMemo(
    () => tripOptions.find((trip) => trip.tripId === selectedTripId) ?? null,
    [selectedTripId, tripOptions],
  );
  const sortedTripOptions = useMemo(() => {
    const getSortTimestamp = (trip: TripListItem) => {
      const endAt = new Date(trip.endDate).getTime();
      if (!Number.isNaN(endAt)) return endAt;

      const startAt = new Date(trip.startDate).getTime();
      if (!Number.isNaN(startAt)) return startAt;

      return 0;
    };

    return [...tripOptions].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [tripOptions]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const expensesByDate = useMemo(() => {
    const grouped = new Map<string, CategoryMap>();

    expenses.forEach((expense) => {
      const key = getDateKey(expense.paidAt);
      const current = grouped.get(key) ?? {};
      current[expense.category as ExpenseCategories] = (current[expense.category as ExpenseCategories] ?? 0) + expense.totalAmount;
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([date, categories]) => {
        const total = Object.values(categories).reduce((sum, val) => sum + val, 0);
        return { date, categories, total };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses]);

  const visibleCategories = useMemo(
    () =>
      CATEGORY_ORDER.filter((category) =>
        expenses.some((expense) => expense.category === category && expense.totalAmount > 0),
      ).map((category) => CATEGORY_META[category]),
    [expenses],
  );

  const shouldUseMockExpensePreview = false;
  const displayExpensesByDate = expensesByDate;
  const displayExpensesTotal = expensesTotal;
  const displayMaxExpenseByDate = useMemo(
    () => displayExpensesByDate.reduce((max, item) => Math.max(max, item.total), 0),
    [displayExpensesByDate],
  );

  const yAxisValues = useMemo(() => {
    const maxVal = displayMaxExpenseByDate > 0 ? displayMaxExpenseByDate : 140000;
    const step = Math.max(Math.ceil(maxVal / 4 / 5000) * 5000, 10000);
    const values = [];
    for (let i = 4; i >= 0; i--) {
      values.push(step * i);
    }
    return values;
  }, [displayMaxExpenseByDate]);

  useEffect(() => {
    if (displayExpensesByDate.length > 0 && !selectedDateKey) {
      setSelectedDateKey(displayExpensesByDate[displayExpensesByDate.length - 1].date);
    }
  }, [displayExpensesByDate, selectedDateKey]);

  const selectedDailyExpense = useMemo(
    () => displayExpensesByDate.find((item) => item.date === selectedDateKey),
    [displayExpensesByDate, selectedDateKey]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadData(true)} />}
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>정산</Text>
          <View style={styles.headerSpacer} />
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#A44A3F" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>연결된 카드/계좌</Text>
              <Text style={styles.sectionMeta}>{cards.length + accounts.length}개</Text>
            </View>
            <TouchableOpacity
              style={[styles.syncButton, isSyncing && styles.disabledButton]}
              disabled={isSyncing}
              onPress={() => void handleSync()}
            >
              {isSyncing ? <ActivityIndicator size="small" color="#244934" /> : <Text style={styles.syncButtonText}>동기화</Text>}
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#244934" />
            </View>
          ) : cards.length === 0 && accounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>동기화된 카드/계좌가 없습니다</Text>
              <Text style={styles.emptyDescription}>
                카드/계좌 동기화를 실행하면 백엔드에 등록된 카드와 계좌를 불러옵니다.
              </Text>
            </View>
          ) : (
            <>
              {cards.map((card) => (
                <FinanceCardRow key={card.financeCardId} card={card} />
              ))}

              {accounts.map((account) => (
                <View key={account.financeAccountId} style={styles.accountRow}>
                  <View style={styles.cardBadge}>
                    <Ionicons name="wallet-outline" size={18} color="#244934" />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{account.accountName}</Text>
                    <Text style={styles.cardNumber}>{account.accountNo}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardStatus, account.active ? styles.readyStatus : styles.inactivePill]}>
                      {account.active ? '활성' : '비활성'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>여행 지출 내역</Text>
          <View style={styles.heroCard}>
            <View style={styles.tripHeader}>
              <Text style={styles.tripLabel}>정산 대상 여행</Text>
              <TouchableOpacity style={styles.tripDropdownButton} onPress={() => setTripSelectorVisible(true)}>
                <Text style={styles.tripDropdownText} numberOfLines={1}>
                  {selectedTrip ? selectedTrip.title : '여행을 선택해 주세요'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#244934" />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroEyebrow}>여행 총 지출</Text>
            <Text style={styles.heroAmount}>{formatCurrency(displayExpensesTotal)}</Text>
            {shouldUseMockExpensePreview ? (
              <Text style={styles.previewCaption}>실데이터가 없어 목업 지출 그래프를 표시하고 있어요.</Text>
            ) : null}

            <View style={styles.chartSection}>
            <View style={styles.chartWrapper}>
              <View style={styles.yAxisLinesLayer}>
                {yAxisValues.map((val, index) => (
                  <View key={`y-${val}-${index}`} style={styles.yAxisLineRow}>
                    <Text style={styles.yAxisText}>{val === 0 ? '0' : val}</Text>
                    <View style={styles.yAxisDashedLine} />
                  </View>
                ))}
              </View>

              {displayExpensesByDate.length === 0 ? (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>표시할 날짜별 지출이 없습니다.</Text>
                </View>
              ) : (
                <View style={styles.chartScrollWrap}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.chartScrollArea}
                  >
                    {displayExpensesByDate.map((item) => {
                    const maxY = yAxisValues[0] || 1;
                    const heightPercent = maxY > 0 ? Math.min((item.total / maxY) * 100, 100) : 0;

                    const isSelected = selectedDateKey === item.date;

                    return (
                      <TouchableOpacity 
                        key={item.date} 
                        style={styles.chartColumn}
                        onPress={() => setSelectedDateKey(item.date)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.chartBarTrack}>
                          {item.total > 0 && (
                            <View style={[styles.chartBarStackWrap, { height: `${heightPercent}%`, opacity: isSelected ? 1 : 0.5 }]}>
                              {[...visibleCategories].reverse().map((category) => {
                                const amount = item.categories[category.key] ?? 0;
                                if (amount <= 0) return null;

                                return (
                                  <View
                                    key={`${item.date}-${category.key}`}
                                    style={[styles.chartBarSegment, { flex: amount, backgroundColor: category.color }]}
                                  />
                                );
                              })}
                            </View>
                          )}
                        </View>
                        <View style={styles.chartLabelWrapper}>
                          <Text style={[styles.chartLabel, isSelected && styles.chartLabelSelected]}>{item.date}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {displayExpensesByDate.length > 0 && (
              <View style={styles.legendRow}>
                {visibleCategories.map((category) => (
                  <View key={category.key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: category.color }]} />
                    <Text style={styles.legendText}>{category.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {selectedDailyExpense && (
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Text style={styles.detailCardTitle}>{selectedDailyExpense.date} 상세 지출</Text>
                  <Text style={styles.detailCardTotal}>총 {KRW_FORMATTER.format(selectedDailyExpense.total)}원</Text>
                </View>
                <View style={styles.detailGrid}>
                  {visibleCategories
                    .filter((category) => (selectedDailyExpense.categories[category.key] ?? 0) > 0)
                    .map((category) => (
                      <View key={`${selectedDailyExpense.date}-${category.key}`} style={styles.detailGridCol}>
                        <View style={styles.detailGridItem}>
                          <View style={[styles.legendDot, { backgroundColor: category.color }]} />
                          <Text style={styles.detailItemLabel}>{category.label}:</Text>
                          <Text style={styles.detailItemValue}>
                            {KRW_FORMATTER.format(selectedDailyExpense.categories[category.key] ?? 0)}원
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </View>
            )}

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, !selectedTripId && styles.disabledButton, styles.fullWidthAction]}
                disabled={!selectedTripId}
                onPress={() => {
                  if (!selectedTripId) return;
                  router.push({
                    pathname: '/payment-details',
                    params: { tripId: selectedTripId },
                  });
                }}
              >
                <Text style={styles.secondaryButtonText}>상세 지출 내역 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>

      <TripSelectorModal
        currentTripId={selectedTripId}
        trips={sortedTripOptions}
        visible={tripSelectorVisible}
        onClose={() => setTripSelectorVisible(false)}
        onSelect={handleSelectTrip}
      />
    </SafeAreaView>
  );
}

function FinanceCardRow({ card }: { card: FinanceCardItem }) {
  return (
    <View style={styles.cardRow}>
      <View style={styles.cardBadge}>
        <Ionicons name="card-outline" size={18} color="#244934" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{card.cardName}</Text>
        <Text style={styles.cardNumber}>{card.cardNoMasked}</Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={[styles.cardStatus, card.active ? styles.readyStatus : styles.inactivePill]}>
          {card.active ? '활성' : '비활성'}
        </Text>
      </View>
    </View>
  );
}

function TripSelectorModal({
  currentTripId,
  trips,
  visible,
  onClose,
  onSelect,
}: {
  currentTripId: string | null;
  trips: TripListItem[];
  visible: boolean;
  onClose: () => void;
  onSelect: (trip: TripListItem) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>여행 선택</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#14291E" />
            </TouchableOpacity>
          </View>

          {trips.length === 0 ? (
            <Text style={styles.modalEmptyText}>선택할 여행이 없습니다.</Text>
          ) : (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
              persistentScrollbar
            >
              {trips.map((trip) => (
                <TouchableOpacity
                  key={trip.tripId}
                  style={[styles.modalItem, trip.tripId === currentTripId && styles.modalItemActive]}
                  onPress={() => onSelect(trip)}
                >
                  <View style={styles.modalItemText}>
                    <Text style={styles.modalItemTitle}>{trip.title}</Text>
                    <Text style={styles.modalItemSubtitle}>
                      {trip.startDate} ~ {trip.endDate}
                    </Text>
                    <Text style={styles.modalItemMeta}>{trip.memberCount}명 여행</Text>
                  </View>
                  {trip.tripId === currentTripId ? (
                    <Ionicons name="checkmark-circle" size={20} color="#244934" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#94A098" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EBF3EA',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  headerTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#14291E',
  },
  headerSpacer: {
    width: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tripLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#6D7E70',
  },
  tripDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#EFF4D8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    minHeight: 42,
  },
  tripDropdownText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#244934',
    flex: 1,
    textAlign: 'center',
  },
  heroEyebrow: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#6D7E70',
  },
  heroAmount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 34,
    color: '#14291E',
  },
  previewCaption: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#6D7E70',
    marginTop: -4,
  },
  heroActions: {
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#244934',
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  fullWidthAction: {
    flex: undefined,
  },
  chartSection: {
    marginTop: 4,
  },
  chartEmpty: {
    borderRadius: 18,
    backgroundColor: '#F6F8F4',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#6D7E70',
  },
  chartWrapper: {
    position: 'relative',
    height: 220,
    marginTop: 10,
  },
  yAxisLinesLayer: {
    position: 'absolute',
    top: 0,
    bottom: 30,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
  },
  yAxisLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  yAxisText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 10,
    color: '#9CAAA0',
    width: 48,
  },
  yAxisDashedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#C9D7CE',
    borderStyle: 'dashed',
  },
  chartScrollWrap: {
    height: '100%',
    marginLeft: 48,
  },
  chartScrollArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: '100%',
    justifyContent: 'space-around',
    paddingRight: 12,
  },
  chartColumn: {
    width: 56,
    alignItems: 'center',
    height: '100%',
  },
  chartBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 30,
  },
  chartBarStackWrap: {
    width: 26,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  chartBarSegment: {
    width: '100%',
  },
  chartLabelWrapper: {
    position: 'absolute',
    bottom: 6,
    width: '100%',
    alignItems: 'center',
  },
  chartLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#7A867B',
  },
  chartLabelSelected: {
    fontFamily: 'Pretendard-Bold',
    color: '#000000',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#526355',
  },
  detailCard: {
    backgroundColor: '#F9FAED',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 16,
    marginBottom: 16,
  },
  detailCardTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: '#303030',
  },
  detailCardTotal: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#14291E',
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  detailGridCol: {
    flex: 1,
    gap: 16,
  },
  detailGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailItemLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#6D7E70',
    flex: 1,
  },
  detailItemValue: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#303030',
  },
  disabledButton: {
    opacity: 0.5,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#14291E',
  },
  sectionMeta: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#6D7E70',
  },
  syncButton: {
    borderRadius: 999,
    backgroundColor: '#DDE5B6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#244934',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#F6DEDA',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#7C372F',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#14291E',
  },
  emptyDescription: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#526355',
  },
  cardRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#14291E',
  },
  cardNumber: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#607163',
  },
  cardMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  cardStatus: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
  },
  readyStatus: {
    backgroundColor: '#E3EFD8',
    color: '#244934',
  },
  accountRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  inactivePill: {
    backgroundColor: '#E7E8E7',
    color: '#5D655E',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 41, 30, 0.25)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    gap: 12,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#14291E',
  },
  modalEmptyText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#526355',
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalScrollContent: {
    gap: 10,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: '#F6F8F4',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalItemActive: {
    backgroundColor: '#EFF4D8',
  },
  modalItemText: {
    flex: 1,
    gap: 4,
  },
  modalItemTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#14291E',
  },
  modalItemSubtitle: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#6D7E70',
  },
  modalItemMeta: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#244934',
  },
});
