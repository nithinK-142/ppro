const { describe, expect, it } = require('vitest');
const { generateOtp, hashOtp, otpExpired, resendAvailable } = require('../src/utils/otp');

describe('OTP rules', () => {
  it('generates exactly six digits', () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('does not expose the raw OTP through the stored value', () => {
    const code = generateOtp();
    expect(hashOtp(code)).not.toBe(code);
    expect(hashOtp(code)).toHaveLength(64);
  });

  it('expires at the configured timestamp', () => {
    const now = new Date('2026-09-30T10:00:00Z');
    expect(otpExpired('2026-09-30T09:59:59Z', now)).toBe(true);
    expect(otpExpired('2026-09-30T10:00:01Z', now)).toBe(false);
  });

  it('calculates resend cooldown', () => {
    const now = new Date('2026-09-30T10:00:20Z');
    expect(resendAvailable('2026-09-30T10:00:00Z', now)).toBe(10);
  });
});
