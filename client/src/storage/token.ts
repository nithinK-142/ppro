import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'padosipro.auth.token';

let cachedToken: string | null = null;
let hydrated = false;
let hydrationPromise: Promise<string | null> | null = null;

export async function getToken(): Promise<string | null> {
  if (hydrated) return cachedToken;

  if (!hydrationPromise) {
    hydrationPromise = SecureStore.getItemAsync(TOKEN_KEY)
      .then((token) => {
        cachedToken = token;
        hydrated = true;
        return cachedToken;
      })
      .catch((error) => {
        hydrationPromise = null;
        throw error;
      });
  }

  return hydrationPromise;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  hydrated = true;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  hydrated = true;
  hydrationPromise = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
