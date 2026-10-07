import { jsonRequest, request } from './client';
import type { Profile, ProfilePayload, SessionData } from '../types';

export const getMe = () => request<Pick<SessionData, 'user' | 'profile' | 'selectedTasks' | 'setupComplete'>>('/api/v1/profile');

export const saveProfile = (payload: ProfilePayload) => jsonRequest<Profile>('/api/v1/profile', 'PATCH', payload);
