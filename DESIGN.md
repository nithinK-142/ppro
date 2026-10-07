# Design

## Architecture

- PadosiPro has two parts: a native Expo/React Native app and an Express API.

- The app uses Expo Router for navigation. On startup, it restores the login state, checks the profile and task selection, then opens the next required screen.

- Auth state is kept in one context. API requests use one shared client for auth headers and error handling. Tokens are stored in SecureStore.

- The API uses controllers for request handlers. Routes connect requests to controllers, while validation, auth, rate limits, request IDs, and error handling are handled in middleware. Shared low-level code stays in `utils`.

## Data and Authentication

- Neon PostgreSQL stores the backend data through the server-side database client.

- The database keeps users, OTPs, profiles, tasks, and task selections in separate tables, with foreign keys and indexes.

- Profiles store Name, Indian mobile number, Address, and Business Name. Business Name is optional because not every household has a business name.

- The task catalogue contains 30 tasks across 6 categories.

- Passwords use bcrypt. OTPs are generated with `crypto`. Only the OTP hash is stored.

- OTP emails are sent through Mailjet Send API v3.1 over HTTPS.

OTP:
- Expires after 10 minutes.
- Maximum 5 wrong attempts.
- Single-use.
- 30-second resend cooldown.

JWTs are used for login sessions and expire after 7 days by default.

Unverified users cannot log in. Session restore handles expired or invalid authentication separately from temporary network or server errors.

SecureStore persists the authentication token on the device.

## Client UX

The UI uses a warm paper background, dark text, one orange action colour, simple borders, and large headings. The design stays simple so the task list remains the main focus.

Network states are handled directly in the screens:

- Loading states prevent duplicate submits.
- Empty states explain what to do next.
- Failed requests show the server error and allow retry where useful.

Inputs use clear labels and suitable keyboard types. Task selections show their selected state. Main controls have stable test IDs.

## API Safety

All input is validated before reaching the main application logic.

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

`/health/ready` checks that the PostgreSQL database is reachable.

SIGINT and SIGTERM shut down the server before closing the database. A shutdown timeout prevents the process from hanging.

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

## Trade-offs

- **JWT sessions:** Stateless and simple. Tokens cannot be revoked before expiry.
- **OTP stored as a hash:** Safer if the database is exposed. The original OTP cannot be retrieved later.
- **Replace-all task selection:** Saving selections replaces the user's previous selection in one transaction. This keeps the state simple. The trade-off is that selection history is not kept.

## Next

With another week, I would focus on:

- Password reset and account recovery.
- Better session management and token revocation.
- OpenAPI contract tests and more end-to-end tests.
- Task status and completion after task selection.

## Next Next

Further down the line:

- **Payments** — Integrate Razorpay or Paytm for secure payment processing.
- **Chat** — Add WhatsApp-based communication between customers and Lifestyle Managers.
- **Admin tools** — Build an admin console to manage users, tasks, categories, and app content.
- **Push notifications** — Use Firebase Cloud Messaging (FCM) for task and account updates.
- **Background jobs** — Add scheduled jobs for tasks such as OTP cleanup, notifications, and other maintenance work.