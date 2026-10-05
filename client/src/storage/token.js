import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'padosipro.auth.token';

let cachedToken = null;
let hydrated = false;
let hydrationPromise = null;

export async function getToken() {
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

export async function setToken(token) {
  cachedToken = token;
  hydrated = true;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  cachedToken = null;
  hydrated = true;
  hydrationPromise = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
