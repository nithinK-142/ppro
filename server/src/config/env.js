require('dotenv').config();

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/padosipro.db'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(2).default('7d'),
  OTP_SECRET: z.string().min(32),
  OTP_EXPIRES_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.string().default('false'),
  SMTP_REQUIRE_TLS: z.string().default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  SMTP_GREETING_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  MAIL_FROM: z.string().min(1),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:8081'),
  TRUST_PROXY: z.string().optional().default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.JWT_SECRET === 'replace-with-a-long-random-secret') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'JWT_SECRET must be changed in production' });
  }
  if (value.NODE_ENV === 'production' && value.OTP_SECRET === 'replace-with-another-long-random-secret') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['OTP_SECRET'], message: 'OTP_SECRET must be changed in production' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(JSON.stringify({ level: 'error', event: 'config.invalid', errors: parsed.error.flatten().fieldErrors }));
  process.exit(1);
}

const env = {
  ...parsed.data,
  SMTP_SECURE: parsed.data.SMTP_SECURE === 'true',
  SMTP_REQUIRE_TLS: parsed.data.SMTP_REQUIRE_TLS === 'true',
  TRUST_PROXY: parsed.data.TRUST_PROXY === 'true'
};

module.exports = env;
