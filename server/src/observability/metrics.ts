import { monitorEventLoopDelay } from 'node:perf_hooks';
import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import env from '../config/env.ts';

type Labels = Record<string, string>;
type HistogramSeries = {
  labels: Labels;
  count: number;
  sum: number;
  buckets: number[];
};

const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const httpRequests = new Map<string, { labels: Labels; value: number }>();
const httpServerErrors = new Map<string, { labels: Labels; value: number }>();
const databaseErrors = new Map<string, { labels: Labels; value: number }>();
const httpDurations = new Map<string, HistogramSeries>();
const databaseDurations = new Map<string, HistogramSeries>();
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
if (env.OBSERVABILITY_ENABLED) eventLoopDelay.enable();
let requestsInFlight = 0;

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function labelKey(labels: Labels): string {
  return JSON.stringify(Object.entries(labels).sort(([left], [right]) => left.localeCompare(right)));
}

function incrementCounter(series: Map<string, { labels: Labels; value: number }>, labels: Labels): void {
  const key = labelKey(labels);
  const current = series.get(key);
  if (current) current.value += 1;
  else series.set(key, { labels, value: 1 });
}

function observeHistogram(series: Map<string, HistogramSeries>, labels: Labels, seconds: number): void {
  const key = labelKey(labels);
  let current = series.get(key);
  if (!current) {
    current = { labels, count: 0, sum: 0, buckets: durationBuckets.map(() => 0) };
    series.set(key, current);
  }

  current.count += 1;
  current.sum += seconds;
  durationBuckets.forEach((bound, index) => {
    if (seconds <= bound) current.buckets[index] += 1;
  });
}

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`;
}

function addSample(lines: string[], name: string, value: number, labels: Labels = {}): void {
  if (!Number.isFinite(value)) return;
  lines.push(`${name}${formatLabels(labels)} ${value}`);
}

function addHeader(lines: string[], name: string, help: string, type: 'counter' | 'gauge' | 'histogram'): void {
  lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
}

function addCounter(lines: string[], name: string, help: string, series: Map<string, { labels: Labels; value: number }>): void {
  addHeader(lines, name, help, 'counter');
  for (const item of series.values()) addSample(lines, name, item.value, item.labels);
}

function addHistogram(lines: string[], name: string, help: string, series: Map<string, HistogramSeries>): void {
  addHeader(lines, name, help, 'histogram');
  for (const item of series.values()) {
    durationBuckets.forEach((bound, index) => {
      addSample(lines, `${name}_bucket`, item.buckets[index], { ...item.labels, le: String(bound) });
    });
    addSample(lines, `${name}_bucket`, item.count, { ...item.labels, le: '+Inf' });
    addSample(lines, `${name}_sum`, item.sum, item.labels);
    addSample(lines, `${name}_count`, item.count, item.labels);
  }
}

function normalizedMethod(method: string): string {
  const known = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  return known.has(method) ? method : 'OTHER';
}

export function normalizeDatabaseCommand(query: unknown): string {
  const statement = typeof query === 'string'
    ? query
    : query && typeof query === 'object' && 'text' in query && typeof query.text === 'string'
      ? query.text
      : '';
  const command = statement.trim().match(/^([a-z]+)/i)?.[1]?.toUpperCase();
  const known = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE']);
  return command && known.has(command) ? command.toLowerCase() : 'other';
}

export function observeDatabaseQuery(command: string, seconds: number, failed: boolean): void {
  const labels = { command };
  observeHistogram(databaseDurations, labels, seconds);
  if (failed) incrementCounter(databaseErrors, labels);
}

export function recordHttpRequest(method: string, route: string, statusCode: number, seconds: number): void {
  const labels = {
    method: normalizedMethod(method),
    route,
    status_code: String(statusCode)
  };
  incrementCounter(httpRequests, labels);
  if (statusCode >= 500) incrementCounter(httpServerErrors, labels);
  observeHistogram(httpDurations, labels, seconds);
}

export function beginRequest(): void {
  requestsInFlight += 1;
}

export function endRequest(): void {
  requestsInFlight = Math.max(0, requestsInFlight - 1);
}

export function renderMetrics(): string {
  const lines: string[] = [];
  addCounter(lines, 'padosipro_http_requests_total', 'Total completed HTTP requests.', httpRequests);
  addHistogram(lines, 'padosipro_http_request_duration_seconds', 'HTTP request duration in seconds.', httpDurations);
  addCounter(lines, 'padosipro_http_server_errors_total', 'Total HTTP 5xx responses.', httpServerErrors);
  addHeader(lines, 'padosipro_http_requests_in_flight', 'HTTP requests currently being handled.', 'gauge');
  addSample(lines, 'padosipro_http_requests_in_flight', requestsInFlight);

  addHistogram(lines, 'padosipro_database_query_duration_seconds', 'PostgreSQL query duration in seconds.', databaseDurations);
  addCounter(lines, 'padosipro_database_query_errors_total', 'Failed PostgreSQL queries.', databaseErrors);

  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  addHeader(lines, 'padosipro_process_uptime_seconds', 'Process uptime in seconds.', 'gauge');
  addSample(lines, 'padosipro_process_uptime_seconds', process.uptime());
  addHeader(lines, 'padosipro_process_start_time_seconds', 'Process start time since unix epoch in seconds.', 'gauge');
  addSample(lines, 'padosipro_process_start_time_seconds', Date.now() / 1000 - process.uptime());
  addHeader(lines, 'padosipro_process_memory_bytes', 'Process memory usage in bytes.', 'gauge');
  addSample(lines, 'padosipro_process_memory_bytes', memory.rss, { type: 'rss' });
  addSample(lines, 'padosipro_process_memory_bytes', memory.heapTotal, { type: 'heap_total' });
  addSample(lines, 'padosipro_process_memory_bytes', memory.heapUsed, { type: 'heap_used' });
  addSample(lines, 'padosipro_process_memory_bytes', memory.external, { type: 'external' });
  addSample(lines, 'padosipro_process_memory_bytes', memory.arrayBuffers, { type: 'array_buffers' });
  addHeader(lines, 'padosipro_process_cpu_seconds_total', 'Total CPU time used by the process in seconds.', 'counter');
  addSample(lines, 'padosipro_process_cpu_seconds_total', cpu.user / 1_000_000, { type: 'user' });
  addSample(lines, 'padosipro_process_cpu_seconds_total', cpu.system / 1_000_000, { type: 'system' });

  addHeader(lines, 'padosipro_nodejs_eventloop_lag_seconds', 'Event-loop delay percentiles since the last scrape, in seconds.', 'gauge');
  for (const [quantile, percentile] of [['p50', 50], ['p95', 95], ['p99', 99]] as const) {
    const value = eventLoopDelay.percentile(percentile) / 1_000_000_000;
    addSample(lines, 'padosipro_nodejs_eventloop_lag_seconds', value, { quantile });
  }
  eventLoopDelay.reset();
  return `${lines.join('\n')}\n`;
}

function getBearerToken(req: Request): string | undefined {
  const value = req.header('authorization');
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export const metricsHandler: RequestHandler = (req, res) => {
  const expected = env.METRICS_TOKEN;
  if (!expected) {
    res.status(404).end();
    return;
  }

  const supplied = getBearerToken(req);
  if (!supplied) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).end();
    return;
  }

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.end(renderMetrics());
};
