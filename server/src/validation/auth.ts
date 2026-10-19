import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72);

const registerSchema = z.object({
  email,
  password,
  confirmPassword: password
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  error: 'Passwords do not match'
});

const verifySchema = z.object({
  registrationId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, { error: 'OTP must be 6 digits' })
});

const resendSchema = z.object({ registrationId: z.string().uuid() });

const loginSchema = z.object({ email, password });
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32).max(200),
  refreshAttemptId: z.string().min(16).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional()
});

export { registerSchema, verifySchema, resendSchema, loginSchema, refreshTokenSchema };
