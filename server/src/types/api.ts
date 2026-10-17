import type { TaskRow } from '../db/schema/index.ts';

export interface UserSummary {
  id: number;
  email: string;
  emailVerifiedAt: string | null;
}

export interface ProfileData {
  name: string;
  mobile: string;
  address: string;
  businessName: string | null;
  updated_at: string;
}

export interface SessionData {
  user: UserSummary;
  profile: ProfileData | null;
  selectedTasks: TaskRow[];
  setupComplete: boolean;
}

export interface LoginData extends SessionData {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshData {
  accessToken: string;
  refreshToken: string;
}

export interface LogoutData {
  loggedOut: true;
}


export interface RegisterData {
  userId: number;
  email: string;
  verificationRequired: true;
  verificationEmailSent: boolean;
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
