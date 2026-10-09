# PadosiPro Client

Expo / React Native app.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `.env` to the API address reachable from the app.

For a physical phone, use your computer's LAN IP and keep the phone and computer on the same Wi-Fi:

```text
http://<computer-lan-ip>:4000
```

Find the LAN IP with:

```sh
# Linux
hostname -I

# macOS
ipconfig getifaddr en0

# Windows
ipconfig
```

For an Android emulator, use:

```text
http://10.0.2.2:4000
```

`EXPO_PUBLIC_*` values are inlined when the JavaScript bundle is built. After changing `client/.env`, stop Expo with `Ctrl+C` and start it again, or rebuild the APK.


## Start

```sh
pnpm start
```

## Build the APK

Built and tested on Linux (Zorin OS, Ubuntu-based). The commands use `apt`, so adjust the package install on other distros. The result is a release APK, debug-signed, arm64 only. Pick one of the two options below.

The API URL is baked into the APK at build time, so set `EXPO_PUBLIC_API_URL` before building.

Plain `http://` works in release builds because `usesCleartextTraffic: true` is enabled via `expo-build-properties` in `app.json`.

### Option 1: Docker

Builds everything inside a container (JDK, Android SDK, dependencies, Gradle) and copies only the finished APK to `build/apk/`. Nothing gets installed on your machine, so this is the easiest route if you already have Docker.

Needs Docker with at least **5 GB RAM** available to it (6 GB is safer). 2 GB or more of swap is optional, but it helps with memory spikes.


```sh
docker info | grep -i "total memory"   # should show 5 GB or more
cp .env.example .env                   # set EXPO_PUBLIC_API_URL
docker build -o build/apk .
```

APK: `build/apk/PadosiPro.apk`

- `cannot allocate memory` or `Gradle build daemon disappeared` means Docker doesn't have enough RAM.
- Docker Desktop defaults to a small VM. Raise it in Settings → Resources (Memory 5 GB or more).
- First build takes 15 to 25 minutes.

### Option 2: Local (no Docker)

Installs the Android command-line tools on your machine (no Android Studio needed) and builds the APK directly with Gradle. More setup up front, but rebuilds are faster and it needs less RAM than Docker.

Needs JDK 17, Node 22.13+, pnpm and about 4 GB of free RAM.

```sh
# Android SDK (one time)
sudo apt install -y openjdk-17-jdk unzip curl
mkdir -p ~/android-sdk/cmdline-tools && cd ~/android-sdk/cmdline-tools
curl -L -o t.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip t.zip && mv cmdline-tools latest && rm t.zip
cd -
export ANDROID_HOME=$HOME/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"

# Build (from the project root)
cp .env.example .env                   # set EXPO_PUBLIC_API_URL
pnpm install
pnpm exec expo prebuild --platform android --clean
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
printf '\norg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g\norg.gradle.workers.max=2\norg.gradle.parallel=false\nreactNativeArchitectures=arm64-v8a\n' >> gradle.properties
./gradlew assembleRelease --no-daemon
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

A prebuilt APK has the builder's IP baked into it. Build your own APK with your LAN IP using the steps above.

Close heavy apps (browser, IDE) while it builds.

## Install on a phone

1. On the phone, enable Developer options → USB debugging, then connect it over USB.
3. Install the APK:

```sh
# Docker build (run from the project root)
adb install -r build/apk/PadosiPro.apk

# Local build (run from android/)
adb install -r app/build/outputs/apk/release/app-release.apk
```

`adb` comes with the Android SDK from Option 2. Otherwise install it with `sudo apt install adb`.

## TypeScript check

```sh
pnpm check
```

The app source uses `.ts` and `.tsx`.

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

API access goes through the shared request client in `src/api/client.ts`.

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