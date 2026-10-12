import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'padosipro.auth.access-token';
const REFRESH_TOKEN_KEY = 'padosipro.auth.refresh-token';
const REFRESH_ATTEMPT_ID_KEY = 'padosipro.auth.refresh-attempt-id';

let cachedAccessToken: string | null | undefined;
let cachedRefreshToken: string | null | undefined;
let accessHydration: Promise<string | null> | null = null;
let refreshHydration: Promise<string | null> | null = null;
let cachedRefreshAttemptId: string | null | undefined;
let refreshAttemptHydration: Promise<string | null> | null = null;

function createRefreshAttemptId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

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

async function getRefreshAttemptId() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  if (cachedRefreshAttemptId !== undefined) return cachedRefreshAttemptId;

  refreshAttemptHydration ??= SecureStore.getItemAsync(REFRESH_ATTEMPT_ID_KEY)
    .then(async (attemptId) => {
      const stableAttemptId = attemptId || createRefreshAttemptId();
      if (!attemptId) await SecureStore.setItemAsync(REFRESH_ATTEMPT_ID_KEY, stableAttemptId);
      cachedRefreshAttemptId = stableAttemptId;
      return stableAttemptId;
    })
    .catch((error: unknown) => {
      refreshAttemptHydration = null;
      throw error;
    });

  return refreshAttemptHydration;
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

  // Write the next attempt ID last. If storage fails earlier, the old ID remains
  // paired with the old refresh token or is harmless with the new refresh token.
  const nextAttemptId = createRefreshAttemptId();
  await SecureStore.setItemAsync(REFRESH_ATTEMPT_ID_KEY, nextAttemptId);
  cachedRefreshAttemptId = nextAttemptId;
  refreshAttemptHydration = Promise.resolve(nextAttemptId);
}

async function clearTokens() {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_ATTEMPT_ID_KEY)
    ]);
  } finally {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    accessHydration = Promise.resolve(null);
    refreshHydration = Promise.resolve(null);
    cachedRefreshAttemptId = null;
    refreshAttemptHydration = Promise.resolve(null);
  }
}

export { getAccessToken, getRefreshToken, getRefreshAttemptId, setTokens, clearTokens };
