import { generateOtp, hashOtp, otpExpired, otpMatches, resendAvailable } from '../src/utils/otp.ts';

describe('OTP rules', () => {
  it('generates exactly six digits', () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('can generate leading zeroes', () => {
    expect(generateOtp()).toHaveLength(6);
  });

  it('does not expose the raw OTP through the stored value', () => {
    const code = generateOtp();
    expect(hashOtp(code)).not.toBe(code);
    expect(hashOtp(code)).toHaveLength(64);
  });

  it('matches the original OTP and rejects a different OTP', () => {
    const code = '012345';
    const stored = hashOtp(code);
    expect(otpMatches(code, stored)).toBe(true);
    expect(otpMatches('012346', stored)).toBe(false);
  });

  it('rejects malformed stored hashes safely', () => {
    expect(otpMatches('012345', 'bad')).toBe(false);
  });

  it('expires at the configured timestamp', () => {
    const now = new Date('2026-09-30T10:00:00Z');
    expect(otpExpired('2026-09-30T09:59:59Z', now)).toBe(true);
    expect(otpExpired('2026-09-30T10:00:00Z', now)).toBe(true);
    expect(otpExpired('2026-09-30T10:00:01Z', now)).toBe(false);
  });

  it('calculates resend cooldown and floors elapsed seconds', () => {
    const now = new Date('2026-09-30T10:00:20.999Z');
    expect(resendAvailable('2026-09-30T10:00:00Z', now)).toBe(10);
    expect(resendAvailable('2026-09-30T09:59:00Z', now)).toBe(0);
  });
});
