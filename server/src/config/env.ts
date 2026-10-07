import 'dotenv/config';
import { z } from 'zod';
import type { SignOptions } from 'jsonwebtoken';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(2).default('7d').transform((value) => value as SignOptions['expiresIn']),
  OTP_SECRET: z.string().min(32),
  OTP_EXPIRES_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  MAILJET_API_KEY: z.string().min(1),
  MAILJET_SECRET_KEY: z.string().min(1),
  MAILJET_SEND_URL: z.string().url().default('https://api.mailjet.com/v3.1/send'),
  MAILJET_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  MAIL_FROM_EMAIL: z.string().email(),
  MAIL_FROM_NAME: z.string().min(1).default('PadosiPro'),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:8081'),
  TRUST_PROXY: z.string().optional().default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
})
  .refine(
    ({ NODE_ENV, JWT_SECRET }) => NODE_ENV !== 'production' || JWT_SECRET !== 'replace-with-a-long-random-secret',
    { path: ['JWT_SECRET'], error: 'JWT_SECRET must be changed in production' }
  )
  .refine(
    ({ NODE_ENV, OTP_SECRET }) => NODE_ENV !== 'production' || OTP_SECRET !== 'replace-with-another-long-random-secret',
    { path: ['OTP_SECRET'], error: 'OTP_SECRET must be changed in production' }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(JSON.stringify({
    level: 'error',
    event: 'config.invalid',
    errors: z.flattenError(parsed.error).fieldErrors
  }));
  process.exit(1);
}

const env = {
  ...parsed.data,
  TRUST_PROXY: parsed.data.TRUST_PROXY === 'true'
};

export default env;
