import type { ProfileRow, TaskRow } from './database.ts';

export interface UserSummary {
  id: number;
  email: string;
  emailVerifiedAt: Date | null;
}

export interface ProfileData {
  name: string;
  mobile: string;
  address: string;
  businessName: string | null;
  updated_at: Date;
}

export interface LoginData {
  token: string;
  user: UserSummary;
  profile: ProfileRow | null;
  selectedTasks: TaskRow[];
  setupComplete: boolean;
}

export interface MeData {
  user: UserSummary;
  profile: ProfileData | null;
  selectedTasks: TaskRow[];
  setupComplete: boolean;
}

export interface RegisterData {
  userId: number;
  email: string;
  verificationRequired: true;
}

export interface VerificationData {
  verified: true;
}

export interface ResendData {
  sent: true;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TaskListData {
  data: TaskRow[];
  pagination: Pagination;
}

export interface DataResponse<T> {
  data: T;
}
