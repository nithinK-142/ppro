import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import env from '../config/env.ts';

type AttributeValue = string | number | boolean;
type Attributes = Record<string, AttributeValue>;
type SpanKind = 2 | 3;
type SpanStatus = 0 | 1 | 2;

type Span = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixNano: string;
  startMonotonic: bigint;
  endTimeUnixNano?: string;
  attributes: Attributes;
  status: SpanStatus;
  statusMessage?: string;
};

type SpanContext = { traceId: string; spanId: string };

const activeSpan = new AsyncLocalStorage<SpanContext>();
const pendingSpans: Span[] = [];
const endpoint = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
let flushInProgress: Promise<void> | undefined;

function newId(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function createSpan(name: string, kind: SpanKind, attributes: Attributes, parent?: SpanContext): Span {
  return {
    traceId: parent?.traceId ?? newId(16),
    spanId: newId(8),
    ...(parent ? { parentSpanId: parent.spanId } : {}),
    name,
    kind,
    startTimeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
    startMonotonic: process.hrtime.bigint(),
    attributes,
    status: 0
  };
}

export function startHttpSpan(method: string): Span | undefined {
  if (!endpoint) return undefined;
  return createSpan(`${method}`, 2, { 'http.request.method': method }, activeSpan.getStore());
}

export function startDatabaseSpan(command: string): Span | undefined {
  const parent = activeSpan.getStore();
  if (!endpoint || !parent) return undefined;
  return createSpan(`postgresql ${command}`, 3, {
    'db.system': 'postgresql',
    'db.operation.name': command.toUpperCase()
  }, parent);
}

export function runInSpanContext<T>(span: Span | undefined, callback: () => T): T {
  if (!span) return callback();
  return activeSpan.run({ traceId: span.traceId, spanId: span.spanId }, callback);
}

export function runInParentSpanContext<T>(span: Span | undefined, callback: () => T): T {
  if (!span?.parentSpanId) return callback();
  return activeSpan.run({ traceId: span.traceId, spanId: span.parentSpanId }, callback);
}

export function traceIdOf(span: Span | undefined): string | undefined {
  return span?.traceId;
}

export function finishSpan(span: Span | undefined, attributes: Attributes = {}, failed = false): void {
  if (!span) return;
  Object.assign(span.attributes, attributes);
  span.endTimeUnixNano = String(BigInt(span.startTimeUnixNano) + (process.hrtime.bigint() - span.startMonotonic));
  span.status = failed ? 2 : 1;
  if (failed) span.statusMessage = 'operation failed';
  if (!endpoint) return;

  pendingSpans.push(span);
  if (pendingSpans.length > 2048) pendingSpans.shift();
  if (pendingSpans.length >= 128) void flushTraces();
}

function otelAttributes(attributes: Attributes) {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: typeof value === 'string'
      ? { stringValue: value }
      : typeof value === 'boolean'
        ? { boolValue: value }
        : Number.isInteger(value)
          ? { intValue: String(value) }
          : { doubleValue: value }
  }));
}

function otlpSpan(span: Span) {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name,
    kind: span.kind,
    startTimeUnixNano: span.startTimeUnixNano,
    endTimeUnixNano: span.endTimeUnixNano ?? span.startTimeUnixNano,
    attributes: otelAttributes(span.attributes),
    status: { code: span.status, ...(span.statusMessage ? { message: span.statusMessage } : {}) }
  };
}

function exportHeaders(): Record<string, string> {
  const raw = env.OTEL_EXPORTER_OTLP_HEADERS;
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const entry of raw.split(',')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const key = decodeURIComponent(entry.slice(0, separator).trim());
    const value = decodeURIComponent(entry.slice(separator + 1).trim());
    if (key) headers[key] = value;
  }
  return headers;
}

export async function flushTraces(): Promise<void> {
  if (!endpoint || pendingSpans.length === 0) return;
  if (flushInProgress) return flushInProgress;

  const batch = pendingSpans.splice(0, 128);
  flushInProgress = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...exportHeaders() },
        body: JSON.stringify({
          resourceSpans: [{
            resource: { attributes: [{ key: 'service.name', value: { stringValue: env.OTEL_SERVICE_NAME } }] },
            scopeSpans: [{ scope: { name: 'padosipro' }, spans: batch.map(otlpSpan) }]
          }]
        }),
        signal: AbortSignal.timeout(2000)
      });
      if (!response.ok) {
        pendingSpans.unshift(...batch);
        console.warn(`Trace export failed with HTTP ${response.status}.`);
      }
    } catch {
      pendingSpans.unshift(...batch);
      console.warn('Trace export failed; spans will be retried.');
    } finally {
      if (pendingSpans.length > 2048) pendingSpans.splice(0, pendingSpans.length - 2048);
      flushInProgress = undefined;
    }
  })();
  return flushInProgress;
}

if (endpoint) {
  const timer = setInterval(() => void flushTraces(), 5000);
  timer.unref();
}
