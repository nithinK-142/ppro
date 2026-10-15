# PadosiPro Server

Express API.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` and the other required environment variables in `.env`.

## Tests

Tests load `server/.env.test` only; they do not use `server/.env`. Create it from the test template and set `DATABASE_URL` to a disposable PostgreSQL database:

```sh
cp .env.test.example .env.test
# Edit .env.test and set DATABASE_URL
pnpm test
```

The test setup deletes and reseeds application tables. It refuses to run if the test database matches the database in `.env`. Never use production data for tests. Test mail settings are placeholders because email calls are mocked.

## Observability

See [`../observability/README.md`](../observability/README.md) for metrics and tracing setup.

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

- `DATABASE_URL` — PostgreSQL connection URL.
- `DATABASE_POOL_MAX` — Maximum number of database connections in the pool.
- `DATABASE_IDLE_TIMEOUT_MS` — Time in milliseconds before an idle database connection is closed.
- `DATABASE_CONNECTION_TIMEOUT_MS` — Maximum time in milliseconds to wait for a database connection.
- `JWT_SECRET` — Secret used to sign and verify JWTs.
- `ACCESS_TOKEN_EXPIRES_IN` — Access token lifetime, for example `15m`.
- `REFRESH_TOKEN_TTL_DAYS` — Number of days a refresh token remains valid.
- `OTP_SECRET` — Secret used to protect OTP-related operations.
- `OTP_EXPIRES_MINUTES` — OTP validity period in minutes.
- `OTP_RESEND_SECONDS` — Minimum wait time in seconds before another OTP can be requested.
- `OTP_MAX_ATTEMPTS` — Maximum number of OTP verification attempts allowed.
- `MAILJET_API_KEY` — Mailjet API key used to send emails.
- `MAILJET_SECRET_KEY` — Mailjet secret key used to authenticate API requests.
- `MAILJET_SEND_URL` — Mailjet email sending API endpoint.
- `MAILJET_TIMEOUT_MS` — Maximum time in milliseconds to wait for a Mailjet API response.
- `MAIL_FROM_EMAIL` — Email address shown as the sender.
- `MAIL_FROM_NAME` — Display name shown as the sender.
- `CLIENT_ORIGIN` — Allowed frontend origin(s) for cross-origin requests.
- `TRUST_PROXY` — Whether the API trusts forwarded request information from a reverse proxy.
- `LOG_LEVEL` — Minimum severity level for logs, such as `info`, `warn`, or `error`.
- `METRICS_TOKEN` — bearer token for the protected `/metrics` endpoint
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` — optional OTLP/HTTP trace receiver URL
- `OTEL_EXPORTER_OTLP_HEADERS` — optional URL-encoded OTLP headers
- `OTEL_SERVICE_NAME` — service name shown in traces

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
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Profile:

- `GET /api/v1/profile`
- `PATCH /api/v1/profile`

Tasks:

- `GET /api/v1/tasks`
- `GET /api/v1/tasks/selected`
- `PUT /api/v1/tasks/selected`

## Security

Authentication uses short-lived HS256 access JWTs (15 minutes by default) and opaque refresh tokens (30-day absolute session lifetime by default). Configure `ACCESS_TOKEN_EXPIRES_IN` and `REFRESH_TOKEN_TTL_DAYS` to change those defaults; `JWT_EXPIRES_IN` no longer controls access-token expiry. Refresh tokens are stored as SHA-256 hashes, rotated on use, and revoked on logout. Reuse of a rotated token revokes that session family.

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

Tests cover OTP generation, hashing, expiry, resend timing, wrong-attempt limits, verified-user login, refresh-token hashing and rotation, replay revocation, and logout revocation.

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
