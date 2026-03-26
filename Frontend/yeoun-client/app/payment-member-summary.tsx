import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getExpenseDetailApi, getTripExpensesApi, TripExpenseItem } from '@/src/api/expense';
import {
  createSettlementApi,
  getSettlementDetailApi,
  getTripSettlementsApi,
  SettlementDetail,
  SettlementTransferItem,
} from '@/src/api/settlement';
import { getTripMembersApi, getTripsApi, TripListItem, TripMemberItem } from '@/src/api/trip';
import { useTripStore } from '@/src/store';

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');
const SUMMARY_AVATAR_COLORS = ['#D7C2FF', '#FFCACA', '#BEEAD8', '#FFD6A5', '#C9D7FF'] as const;

type MemberSummaryRow = {
  userId: string;
  nickname: string;
  shareAmount: number;
  paidAmount: number;
};

const formatCurrency = (amount: number) => `${KRW_FORMATTER.format(Math.round(amount))}원`;

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

const getShareAmountForMember = (expense: TripExpenseItem, memberId: string) => {
  const participantUserIds = expense.participantUserIds ?? [];
  if (!participantUserIds.includes(memberId)) return 0;
  return expense.totalAmount / Math.max(participantUserIds.length, 1);
};

const enrichExpensesWithDetails = async (items: TripExpenseItem[]) => {
  const enrichedItems = await Promise.all(
    items.map(async (expense) => {
      if ((expense.participantUserIds?.length ?? 0) > 0) {
        return expense;
      }

      try {
        const detailResponse = await getExpenseDetailApi(expense.expenseId);
        if (!detailResponse.success) {
          return expense;
        }

        const participantUserIds = detailResponse.data.participantUserIds ?? [];
        return participantUserIds.length > 0 ? { ...expense, participantUserIds } : expense;
      } catch {
        return expense;
      }
    }),
  );

  return enrichedItems;
};

export default function PaymentMemberSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const currentTripId = useTripStore((state) => state.currentTripId);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const routeTripId = typeof params.tripId === 'string' && params.tripId.length > 0 ? params.tripId : null;

  const [tripId, setTripId] = useState<string | null>(routeTripId ?? currentTripId);
  const [tripOptions, setTripOptions] = useState<TripListItem[]>([]);
  const [tripMembers, setTripMembers] = useState<TripMemberItem[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseItem[]>([]);
  const [settlementDetail, setSettlementDetail] = useState<SettlementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          throw new Error(tripsResponse.message ?? '여행 정보를 불러오지 못했어요.');
        }

        setTripOptions(tripsResponse.data.items);

        const nextTripId =
          (tripId && tripsResponse.data.items.some((item) => item.tripId === tripId) ? tripId : null) ??
          (routeTripId && tripsResponse.data.items.some((item) => item.tripId === routeTripId) ? routeTripId : null) ??
          (currentTripId && tripsResponse.data.items.some((item) => item.tripId === currentTripId) ? currentTripId : null) ??
          null;

        setTripId(nextTripId);

        if (!nextTripId) {
          setTripMembers([]);
          setExpenses([]);
          setSettlementDetail(null);
          return;
        }

        const [membersResponse, expensesResponse, settlementsResponse] = await Promise.all([
          getTripMembersApi(nextTripId),
          getTripExpensesApi(nextTripId),
          getTripSettlementsApi(nextTripId),
        ]);

        if (!membersResponse.success) {
          throw new Error(membersResponse.message ?? '여행 멤버 정보를 불러오지 못했어요.');
        }

        if (!expensesResponse.success) {
          throw new Error(expensesResponse.message ?? '지출 정보를 불러오지 못했어요.');
        }

        if (!settlementsResponse.success) {
          throw new Error(settlementsResponse.message ?? '정산 정보를 불러오지 못했어요.');
        }

        const enrichedExpenses = await enrichExpensesWithDetails(expensesResponse.data.items);

        setTripMembers(membersResponse.data.items);
        setExpenses(enrichedExpenses);

        let latestSettlement = [...settlementsResponse.data.items].sort((a, b) => {
          const createdAtA = new Date(a.createdAt).getTime();
          const createdAtB = new Date(b.createdAt).getTime();
          return createdAtB - createdAtA;
        })[0];

        if (!latestSettlement && enrichedExpenses.length > 0) {
          const createResponse = await createSettlementApi(nextTripId, {});
          if (!createResponse.success) {
            throw new Error(createResponse.message ?? '정산을 생성하지 못했어요.');
          }
          latestSettlement = createResponse.data;
        }

        if (!latestSettlement) {
          setSettlementDetail(null);
          return;
        }

        const detailResponse = await getSettlementDetailApi(latestSettlement.settlementId);
        if (!detailResponse.success) {
          throw new Error(detailResponse.message ?? '정산 상세 정보를 불러오지 못했어요.');
        }

        setSettlementDetail(detailResponse.data);
      } catch (error) {
        setErrorMessage(resolveMessage(error, '정산 정보를 불러오지 못했어요.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentTripId, routeTripId, tripId],
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

  const memberSummaryRows = useMemo<MemberSummaryRow[]>(() => {
    if (settlementDetail?.memberSettlements?.length) {
      return settlementDetail.memberSettlements.map((member) => ({
        userId: member.userId,
        nickname: member.nickname,
        shareAmount: member.shareAmount,
        paidAmount: member.paidAmount,
      }));
    }

    return tripMembers.map((member) => ({
      userId: member.userId,
      nickname: member.nickname,
      shareAmount: expenses.reduce((sum, expense) => sum + getShareAmountForMember(expense, member.userId), 0),
      paidAmount: expenses.reduce(
        (sum, expense) => sum + (expense.payerUserId === member.userId ? expense.totalAmount : 0),
        0,
      ),
    }));
  }, [expenses, settlementDetail, tripMembers]);

  const settlementTransfers = useMemo<SettlementTransferItem[]>(
    () => settlementDetail?.transfers ?? [],
    [settlementDetail],
  );

  const tripPeriodLabel = useMemo(
    () => formatPeriod(selectedTrip?.startDate, selectedTrip?.endDate),
    [selectedTrip?.endDate, selectedTrip?.startDate],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadData(true)} />}
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#4D8BEF" />
          </View>
        ) : (
          <>
            <View style={styles.titleSection}>
              <View style={styles.headerRowAligned}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={26} color="#333333" />
                </TouchableOpacity>
                {tripPeriodLabel ? <Text style={styles.periodText}>{tripPeriodLabel}</Text> : null}
              </View>
              <Text style={styles.heroTitle}>{selectedTrip?.title ?? currentTrip?.tripName ?? '여행'}</Text>
              <Text style={styles.heroTitle}>정산내역입니다.</Text>
            </View>

            <Text style={styles.heroDescription}>
              일행과 함께 지출한 비용이 있다면,
              {'\n'}
              개인별 사용 금액과 정산 결과를 정리해드려요.
            </Text>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>개인별 지출금액</Text>
            <View style={styles.divider} />

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {memberSummaryRows.length === 0 ? (
              <Text style={styles.emptyText}>아직 계산할 지출 내역이 없어요.</Text>
            ) : (
              memberSummaryRows.map((member, index) => (
                <View key={member.userId} style={[styles.memberRow, index > 0 && styles.memberRowSpaced]}>
                  <View style={styles.memberIdentity}>
                    <View style={[styles.avatar, { backgroundColor: SUMMARY_AVATAR_COLORS[index % SUMMARY_AVATAR_COLORS.length] }]}>
                      <Text style={styles.avatarText}>{member.nickname.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.memberName}>{member.nickname}</Text>
                  </View>

                  <View style={styles.amountBox}>
                    <Text style={styles.amountText}>{formatCurrency(member.shareAmount)}</Text>
                    <Text style={styles.metaText}>{`결제 : ${formatCurrency(member.paidAmount)}`}</Text>
                  </View>
                </View>
              ))
            )}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>정산 결과</Text>
            <View style={styles.divider} />

            {settlementTransfers.length === 0 ? (
              <Text style={styles.emptyText}>누구에게 얼마를 보내야 하는 정산 내역이 아직 없어요.</Text>
            ) : (
              settlementTransfers.map((transfer, index) => (
                <View
                  key={transfer.settlementTransferId || `${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                  style={[styles.transferRow, index > 0 && styles.transferRowSpaced]}
                >
                  <View style={styles.transferTextBox}>
                    <Text style={styles.transferPrimaryText}>
                      {transfer.fromNickname} <Text style={styles.transferArrow}>→</Text> {transfer.toNickname}
                    </Text>
                    <Text style={styles.transferSecondaryText}>보낼 금액</Text>
                    <Text style={styles.transferAmountText}>{formatCurrency(transfer.amount)}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 60,
  },
  titleSection: {
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  headerRowAligned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -4,
    marginBottom: 4,
  },
  loadingBox: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  periodText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 18,
    color: '#333333',
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 34,
    color: '#333333',
  },
  heroDescription: {
    marginTop: 28,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#7B7B7B',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E3E3E3',
    borderStyle: 'dashed',
    marginVertical: 22,
  },
  sectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: '#333333',
  },
  errorText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#A44A3F',
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#7B7B7B',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  memberRowSpaced: {
    marginTop: 18,
  },
  memberIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  memberName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#333333',
  },
  amountBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 19,
    color: '#333333',
  },
  metaText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    color: '#A0A0A0',
  },
  transferRow: {
    paddingVertical: 10,
  },
  transferRowSpaced: {
    marginTop: 14,
  },
  transferTextBox: {
    gap: 6,
  },
  transferPrimaryText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#333333',
  },
  transferArrow: {
    color: '#7B7B7B',
  },
  transferSecondaryText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#A0A0A0',
  },
  transferAmountText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#333333',
    marginTop: 2,
  },
});
