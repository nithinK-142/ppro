# PadosiPro Server

Express API.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set the required environment variables in `.env`.

## Start

Run the API normally:

```sh
pnpm start
```

For local development with watch mode:

```sh
pnpm dev
```

## Docker

Run the API with Docker Compose:

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
├── db/            SQLite setup, schema, and seed data
├── utils/         OTP and email helpers
├── logging/       Pino logger
├── config/        Environment configuration
└── errors/        Application errors
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

SQLite stores application data.

`src/db/seed.js` seeds 30 task records across six categories.

## Tests

```sh
pnpm test
```

Tests cover OTP generation, hashing, expiry, resend timing, wrong-attempt limits, and verified-user login.

## Mail

Email is sent through Mailjet SMTP.

Configure `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, and `MAIL_FROM` in `.env`.

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