import {
  readApiConfig,
  readAuthConfig,
  readOrganizationConfig,
  readPasswordRecoveryConfig,
  readProductIntegrationsConfig,
  readRedisConfig,
  readRuntimeConfig,
} from './index';
import * as publicApi from './public';

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
      AWS_REGION: 'us-east-1',
      AWS_S3_BUCKET: 'production-bucket',
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
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'production-bucket',
      })
    ).toThrow('localhost origins in production');
  });

  it('parses optional development settings and list values', () => {
    const config = readApiConfig({
      ...baseEnv,
      NODE_ENV: 'unexpected',
      API_PORT: '3100',
      DATABASE_SSL: '1',
      CORS_ALLOWED_ORIGINS: ' https://one.example.com, ,https://two.example.com ',
      AWS_S3_ENDPOINT: 'http://localhost:9000',
      AWS_CLOUDFRONT_DOMAIN: 'cdn.example.com',
      LOG_LEVEL: 'warn',
      TRUST_PROXY: 'true',
      SWAGGER_ENABLED: 'false',
    });
    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3100);
    expect(config.databaseSsl).toBe(true);
    expect(config.corsAllowedOrigins).toHaveLength(2);
    expect(config.awsS3Endpoint).toBe('http://localhost:9000');
    expect(config.awsCloudFrontDomain).toBe('cdn.example.com');
    expect(config.logLevel).toBe('warn');
    expect(config.trustProxy).toBe(true);
    expect(config.swaggerEnabled).toBe(false);
  });

  it('falls back for invalid log levels and rejects strict booleans', () => {
    expect(readApiConfig({ ...baseEnv, LOG_LEVEL: 'verbose' }).logLevel).toBe('info');
    expect(() => readApiConfig({ ...baseEnv, SWAGGER_ENABLED: '1' })).toThrow(
      "SWAGGER_ENABLED must be 'true' or 'false'"
    );
  });

  it('rejects unsafe production database settings and missing variables', () => {
    expect(() =>
      readApiConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        DATABASE_SSL: 'false',
        CORS_ALLOWED_ORIGINS: 'https://app.example.com',
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'production-bucket',
      })
    ).toThrow('DATABASE_SSL must be true in production');
    expect(() =>
      readApiConfig({
        NODE_ENV: 'production',
        DATABASE_SSL: 'true',
        CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      })
    ).toThrow('DATABASE_URL is required in production');
    expect(() => readApiConfig({ ...baseEnv, CORS_ALLOWED_ORIGINS: ', ,' })).toThrow(
      'CORS_ALLOWED_ORIGINS must include at least one origin'
    );
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
    expect(() =>
      readAuthConfig({
        ...authEnv,
        JWT_REFRESH_SECRET: 'short',
      })
    ).toThrow('JWT_REFRESH_SECRET must be at least 32 characters');
  });

  it('parses explicit auth settings and production requirements', () => {
    const config = readAuthConfig({
      ...authEnv,
      COOKIE_SECURE: '1',
      JWT_ACCESS_EXPIRES_SECONDS: '120',
      JWT_REFRESH_EXPIRES_SECONDS: '240',
      AUTH_ALLOWED_ORIGINS: 'https://one.example.com, https://two.example.com',
    });
    expect(config.cookieSecure).toBe(true);
    expect(config.jwtAccessExpiresSeconds).toBe(120);
    expect(config.jwtRefreshExpiresSeconds).toBe(240);
    expect(config.authAllowedOrigins).toHaveLength(2);
    expect(() => readAuthConfig({ NODE_ENV: 'production' })).toThrow(
      'JWT_ACCESS_SECRET is required in production'
    );
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

  it('rejects invalid expirations and localhost in production', () => {
    expect(() =>
      readOrganizationConfig({
        ORGANIZATION_INVITATION_EXPIRES_SECONDS: '0',
      })
    ).toThrow('must be a positive integer');
    expect(() =>
      readOrganizationConfig({
        NODE_ENV: 'production',
        ORGANIZATION_INVITATION_EXPIRES_SECONDS: '60',
        APP_WEB_URL: 'http://localhost:4200',
      })
    ).toThrow('localhost origins in production');
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

  it('parses mail settings and optional credentials', () => {
    const config = readPasswordRecoveryConfig({
      APP_PUBLIC_URL: 'https://app.example.com',
      PASSWORD_RECOVERY_EXPIRES_MINUTES: '15',
      EMAIL_VERIFICATION_EXPIRES_MINUTES: '60',
      MAIL_FROM: 'mail@example.com',
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: '465',
      MAIL_SECURE: 'true',
      MAIL_CONNECTION_TIMEOUT_MS: '1000',
      MAIL_GREETING_TIMEOUT_MS: '2000',
      MAIL_SOCKET_TIMEOUT_MS: '3000',
      AUTH_EMAIL_ENABLED: 'false',
      COMMERCIAL_EMAIL_ENABLED: '0',
      MAIL_USER: 'mailer',
      MAIL_PASSWORD: 'test-only-mail-password',
    });
    expect(config.expiresMinutes).toBe(15);
    expect(config.mailSecure).toBe(true);
    expect(config.authEmailEnabled).toBe(false);
    expect(config.commercialEmailEnabled).toBe(false);
    expect(config.mailUser).toBe('mailer');
    expect(config.mailPassword).toBe('test-only-mail-password');
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

  it('parses provider and production modes', () => {
    const config = readProductIntegrationsConfig({
      WHATSAPP_MODE: 'provider',
      PAYMENT_GATEWAY: 'production',
      WHATSAPP_HASH_SECRET: 'test-only-whatsapp-hash-secret-value',
      PAYMENT_SANDBOX_SECRET: 'test-only-payment-sandbox-secret-value',
    });
    expect(config.whatsappMode).toBe('provider');
    expect(config.paymentGateway).toBe('production');
  });
});

describe('readRedisConfig', () => {
  it('loads Redis configuration', () => {
    const config = readRedisConfig({ NODE_ENV: 'test' });
    expect(config.url).toBe('redis://localhost:6379');
    expect(config.rateLimitPrefix).toBe('rate_limit');
    expect(config.authDeliveryPrefix).toBe('auth_delivery');
  });

  it('loads explicit Redis settings', () => {
    const config = readRedisConfig({
      REDIS_URL: 'redis://cache.example.com:6379',
      RATE_LIMIT_HASH_SECRET: 'test-only-rate-limit-secret-value-1234',
      RATE_LIMIT_PREFIX: 'custom_rate',
      AUTH_DELIVERY_PREFIX: 'custom_auth',
    });
    expect(config.url).toBe('redis://cache.example.com:6379');
    expect(config.rateLimitPrefix).toBe('custom_rate');
    expect(config.authDeliveryPrefix).toBe('custom_auth');
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

describe('Public API', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.readRuntimeConfig).toBe(readRuntimeConfig);
  });
});
