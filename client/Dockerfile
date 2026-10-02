FROM node:24-bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jdk-headless unzip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* && corepack enable

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

RUN mkdir -p $ANDROID_HOME/cmdline-tools && cd $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o t.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q t.zip && mv cmdline-tools latest && rm t.zip \
 && yes | sdkmanager --licenses >/dev/null \
 && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"

WORKDIR /app
COPY . .

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
RUN pnpm exec expo prebuild --platform android --clean

WORKDIR /app/android
RUN echo "sdk.dir=$ANDROID_HOME" > local.properties \
 && printf '\norg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m\nkotlin.compiler.execution.strategy=in-process\norg.gradle.workers.max=1\norg.gradle.parallel=false\norg.gradle.vfs.watch=false\nreactNativeArchitectures=arm64-v8a\n' >> gradle.properties

ENV NODE_OPTIONS=--max-old-space-size=1536
ENV CMAKE_BUILD_PARALLEL_LEVEL=1

RUN --mount=type=cache,target=/root/.gradle ./gradlew assembleRelease --no-daemon

# Export stage: only the APK leaves the build
FROM scratch
COPY --from=build /app/android/app/build/outputs/apk/release/app-release.apk /PadosiPro.apk