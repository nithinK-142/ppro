import { beforeEach, describe, expect, it, vi } from 'vitest';
import { secureStore } from './setup';

describe('token storage', () => {
  beforeEach(() => vi.resetModules());

  it('hydrates token once and caches it', async () => {
    secureStore.getItemAsync.mockResolvedValue('saved-token');
    const { getToken } = await import('../src/storage/token');
    await expect(getToken()).resolves.toBe('saved-token');
    await expect(getToken()).resolves.toBe('saved-token');
    expect(secureStore.getItemAsync).toHaveBeenCalledOnce();
  });

  it('persists and updates the cached token', async () => {
    const { getToken, setToken } = await import('../src/storage/token');
    await setToken('new-token');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('padosipro.auth.token', 'new-token');
    await expect(getToken()).resolves.toBe('new-token');
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('surfaces secure storage read failures', async () => {
    secureStore.getItemAsync.mockRejectedValueOnce(new Error('storage unavailable'));
    const { getToken } = await import('../src/storage/token');
    await expect(getToken()).rejects.toThrow('storage unavailable');
  });

  it('clears the persisted and cached token', async () => {
    const { getToken, setToken, clearToken } = await import('../src/storage/token');
    await setToken('new-token');
    await clearToken();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('padosipro.auth.token');
    expect(await getToken()).toBe(null);
    expect(secureStore.getItemAsync).toHaveBeenCalledOnce();
  });
});
