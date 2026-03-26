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

export type ReceiptExpenseCategory = 'FOOD' | 'CAFE' | 'TRANSPORT' | 'LODGING' | 'SHOPPING' | 'ETC';
export type ReceiptOcrStatus = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DLQ';
export type ReceiptExpenseStatus = 'CONFIRMED' | 'DELETED';

export interface ReceiptUploadData {
  receiptId: string;
  tripId: string;
  storageKey: string;
  imageUrl: string;
  uploadedAt: string;
}

export interface ReceiptOcrCreateRequest {
  imageUrl: string;
  currencyCode?: string;
  locale?: string;
}

export interface ReceiptOcrCreateData {
  receiptId: string;
  tripId: string;
  status: string;
  requestedAt: string;
}

export interface ReceiptOcrStatusData {
  receiptId: string;
  tripId: string;
  status: string;
  attempt: number;
  lastRequestedAt: string | null;
  lastProcessedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
}

export interface ReceiptOcrLineItem {
  sortOrder: number;
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export interface ReceiptOcrResultData {
  receiptId: string;
  tripId: string;
  imageUrl: string;
  status: string;
  merchantName: string | null;
  paidAt: string | null;
  currencyCode: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  lineItems: ReceiptOcrLineItem[];
  rawText: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
  requestedAt: string | null;
  processedAt: string | null;
}

export interface ReceiptOcrSelectRequest {
  payerUserId: string;
  category: ReceiptExpenseCategory;
  memo?: string;
  participantUserIds: string[];
}

export interface ReceiptOcrSelectData {
  receiptId: string;
  tripId: string;
  linkedExpenseId: string;
  expenseStatus: ReceiptExpenseStatus;
  createdAt: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const toNullableNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const mapReceiptUploadData = (item: any): ReceiptUploadData => ({
  receiptId: String(item.receiptId),
  tripId: String(item.tripId),
  storageKey: item.storageKey ?? '',
  imageUrl: item.imageUrl ?? '',
  uploadedAt: item.uploadedAt,
});

const mapReceiptOcrCreateData = (item: any): ReceiptOcrCreateData => ({
  receiptId: String(item.receiptId),
  tripId: String(item.tripId),
  status: String(item.status ?? ''),
  requestedAt: item.requestedAt,
});

const mapReceiptOcrStatusData = (item: any): ReceiptOcrStatusData => ({
  receiptId: String(item.receiptId),
  tripId: String(item.tripId),
  status: String(item.status ?? ''),
  attempt: typeof item.attempt === 'number' ? item.attempt : Number(item.attempt ?? 0),
  lastRequestedAt: item.lastRequestedAt ?? null,
  lastProcessedAt: item.lastProcessedAt ?? null,
  lastErrorCode: item.lastErrorCode ?? null,
  lastErrorMessage: item.lastErrorMessage ?? null,
  updatedAt: item.updatedAt,
});

const mapReceiptOcrLineItem = (item: any): ReceiptOcrLineItem => ({
  sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : Number(item.sortOrder ?? 0),
  name: item.name ?? '',
  quantity: toNullableNumber(item.quantity),
  unitPrice: toNullableNumber(item.unitPrice),
  amount: toNullableNumber(item.amount),
});

const mapReceiptOcrResultData = (item: any): ReceiptOcrResultData => ({
  receiptId: String(item.receiptId),
  tripId: String(item.tripId),
  imageUrl: item.imageUrl ?? '',
  status: String(item.status ?? ''),
  merchantName: item.merchantName ?? null,
  paidAt: item.paidAt ?? null,
  currencyCode: item.currencyCode ?? null,
  totalAmount: toNullableNumber(item.totalAmount),
  taxAmount: toNullableNumber(item.taxAmount),
  lineItems: Array.isArray(item.lineItems) ? item.lineItems.map(mapReceiptOcrLineItem) : [],
  rawText: item.rawText ?? null,
  errorCode: item.errorCode ?? null,
  errorMessage: item.errorMessage ?? null,
  attempt: typeof item.attempt === 'number' ? item.attempt : Number(item.attempt ?? 0),
  requestedAt: item.requestedAt ?? null,
  processedAt: item.processedAt ?? null,
});

const mapReceiptOcrSelectData = (item: any): ReceiptOcrSelectData => ({
  receiptId: String(item.receiptId),
  tripId: String(item.tripId),
  linkedExpenseId: String(item.linkedExpenseId),
  expenseStatus: item.expenseStatus,
  createdAt: item.createdAt,
});

export const uploadReceiptImageApi = async (
  tripId: string,
  file: { uri: string; name?: string; type?: string },
): Promise<ApiResponse<ReceiptUploadData>> => {
  if (isMockTripId(tripId)) {
    return {
      success: true,
      data: {
        receiptId: `mock-receipt-${Date.now()}`,
        tripId,
        storageKey: `receipts/mock/${Date.now()}.jpg`,
        imageUrl: 'https://example.com/mock-receipt.jpg',
        uploadedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name || `receipt-${Date.now()}.jpg`,
    type: file.type || 'image/jpeg',
  } as any);

  try {
    const response = await apiClient.post<ApiResponse<any>>(`/trips/${tripId}/receipts/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      ...response.data,
      data: mapReceiptUploadData(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          receiptId: `mock-receipt-${Date.now()}`,
          tripId,
          storageKey: `receipts/mock/${Date.now()}.jpg`,
          imageUrl: 'https://example.com/mock-receipt.jpg',
          uploadedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};

export const requestReceiptOcrApi = async (
  tripId: string,
  request: ReceiptOcrCreateRequest,
): Promise<ApiResponse<ReceiptOcrCreateData>> => {
  if (isMockTripId(tripId)) {
    return {
      success: true,
      data: {
        receiptId: `mock-receipt-${Date.now()}`,
        tripId,
        status: 'REQUESTED',
        requestedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const response = await apiClient.post<ApiResponse<any>>(`/trips/${tripId}/receipts/ocr-requests`, request);
    return {
      ...response.data,
      data: mapReceiptOcrCreateData(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          receiptId: `mock-receipt-${Date.now()}`,
          tripId,
          status: 'REQUESTED',
          requestedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};

export const getReceiptOcrStatusApi = async (receiptId: string): Promise<ApiResponse<ReceiptOcrStatusData>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/receipts/${receiptId}/ocr-status`);
    return {
      ...response.data,
      data: mapReceiptOcrStatusData(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          receiptId,
          tripId: 'mock-trip-id',
          status: 'COMPLETED',
          attempt: 1,
          lastRequestedAt: new Date().toISOString(),
          lastProcessedAt: new Date().toISOString(),
          lastErrorCode: null,
          lastErrorMessage: null,
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};

export const getReceiptOcrResultApi = async (receiptId: string): Promise<ApiResponse<ReceiptOcrResultData>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/receipts/${receiptId}/ocr-result`);
    return {
      ...response.data,
      data: mapReceiptOcrResultData(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          receiptId,
          tripId: 'mock-trip-id',
          imageUrl: 'https://example.com/mock-receipt.jpg',
          status: 'COMPLETED',
          merchantName: 'Mock Store',
          paidAt: new Date().toISOString(),
          currencyCode: 'KRW',
          totalAmount: 15000,
          taxAmount: 0,
          lineItems: [],
          rawText: 'Mock OCR result',
          errorCode: null,
          errorMessage: null,
          attempt: 1,
          requestedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};

export const selectReceiptOcrApi = async (
  receiptId: string,
  request: ReceiptOcrSelectRequest,
): Promise<ApiResponse<ReceiptOcrSelectData>> => {
  try {
    const response = await apiClient.post<ApiResponse<any>>(`/receipts/${receiptId}/select`, request);
    return {
      ...response.data,
      data: mapReceiptOcrSelectData(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          receiptId,
          tripId: 'mock-trip-id',
          linkedExpenseId: `mock-expense-${Date.now()}`,
          expenseStatus: 'CONFIRMED',
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};
