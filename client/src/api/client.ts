import { getToken } from '../storage/token';
import { logger } from '../utils/logger';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 15_000;

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is required');
}

export class ApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = RequestInit;

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getToken();
  const requestId = createRequestId();
  const method = String(options.method || 'GET').toUpperCase();
  const url = `${apiUrl}${path}`;
  const startedAt = Date.now();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...(options.headers || {})
  } as Record<string, string>;

  if (token) headers.Authorization = `Bearer ${token}`;

  logger.debug('api.request', { method, path, requestId });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
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
  const body = await response.json().catch(() => null) as { data?: T } & ErrorBody | null;
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
