import { getToken } from '../storage/token';
import { logger } from '../utils/logger';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 15_000;

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is required');
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

type ResponseBody<T> = { data?: T } & ErrorBody;

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const requestId = createRequestId();
  const method = (options.method ?? 'GET').toUpperCase();
  const startedAt = Date.now();
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Request-Id', requestId);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  logger.debug('api.request', { method, path, requestId });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const timedOut = err.name === 'AbortError';

    logger.error(timedOut ? 'api.timeout' : 'api.network_error', {
      method,
      path,
      requestId,
      durationMs: Date.now() - startedAt,
      message: err.message
    });

    throw new ApiError(
      timedOut ? 'Request timed out. Check your connection and try again.' : 'Network error. Check your connection and try again.',
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      0,
      { requestId }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const responseRequestId = response.headers.get('X-Request-Id') || requestId;
  const body = await response.json().catch(() => null) as ResponseBody<T> | null;
  const durationMs = Date.now() - startedAt;

  if (!response.ok) {
    const error = body?.error;
    logger.warn('api.response_error', {
      method,
      path,
      requestId: responseRequestId,
      status: response.status,
      durationMs,
      code: error?.code || 'REQUEST_FAILED'
    });

    throw new ApiError(
      error?.message || 'Request failed. Try again.',
      error?.code || 'REQUEST_FAILED',
      response.status,
      { ...(error?.details || {}), requestId: responseRequestId }
    );
  }

  logger.debug('api.response', {
    method,
    path,
    requestId: responseRequestId,
    status: response.status,
    durationMs
  });

  return body?.data as T;
}

export function jsonRequest<T>(path: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) {
  return request<T>(path, {
    method,
    body: JSON.stringify(body)
  });
}
