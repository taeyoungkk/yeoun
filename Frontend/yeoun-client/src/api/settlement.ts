import { isAxiosError } from 'axios';

import apiClient from './client';

interface ApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export type SettlementStatus = 'DRAFT' | 'FINALIZED' | 'SUPERSEDED';
export type SettlementTransferStatus = 'PENDING' | 'SETTLED';

export interface SettlementListItem {
  settlementId: string;
  versionNo: number;
  status: SettlementStatus;
  algorithmVersion: string;
  note?: string;
  currencyCode: string;
  memberCount: number;
  confirmedExpenseCount: number;
  totalConfirmedAmount: number;
  transferCount: number;
  createdByUserId: string;
  finalizedAt?: string;
  createdAt: string;
}

export interface SettlementMemberItem {
  userId: string;
  nickname: string;
  paidAmount: number;
  shareAmount: number;
  netAmount: number;
}

export interface SettlementTransferItem {
  settlementTransferId: string;
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  toNickname: string;
  amount: number;
  currencyCode: string;
  status: SettlementTransferStatus;
  settledAt?: string;
}

export interface SettlementDetail {
  settlementId: string;
  tripId: string;
  versionNo: number;
  status: SettlementStatus;
  algorithmVersion: string;
  note?: string;
  currencyCode: string;
  memberCount: number;
  confirmedExpenseCount: number;
  totalConfirmedAmount: number;
  createdByUserId: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
  totalTransferAmount: number;
  transferCount: number;
  memberSettlements: SettlementMemberItem[];
  transfers: SettlementTransferItem[];
}

export interface SettlementCreateRequest {
  note?: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return isAxiosError(error) && !error.response;
};

const mapListItem = (item: any): SettlementListItem => ({
  settlementId: String(item?.settlementId ?? ''),
  versionNo: Number(item?.versionNo ?? 0),
  status: item?.status ?? 'DRAFT',
  algorithmVersion: String(item?.algorithmVersion ?? ''),
  note: item?.note ?? undefined,
  currencyCode: String(item?.currencyCode ?? 'KRW'),
  memberCount: Number(item?.memberCount ?? 0),
  confirmedExpenseCount: Number(item?.confirmedExpenseCount ?? 0),
  totalConfirmedAmount: Number(item?.totalConfirmedAmount ?? 0),
  transferCount: Number(item?.transferCount ?? 0),
  createdByUserId: String(item?.createdByUserId ?? ''),
  finalizedAt: item?.finalizedAt ?? undefined,
  createdAt: String(item?.createdAt ?? ''),
});

const mapDetail = (item: any): SettlementDetail => ({
  settlementId: String(item?.settlementId ?? ''),
  tripId: String(item?.tripId ?? ''),
  versionNo: Number(item?.versionNo ?? 0),
  status: item?.status ?? 'DRAFT',
  algorithmVersion: String(item?.algorithmVersion ?? ''),
  note: item?.note ?? undefined,
  currencyCode: String(item?.currencyCode ?? 'KRW'),
  memberCount: Number(item?.memberCount ?? 0),
  confirmedExpenseCount: Number(item?.confirmedExpenseCount ?? 0),
  totalConfirmedAmount: Number(item?.totalConfirmedAmount ?? 0),
  createdByUserId: String(item?.createdByUserId ?? ''),
  finalizedAt: item?.finalizedAt ?? undefined,
  createdAt: String(item?.createdAt ?? ''),
  updatedAt: String(item?.updatedAt ?? ''),
  totalTransferAmount: Number(item?.totalTransferAmount ?? 0),
  transferCount: Number(item?.transferCount ?? 0),
  memberSettlements: Array.isArray(item?.memberSettlements)
    ? item.memberSettlements.map((member: any) => ({
        userId: String(member?.userId ?? ''),
        nickname: String(member?.nickname ?? ''),
        paidAmount: Number(member?.paidAmount ?? 0),
        shareAmount: Number(member?.shareAmount ?? 0),
        netAmount: Number(member?.netAmount ?? 0),
      }))
    : [],
  transfers: Array.isArray(item?.transfers)
    ? item.transfers.map((transfer: any) => ({
        settlementTransferId: String(transfer?.settlementTransferId ?? ''),
        fromUserId: String(transfer?.fromUserId ?? ''),
        fromNickname: String(transfer?.fromNickname ?? ''),
        toUserId: String(transfer?.toUserId ?? ''),
        toNickname: String(transfer?.toNickname ?? ''),
        amount: Number(transfer?.amount ?? 0),
        currencyCode: String(transfer?.currencyCode ?? 'KRW'),
        status: transfer?.status ?? 'PENDING',
        settledAt: transfer?.settledAt ?? undefined,
      }))
    : [],
});

export const getTripSettlementsApi = async (
  tripId: string,
): Promise<ApiResponse<{ items: SettlementListItem[] }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: any[] }>>(`/trips/${tripId}/settlements`);
    return {
      ...response.data,
      data: {
        items: Array.isArray(response.data.data?.items) ? response.data.data.items.map(mapListItem) : [],
      },
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return { success: true, data: { items: [] }, timestamp: new Date().toISOString() };
    }
    throw error;
  }
};

export const getLatestSettlementApi = async (
  tripId: string,
): Promise<ApiResponse<SettlementDetail | null>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/trips/${tripId}/settlements/latest`);
    return {
      ...response.data,
      data: mapDetail(response.data.data),
    };
  } catch (error) {
    if (
      isAxiosError(error) &&
      error.response?.status === 404 &&
      error.response?.data?.code === 'SETTLEMENT_LATEST_NOT_AVAILABLE'
    ) {
      return {
        success: true,
        code: error.response.data.code,
        message: error.response.data.message,
        data: null,
        timestamp: error.response.data.timestamp ?? new Date().toISOString(),
      };
    }

    if (shouldMockInDev(error)) {
      return { success: true, data: null, timestamp: new Date().toISOString() };
    }

    throw error;
  }
};

export const createSettlementApi = async (
  tripId: string,
  data: SettlementCreateRequest,
): Promise<ApiResponse<SettlementListItem>> => {
  try {
    const response = await apiClient.post<ApiResponse<any>>(`/trips/${tripId}/settlements`, data);
    return {
      ...response.data,
      data: mapListItem(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: mapListItem({
          settlementId: `mock-settlement-${Date.now()}`,
          versionNo: 1,
          status: 'DRAFT',
          algorithmVersion: 'mock',
          note: data.note,
          currencyCode: 'KRW',
          memberCount: 0,
          confirmedExpenseCount: 0,
          totalConfirmedAmount: 0,
          transferCount: 0,
          createdByUserId: '',
          createdAt: new Date().toISOString(),
        }),
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const getSettlementDetailApi = async (
  settlementId: string,
): Promise<ApiResponse<SettlementDetail>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/settlements/${settlementId}`);
    return {
      ...response.data,
      data: mapDetail(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: mapDetail({
          settlementId,
          versionNo: 1,
          status: 'DRAFT',
          algorithmVersion: 'mock',
          currencyCode: 'KRW',
          memberCount: 0,
          confirmedExpenseCount: 0,
          totalConfirmedAmount: 0,
          createdByUserId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totalTransferAmount: 0,
          transferCount: 0,
          memberSettlements: [],
          transfers: [],
        }),
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const finalizeSettlementApi = async (
  settlementId: string,
): Promise<ApiResponse<SettlementListItem>> => {
  try {
    const response = await apiClient.post<ApiResponse<any>>(`/settlements/${settlementId}/finalize`);
    return {
      ...response.data,
      data: mapListItem(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: mapListItem({
          settlementId,
          versionNo: 1,
          status: 'FINALIZED',
          algorithmVersion: 'mock',
          currencyCode: 'KRW',
          memberCount: 0,
          confirmedExpenseCount: 0,
          totalConfirmedAmount: 0,
          transferCount: 0,
          createdByUserId: '',
          finalizedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }),
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
