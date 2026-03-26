import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  getReceiptOcrResultApi,
  getReceiptOcrStatusApi,
  type ReceiptOcrResultData,
  type ReceiptOcrStatusData,
} from '@/src/api/receipt';
import { useUIStore } from '@/src/store/ui.store';

const POLL_INTERVAL_MS = 2500;

export default function ReceiptOcrResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receiptId?: string | string[] }>();
  const receiptId = Array.isArray(params.receiptId) ? params.receiptId[0] : params.receiptId;
  const showToast = useUIStore((state) => state.showToast);

  const [statusData, setStatusData] = useState<ReceiptOcrStatusData | null>(null);
  const [resultData, setResultData] = useState<ReceiptOcrResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasShownCompletionToastRef = useRef(false);

  const statusLabel = useMemo(() => {
    switch (statusData?.status) {
      case 'REQUESTED':
        return '분석 요청됨';
      case 'PROCESSING':
        return '분석 중';
      case 'COMPLETED':
        return '분석 완료';
      case 'FAILED':
        return '분석 실패';
      default:
        return '상태 확인 중';
    }
  }, [statusData?.status]);

  const fetchResult = async (targetReceiptId: string) => {
    const resultResponse = await getReceiptOcrResultApi(targetReceiptId);
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
    if (!statusResponse.success) {
      throw new Error(statusResponse.message ?? '영수증 OCR 상태를 불러오지 못했습니다.');
    }

    setStatusData(statusResponse.data);

    if (statusResponse.data.status === 'COMPLETED') {
      await fetchResult(targetReceiptId);
      if (!hasShownCompletionToastRef.current) {
        showToast('영수증 OCR 결과가 준비되었습니다.', 'success');
        hasShownCompletionToastRef.current = true;
      }
    }

    if (statusResponse.data.status === 'FAILED') {
      setResultData(null);
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

    const startPolling = async () => {
      try {
        await fetchStatus(receiptId);
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

        try {
          const nextStatus = await fetchStatus(receiptId, { silent: true });
          if (nextStatus.status === 'COMPLETED' || nextStatus.status === 'FAILED') {
            if (intervalId) {
              clearInterval(intervalId);
            }
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

  const handleRefresh = async () => {
    if (!receiptId) {
      return;
    }

    setIsRefreshing(true);
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
            {statusData?.status === 'COMPLETED'
              ? '분석이 완료되었습니다.'
              : statusData?.status === 'FAILED'
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

            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>원문 텍스트</Text>
              <Text style={styles.rawText}>{resultData.rawText?.trim() || '추출된 원문 텍스트가 없습니다.'}</Text>
            </View>
          </>
        ) : (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>결과 대기 중</Text>
            <Text style={styles.emptyText}>
              {statusData?.status === 'FAILED'
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
    backgroundColor: '#F6F7F5',
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
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
});
