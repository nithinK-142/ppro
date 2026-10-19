import { jsonRequest } from './client';
import type { LoginPayload, LoginResponse, RegisterPayload, VerifyEmailPayload } from '../types';

export const register = (payload: RegisterPayload) => jsonRequest<{ registrationId: string; email: string; verificationRequired: boolean; verificationEmailSent: boolean }>('/api/v1/auth/register', 'POST', payload);

export const verifyEmail = (payload: VerifyEmailPayload) => jsonRequest<LoginResponse>('/api/v1/auth/verify-email', 'POST', payload);

export const resendVerification = (registrationId: string) => jsonRequest<{ sent: boolean }>('/api/v1/auth/resend-verification', 'POST', { registrationId });

export const login = (payload: LoginPayload) => jsonRequest<LoginResponse>('/api/v1/auth/login', 'POST', payload);

export const logout = (refreshToken: string) => jsonRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', 'POST', { refreshToken });
