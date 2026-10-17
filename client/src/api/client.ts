import type { PaginatedResponse, Pagination } from '../types';
import { clearTokens, getAccessToken, getRefreshToken, getRefreshAttemptId, setTokens } from '../storage/token';
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

type ResponseBody<T> = { data?: T; pagination?: Pagination } & ErrorBody;
type TokenPair = { accessToken: string; refreshToken: string };

let refreshInFlight: Promise<string> | null = null;
const authExpiryListeners = new Set<() => void>();

function notifyAuthExpired() {
  for (const listener of authExpiryListeners) listener();
}

async function expireLocalSession() {
  try {
    await clearTokens();
  } finally {
    notifyAuthExpired();
  }
}

export function subscribeToAuthExpiry(listener: () => void) {
  authExpiryListeners.add(listener);
  return () => {
    authExpiryListeners.delete(listener);
  };
}

function errorFromResponse<T>(body: ResponseBody<T> | null, response: Response, requestId: string) {
  const error = body?.error;
  return new ApiError(
    error?.message || 'Request failed. Try again.',
    error?.code || 'REQUEST_FAILED',
    response.status,
    { ...(error?.details || {}), requestId }
  );
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await expireLocalSession();
        throw new ApiError('Session expired. Sign in again.', 'INVALID_REFRESH_TOKEN', 401);
      }

      const refreshAttemptId = await getRefreshAttemptId();
      if (!refreshAttemptId) {
        await expireLocalSession();
        throw new ApiError('Session expired. Sign in again.', 'INVALID_REFRESH_TOKEN', 401);
      }

      const requestId = createRequestId();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Request-Id': requestId
          },
          body: JSON.stringify({ refreshToken, refreshAttemptId }),
          signal: controller.signal
        });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        const timedOut = err.name === 'AbortError';
        logger.error(timedOut ? 'auth.refresh_timeout' : 'auth.refresh_network_error', {
          requestId,
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

      const body = await response.json().catch(() => null) as ResponseBody<TokenPair> | null;
      const responseRequestId = response.headers.get('X-Request-Id') || requestId;
      if (!response.ok) {
        logger.warn('auth.refresh_failed', {
          requestId: responseRequestId,
          status: response.status,
          code: body?.error?.code || 'REQUEST_FAILED'
        });
        if (response.status === 401) {
          await expireLocalSession();
        }
        throw errorFromResponse(body, response, responseRequestId);
      }

      const tokens = body?.data;
      if (!tokens?.accessToken || !tokens.refreshToken) {
        // The server may have rotated the token before the response was lost or truncated.
        // Keep the old refresh token and attempt ID so the same rotation can be recovered.
        throw new ApiError('Invalid token refresh response. Retry the request.', 'INVALID_REFRESH_RESPONSE', 502, { requestId: responseRequestId });
      }

      try {
        await setTokens(tokens.accessToken, tokens.refreshToken);
      } catch {
        // Keep the attempt ID. If the response or storage write was interrupted,
        // the server can return the same rotation on the next refresh request.
        throw new ApiError('Could not save the renewed session. Retry the request.', 'TOKEN_STORAGE_FAILED', 0, { requestId: responseRequestId });
      }
      logger.info('auth.tokens_rotated', { requestId: responseRequestId });
      return tokens.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function requestInternal<T>(
  path: string,
  options: RequestInit,
  allowRefresh: boolean,
  includePagination = false
): Promise<T> {
  const token = await getAccessToken();
  const requestId = createRequestId();
  const method = (options.method ?? 'GET').toUpperCase();
  const startedAt = Date.now();
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Request-Id', requestId);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else headers.delete('Authorization');

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
  const body = await response.json().catch(() => null) as ResponseBody<unknown> | null;
  const durationMs = Date.now() - startedAt;

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/v1/auth/')) {
      if (allowRefresh) {
        const currentToken = await getAccessToken();
        if (currentToken && currentToken !== token) {
          return requestInternal<T>(path, options, false, includePagination);
        }

        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          await refreshAccessToken();
          return requestInternal<T>(path, options, false, includePagination);
        }
      }

      await expireLocalSession();
    }

    logger.warn('api.response_error', {
      method,
      path,
      requestId: responseRequestId,
      status: response.status,
      durationMs,
      code: body?.error?.code || 'REQUEST_FAILED'
    });

    throw errorFromResponse(body, response, responseRequestId);
  }

  logger.debug('api.response', {
    method,
    path,
    requestId: responseRequestId,
    status: response.status,
    durationMs
  });

  return (includePagination
    ? { data: body?.data, pagination: body?.pagination }
    : body?.data) as T;
}

export function request<T>(path: string, options: RequestInit = {}) {
  return requestInternal<T>(path, options, true);
}

export function paginatedRequest<T>(path: string): Promise<PaginatedResponse<T>> {
  return requestInternal<PaginatedResponse<T>>(path, {}, true, true);
}

export function jsonRequest<T>(path: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) {
  return request<T>(path, {
    method,
    body: JSON.stringify(body)
  });
}
