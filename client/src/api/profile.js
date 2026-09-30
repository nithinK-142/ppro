import { request } from './client';

export const getMe = () => request('/api/v1/profile');

export const saveProfile = (payload) => request('/api/v1/profile', {
  method: 'PATCH',
  body: JSON.stringify(payload)
});
