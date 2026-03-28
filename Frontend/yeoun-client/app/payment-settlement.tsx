import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getLatestSettlementApi, SettlementDetail } from '@/src/api/settlement';
import { getTripsApi, TripListItem } from '@/src/api/trip';
import { useTripStore, useUserStore } from '@/src/store';

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');
const formatCurrency = (amount: number) => `${KRW_FORMATTER.format(Math.round(amount))}원`;
const resolveMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export default function PaymentSettlementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const currentTripId = useTripStore((state) => state.currentTripId);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const currentUserId = useUserStore((state) => state.profile?.userId ?? null);
  const routeTripId = typeof params.tripId === 'string' && params.tripId.length > 0 ? params.tripId : null;
  const activeTripId = routeTripId ?? currentTripId;

  const [trip, setTrip] = useState<TripListItem | null>(null);
  const [settlementDetail, setSettlementDetail] = useState<SettlementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    if (!activeTripId) {
      setTrip(null);
      setSettlementDetail(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      setErrorMessage(null);
      const tripsResponse = await getTripsApi();
      if (!tripsResponse.success) throw new Error(tripsResponse.message ?? '여행 정보를 불러오지 못했습니다.');
      const availableTrips = tripsResponse.data.items.filter((item) => item.status !== 'DELETED');
      const selectedTrip = availableTrips.find((item) => item.tripId === activeTripId) ?? null;
      setTrip(selectedTrip);

      const latestSettlementResponse = await getLatestSettlementApi(activeTripId);
      if (!latestSettlementResponse.success) {
        throw new Error(latestSettlementResponse.message ?? '정산 상세를 불러오지 못했습니다.');
      }

      setSettlementDetail(latestSettlementResponse.data);
    } catch (error) {
      setErrorMessage(resolveMessage(error, '정산 정보를 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTripId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const mySettlement = useMemo(
    () => settlementDetail?.memberSettlements.find((item) => item.userId === currentUserId) ?? null,
    [currentUserId, settlementDetail],
  );

  const displayTrip = trip ?? (currentTrip?.tripId === activeTripId ? currentTrip : null);

  const formatPeriod = (start?: string, end?: string) => {
    if (!start || !end) return '2026.3.19 - 3.26';
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} - ${end}`;
    return `${s.getFullYear()}.${s.getMonth() + 1}.${s.getDate()} - ${e.getMonth() + 1}.${e.getDate()}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#4D8BEF" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadData(true)} />}
        >
          <View style={styles.hero}>
            <View style={styles.headerRowAligned}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={styles.heroPeriod}>{formatPeriod(displayTrip?.startDate, displayTrip?.endDate)}</Text>
            </View>
            <Text style={styles.heroTitle}>{(displayTrip as any)?.title ?? (displayTrip as any)?.tripName ?? '도쿄 여행'}</Text>
            <Text style={styles.heroTitle}>정산내역입니다.</Text>
            <Text style={styles.heroDescription}>
              {'일행과 함께 지출한 비용이 있다면,\n총무에게 내야 할 금액을 정산해드려요.'}
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#A44A3F" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {!settlementDetail ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>아직 생성된 정산이 없습니다</Text>
              <Text style={styles.emptyDescription}>
                확정된 지출이 없어 최신 정산을 불러오지 못했습니다. 비용 정보를 확인한 뒤 다시 시도해 주세요.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.dashedLine} />

              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>개인별 지출금액</Text>
              </View>

              <View style={styles.dashedLine} />

              <View style={styles.memberList}>
                {settlementDetail.memberSettlements.map((item, index) => (
                  <View key={item.userId} style={styles.memberRow}>
                    <View style={styles.memberIdentity}>
                      <View style={[styles.memberAvatar, index % 2 === 0 ? styles.memberAvatarPrimary : styles.memberAvatarSecondary]}>
                        <Ionicons name="person" size={24} color="#FFFFFF" style={{ opacity: 0.8 }} />
                      </View>
                      <Text style={styles.memberName}>{item.userId === currentUserId ? `(나) ${item.nickname}` : item.nickname}</Text>
                    </View>

                    <View style={styles.memberAmountBox}>
                      <Text style={styles.memberAmount}>{formatCurrency(item.netAmount)}</Text>
                      <Text style={styles.memberSubtext}>{`결제 : ${formatCurrency(item.paidAmount)}`}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {mySettlement ? (
                <View style={styles.myCard}>
                  <Text style={styles.myCardLabel}>내 정산 기준</Text>
                  <Text style={styles.myCardAmount}>{formatCurrency(mySettlement.netAmount)}</Text>
                  <Text style={styles.myCardDescription}>
                    양수면 내가 더 낸 금액이고, 음수면 내가 부담해야 할 금액입니다.
                  </Text>
                </View>
              ) : null}
            </>
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
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 120,
  },
  hero: {
    gap: 8,
  },
  heroPeriod: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 18,
    color: '#333333',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: '#333333',
  },
  heroDescription: {
    marginTop: 14,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#8E8E8E',
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    borderStyle: 'dashed',
    marginVertical: 24,
  },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#FDE5E1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 20,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#8E3B2F',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderTopWidth: 2,
    borderTopColor: '#EAEAEA',
    paddingTop: 32,
    marginTop: 24,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#333333',
  },
  emptyDescription: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#8E8E8E',
  },
  summarySection: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: '#333333',
  },
  memberList: {
    gap: 28,
    marginTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarPrimary: {
    backgroundColor: '#C9B2F7',
  },
  memberAvatarSecondary: {
    backgroundColor: '#F5B6B6',
  },
  memberName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#333333',
  },
  memberAmountBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  memberAmount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#333333',
  },
  memberSubtext: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#A0A0A0',
  },
  myCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    padding: 24,
    gap: 8,
    marginTop: 36,
  },
  myCardLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#333333',
  },
  myCardAmount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    color: '#4D8BEF',
  },
  myCardDescription: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#8E8E8E',
    marginTop: 4,
  },
});
