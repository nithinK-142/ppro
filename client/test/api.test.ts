import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, jsonRequest, request } from '../src/api/client';

const getToken = vi.hoisted(() => vi.fn(async () => 'token-123'));
const logger = vi.hoisted(() => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../src/storage/token', () => ({ getToken }));
vi.mock('../src/utils/logger', () => ({ logger }));

describe('API client', () => {
  beforeEach(() => {
    getToken.mockResolvedValue('token-123');
    vi.clearAllMocks();
  });

  it('omits authorization when no token exists', async () => {
    getToken.mockResolvedValue(null);
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
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));

    const promise = request('/slow');
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(promise).rejects.toMatchObject({ code: 'TIMEOUT', status: 0 });
    vi.useRealTimers();
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
