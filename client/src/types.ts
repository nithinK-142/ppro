export type Task = {
  id: number;
  name: string;
  category: string;
  description: string;
};

export type User = {
  id: number;
  email: string;
  emailVerifiedAt: string | null;
};

export type Profile = {
  name: string;
  mobile: string;
  address: string;
  businessName?: string | null;
  updated_at?: string | null;
};

export type SessionData = {
  token?: string;
  user: User;
  profile: Profile | null;
  selectedTasks: Task[];
  setupComplete: boolean;
};

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'session_error';

export type RegisterPayload = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type VerifyEmailPayload = {
  email: string;
  otp: string;
};

export type ProfilePayload = {
  name: string;
  mobile: string;
  address: string;
  businessName: string;
};
