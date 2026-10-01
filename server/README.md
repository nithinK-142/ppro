# PadosiPro API

Express API for the PadosiPro onboarding flow.

## Stack

Node.js 24 · Express 5 · SQLite · bcrypt · JWT · Zod · Nodemailer

## Run

Copy `.env.example` to `.env`, set the two secrets, then:

```sh
docker compose up --build
```

API: `http://localhost:4000`

For local Node development:

```sh
pnpm install
pnpm dev
```

## Flow

```text
register → verify email → login → profile → choose tasks → home
```

## API

OpenAPI: `docs/openapi.yaml`
Bruno collection: `bruno/`

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

Every response carries `X-Request-Id`. Auth endpoints use IP and email-aware rate limits. Task queries have bounded search and pagination values.

## Tests

```sh
pnpm test
```

Tests cover OTP generation, hashing, expiry, resend timing, wrong-attempt limits, and verified-user login.

## Mail

Email is sent through Mailjet SMTP.

Set `SMTP_USER` to the Mailjet API key and `SMTP_PASS` to the Mailjet secret key.
Use a sender address verified in Mailjet. Port `465` uses SMTPS; port `587` uses STARTTLS.

## Data

SQLite is used for the assignment. `src/db/seed.js` loads 30 local task records across six categories. No production PadosiPro API is called.

## Logs

API logs are structured JSON on stdout. Every request has an `X-Request-Id`; the client sends it and the API returns it. Match that ID across both logs when debugging a request. Set `LOG_LEVEL=debug` for more detail. Passwords, bearer tokens, and cookies are not logged.
