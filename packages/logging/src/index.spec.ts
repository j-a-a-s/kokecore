import {
  initLogger,
  redactSensitiveData,
  LogEnricher,
  PerformanceMonitor,
  createRequestLoggingMiddleware,
  createCorrelationIdMiddleware,
  LogLevel,
} from './index';

describe('Sensitive data redaction', () => {
  it('redacts known sensitive keys', () => {
    const input = {
      username: 'john',
      password: 'secret',
      token: 'abc123',
      nested: {
        apiKey: 'super-secret',
        safe: 'visible',
      },
    };
    const result = redactSensitiveData(input) as Record<string, any>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.username).toBe('john');
    expect(result.nested.apiKey).toBe('[REDACTED]');
    expect(result.nested.safe).toBe('visible');
  });

  it('passes through strings unchanged', () => {
    expect(redactSensitiveData('plain string')).toBe('plain string');
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

    const req: any = {
      headers: { 'x-request-id': 'req-1' },
      method: 'GET',
      originalUrl: '/api/users?foo=bar',
      user: { sub: 'user-1' },
    };
    const res: any = { setHeader: jest.fn(), statusCode: 200, on: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-1');
    expect(req.requestId).toBe('req-1');
    expect(next).toHaveBeenCalled();
  });

  it('creates a correlation id middleware', () => {
    const middleware = createCorrelationIdMiddleware('x-correlation-id');
    const req: any = { headers: { 'x-correlation-id': 'corr-1' } };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.correlationId).toBe('corr-1');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-1');
    expect(next).toHaveBeenCalled();
  });
});
