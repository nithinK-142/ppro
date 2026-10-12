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

  it('persists both tokens and updates their caches', async () => {
    const { getAccessToken, getRefreshToken, setTokens } = await import('../src/storage/token');
    await setTokens('new-access-token', 'new-refresh-token');
    expect(secureStore.setItemAsync).toHaveBeenNthCalledWith(1, 'padosipro.auth.refresh-token', 'new-refresh-token');
    expect(secureStore.setItemAsync).toHaveBeenNthCalledWith(2, 'padosipro.auth.access-token', 'new-access-token');
    await expect(getAccessToken()).resolves.toBe('new-access-token');
    await expect(getRefreshToken()).resolves.toBe('new-refresh-token');
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
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
    await expect(getAccessToken()).resolves.toBe(null);
    await expect(getRefreshToken()).resolves.toBe(null);
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
