import axios from 'axios';

import apiClient from './client';

interface ApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface TripExpenseItem {
  expenseId: string;
  tripId: string;
  merchantName: string;
  category: string;
  currencyCode: string;
  totalAmount: number;
  paidAt: string;
  payerUserId: string;
  splitType: string;
  sourceType: string;
  status: 'PENDING' | 'CONFIRMED' | 'DELETED';
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const mapExpenseItem = (item: any): TripExpenseItem => ({
  expenseId: String(item.expenseId),
  tripId: String(item.tripId),
  merchantName: item.merchantName ?? '',
  category: String(item.category ?? ''),
  currencyCode: item.currencyCode ?? 'KRW',
  totalAmount: typeof item.totalAmount === 'number' ? item.totalAmount : Number(item.totalAmount ?? 0),
  paidAt: item.paidAt,
  payerUserId: String(item.payerUserId),
  splitType: String(item.splitType ?? ''),
  sourceType: String(item.sourceType ?? ''),
  status: item.status,
});

export const getTripExpensesApi = async (tripId: string): Promise<ApiResponse<{ items: TripExpenseItem[] }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: any[] }>>(`/trips/${tripId}/expenses`);
    return {
      ...response.data,
      data: {
        items: Array.isArray(response.data.data?.items) ? response.data.data.items.map(mapExpenseItem) : [],
      },
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { items: [] },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
