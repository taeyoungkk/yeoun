import axios from 'axios';

import apiClient from './client';

interface ApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface FinanceAccountItem {
  financeAccountId: string;
  accountNo: string;
  accountName: string;
  active: boolean;
}

export interface FinanceCardItem {
  financeCardId: string;
  cardNoMasked: string;
  cardName: string;
  cardUniqueNo: string;
  cvcRegistered: boolean;
  active: boolean;
}

export interface FinanceProfile {
  financeProfileId: string;
  userId: string;
  financeUserKey: string;
  financeUserId: string;
  syncedAt?: string;
  accounts: FinanceAccountItem[];
  cards: FinanceCardItem[];
}

export interface FinanceCardCvcUpsertRequest {
  cvc: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const emptyProfile = (): FinanceProfile => ({
  financeProfileId: '',
  userId: '',
  financeUserKey: '',
  financeUserId: '',
  syncedAt: new Date().toISOString(),
  accounts: [],
  cards: [],
});

const mapFinanceProfile = (data: any): FinanceProfile => ({
  financeProfileId: String(data?.financeProfileId ?? ''),
  userId: String(data?.userId ?? ''),
  financeUserKey: String(data?.financeUserKey ?? ''),
  financeUserId: String(data?.financeUserId ?? ''),
  syncedAt: data?.syncedAt ?? undefined,
  accounts: Array.isArray(data?.accounts)
    ? data.accounts.map((account: any) => ({
        financeAccountId: String(account.financeAccountId ?? ''),
        accountNo: String(account.accountNo ?? ''),
        accountName: String(account.accountName ?? ''),
        active: Boolean(account.active),
      }))
    : [],
  cards: Array.isArray(data?.cards)
    ? data.cards.map((card: any) => ({
        financeCardId: String(card.financeCardId ?? ''),
        cardNoMasked: String(card.cardNoMasked ?? ''),
        cardName: String(card.cardName ?? ''),
        cardUniqueNo: String(card.cardUniqueNo ?? ''),
        cvcRegistered: Boolean(card.cvcRegistered),
        active: Boolean(card.active),
      }))
    : [],
});

export const getMyFinanceProfileApi = async (): Promise<ApiResponse<FinanceProfile>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>('/users/me/finance-profile');
    return {
      ...response.data,
      data: mapFinanceProfile(response.data.data),
    };
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 404 &&
      error.response?.data?.code === 'FINANCE_PROFILE_NOT_FOUND'
    ) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Finance profile not found. Returning empty profile.',
        data: emptyProfile(),
        timestamp: new Date().toISOString(),
      };
    }

    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: emptyProfile(),
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};

export const syncMyFinanceProfileApi = async (): Promise<ApiResponse<FinanceProfile>> => {
  try {
    const response = await apiClient.post<ApiResponse<any>>('/users/me/finance-profile/sync');
    return {
      ...response.data,
      data: mapFinanceProfile(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: emptyProfile(),
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};

export const upsertFinanceCardCvcApi = async (
  financeCardId: string,
  data: FinanceCardCvcUpsertRequest,
): Promise<ApiResponse<FinanceCardItem>> => {
  try {
    const response = await apiClient.patch<ApiResponse<any>>(
      `/users/me/finance-profile/cards/${financeCardId}/cvc`,
      data,
    );
    return {
      ...response.data,
      data: {
        financeCardId: String(response.data.data?.financeCardId ?? financeCardId),
        cardNoMasked: String(response.data.data?.cardNoMasked ?? ''),
        cardName: String(response.data.data?.cardName ?? ''),
        cardUniqueNo: String(response.data.data?.cardUniqueNo ?? ''),
        cvcRegistered: Boolean(response.data.data?.cvcRegistered),
        active: Boolean(response.data.data?.active),
      },
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          financeCardId,
          cardNoMasked: '',
          cardName: 'Mock Card',
          cardUniqueNo: '',
          cvcRegistered: true,
          active: true,
        },
        timestamp: new Date().toISOString(),
      };
    }

    throw error;
  }
};
