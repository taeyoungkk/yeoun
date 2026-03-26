import axios from 'axios';

import apiClient from './client';

interface ApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export type PaymentImportSourceType = 'DEMAND_DEPOSIT' | 'CREDIT_CARD';
export type PaymentImportStatus = 'CANDIDATE' | 'SELECTED' | 'IGNORED';
export type ExpenseCategory = 'FOOD' | 'CAFE' | 'TRANSPORT' | 'LODGING' | 'SHOPPING' | 'ETC';

export interface PaymentImportItem {
  paymentImportId: string;
  userId: string;
  tripId: string;
  merchantName: string;
  transactionSummary?: string;
  approvedAmount: number;
  currencyCode: string;
  approvedAt: string;
  cardName?: string;
  accountNo?: string;
  approvalNo?: string;
  externalTransactionUniqueNo?: string;
  sourceType: PaymentImportSourceType;
  status: PaymentImportStatus;
  linkedExpenseId?: string;
}

export interface PaymentImportListData {
  items: PaymentImportItem[];
}

export interface PaymentImportSelectRequest {
  tripId: string;
  payerUserId: string;
  category: ExpenseCategory;
  memo?: string;
  participantUserIds: string[];
}

export interface PaymentImportSelectData {
  paymentImportId: string;
  tripId: string;
  linkedExpenseId: string;
  status: PaymentImportStatus;
  updatedAt: string;
}

export interface PaymentImportIgnoreData {
  paymentImportId: string;
  status: PaymentImportStatus;
  updatedAt: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const mapItem = (item: any): PaymentImportItem => ({
  paymentImportId: String(item?.paymentImportId ?? ''),
  userId: String(item?.userId ?? ''),
  tripId: String(item?.tripId ?? ''),
  merchantName: String(item?.merchantName ?? ''),
  transactionSummary: item?.transactionSummary ?? undefined,
  approvedAmount: typeof item?.approvedAmount === 'number' ? item.approvedAmount : Number(item?.approvedAmount ?? 0),
  currencyCode: String(item?.currencyCode ?? 'KRW'),
  approvedAt: String(item?.approvedAt ?? ''),
  cardName: item?.cardName ?? undefined,
  accountNo: item?.accountNo ?? undefined,
  approvalNo: item?.approvalNo ?? undefined,
  externalTransactionUniqueNo: item?.externalTransactionUniqueNo ?? undefined,
  sourceType: item?.sourceType ?? 'CREDIT_CARD',
  status: item?.status ?? 'CANDIDATE',
  linkedExpenseId: item?.linkedExpenseId ?? undefined,
});

const emptyList = (): PaymentImportListData => ({ items: [] });

export const getMyPaymentImportsApi = async (): Promise<ApiResponse<PaymentImportListData>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: any[] }>>('/users/me/payment-imports');
    return {
      ...response.data,
      data: {
        items: Array.isArray(response.data.data?.items) ? response.data.data.items.map(mapItem) : [],
      },
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return { success: true, data: emptyList(), timestamp: new Date().toISOString() };
    }
    throw error;
  }
};

export const getTripPaymentImportsApi = async (tripId: string): Promise<ApiResponse<PaymentImportListData>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: any[] }>>(`/trips/${tripId}/payment-imports`);
    return {
      ...response.data,
      data: {
        items: Array.isArray(response.data.data?.items) ? response.data.data.items.map(mapItem) : [],
      },
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return { success: true, data: emptyList(), timestamp: new Date().toISOString() };
    }
    throw error;
  }
};

export const selectPaymentImportApi = async (
  paymentImportId: string,
  data: PaymentImportSelectRequest,
): Promise<ApiResponse<PaymentImportSelectData>> => {
  try {
    const response = await apiClient.post<ApiResponse<PaymentImportSelectData>>(
      `/payment-imports/${paymentImportId}/select`,
      data,
    );
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          paymentImportId,
          tripId: data.tripId,
          linkedExpenseId: `mock-expense-${Date.now()}`,
          status: 'SELECTED',
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const ignorePaymentImportApi = async (
  paymentImportId: string,
): Promise<ApiResponse<PaymentImportIgnoreData>> => {
  try {
    const response = await apiClient.post<ApiResponse<PaymentImportIgnoreData>>(
      `/payment-imports/${paymentImportId}/ignore`,
    );
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          paymentImportId,
          status: 'IGNORED',
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
