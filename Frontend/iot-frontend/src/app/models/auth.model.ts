export interface AuthUser {
  username: string;
  role: 'user' | 'admin';
  sessionId?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  role: 'user' | 'admin';
}
