import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getTripExpensesApi, TripExpenseItem } from '@/src/api/expense';
import { getTripsApi, TripListItem } from '@/src/api/trip';
import { useTripStore } from '@/src/store';

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');

const formatCurrency = (amount: number) => `${KRW_FORMATTER.format(Math.round(amount))}원`;

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: '식비',
  CAFE: '카페',
  TRANSPORT: '교통',
  FLIGHT: '항공',
  LODGING: '숙소',
  SHOPPING: '쇼핑',
  ETC: '기타',
  ACTIVITY: '액티비티',
};

const getCategoryIconName = (category: string) => {
  switch (category) {
    case 'FOOD':
      return 'restaurant';
    case 'CAFE':
      return 'cafe';
    case 'TRANSPORT':
      return 'bus';
    case 'FLIGHT':
      return 'airplane';
    case 'LODGING':
      return 'home';
    case 'SHOPPING':
      return 'cart';
    default:
      return 'receipt';
  }
};

export default function PaymentSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const currentTripId = useTripStore((state) => state.currentTripId);
  const currentTrip = useTripStore((state) => state.currentTrip);

  const routeTripId = typeof params.tripId === 'string' && params.tripId.length > 0 ? params.tripId : null;
  const activeTripId = routeTripId ?? currentTripId;

  const [trip, setTrip] = useState<TripListItem | null>(null);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeTripId) {
      setIsLoading(false);
      setTrip(null);
      setExpenses([]);
      return;
    }

    setIsLoading(true);

    try {
      const tripsResponse = await getTripsApi();
      if (tripsResponse.success) {
        const availableTrips = tripsResponse.data.items.filter((item) => item.status !== 'DELETED');
        setTrip(availableTrips.find((item) => item.tripId === activeTripId) ?? null);
      }

      const expensesResponse = await getTripExpensesApi(activeTripId);
      if (expensesResponse.success) {
        setExpenses(expensesResponse.data.items);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error(error);
      setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTripId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { totalAmount, categoryStats, topCategoryName } = useMemo(() => {
    let total = 0;
    const categoryMap = new Map<string, number>();

    expenses.forEach((expense) => {
      total += expense.totalAmount;
      const currentAmount = categoryMap.get(expense.category) ?? 0;
      categoryMap.set(expense.category, currentAmount + expense.totalAmount);
    });

    const stats = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? '기타',
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalAmount: total,
      categoryStats: stats,
      topCategoryName: stats.length > 0 ? stats[0].label : '',
    };
  }, [expenses]);

  const hasExpenses = expenses.length > 0;
  const displayTrip = trip ?? (currentTrip?.tripId === activeTripId ? currentTrip : null);

  const formatPeriod = (start?: string, end?: string) => {
    if (!start || !end) return '여행 기간 정보가 없어요';

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return `${start} - ${end}`;
    }

    return `${startDate.getFullYear()}.${startDate.getMonth() + 1}.${startDate.getDate()} - ${endDate.getMonth() + 1}.${endDate.getDate()}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#4D8BEF" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.headerRowAligned}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={26} color="#333333" />
              </TouchableOpacity>
              <Text style={styles.periodText}>{formatPeriod(displayTrip?.startDate, displayTrip?.endDate)}</Text>
            </View>
            <Text style={styles.titleText}>{(displayTrip as any)?.title ?? (displayTrip as any)?.tripName ?? '여행'}</Text>
            <Text style={styles.titleText}>영수증 내역입니다.</Text>
          </View>

          <View style={styles.dashedLine} />

          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>총 지출금액</Text>
            <TouchableOpacity style={styles.totalRow} activeOpacity={1} onPress={() => {}}>
              <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
              <Ionicons name="chevron-forward" size={20} color="#8E8E8E" />
            </TouchableOpacity>
          </View>

          <View style={styles.dashedLine} />

          {hasExpenses ? (
            <>
              {topCategoryName ? (
                <>
                  <Text style={styles.insightText}>{topCategoryName} 항목의 비중이 가장 높아요.</Text>
                  <View style={styles.dashedLine} />
                </>
              ) : null}

              <View style={styles.statsList}>
                {categoryStats.map((stat) => {
                  const showTextInside = stat.percentage > 15;

                  return (
                    <View key={stat.category} style={styles.statRow}>
                      <View style={styles.statInfo}>
                        <View style={styles.statHeader}>
                          <Ionicons name={getCategoryIconName(stat.category)} size={20} color="#4D8BEF" />
                          <Text style={styles.statCategoryName}>{stat.label}</Text>
                          <Ionicons name="chevron-forward" size={14} color="#8E8E8E" />
                        </View>
                        <Text style={styles.statAmount}>{formatCurrency(stat.amount)}</Text>
                      </View>

                      <View style={styles.barContainer}>
                        {!showTextInside ? (
                          <Text style={[styles.barPercentText, styles.barPercentTextOutside]}>
                            {stat.percentage.toFixed(1)}%
                          </Text>
                        ) : null}
                        <View style={[styles.barFill, { width: `${Math.max(stat.percentage, 1)}%` }]}>
                          {showTextInside ? (
                            <Text style={[styles.barPercentText, styles.barPercentTextInside]}>
                              {stat.percentage.toFixed(1)}%
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>아직 등록된 지출이 없어요</Text>
              <Text style={styles.emptyDescription}>
                지출을 추가하면 카테고리별 요약을 여기에서 확인할 수 있어요.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRowAligned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -4,
    marginBottom: 4,
  },
  backButton: {
    padding: 4,
  },
  content: {
    paddingTop: 70,
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    gap: 8,
  },
  periodText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 18,
    color: '#333333',
    marginBottom: 4,
  },
  titleText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: '#333333',
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    borderStyle: 'dashed',
    marginVertical: 24,
  },
  totalSection: {
    gap: 16,
  },
  totalLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#555555',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  totalAmount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    color: '#4D8BEF',
  },
  insightText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#333333',
  },
  statsList: {
    gap: 36,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statInfo: {
    flex: 0.8,
    gap: 8,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statCategoryName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#333333',
  },
  statAmount: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#A0A0A0',
  },
  barContainer: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barFill: {
    height: 38,
    backgroundColor: '#4D8BEF',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    justifyContent: 'center',
  },
  barPercentText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
  },
  barPercentTextOutside: {
    color: '#4D8BEF',
    marginRight: 8,
  },
  barPercentTextInside: {
    color: '#FFFFFF',
    marginLeft: 12,
  },
  emptyState: {
    paddingTop: 20,
    paddingBottom: 12,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    color: '#333333',
  },
  emptyDescription: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#8E8E8E',
  },
});
