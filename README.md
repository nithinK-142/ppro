# PadosiPro

PadosiPro is delivered as one repository with two projects:

- `server/` — Node.js API
- `client/` — Expo / React Native app

## Run for testing

Requirements:

- Node.js 22.13+
- Android Studio with an Android emulator, or a physical Android device

From the repository root:

### 1. Set the client API URL

Edit `client/.env` and set `EXPO_PUBLIC_API_URL` to the API address reachable from the app.

For a physical phone, use your computer's LAN IP and keep the phone and computer on the same Wi-Fi:

```text
http://<computer-lan-ip>:4000
```

Find the LAN IP with:

- Linux: `hostname -I`
- macOS: `ipconfig getifaddr en0`
- Windows: `ipconfig`

For an Android emulator, use:

```text
http://10.0.2.2:4000
```

### 2. Start the application

```sh
node run.mjs
```

`run.mjs` creates missing `.env` files, installs dependencies, validates the client API URL, and starts the API and Expo together.

Any API keys/credentials provided are temporary testing credentials only and are intended to be discarded after testing.

Press `Ctrl+C` to stop both processes.

## Email verification for testing

Use a [**YOPmail**](https://yopmail.com/en/) address when registering for testing.

The app uses **Mailjet Send API v3.1 over HTTPS** for verification emails. The provided Mailjet setup was tested successfully with YOPmail. Proton Mail and Gmail did not receive the verification emails in the tested setup.

These email credentials are provided only for testing and are intended to be discarded thereafter.

## Test flow

```text
register → verify email → login → profile → choose tasks → home
```

## Note

- APK build instructions are documented in `client/README.md`.
- API configuration instructions are documented in `server/README.md`.