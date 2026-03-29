import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  getReceiptOcrResultApi,
  getReceiptOcrStatusApi,
  selectReceiptOcrApi,
  type ReceiptExpenseCategory,
  type ReceiptOcrResultData,
  type ReceiptOcrStatusData,
} from '@/src/api/receipt';
import { filterAcceptedTripMembers, getTripMembersApi, type TripMemberItem } from '@/src/api/trip';
import { useUIStore } from '@/src/store/ui.store';
import { useUserStore } from '@/src/store';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 30000;
const CATEGORY_OPTIONS: ReceiptExpenseCategory[] = ['FOOD', 'CAFE', 'TRANSPORT', 'LODGING', 'SHOPPING', 'ETC'];
const CATEGORY_LABELS: Record<ReceiptExpenseCategory, string> = {
  FOOD: '식비',
  CAFE: '카페',
  TRANSPORT: '교통',
  LODGING: '숙소',
  SHOPPING: '쇼핑',
  ETC: '기타',
};

const isSuccessStatus = (status?: string | null) => status === 'READY' || status === 'COMPLETED';
const isFailureStatus = (status?: string | null) => status === 'FAILED' || status === 'DLQ';
const isTerminalStatus = (status?: string | null) => isSuccessStatus(status) || isFailureStatus(status);
const NON_RECEIPT_ERROR_CODES = new Set(['NonReceiptImageError', 'NOT_RECEIPT_IMAGE']);

export default function ReceiptOcrResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receiptId?: string | string[] }>();
  const receiptId = Array.isArray(params.receiptId) ? params.receiptId[0] : params.receiptId;
  const showToast = useUIStore((state) => state.showToast);
  const currentUserId = useUserStore((state) => state.profile?.userId ?? null);

  const [statusData, setStatusData] = useState<ReceiptOcrStatusData | null>(null);
  const [resultData, setResultData] = useState<ReceiptOcrResultData | null>(null);
  const [tripMembers, setTripMembers] = useState<TripMemberItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ReceiptExpenseCategory>('ETC');
  const [selectedPayerUserId, setSelectedPayerUserId] = useState<string | null>(null);
  const [selectedParticipantUserIds, setSelectedParticipantUserIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasShownCompletionToastRef = useRef(false);
  const hasShownTimeoutWarningRef = useRef(false);
  const pollStartedAtRef = useRef<number | null>(null);

  const statusLabel = useMemo(() => {
    switch (statusData?.status) {
      case 'REQUESTED':
        return '분석 요청됨';
      case 'PROCESSING':
        return '분석 중';
      case 'READY':
      case 'COMPLETED':
        return '분석 완료';
      case 'FAILED':
      case 'DLQ':
        return '분석 실패';
      default:
        return '상태 확인 중';
    }
  }, [statusData?.status]);

  const fetchResult = async (targetReceiptId: string) => {
    console.log('[ReceiptOCR] Fetch result.', { receiptId: targetReceiptId });
    const resultResponse = await getReceiptOcrResultApi(targetReceiptId);
    console.log('[ReceiptOCR] Result response.', {
      receiptId: targetReceiptId,
      success: resultResponse.success,
      status: resultResponse.data?.status ?? null,
    });

    if (!resultResponse.success) {
      throw new Error(resultResponse.message ?? '영수증 OCR 결과를 불러오지 못했습니다.');
    }

    setResultData(resultResponse.data);
  };

  const fetchStatus = async (targetReceiptId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setErrorMessage(null);
    }

    const statusResponse = await getReceiptOcrStatusApi(targetReceiptId);
    console.log('[ReceiptOCR] Status response.', {
      receiptId: targetReceiptId,
      success: statusResponse.success,
      status: statusResponse.data?.status ?? null,
      attempt: statusResponse.data?.attempt ?? null,
      lastErrorCode: statusResponse.data?.lastErrorCode ?? null,
      lastErrorMessage: statusResponse.data?.lastErrorMessage ?? null,
    });

    if (!statusResponse.success) {
      throw new Error(statusResponse.message ?? '영수증 OCR 상태를 불러오지 못했습니다.');
    }

    setStatusData(statusResponse.data);

    if (isSuccessStatus(statusResponse.data.status)) {
      setErrorMessage(null);
      await fetchResult(targetReceiptId);
      if (!hasShownCompletionToastRef.current) {
        showToast('영수증 OCR 결과가 준비되었습니다.', 'success');
        hasShownCompletionToastRef.current = true;
      }
    }

    if (isFailureStatus(statusResponse.data.status)) {
      setResultData(null);
      if (
        statusResponse.data.lastErrorCode &&
        NON_RECEIPT_ERROR_CODES.has(statusResponse.data.lastErrorCode)
      ) {
        setErrorMessage('This image does not look like a receipt. Please try again with a receipt photo.');
        return statusResponse.data;
      }
      setErrorMessage(statusResponse.data.lastErrorMessage ?? '영수증 OCR 분석에 실패했습니다.');
    }

    return statusResponse.data;
  };

  useEffect(() => {
    if (!receiptId) {
      setIsLoading(false);
      setErrorMessage('receiptId가 없어 결과를 조회할 수 없습니다.');
      return;
    }

    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    pollStartedAtRef.current = Date.now();

    const startPolling = async () => {
      try {
        const initialStatus = await fetchStatus(receiptId);
        if (isTerminalStatus(initialStatus.status)) {
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : '영수증 OCR 상태를 불러오지 못했습니다.';
        setErrorMessage(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }

      intervalId = setInterval(async () => {
        if (!active) {
          return;
        }

        const elapsedMs = Date.now() - (pollStartedAtRef.current ?? Date.now());
        if (elapsedMs >= POLL_TIMEOUT_MS && !hasShownTimeoutWarningRef.current) {
          const message = 'OCR 처리 시간이 오래 걸리고 있습니다. 결과가 준비될 때까지 계속 확인합니다.';
          console.warn('[ReceiptOCR] Polling exceeded timeout threshold.', {
            receiptId: receiptId ?? null,
            status: statusData?.status ?? null,
          });
          setErrorMessage(message);
          showToast(message, 'info');
          hasShownTimeoutWarningRef.current = true;
        }

        try {
          const nextStatus = await fetchStatus(receiptId, { silent: true });
          if (isTerminalStatus(nextStatus.status) && intervalId) {
            clearInterval(intervalId);
          }
        } catch (error) {
          if (!active) {
            return;
          }
          const message = error instanceof Error ? error.message : '영수증 OCR 상태를 불러오지 못했습니다.';
          setErrorMessage(message);
        }
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [receiptId]);

  const resolvedTripId = resultData?.tripId ?? statusData?.tripId ?? null;

  useEffect(() => {
    if (!resolvedTripId) return;

    let active = true;
    const loadMembers = async () => {
      try {
        const response = await getTripMembersApi(resolvedTripId);
        if (!response.success) {
          throw new Error(response.message ?? '여행 멤버 정보를 불러오지 못했습니다.');
        }

        if (!active) return;

        const members = filterAcceptedTripMembers(response.data.items);
        setTripMembers(members);

        const defaultPayerUserId =
          (currentUserId && members.some((member) => member.userId === currentUserId) ? currentUserId : null) ??
          members[0]?.userId ??
          null;

        setSelectedPayerUserId((prev) => (prev && members.some((member) => member.userId === prev) ? prev : defaultPayerUserId));
        setSelectedParticipantUserIds((prev) => {
          if (prev.length > 0) {
            const filtered = prev.filter((userId) => members.some((member) => member.userId === userId));
            if (filtered.length > 0) {
              return filtered;
            }
          }
          return members.map((member) => member.userId);
        });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : '여행 멤버 정보를 불러오지 못했습니다.';
        setErrorMessage(message);
      }
    };

    void loadMembers();
    return () => {
      active = false;
    };
  }, [currentUserId, resolvedTripId]);

  const handleRefresh = async () => {
    if (!receiptId) {
      return;
    }

    setIsRefreshing(true);
    pollStartedAtRef.current = Date.now();
    hasShownTimeoutWarningRef.current = false;
    setErrorMessage(null);
    try {
      await fetchStatus(receiptId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '영수증 OCR 상태를 불러오지 못했습니다.';
      setErrorMessage(message);
      showToast(message, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectReceipt = async () => {
    if (!receiptId || !resolvedTripId) {
      showToast('영수증 정보가 없어 지출로 확정할 수 없습니다.', 'error');
      return;
    }
    if (!selectedPayerUserId) {
      showToast('결제자를 선택해 주세요.', 'error');
      return;
    }
    if (selectedParticipantUserIds.length === 0) {
      showToast('함께한 멤버를 한 명 이상 선택해 주세요.', 'error');
      return;
    }

    if (!resultData || resultData.lineItems.length === 0) {
      showToast('?ê³¸ë‹”ï§ line item ?ëº£ë‚«åª›Â€ ?ë†ë’¿?ëˆë–Ž.', 'error');
      return;
    }

    setIsSelecting(true);
    try {
      const response = await selectReceiptOcrApi(receiptId, {
        payerUserId: selectedPayerUserId,
        category: selectedCategory,
        lineItems: resultData.lineItems
          .filter((item) => item.ocrLineItemId && item.amount != null && item.amount > 0)
          .map((item) => ({
            ocrLineItemId: item.ocrLineItemId,
            amount: item.amount as number,
            participantUserIds: selectedParticipantUserIds,
          })),
      });

      if (!response.success) {
        throw new Error(response.message ?? '영수증 내역 확정에 실패했습니다.');
      }

      showToast('영수증 내역을 지출로 추가했습니다.', 'success');
      router.replace({ pathname: '/payment-details', params: { tripId: resolvedTripId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : '영수증 내역 확정에 실패했습니다.';
      setErrorMessage(message);
      showToast(message, 'error');
    } finally {
      setIsSelecting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#244934" />
          <Text style={styles.loadingTitle}>영수증을 분석하고 있습니다</Text>
          <Text style={styles.loadingDescription}>잠시만 기다리면 결과를 확인할 수 있습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#244934" />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>영수증 OCR 결과</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusCaption}>현재 상태</Text>
          <Text style={styles.statusTitle}>{statusLabel}</Text>
          <Text style={styles.statusSubtext}>
            {isSuccessStatus(statusData?.status)
              ? '분석이 완료되었습니다.'
              : isFailureStatus(statusData?.status)
                ? '분석 중 오류가 발생했습니다.'
                : '분석 진행 상황을 자동으로 확인하고 있습니다.'}
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#B42318" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {resultData ? (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>기본 정보</Text>
              <InfoRow label="상호명" value={resultData.merchantName ?? '-'} />
              <InfoRow label="결제 시각" value={resultData.paidAt ?? '-'} />
              <InfoRow label="통화" value={resultData.currencyCode ?? '-'} />
              <InfoRow label="총액" value={formatAmount(resultData.totalAmount, resultData.currencyCode)} />
              <InfoRow label="세금" value={formatAmount(resultData.taxAmount, resultData.currencyCode)} />
            </View>

            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>품목</Text>
              {resultData.lineItems.length > 0 ? (
                resultData.lineItems.map((item) => (
                  <View key={`${item.sortOrder}-${item.name}`} style={styles.lineItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineItemName}>{item.name || `품목 ${item.sortOrder}`}</Text>
                      <Text style={styles.lineItemMeta}>
                        수량 {item.quantity ?? '-'} / 단가 {formatAmount(item.unitPrice, resultData.currencyCode)}
                      </Text>
                    </View>
                    <Text style={styles.lineItemAmount}>{formatAmount(item.amount, resultData.currencyCode)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>추출된 품목 정보가 없습니다.</Text>
              )}
            </View>

            {tripMembers.length > 0 ? (
              <View style={styles.resultCard}>
                <Text style={styles.sectionTitle}>지출로 확정</Text>

                <Text style={styles.fieldLabel}>카테고리</Text>
                <View style={styles.choiceWrap}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.choiceChip, selectedCategory === category && styles.choiceChipActive]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[styles.choiceChipText, selectedCategory === category && styles.choiceChipTextActive]}>
                        {CATEGORY_LABELS[category]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>결제자</Text>
                <View style={styles.choiceWrap}>
                  {tripMembers.map((member) => (
                    <TouchableOpacity
                      key={member.userId}
                      style={[styles.choiceChip, selectedPayerUserId === member.userId && styles.choiceChipActive]}
                      onPress={() => setSelectedPayerUserId(member.userId)}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          selectedPayerUserId === member.userId && styles.choiceChipTextActive,
                        ]}
                      >
                        {member.nickname}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>함께한 멤버</Text>
                <View style={styles.choiceWrap}>
                  {tripMembers.map((member) => {
                    const isSelected = selectedParticipantUserIds.includes(member.userId);
                    return (
                      <TouchableOpacity
                        key={`participant-${member.userId}`}
                        style={[styles.choiceChip, isSelected && styles.choiceChipActive]}
                        onPress={() =>
                          setSelectedParticipantUserIds((prev) =>
                            prev.includes(member.userId)
                              ? prev.filter((userId) => userId !== member.userId)
                              : [...prev, member.userId],
                          )
                        }
                      >
                        <Text style={[styles.choiceChipText, isSelected && styles.choiceChipTextActive]}>{member.nickname}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={() => void handleSelectReceipt()}
                  style={[styles.confirmButton, isSelecting && styles.confirmButtonDisabled]}
                  disabled={isSelecting}
                >
                  <Text style={styles.confirmButtonText}>{isSelecting ? '확정 중...' : '이 내역으로 지출 추가'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>결과 대기 중</Text>
            <Text style={styles.emptyText}>
              {isFailureStatus(statusData?.status)
                ? '분석 결과를 가져오지 못했습니다.'
                : '결과가 준비되면 이 화면에 자동으로 표시됩니다.'}
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={() => router.replace('/receipt-ocr')} style={styles.retryButton}>
          <Ionicons name="camera-outline" size={18} color="white" />
          <Text style={styles.retryButtonText}>다시 스캔하기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const formatAmount = (amount: number | null, currencyCode: string | null) => {
  if (amount == null) {
    return '-';
  }

  const currency = currencyCode ?? 'KRW';
  return `${amount.toLocaleString()} ${currency}`;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EBF3EA',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  loadingDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 44,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  statusCard: {
    backgroundColor: '#244934',
    borderRadius: 24,
    padding: 20,
  },
  statusCaption: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginBottom: 8,
  },
  statusTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
  },
  statusSubtext: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: '#FEF3F2',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  errorText: {
    flex: 1,
    color: '#B42318',
    fontSize: 14,
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0EB',
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  lineItemMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  lineItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#244934',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  rawText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  retryButton: {
    height: 52,
    borderRadius: 20,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: -2,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D7DDD4',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#F8FAF6',
  },
  choiceChipActive: {
    borderColor: '#244934',
    backgroundColor: '#E7F0EB',
  },
  choiceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  choiceChipTextActive: {
    color: '#244934',
  },
  confirmButton: {
    marginTop: 6,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#244934',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
