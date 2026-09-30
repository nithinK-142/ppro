# Design

## API shape

Small Express app. Routes map URLs to controllers. Validation, auth, rate limits, request IDs, and errors stay in middleware. Shared low-level code stays in `utils`. No service layer.

## Data

SQLite keeps the project runnable without an external database. Users, OTP records, profiles, tasks, and selections are separate tables with foreign keys and indexes.

## Auth

Passwords use bcrypt. OTPs are generated with `crypto.randomInt`, stored as HMAC-SHA256 hashes, expire after 10 minutes, allow five wrong attempts, and are single-use. Resends are throttled for 30 seconds. JWTs expire after seven days by default.

## API safety

Validation runs at the edge. Request IDs are added to every response and malformed incoming IDs are rejected. Auth traffic is limited by IP and account key. JSON bodies are capped at 20 KB. Search and pagination are bounded. Errors do not expose stack traces. Helmet is enabled.

## Operations

`/health/live` checks process liveness. `/health/ready` checks SQLite. SIGINT and SIGTERM stop the HTTP server before closing the database, with a hard shutdown timeout.

## Contract

`docs/openapi.yaml` describes the HTTP surface. It is kept beside the routes so the mobile client and API tooling have one readable contract.

## Left out

Payments, chat, vendors, admin tools, push notifications, background jobs, and the full task lifecycle are outside the assignment.

## Next

Use a shared rate-limit store for multiple API instances, rotate refresh tokens, add contract tests against OpenAPI, and move production data to PostgreSQL if the product grows.
