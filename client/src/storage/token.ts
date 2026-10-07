import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'padosipro.auth.token';

let cachedToken: string | null | undefined;
let hydrationPromise: Promise<string | null> | null = null;

async function getToken() {
  if (cachedToken !== undefined) return cachedToken;

  hydrationPromise ??= SecureStore.getItemAsync(TOKEN_KEY)
    .then((token) => {
      cachedToken = token;
      return token;
    })
    .catch((error) => {
      hydrationPromise = null;
      throw error;
    });

  return hydrationPromise;
}

async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  cachedToken = token;
}

async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  cachedToken = null;
  hydrationPromise = null;
}

export { getToken, setToken, clearToken };
