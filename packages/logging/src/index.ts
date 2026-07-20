/**
 * @kokecore/logging
 *
 * Enterprise-grade logging with:
 * - Structured JSON logging with Pino
 * - OpenTelemetry distributed tracing
 * - Sensitive data redaction
 * - Request ID tracking
 * - Log level management
 * - Performance monitoring
 */

import pino from 'pino';
import { trace, context } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  traceId?: string;
  spanId?: string;
  message: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  service: string;
  environment: string;
  level?: LogLevel;
  redactKeys?: string[];
  prettyPrint?: boolean;
  enableTracing?: boolean;
}

/**
 * Sensitive keys to redact by default
 */
const DEFAULT_REDACT_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'secret',
  'refreshtoken',
  'accesstoken',
  'apikey',
  'api_key',
  'private_key',
  'secret_key',
  'credit_card',
  'ssn',
  'social_security_number',
];

/**
 * Check if a key should be redacted
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return DEFAULT_REDACT_KEYS.some((sensitive) => lowerKey.includes(sensitive));
}

/**
 * Redact sensitive data from an object
 */
export function redactSensitiveData(value: unknown): unknown {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveData(entry));
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? '[REDACTED]' : redactSensitiveData(entry);
  }
  return result;
}

/**
 * Get current OpenTelemetry context
 */
function getTraceContext(): { traceId?: string; spanId?: string } | undefined {
  const currentSpan = trace.getActiveSpan();
  if (!currentSpan) return undefined;

  const spanContext = currentSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

/**
 * Pino logger instance
 */
let pinoLogger: pino.Logger | null = null;

/**
 * Initialize the logger
 */
export function initLogger(config: LoggerConfig): pino.Logger {
  const redact = config.redactKeys || DEFAULT_REDACT_KEYS;

  const redactPaths = redact.flatMap((key) => {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      return [key, `*.${key}`];
    }
    return [`["${key}"]`, `*["${key}"]`];
  });

  pinoLogger = pino({
    level: config.level || LogLevel.INFO,
    formatters: {
      level: (label) => ({ level: label }),
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    redact: {
      paths: redactPaths,
      remove: true,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
    base: {
      service: config.service,
      environment: config.environment,
    },
  });

  if (config.prettyPrint) {
    // Note: In production, use a transport instead
    // This is for development only
    return pinoLogger;
  }

  return pinoLogger;
}

/**
 * Get the logger instance
 */
export function getLogger(): pino.Logger {
  if (!pinoLogger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return pinoLogger;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  const logger = getLogger();
  return logger.child(context);
}

/**
 * Log entry with context
 */
export function log(entry: Partial<LogEntry>): void {
  const logger = getLogger();
  const traceContext = getTraceContext();

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: entry.level || LogLevel.INFO,
    service: entry.service || 'unknown',
    environment: entry.environment || 'unknown',
    requestId: entry.requestId,
    userId: entry.userId,
    organizationId: entry.organizationId,
    traceId: traceContext?.traceId || entry.traceId,
    spanId: traceContext?.spanId || entry.spanId,
    message: entry.message || '',
    error: entry.error,
    metadata: entry.metadata
      ? (redactSensitiveData(entry.metadata) as Record<string, unknown>)
      : undefined,
  };

  logger[logEntry.level](logEntry);
}

/**
 * Debug level log
 */
export function debug(message: string, metadata?: Record<string, unknown>): void {
  log({
    level: LogLevel.DEBUG,
    message,
    metadata,
  });
}

/**
 * Info level log
 */
export function info(message: string, metadata?: Record<string, unknown>): void {
  log({
    level: LogLevel.INFO,
    message,
    metadata,
  });
}

/**
 * Warn level log
 */
export function warn(message: string, metadata?: Record<string, unknown>): void {
  log({
    level: LogLevel.WARN,
    message,
    metadata,
  });
}

/**
 * Error level log
 */
export function error(
  message: string,
  error?: Error | unknown,
  metadata?: Record<string, unknown>
): void {
  const errorObj =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : error;

  log({
    level: LogLevel.ERROR,
    message,
    error: errorObj as LogEntry['error'],
    metadata,
  });
}

/**
 * Request logging middleware for Express
 */
export interface RequestLoggingConfig {
  service: string;
  environment: string;
  logLevel?: LogLevel;
  redactHeaders?: string[];
  enableTracing?: boolean;
}

export interface RequestWithUser {
  user?: { sub?: string };
  requestId?: string;
  organizationId?: string;
  headers?: Record<string, string | string[]>;
  method?: string;
  originalUrl?: string;
}

interface ResponseWithEvents {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
}

interface CorrelationRequest {
  headers: Record<string, string | undefined>;
  correlationId?: string;
}

export function createRequestLoggingMiddleware(config: RequestLoggingConfig) {
  const REQUEST_ID_HEADER = 'x-request-id';

  return (req: RequestWithUser, res: ResponseWithEvents, next: () => void) => {
    const startedAt = process.hrtime.bigint();
    const requestId = firstHeaderValue(req.headers?.[REQUEST_ID_HEADER]) || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const logger = createChildLogger({
      requestId,
      userId: req.user?.sub,
      organizationId: req.organizationId,
    });

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statusCode = res.statusCode;
      const level =
        statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

      logger[level]({
        method: req.method,
        path: req.originalUrl?.split('?')[0] || req.originalUrl,
        statusCode,
        durationMs: Math.round(durationMs),
        message: `${req.method} ${req.originalUrl} ${statusCode}`,
      });
    });

    next();
  };
}

/**
 * Correlation ID middleware for distributed tracing
 */
export function createCorrelationIdMiddleware(headerName = 'x-correlation-id') {
  return (
    req: CorrelationRequest,
    res: Pick<ResponseWithEvents, 'setHeader'>,
    next: () => void
  ) => {
    const correlationId = req.headers[headerName] || randomUUID();
    req.correlationId = correlationId;
    res.setHeader(headerName, correlationId);

    // Set as OpenTelemetry baggage if available
    const activeContext = context.active();
    if (activeContext) {
      // You could set baggage here if needed
    }

    next();
  };
}

/**
 * Helper to get first header value
 */
function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private timers: Map<string, bigint> = new Map();

  startTimer(name: string): void {
    this.timers.set(name, process.hrtime.bigint());
  }

  endTimer(name: string): number {
    const startedAt = this.timers.get(name);
    if (!startedAt) {
      warn(`Timer ${name} was not started`);
      return 0;
    }
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    this.timers.delete(name);
    return durationMs;
  }

  measure<T>(name: string, fn: () => T): T {
    this.startTimer(name);
    try {
      return fn();
    } finally {
      const duration = this.endTimer(name);
      debug(`Performance: ${name} took ${duration}ms`);
    }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(name);
    try {
      return await fn();
    } finally {
      const duration = this.endTimer(name);
      debug(`Performance: ${name} took ${duration}ms`);
    }
  }
}

/**
 * Log enrichment utility
 */
export class LogEnricher {
  private static context: Map<string, unknown> = new Map();

  static set(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  static get(key: string): unknown {
    return this.context.get(key);
  }

  static delete(key: string): void {
    this.context.delete(key);
  }

  static clear(): void {
    this.context.clear();
  }

  static getAll(): Record<string, unknown> {
    return Object.fromEntries(this.context);
  }

  static createEnrichedLogger(baseContext: Record<string, unknown> = {}): pino.Logger {
    const enrichedContext = {
      ...baseContext,
      ...this.getAll(),
    };
    return createChildLogger(enrichedContext);
  }
}

/**
 * Export all logging utilities
 */
export default {
  initLogger,
  getLogger,
  createChildLogger,
  log,
  debug,
  info,
  warn,
  error,
  redactSensitiveData,
  createRequestLoggingMiddleware,
  createCorrelationIdMiddleware,
  PerformanceMonitor,
  LogEnricher,
};
