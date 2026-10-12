import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'padosipro.auth.access-token';
const REFRESH_TOKEN_KEY = 'padosipro.auth.refresh-token';

let cachedAccessToken: string | null | undefined;
let cachedRefreshToken: string | null | undefined;
let accessHydration: Promise<string | null> | null = null;
let refreshHydration: Promise<string | null> | null = null;

async function getAccessToken() {
  if (cachedAccessToken !== undefined) return cachedAccessToken;

  accessHydration ??= SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    .then((token) => {
      cachedAccessToken = token;
      return token;
    })
    .catch((error: unknown) => {
      accessHydration = null;
      throw error;
    });

  return accessHydration;
}

async function getRefreshToken() {
  if (cachedRefreshToken !== undefined) return cachedRefreshToken;

  refreshHydration ??= SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    .then((token) => {
      cachedRefreshToken = token;
      return token;
    })
    .catch((error: unknown) => {
      refreshHydration = null;
      throw error;
    });

  return refreshHydration;
}

async function setTokens(accessToken: string, refreshToken: string) {
  // Persist the replacement refresh token first. If the app stops mid-write,
  // the still-valid previous access token can continue using the new refresh token.
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  cachedRefreshToken = refreshToken;
  refreshHydration = Promise.resolve(refreshToken);

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  cachedAccessToken = accessToken;
  accessHydration = Promise.resolve(accessToken);
}

async function clearTokens() {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
    ]);
  } finally {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    accessHydration = Promise.resolve(null);
    refreshHydration = Promise.resolve(null);
  }
}

export { getAccessToken, getRefreshToken, setTokens, clearTokens };
