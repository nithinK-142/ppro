import { getToken } from '../storage/token';
import { logger } from '../utils/logger';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is required');
}

export class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function request(path, options = {}) {
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
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  logger.debug('api.request', { method, path, requestId });

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    logger.error('api.network_error', {
      method,
      path,
      requestId,
      durationMs: Date.now() - startedAt,
      message: error?.message
    });
    throw new ApiError(
      'Network error. Check your connection and try again.',
      'NETWORK_ERROR',
      0,
      { requestId }
    );
  }

  const responseRequestId = response.headers.get('X-Request-Id') || requestId;
  const body = await response.json().catch(() => null);
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

  return body?.data;
}
