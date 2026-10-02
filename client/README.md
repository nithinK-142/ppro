# PadosiPro Client

Expo / React Native app.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` to the API address reachable from the app.

## Start

```sh
pnpm start
```

## Code structure

```text
app/        Expo Router screens and route groups
src/api/    API requests and shared request handling
src/state/  Auth/session state
src/storage/ SecureStore token persistence
src/components/ Shared UI components
src/theme/  Shared theme values
src/utils/  Shared utilities and logging
```

Authentication and session restoration are handled through `AuthProvider`.

API access goes through the shared request client in `src/api/client.js`.

JWTs are stored with Expo SecureStore.

## Flow

```text
register → verify email → login → profile → choose tasks → home
```

The JWT is restored when the app starts.

## States

Network screens have loading, empty, and error/retry states. Submit actions lock while requests run.

## Debugging

API requests send an `X-Request-Id` and log method, path, status, duration, and error code. The server returns the same ID. Match that ID with the API logs when debugging.

`EXPO_PUBLIC_LOG_LEVEL` supports:

- `silent` — disables client logs.
- `error` — errors only.
- `warn` — warnings and errors.
- `info` — general request and application logs.
- `debug` — detailed request debugging logs.

## Scope

Account setup and task selection only. No payments, chat, push notifications, or full request lifecycle.