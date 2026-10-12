import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, jsonRequest, request, subscribeToAuthExpiry } from '../src/api/client';

const tokenApi = vi.hoisted(() => ({
  getAccessToken: vi.fn(async () => 'token-123' as string | null),
  getRefreshToken: vi.fn(async () => null as string | null),
  setTokens: vi.fn(async (_accessToken: string, _refreshToken: string) => undefined),
  clearTokens: vi.fn(async () => undefined)
}));
const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../src/storage/token', () => tokenApi);
vi.mock('../src/utils/logger', () => ({ logger }));

describe('API client', () => {
  let currentAccessToken: string | null;

  beforeEach(() => {
    vi.clearAllMocks();
    currentAccessToken = 'token-123';
    tokenApi.getAccessToken.mockImplementation(async () => currentAccessToken);
    tokenApi.getRefreshToken.mockResolvedValue(null);
    tokenApi.setTokens.mockImplementation(async (accessToken) => { currentAccessToken = accessToken; });
  });

  it('omits authorization when no token exists', async () => {
    tokenApi.getAccessToken.mockResolvedValue(null);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await request('/health');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.get('Authorization')).toBeNull();
  });

  it('sends auth and request-id headers and returns data', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { 'X-Request-Id': 'server-id' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.get('Authorization')).toBe('Bearer token-123');
    expect(options.headers.get('Accept')).toBe('application/json');
    expect(options.headers.get('X-Request-Id')).toMatch(/^[a-z0-9-]+$/);
  });

  it('refreshes and rotates tokens once after an expired access token', async () => {
    currentAccessToken = 'expired-access';
    tokenApi.getRefreshToken.mockResolvedValue('refresh-token-1');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INVALID_TOKEN', message: 'Expired' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { accessToken: 'access-token-2', refreshToken: 'refresh-token-2' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request<{ ok: boolean }>('/api/v1/profile')).resolves.toEqual({ ok: true });
    expect(tokenApi.setTokens).toHaveBeenCalledWith('access-token-2', 'refresh-token-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.get('Authorization')).toBe('Bearer access-token-2');
  });

  it('clears local session when the refresh token is rejected', async () => {
    currentAccessToken = 'expired-access-token';
    tokenApi.getRefreshToken.mockResolvedValue('refresh-token-1');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INVALID_TOKEN', message: 'Expired' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const onAuthExpired = vi.fn();
    const unsubscribe = subscribeToAuthExpiry(onAuthExpired);

    try {
      await expect(request('/api/v1/profile')).rejects.toMatchObject({ status: 401, code: 'INVALID_REFRESH_TOKEN' });
      expect(tokenApi.clearTokens).toHaveBeenCalledOnce();
      expect(onAuthExpired).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it('does not attempt refresh for failed login requests', async () => {
    tokenApi.getRefreshToken.mockResolvedValue('refresh-token-1');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } }), { status: 401 })));

    await expect(jsonRequest('/api/v1/auth/login', 'POST', { email: 'a@b.com', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(tokenApi.getRefreshToken).not.toHaveBeenCalled();
  });

  it('converts server errors into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { code: 'BAD_REQUEST', message: 'Nope', details: { field: 'email' } }
    }), { status: 400, headers: { 'X-Request-Id': 'req-1' } })));

    await expect(request('/bad')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'BAD_REQUEST',
      status: 400,
      message: 'Nope'
    });
  });

  it('converts network failures into NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket failed'); }));
    await expect(request('/bad')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('converts aborts into TIMEOUT', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })));

      const rejection = expect(request('/slow')).rejects.toMatchObject({ code: 'TIMEOUT', status: 0 });
      await vi.advanceTimersByTimeAsync(15_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('jsonRequest serializes payloads', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { saved: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(jsonRequest<{ saved: boolean }>('/save', 'PATCH', { name: 'N' })).resolves.toEqual({ saved: true });
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ name: 'N' }));
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('exports ApiError with useful fields', () => {
    const error = new ApiError('bad', 'BAD', 422, { field: 'x' });
    expect(error).toMatchObject({ name: 'ApiError', message: 'bad', code: 'BAD', status: 422, details: { field: 'x' } });
  });
});
