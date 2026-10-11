# PadosiPro Server

Express API.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` and the other required environment variables in `.env`.

## Database configuration

The application uses the standard `pg` driver and Drizzle's `node-postgres` adapter. It supports compatible PostgreSQL providers through `DATABASE_URL`; use any TLS or connection parameters required by your provider.

If your provider offers direct and pooled endpoints, choose according to its guidance and your hosting model. Pool limits apply to each API process or instance, not the whole deployment.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `DATABASE_POOL_MAX` | `5` | Maximum pooled clients per process |
| `DATABASE_IDLE_TIMEOUT_MS` | `10000` | Evict idle clients after this many milliseconds; `0` disables idle eviction |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `10000` | Maximum time to wait while opening a connection |

Set these values according to provider connection limits and the number of running instances.

## Start

Run the API normally:

```sh
pnpm start
```

For local development with watch mode:

```sh
pnpm dev
```

## Deployment

Run the API on a Node.js host that supports the required Node.js version and can reach the configured PostgreSQL service and Mailjet API. Configure environment variables through the host's environment-variable settings or secret manager; do not commit production credentials.

Set the following variables in the deployment environment:

- `DATABASE_URL`
- `DATABASE_POOL_MAX`
- `DATABASE_IDLE_TIMEOUT_MS`
- `DATABASE_CONNECTION_TIMEOUT_MS`
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

Set `NODE_ENV=production`. Configure the client to use the deployed API's base URL. Restart or redeploy after changing environment variables.

## Docker

Docker uses the PostgreSQL service configured by `DATABASE_URL`; the application does not require a provider-specific database SDK.

```sh
# Build the  image
docker build -t padosipro-api .

# Run the API container in production mode, load environment variables, and expose port 4000
docker run --rm --name padosipro-api --env-file .env -e NODE_ENV=production -p 4000:4000 padosipro-api
```

API: `http://localhost:4000`

## Code structure

```text
src/
├── controllers/   Request handlers
├── routes/        API routes
├── middleware/    Auth, validation, rate limiting, request logging
├── validation/    Zod request schemas
├── config/        Environment, database, Drizzle schema, SQL bootstrap, and seed data
├── utils/         Application errors, logging, OTP, and email helpers
└── types/         API types
```

Requests flow through routes → middleware → controllers.

Controllers use Drizzle for typed PostgreSQL queries and transactions; raw SQL is kept only for the small startup schema bootstrap and database health check. Validation uses Zod. Authentication uses JWT and bcrypt.

## Flow

```text
register → verify email → login → profile → choose tasks → home
```

OTP verification is required before login.

Registration and OTP resend persist the OTP, then await the Mailjet send attempt before responding. The attempt is bounded by `MAILJET_TIMEOUT_MS`. Delivery failure is logged; users can request another code. Email delivery is awaited rather than delegated to a host-specific background-work API.

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

A compatible PostgreSQL service stores application data through Drizzle ORM and the standard `pg` driver. The application does not depend on a Neon-specific database SDK.

`src/config/schema.ts` defines the typed PostgreSQL tables used by application queries. `src/config/schema.sql` remains the startup schema bootstrap so the assignment still initializes a fresh database without a separate migration step.

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
