# PadosiPro mobile

Native Expo app for the customer onboarding flow. No WebView.

## Run

```sh
pnpm install
cp .env.example .env
pnpm start
```

Set `EXPO_PUBLIC_API_URL` to an address reachable from the device.

Android emulator:

```text
http://10.0.2.2:4000
```

iOS simulator:

```text
http://127.0.0.1:4000
```

Physical device: use the computer's LAN IP.

## Android APK

```sh
pnpm dlx eas-cli@latest build --platform android --profile production
```

The production EAS profile is configured to output an APK.

## Flow

```text
register → verify email → login → profile → choose tasks → home
```

The JWT is stored with Expo SecureStore and restored when the app starts.

## States

Network screens have loading, empty, and error/retry states. Submit actions lock while requests run.

## Scope

Account setup and task preferences only. No payments, chat, vendor marketplace, push notifications, or full request lifecycle.

## Debugging

API requests send an `X-Request-Id` and log method, path, status, duration, and error code. The server returns the same ID. Match that ID with the API logs when debugging. Set `EXPO_PUBLIC_LOG_LEVEL=debug` for request logs.
