import type { QueryResult, QueryResultRow } from '@neondatabase/serverless';

export interface UserAuthRow extends QueryResultRow {
  id: number;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
}

export interface UserVerificationRow extends QueryResultRow {
  id: number;
  email_verified_at: Date | null;
}

export interface OtpRow extends QueryResultRow {
  code_hash: string;
  expires_at: Date;
  attempts: number;
}

export interface ResendOtpRow extends QueryResultRow {
  sent_at: Date;
}

export interface TaskRow extends QueryResultRow {
  id: number;
  name: string;
  category: string;
  description: string;
}

export interface TaskWithTotalRow extends TaskRow {
  total_count: number;
}

export interface TaskIdRow extends QueryResultRow {
  id: number;
}

export interface ProfileRow extends QueryResultRow {
  name: string;
  mobile: string;
  address: string;
  businessName: string | null;
  updated_at: Date;
}

export interface UserProfileRow extends QueryResultRow {
  id: number;
  email: string;
  email_verified_at: Date | null;
  created_at: Date;
  name: string | null;
  mobile: string | null;
  address: string | null;
  businessName: string | null;
  profile_updated_at: Date | null;
}

