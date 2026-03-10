export interface User {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl?: string | null;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}
