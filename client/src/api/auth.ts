import { jsonRequest } from './client';
import type { LoginPayload, LoginResponse, RegisterPayload, VerifyEmailPayload } from '../types';

export const register = (payload: RegisterPayload) => jsonRequest<{ userId: number; email: string; verificationRequired: boolean }>('/api/v1/auth/register', 'POST', payload);

export const verifyEmail = (payload: VerifyEmailPayload) => jsonRequest<{ verified: boolean }>('/api/v1/auth/verify-email', 'POST', payload);

export const resendVerification = (email: string) => jsonRequest<{ sent: boolean; verified?: boolean }>('/api/v1/auth/resend-verification', 'POST', { email });

export const login = (payload: LoginPayload) => jsonRequest<LoginResponse>('/api/v1/auth/login', 'POST', payload);

export const logout = (refreshToken: string) => jsonRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', 'POST', { refreshToken });
