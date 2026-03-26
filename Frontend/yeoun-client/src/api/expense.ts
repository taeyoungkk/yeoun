import axios from 'axios';

import apiClient from './client';
import { isMockTripId } from './trip';

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
  memo?: string;
  participantUserIds?: string[];
  status: 'PENDING' | 'CONFIRMED' | 'DELETED';
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
}

export interface ExpenseDetail extends TripExpenseItem {
  splits: ExpenseSplit[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseCreateData {
  merchantName: string;
  category: string;
  currencyCode: string;
  totalAmount: number;
  paidAt: string;
  payerUserId: string;
  memo: string;
  participantUserIds: string[];
}

export interface ExpenseUpdateData {
  merchantName?: string;
  category?: string;
  currencyCode?: string;
  totalAmount?: number;
  paidAt?: string;
  payerUserId?: string;
  memo?: string;
  participantUserIds?: string[];
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
  memo: item.memo ?? '',
  participantUserIds: Array.isArray(item.participantUserIds)
    ? item.participantUserIds.map((userId: any) => String(userId))
    : Array.isArray(item.splits)
      ? item.splits.map((split: any) => String(split.userId))
      : [],
  status: item.status,
});

const mapExpenseDetail = (item: any): ExpenseDetail => ({
  ...mapExpenseItem(item),
  memo: item.memo ?? '',
  participantUserIds: Array.isArray(item.splits)
    ? item.splits.map((split: any) => String(split.userId))
    : [],
  splits: Array.isArray(item.splits)
    ? item.splits.map((split: any) => ({
        userId: String(split.userId),
        amount: typeof split.amount === 'number' ? split.amount : Number(split.amount ?? 0),
      }))
    : [],
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const getTripExpensesApi = async (tripId: string): Promise<ApiResponse<{ items: TripExpenseItem[] }>> => {
  if (isMockTripId(tripId)) {
    return {
      success: true,
      data: { items: [] },
      timestamp: new Date().toISOString(),
    };
  }

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

export const getExpenseDetailApi = async (expenseId: string): Promise<ApiResponse<ExpenseDetail>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/expenses/${expenseId}`);
    return {
      ...response.data,
      data: mapExpenseDetail(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {} as ExpenseDetail,
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const createExpenseApi = async (tripId: string, data: ExpenseCreateData): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.post<ApiResponse<any>>(`/trips/${tripId}/expenses`, data);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { expenseId: `mock-expense-${Date.now()}` },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const updateExpenseApi = async (expenseId: string, data: ExpenseUpdateData): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.patch<ApiResponse<any>>(`/expenses/${expenseId}`, data);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { expenseId },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const deleteExpenseApi = async (expenseId: string): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.delete<ApiResponse<any>>(`/expenses/${expenseId}`);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { expenseId },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
