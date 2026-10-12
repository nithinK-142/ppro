import { beforeEach, describe, expect, it, vi } from 'vitest';
import { secureStore } from './setup';

describe('token storage', () => {
  beforeEach(() => vi.resetModules());

  it('hydrates the access token once and caches it', async () => {
    secureStore.getItemAsync.mockImplementation(async (key?: string) => key === 'padosipro.auth.access-token' ? 'saved-access-token' : null);
    const { getAccessToken } = await import('../src/storage/token');
    await expect(getAccessToken()).resolves.toBe('saved-access-token');
    await expect(getAccessToken()).resolves.toBe('saved-access-token');
    expect(secureStore.getItemAsync).toHaveBeenCalledOnce();
  });

  it('persists both tokens and rotates the refresh attempt ID', async () => {
    const { getAccessToken, getRefreshToken, getRefreshAttemptId, setTokens } = await import('../src/storage/token');
    await setTokens('new-access-token', 'new-refresh-token');
    expect(secureStore.setItemAsync).toHaveBeenNthCalledWith(1, 'padosipro.auth.refresh-token', 'new-refresh-token');
    expect(secureStore.setItemAsync).toHaveBeenNthCalledWith(2, 'padosipro.auth.access-token', 'new-access-token');
    expect(secureStore.setItemAsync).toHaveBeenNthCalledWith(3, 'padosipro.auth.refresh-attempt-id', expect.any(String));
    await expect(getAccessToken()).resolves.toBe('new-access-token');
    await expect(getRefreshToken()).resolves.toBe('new-refresh-token');
    await expect(getRefreshAttemptId()).resolves.toEqual(expect.any(String));
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('creates and persists one stable refresh attempt ID for an existing session', async () => {
    secureStore.getItemAsync.mockImplementation(async (key?: string) => {
      if (key === 'padosipro.auth.refresh-token') return 'saved-refresh-token';
      if (key === 'padosipro.auth.refresh-attempt-id') return null;
      return null;
    });
    const { getRefreshAttemptId } = await import('../src/storage/token');
    const first = await getRefreshAttemptId();
    const second = await getRefreshAttemptId();
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('padosipro.auth.refresh-attempt-id', first);
  });

  it('surfaces secure storage read failures', async () => {
    secureStore.getItemAsync.mockRejectedValueOnce(new Error('storage unavailable'));
    const { getAccessToken } = await import('../src/storage/token');
    await expect(getAccessToken()).rejects.toThrow('storage unavailable');
  });

  it('clears the persisted and cached token pair', async () => {
    const { getAccessToken, getRefreshToken, setTokens, clearTokens } = await import('../src/storage/token');
    await setTokens('new-access-token', 'new-refresh-token');
    await clearTokens();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('padosipro.auth.access-token');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('padosipro.auth.refresh-token');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('padosipro.auth.refresh-attempt-id');
    await expect(getAccessToken()).resolves.toBe(null);
    await expect(getRefreshToken()).resolves.toBe(null);
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
