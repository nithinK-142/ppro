import { request } from './client';
import type { Profile, ProfilePayload, SessionData } from '../types';

export const getMe = () => request<Pick<SessionData, 'user' | 'profile' | 'selectedTasks' | 'setupComplete'>>('/api/v1/profile');

export const saveProfile = (payload: ProfilePayload) => request<Profile>('/api/v1/profile', {
  method: 'PATCH',
  body: JSON.stringify(payload)
});
