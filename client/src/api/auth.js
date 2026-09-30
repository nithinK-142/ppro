import { request } from './client';

export const register = (payload) => request('/api/v1/auth/register', {
  method: 'POST',
  body: JSON.stringify(payload)
});

export const verifyEmail = (payload) => request('/api/v1/auth/verify-email', {
  method: 'POST',
  body: JSON.stringify(payload)
});

export const resendVerification = (email) => request('/api/v1/auth/resend-verification', {
  method: 'POST',
  body: JSON.stringify({ email })
});

export const login = (payload) => request('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify(payload)
});
