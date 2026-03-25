import apiClient from './client';
import { ApiResponse } from './timeline';

/** 초대 상세 정보 인터페이스 */
export interface TripInviteDetail {
  tripId: string;
  title: string;
  inviter: {
    userId: string;
    nickname: string;
  };
  status: 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  expiresAt: string;
}

/** 초대 수락 결과 인터페이스 */
export interface InviteAcceptResult {
  tripId: string;
  tripMemberId: string;
  inviteStatus: string;
  joinedAt: string;
}

/** 초대 거절 결과 인터페이스 */
export interface InviteDeclineResult {
  tripId: string;
  status: string;
}

export interface ReceivedTripInviteItem {
  tripInviteId: string;
  inviteToken: string;
  tripId: string;
  tripTitle: string;
  inviter: {
    userId: string;
    nickname: string;
  };
  status: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * 초대 토큰으로 여행 초대 정보를 조회합니다.
 * GET /api/v1/trip-invites/{inviteToken}
 */
export const getTripInviteDetailApi = async (inviteToken: string): Promise<ApiResponse<TripInviteDetail>> => {
  const response = await apiClient.get<ApiResponse<TripInviteDetail>>(`/trip-invites/${inviteToken}`);
  return response.data;
};

/**
 * 여행 초대를 수락합니다.
 * POST /api/v1/trip-invites/{inviteToken}/accept
 */
export const acceptTripInviteApi = async (inviteToken: string): Promise<ApiResponse<InviteAcceptResult>> => {
  const response = await apiClient.post<ApiResponse<InviteAcceptResult>>(`/trip-invites/${inviteToken}/accept`);
  return response.data;
};

/**
 * 여행 초대를 거절합니다.
 * POST /api/v1/trip-invites/{inviteToken}/decline
 */
export const declineTripInviteApi = async (inviteToken: string): Promise<ApiResponse<InviteDeclineResult>> => {
  const response = await apiClient.post<ApiResponse<InviteDeclineResult>>(`/trip-invites/${inviteToken}/decline`);
  return response.data;
};

export const acceptTripInviteByIdApi = async (tripInviteId: string): Promise<ApiResponse<InviteAcceptResult>> => {
  const response = await apiClient.post<ApiResponse<InviteAcceptResult>>(`/trip-invites/id/${tripInviteId}/accept`);
  return response.data;
};

export const declineTripInviteByIdApi = async (tripInviteId: string): Promise<ApiResponse<InviteDeclineResult>> => {
  const response = await apiClient.post<ApiResponse<InviteDeclineResult>>(`/trip-invites/id/${tripInviteId}/decline`);
  return response.data;
};

export const getReceivedTripInvitesApi = async (): Promise<ApiResponse<{ items: ReceivedTripInviteItem[] }>> => {
  const response = await apiClient.get<ApiResponse<{ items: ReceivedTripInviteItem[] }>>('/trip-invites/received');
  return response.data;
};
