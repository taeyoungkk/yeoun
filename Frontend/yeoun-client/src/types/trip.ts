export type TripStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';
export type Visibility = 'PRIVATE' | 'PUBLIC' | 'PARTIAL_PUBLIC';
export type InviteStatus = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface Trip {
  tripId: string;
  title: string;
  startDate: string; // ISO Date String
  endDate: string; // ISO Date String
  status: TripStatus;
  visibility: Visibility;
  ownerUserId: string;
  memberCount: number;
  reportStatus?: 'PENDING' | 'GENERATING' | 'READY';
  createdAt: string;
}

export interface TripMember {
  tripMemberId: string;
  userId: string;
  nickname: string;
  inviteStatus: InviteStatus;
  joinedAt?: string | null;
}

export interface TripInvite {
  tripId: string;
  title: string;
  inviter: {
    userId: string;
    nickname: string;
  };
  status: InviteStatus;
  expiresAt: string;
}
