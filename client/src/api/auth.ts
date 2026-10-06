import { request } from './client';
import type { LoginPayload, RegisterPayload, SessionData, VerifyEmailPayload } from '../types';

export const register = (payload: RegisterPayload) => request<{ userId: number; email: string; verificationRequired: boolean }>('/api/v1/auth/register', {
  method: 'POST',
  body: JSON.stringify(payload)
});

export const verifyEmail = (payload: VerifyEmailPayload) => request<{ verified: boolean }>('/api/v1/auth/verify-email', {
  method: 'POST',
  body: JSON.stringify(payload)
});

export const resendVerification = (email: string) => request<{ sent: boolean; verified?: boolean }>('/api/v1/auth/resend-verification', {
  method: 'POST',
  body: JSON.stringify({ email })
});

export const login = (payload: LoginPayload) => request<SessionData>('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify(payload)
});
