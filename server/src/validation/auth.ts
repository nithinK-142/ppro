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
  email,
  otp: z.string().regex(/^\d{6}$/, { error: 'OTP must be 6 digits' })
});

const loginSchema = z.object({ email, password });

export { registerSchema, verifySchema, loginSchema };
