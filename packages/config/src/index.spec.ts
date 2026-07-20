import {
  readApiConfig,
  readAuthConfig,
  readOrganizationConfig,
  readPasswordRecoveryConfig,
  readProductIntegrationsConfig,
  readRedisConfig,
  readRuntimeConfig,
} from './index';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/kokecore',
  APP_VERSION: '1.0.0',
  COMMIT_SHA: 'abc123',
  BUILD_TIME: '2024-01-01T00:00:00Z',
  CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
};

const authEnv = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'this-is-a-very-long-secret-for-jwt-access-tokens-32+',
  JWT_REFRESH_SECRET: 'this-is-a-very-long-secret-for-jwt-refresh-tokens-32+',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:4200',
};

describe('readApiConfig', () => {
  it('loads API configuration with defaults', () => {
    const config = readApiConfig(baseEnv);
    expect(config.nodeEnv).toBe('test');
    expect(config.port).toBe(3000);
    expect(config.databaseUrl).toBe('postgresql://localhost:5432/kokecore');
    expect(config.logLevel).toBe('debug');
    expect(config.corsAllowedOrigins).toEqual(['http://localhost:4200']);
  });

  it('parses production-safe settings', () => {
    const config = readApiConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_SSL: 'true',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
    });
    expect(config.port).toBe(8080);
    expect(config.databaseSsl).toBe(true);
    expect(config.swaggerEnabled).toBe(false);
  });

  it('throws for invalid port', () => {
    expect(() => readApiConfig({ ...baseEnv, PORT: 'invalid' })).toThrow(
      'PORT must be a positive integer'
    );
  });

  it('throws for localhost origins in production', () => {
    expect(() =>
      readApiConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
      })
    ).toThrow('localhost origins in production');
  });
});

describe('readAuthConfig', () => {
  it('loads auth configuration', () => {
    const config = readAuthConfig(authEnv);
    expect(config.jwtAccessExpiresSeconds).toBe(900);
    expect(config.jwtRefreshExpiresSeconds).toBe(2592000);
    expect(config.cookieSecure).toBe(false);
  });

  it('throws for short JWT secrets', () => {
    expect(() =>
      readAuthConfig({
        ...authEnv,
        JWT_ACCESS_SECRET: 'short',
      })
    ).toThrow('JWT_ACCESS_SECRET must be at least 32 characters');
  });
});

describe('readOrganizationConfig', () => {
  it('loads organization configuration', () => {
    const config = readOrganizationConfig({
      NODE_ENV: 'test',
      APP_WEB_URL: 'http://localhost:4200',
    });
    expect(config.organizationInvitationExpiresSeconds).toBe(259200);
    expect(config.appWebUrl).toBe('http://localhost:4200');
  });
});

describe('readPasswordRecoveryConfig', () => {
  it('loads password recovery configuration', () => {
    const env = {
      NODE_ENV: 'test',
      APP_PUBLIC_URL: 'http://localhost:4200',
      MAIL_FROM: 'noreply@example.com',
    };
    const config = readPasswordRecoveryConfig(env);
    expect(config.expiresMinutes).toBe(30);
    expect(config.emailVerificationExpiresMinutes).toBe(1440);
    expect(config.mailFrom).toBe('noreply@example.com');
  });
});

describe('readProductIntegrationsConfig', () => {
  it('loads product integrations with defaults', () => {
    const config = readProductIntegrationsConfig({ NODE_ENV: 'test' });
    expect(config.whatsappMode).toBe('manual');
    expect(config.paymentGateway).toBe('sandbox');
    expect(config.whatsappHashSecret).toHaveLength(46);
    expect(config.paymentSandboxSecret).toHaveLength(46);
  });
});

describe('readRedisConfig', () => {
  it('loads Redis configuration', () => {
    const config = readRedisConfig({ NODE_ENV: 'test' });
    expect(config.url).toBe('redis://localhost:6379');
    expect(config.rateLimitPrefix).toBe('rate_limit');
    expect(config.authDeliveryPrefix).toBe('auth_delivery');
  });
});

describe('readRuntimeConfig', () => {
  it('loads the full runtime configuration', () => {
    const env = {
      ...baseEnv,
      ...authEnv,
      APP_WEB_URL: 'http://localhost:4200',
      MAIL_FROM: 'noreply@example.com',
      APP_PUBLIC_URL: 'http://localhost:4200',
    };
    const config = readRuntimeConfig(env);
    expect(config.api.nodeEnv).toBe('test');
    expect(config.auth.jwtAccessSecret).toBe(authEnv.JWT_ACCESS_SECRET);
    expect(config.redis.url).toBe('redis://localhost:6379');
  });
});
