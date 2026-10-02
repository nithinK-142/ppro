# PadosiPro

PadosiPro is delivered as one repository with two projects:

- `server/` — Node.js API
- `client/` — Expo / React Native app

## Run for testing

Requirements:

- Node.js 22.13+
- Android Studio with an Android emulator, or a physical Android device

From the repository root:

```sh
node scripts/dev.mjs
```

This is the only command needed to run both projects.

It automatically:

1. Creates missing `.env` files from the committed `.env.example` files, so no manual .env configuration is required. Any API keys/credentials provided are temporary testing credentials only and are intended to be discarded after testing.
2. Uses the pinned pnpm version from each project's `package.json` without requiring a global pnpm install.
3. Installs both projects from their committed lockfiles.
4. Starts the API and Expo together.

Existing `.env` files are never overwritten.

Press `Ctrl+C` to stop both processes.

## Email verification for testing

Use a [**YOPmail**](https://yopmail.com/en/) address when registering for testing.

The app uses **Mailjet SMTP** for verification emails. The provided Mailjet setup was tested successfully with YOPmail. Proton Mail and Gmail did not receive the verification emails in the tested setup.

These email credentials are provided only for testing and are intended to be discarded thereafter.

## Test flow

```text
register → verify email → login → profile → choose tasks → home
```

The project uses the pre-configured environment variables. No client or server configuration is needed for the provided test setup.

## Build APK

From `client/`:

```sh
npm add -g eas-cli
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```
