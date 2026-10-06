import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import env from '../config/env.ts';

function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashOtp(code: string) {
  return createHmac('sha256', env.OTP_SECRET).update(code).digest('hex');
}

function otpMatches(code: string, storedHash: string) {
  const actual = Buffer.from(hashOtp(code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function otpExpired(expiresAt: string | Date, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime();
}

function resendAvailable(sentAt: string | Date, now = new Date()) {
  const elapsed = Math.floor((now.getTime() - new Date(sentAt).getTime()) / 1000);
  return Math.max(0, env.OTP_RESEND_SECONDS - elapsed);
}

export { generateOtp, hashOtp, otpMatches, otpExpired, resendAvailable };
