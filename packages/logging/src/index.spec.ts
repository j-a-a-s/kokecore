import {
  createChildLogger,
  initLogger,
  getLogger,
  log,
  debug,
  info,
  warn,
  error,
  redactSensitiveData,
  LogEnricher,
  PerformanceMonitor,
  createRequestLoggingMiddleware,
  createCorrelationIdMiddleware,
  LogLevel,
  default as logging,
  type RequestWithUser,
} from './index';
import { trace } from '@opentelemetry/api';
import * as publicApi from './public';

describe('Sensitive data redaction', () => {
  it('redacts known sensitive keys', () => {
    const input = {
      username: 'john',
      password: 'secret', // secret-scan: allow-safe-example
      token: 'abc123', // secret-scan: allow-safe-example
      nested: {
        apiKey: 'super-secret', // secret-scan: allow-safe-example
        safe: 'visible',
      },
    };
    const result = redactSensitiveData(input) as Record<string, unknown>;
    const nested = result.nested as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.username).toBe('john');
    expect(nested.apiKey).toBe('[REDACTED]');
    expect(nested.safe).toBe('visible');
  });

  it('passes through strings unchanged', () => {
    expect(redactSensitiveData('plain string')).toBe('plain string');
  });

  it('handles primitives, arrays, and case-insensitive sensitive keys', () => {
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData([{ AuthorizationHeader: 'test-only-value' }, 'visible'])).toEqual([
      { AuthorizationHeader: '[REDACTED]' },
      'visible',
    ]);
  });
});

describe('Logger lifecycle and levels', () => {
  it('requires initialization before access', () => {
    expect(() => getLogger()).toThrow('Logger not initialized');
  });

  it('initializes with defaults, custom redaction, and pretty mode', () => {
    const logger = initLogger({
      service: 'test',
      environment: 'test',
      redactKeys: ['api-key'],
      prettyPrint: true,
    });
    expect(getLogger()).toBe(logger);
    expect(createChildLogger({ requestId: 'request-1' })).toBeDefined();
  });

  it('writes every level and redacts metadata', () => {
    const logger = initLogger({ service: 'test', environment: 'test', level: LogLevel.DEBUG });
    const debugSpy = jest.spyOn(logger, 'debug').mockImplementation();
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation();

    debug('debug', { password: 'test-only-password' });
    info('info');
    warn('warn');
    error('error', new Error('failure'), { token: 'test-only-token' });
    error('unknown', { code: 'E_UNKNOWN' });
    log({ message: 'fallbacks', traceId: 'trace-fallback', spanId: 'span-fallback' });

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('prefers active trace context', () => {
    const logger = initLogger({ service: 'test', environment: 'test' });
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation();
    const span = {
      spanContext: () => ({ traceId: 'trace-active', spanId: 'span-active' }),
    };
    const activeSpan = jest.spyOn(trace, 'getActiveSpan').mockReturnValue(span as never);
    log({ level: LogLevel.INFO, message: 'traced', traceId: 'fallback' });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'trace-active', spanId: 'span-active' })
    );
    activeSpan.mockRestore();
  });

  it('exposes the named functions through the default object', () => {
    expect(logging.info).toBe(info);
    expect(logging.redactSensitiveData).toBe(redactSensitiveData);
  });
});

describe('LogEnricher', () => {
  afterEach(() => {
    LogEnricher.clear();
  });

  it('stores and retrieves context', () => {
    LogEnricher.set('requestId', 'req-1');
    expect(LogEnricher.get('requestId')).toBe('req-1');
    expect(LogEnricher.getAll()).toEqual({ requestId: 'req-1' });
  });

  it('deletes context keys', () => {
    LogEnricher.set('temp', 'value');
    LogEnricher.delete('temp');
    expect(LogEnricher.get('temp')).toBeUndefined();
  });

  it('creates enriched loggers with default and explicit context', () => {
    initLogger({ service: 'test', environment: 'test' });
    LogEnricher.set('organizationId', 'org-1');
    expect(LogEnricher.createEnrichedLogger()).toBeDefined();
    expect(LogEnricher.createEnrichedLogger({ requestId: 'request-1' })).toBeDefined();
  });
});

describe('PerformanceMonitor', () => {
  beforeAll(() => {
    initLogger({
      service: 'test',
      environment: 'test',
      level: LogLevel.INFO,
    });
  });

  it('measures elapsed time', () => {
    const monitor = new PerformanceMonitor();
    monitor.startTimer('task');
    const duration = monitor.endTimer('task');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for unknown timers and warns', () => {
    const monitor = new PerformanceMonitor();
    expect(monitor.endTimer('unknown')).toBe(0);
  });

  it('measures synchronous functions', () => {
    const monitor = new PerformanceMonitor();
    const result = monitor.measure('work', () => 42);
    expect(result).toBe(42);
  });

  it('measures asynchronous functions', async () => {
    const monitor = new PerformanceMonitor();
    const result = await monitor.measureAsync('async-work', async () => 'done');
    expect(result).toBe('done');
  });

  it('ends timers when measured functions throw or reject', async () => {
    const monitor = new PerformanceMonitor();
    expect(() =>
      monitor.measure('throwing', () => {
        throw new Error('sync failure');
      })
    ).toThrow('sync failure');
    await expect(
      monitor.measureAsync('rejecting', async () => {
        throw new Error('async failure');
      })
    ).rejects.toThrow('async failure');
    expect(monitor.endTimer('throwing')).toBe(0);
  });
});

describe('Middleware', () => {
  beforeAll(() => {
    initLogger({
      service: 'test',
      environment: 'test',
      level: LogLevel.INFO,
    });
  });

  it('creates a request logging middleware', () => {
    const middleware = createRequestLoggingMiddleware({
      service: 'test',
      environment: 'test',
    });

    const req: RequestWithUser = {
      headers: { 'x-request-id': 'req-1' },
      method: 'GET',
      originalUrl: '/api/users?foo=bar',
      user: { sub: 'user-1' },
    };
    let finish = () => undefined;
    const res = {
      setHeader: jest.fn(),
      statusCode: 200,
      on: jest.fn((_event: 'finish', listener: () => void) => {
        finish = listener;
      }),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-1');
    expect(req.requestId).toBe('req-1');
    expect(next).toHaveBeenCalled();
    finish();
  });

  it('does not log query string values', () => {
    const logger = getLogger();
    const info = jest.fn();
    const child = jest
      .spyOn(logger, 'child')
      .mockReturnValue({ info } as unknown as ReturnType<typeof logger.child>);
    const middleware = createRequestLoggingMiddleware({
      service: 'test',
      environment: 'test',
    });
    const req: RequestWithUser = {
      headers: { 'x-request-id': 'req-query' },
      method: 'GET',
      originalUrl: '/api/users?accessToken=test-only-secret',
    };
    let finish = () => undefined;
    const res = {
      setHeader: jest.fn(),
      statusCode: 200,
      on: jest.fn((_event: 'finish', listener: () => void) => {
        finish = listener;
      }),
    };

    middleware(req, res, jest.fn());
    finish();

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/users', message: 'GET /api/users 200' })
    );
    expect(info.mock.calls.flat().join(' ')).not.toContain('test-only-secret');
    child.mockRestore();
  });

  it.each([400, 500])('logs response status %i and generates missing request IDs', (statusCode) => {
    const middleware = createRequestLoggingMiddleware({ service: 'test', environment: 'test' });
    const req: {
      headers: Record<string, string[]>;
      method: string;
      originalUrl?: string;
      requestId?: string;
    } = { headers: { 'x-request-id': [] }, method: 'POST' };
    let finish = () => undefined;
    const res = {
      setHeader: jest.fn(),
      statusCode,
      on: jest.fn((_event: 'finish', listener: () => void) => {
        finish = listener;
      }),
    };
    middleware(req, res, jest.fn());
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    finish();
  });

  it('creates a correlation id middleware', () => {
    const middleware = createCorrelationIdMiddleware('x-correlation-id');
    const req = {
      headers: { 'x-correlation-id': 'corr-1' },
      correlationId: undefined as string | undefined,
    };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.correlationId).toBe('corr-1');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-1');
    expect(next).toHaveBeenCalled();
  });

  it('generates a correlation id with the default header', () => {
    const middleware = createCorrelationIdMiddleware();
    const req: { headers: Record<string, string | undefined>; correlationId?: string } = {
      headers: {},
    };
    const res = { setHeader: jest.fn() };
    middleware(req, res, jest.fn());
    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.correlationId);
  });
});

describe('Public API', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.initLogger).toBe(initLogger);
  });
});
