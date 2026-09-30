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
Mailpit: `http://localhost:8025`

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

Development uses Mailpit. Production uses SMTP. Port 465 uses SMTPS. Port 587 requires STARTTLS.

## Data

SQLite is used for the assignment. `src/db/seed.js` loads 30 local task records across six categories. No production PadosiPro API is called.
