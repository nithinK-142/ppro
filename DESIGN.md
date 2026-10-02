# Design

## Architecture

PadosiPro has two parts: a native Expo/React Native app and an Express API.

The app uses Expo Router for navigation. On startup, it restores the login state, checks the profile and task selection, then opens the next required screen.

Auth state is kept in one context. API requests use one shared client for auth headers and error handling. Tokens are stored in SecureStore.

The API keeps a simple structure. Routes connect to controllers. Validation, auth, rate limits, request IDs, and error handling are handled in middleware. Shared low-level code stays in `utils`. A service layer was not added because the project is small.

## Data and Authentication

SQLite was used so the backend can run locally without setting up another database.

The database keeps users, OTPs, profiles, tasks, and task selections in separate tables, with foreign keys and indexes.

Passwords use bcrypt. OTPs are generated with crypto. Only the hash is stored.

OTP rules:

- Expires after 10 minutes.
- Maximum 5 wrong attempts.
- Single-use.
- 30-second resend cooldown.

JWTs are used for login sessions and expire after 7 days by default.

Unverified users cannot log in. Session restore handles expired or invalid auth separately from temporary network/server errors.

## Client UX

The UI uses a warm paper background, dark text, one orange action colour, simple borders, and large headings. The design stays simple so the task list remains the main focus.

Network states are handled directly in the screens:

- Loading states prevent duplicate submits.
- Empty states tell the user what to do next.
- Failed requests show the server error and allow retry where useful.

Inputs use clear labels and suitable keyboard types. Task selections show their selected state. Main controls have stable test IDs.

## API Safety

All input is validated before it reaches the main application logic.

The API uses:

- Consistent error responses.
- Request IDs for tracing.
- Generated UUIDs when an incoming request ID is invalid.
- IP and account-based rate limits for auth routes.
- 20 KB JSON body limit.
- Bounded search and pagination.
- No stack traces in API responses.
- Helmet for HTTP security headers.

## API Contract

`docs/openapi.yaml` documents the API endpoints, requests, and responses.

## Operations

`/health/live` checks that the API process is running.

`/health/ready` checks that SQLite is available.

SIGINT and SIGTERM shut down the server before closing the database. A shutdown timeout prevents the process from hanging.

## Trade-offs

SQLite keeps local setup simple.

The API avoids a service layer because the current scope is small.

## Authentication

SecureStore is used to persist the authentication token on native devices instead of normal app storage.

## Scope

The implemented flow covers:

- Registration
- Email verification
- Login
- First-login profile setup
- Task search and selection
- Task confirmation
- Selected-task home screen
- Logout

The assignment does not require payments, chat, vendors, admin tools, push notifications, background jobs, or the full task lifecycle, so they were left out.

## Next

With more time:

- Share rate-limit state across multiple API instances.
- Add refresh-token rotation.
- Add OpenAPI contract tests.
- Move to PostgreSQL if the product grows.