# PadosiPro Server

Express API.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` and the other required environment variables in `.env`.

## Start

Run the API normally:

```sh
pnpm start
```

For local development with watch mode:

```sh
pnpm dev
```

## Vercel

This Express API deploys to Vercel with zero configuration. The Vercel entrypoint is `src/server.ts`.

Add these environment variables in Vercel Project Settings → Environment Variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `OTP_SECRET`
- `OTP_EXPIRES_MINUTES`
- `OTP_RESEND_SECONDS`
- `OTP_MAX_ATTEMPTS`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `MAILJET_SEND_URL`
- `MAILJET_TIMEOUT_MS`
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`
- `CLIENT_ORIGIN`
- `TRUST_PROXY`
- `LOG_LEVEL`

Set `NODE_ENV=production`.

The APK should use the deployed Vercel URL as its API base URL, for example `https://your-project.vercel.app`.

Vercel environment variables are configured outside the repository. Redeploy after changing them.

## Docker

Docker uses the same Neon PostgreSQL database through `DATABASE_URL`.

```sh
docker compose up --build
```

API: `http://localhost:4000`

## Code structure

```text
src/
├── controllers/   Request handlers
├── routes/        API routes
├── middleware/    Auth, validation, rate limiting, request logging
├── validation/    Zod request schemas
├── config/        Environment, database, schema, and seed data
├── utils/         Application errors, logging, OTP, and email helpers
└── types/         API and database types
```

Requests flow through routes → middleware → controllers.

Validation uses Zod. Authentication uses JWT and bcrypt.

## Flow

```text
register → verify email → login → profile → choose tasks → home
```

OTP verification is required before login.

Registration and OTP resend persist the OTP before returning and dispatch the email in the background. Check `auth.otp_sent` or `auth.otp_send_failed` logs when debugging delivery.

## API

- OpenAPI: `docs/openapi.yaml`
- Bruno collection: `bruno/`

Health:

- `GET /health/live`
- `GET /health/ready`

Auth:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`

Profile:

- `GET /api/v1/profile`
- `PATCH /api/v1/profile`

Tasks:

- `GET /api/v1/tasks`
- `GET /api/v1/tasks/selected`
- `PUT /api/v1/tasks/selected`

## Security

Authentication uses JWT.

Passwords are hashed with bcrypt.

Auth endpoints use IP- and email-aware rate limits.

Request validation uses Zod.

Authorization and cookies are redacted from logs.

## Data

Neon PostgreSQL stores application data.

`src/config/seed.ts` seeds 30 task records across six categories.

## Checks and build

```sh
pnpm check
pnpm build
```

`pnpm check` validates the TypeScript runtime import contract before running the TypeScript compiler. `pnpm build` emits compiled JavaScript to `dist/` and copies the database schema alongside it.

## Tests

```sh
pnpm test
```

Tests cover OTP generation, hashing, expiry, resend timing, wrong-attempt limits, and verified-user login.

## Mail

Email is sent through Mailjet Send API v3.1 over HTTPS. Configure `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAIL_FROM_EMAIL`, and `MAIL_FROM_NAME` in `.env`.

## Debugging

Every request gets an `X-Request-Id`. The same ID is returned in the response and logged by the API.

Match the ID across client and server logs when debugging a request.

`LOG_LEVEL` supports:

- `silent` — disables logs.
- `fatal` — fatal errors only.
- `error` — errors and more severe logs.
- `warn` — warnings, errors, and fatal errors.
- `info` — normal application logs.
- `debug` — detailed debugging logs.
- `trace` — most detailed logs.
