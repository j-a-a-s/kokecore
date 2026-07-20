import { z } from 'zod';

/**
 * Core configuration schemas with Zod validation
 */

const NodeEnvSchema = z.enum(['development', 'test', 'production']);
const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

const ApiConfigSchema = z.object({
  nodeEnv: NodeEnvSchema,
  port: z.number().int().positive(),
  databaseUrl: z.string().url(),
  databaseSsl: z.boolean(),
  appVersion: z.string().min(1),
  commitSha: z.string().min(1),
  buildTime: z.string().datetime(),
  corsAllowedOrigins: z.array(z.string().url()).min(1),
  awsRegion: z.string().min(1),
  awsS3Bucket: z.string().min(1),
  awsS3Endpoint: z.string().url().optional(),
  awsCloudFrontDomain: z.string().optional(),
  logLevel: LogLevelSchema,
  trustProxy: z.boolean(),
  swaggerEnabled: z.boolean(),
});

const AuthConfigSchema = z.object({
  jwtAccessSecret: z.string().min(32),
  jwtRefreshSecret: z.string().min(32),
  jwtAccessExpiresSeconds: z.number().int().positive(),
  jwtRefreshExpiresSeconds: z.number().int().positive(),
  cookieSecure: z.boolean(),
  authAllowedOrigins: z.array(z.string().url()).min(1),
});

const OrganizationConfigSchema = z.object({
  organizationInvitationExpiresSeconds: z.number().int().positive(),
  appWebUrl: z.string().url(),
});

const PasswordRecoveryConfigSchema = z.object({
  appPublicUrl: z.string().url(),
  expiresMinutes: z.number().int().positive(),
  emailVerificationExpiresMinutes: z.number().int().positive(),
  mailFrom: z.string().email(),
  mailHost: z.string().min(1),
  mailPort: z.number().int().positive(),
  mailSecure: z.boolean(),
  mailConnectionTimeoutMs: z.number().int().positive(),
  mailGreetingTimeoutMs: z.number().int().positive(),
  mailSocketTimeoutMs: z.number().int().positive(),
  authEmailEnabled: z.boolean(),
  commercialEmailEnabled: z.boolean(),
  mailUser: z.string().optional(),
  mailPassword: z.string().optional(),
});

const ProductIntegrationsConfigSchema = z.object({
  whatsappMode: z.enum(['manual', 'provider']),
  whatsappHashSecret: z.string().min(32),
  paymentGateway: z.enum(['sandbox', 'production']),
  paymentSandboxSecret: z.string().min(32),
});

const RedisConfigSchema = z.object({
  url: z.string().url(),
  rateLimitHashSecret: z.string().min(32),
  rateLimitPrefix: z.string().min(1),
  authDeliveryPrefix: z.string().min(1),
});

/**
 * Runtime environment configuration
 */
export interface RuntimeEnvironmentConfig {
  api: z.infer<typeof ApiConfigSchema>;
  auth: z.infer<typeof AuthConfigSchema>;
  organization: z.infer<typeof OrganizationConfigSchema>;
  passwordRecovery: z.infer<typeof PasswordRecoveryConfigSchema>;
  productIntegrations: z.infer<typeof ProductIntegrationsConfigSchema>;
  redis: z.infer<typeof RedisConfigSchema>;
}

/**
 * Individual config interfaces
 */
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type OrganizationConfig = z.infer<typeof OrganizationConfigSchema>;
export type PasswordRecoveryConfig = z.infer<typeof PasswordRecoveryConfigSchema>;
export type ProductIntegrationsConfig = z.infer<typeof ProductIntegrationsConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;

/**
 * Default values for development
 */
const LOCAL_DATABASE_URL =
  'postgresql://kokecore:kokecore_dev_password@localhost:5432/kokecore_dev?schema=public';
const LOCAL_ORIGIN = 'http://localhost:4200';

/**
 * Helper functions for environment variable parsing
 */
function parseNodeEnv(value: string | undefined): 'development' | 'test' | 'production' {
  const parsed = NodeEnvSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return 'development';
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function parseStrictBoolean(
  value: string | undefined,
  defaultValue: boolean,
  envName: string
): boolean {
  if (value === undefined) return defaultValue;
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${envName} must be 'true' or 'false'`);
  }
  return value === 'true';
}

function parseLogLevel(value: string): 'debug' | 'info' | 'warn' | 'error' {
  const parsed = LogLevelSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return 'info';
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function requireString(
  env: Record<string, string | undefined>,
  key: string,
  isProduction: boolean,
  defaultValue?: string
): string {
  const value = env[key];
  if (value !== undefined && value !== '') return value;
  if (isProduction) {
    throw new Error(`${key} is required in production`);
  }
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`${key} is required`);
}

function optionalString(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  return value;
}

function assertProductionOrigins(envName: string, origins: string[]): void {
  const invalidOrigins = origins.filter((origin) => origin.startsWith('http://localhost'));
  if (invalidOrigins.length > 0) {
    throw new Error(`${envName} cannot contain localhost origins in production`);
  }
}

/**
 * Read and validate API configuration
 */
export function readApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === 'production';
  const port = Number(env.PORT ?? env.API_PORT ?? 3000);
  const databaseUrl = requireString(env, 'DATABASE_URL', isProduction, LOCAL_DATABASE_URL);
  const databaseSsl = parseBoolean(env.DATABASE_SSL, isProduction);
  const appVersion = requireString(
    env,
    'APP_VERSION',
    isProduction,
    env.npm_package_version ?? '0.1.0'
  );
  const commitSha = requireString(env, 'COMMIT_SHA', isProduction, 'local');
  const buildTime = env.BUILD_TIME ?? new Date().toISOString();
  const corsAllowedOrigins = parseList(
    requireString(
      env,
      'CORS_ALLOWED_ORIGINS',
      isProduction,
      env.AUTH_ALLOWED_ORIGINS ?? LOCAL_ORIGIN
    )
  );
  const awsRegion = requireString(env, 'AWS_REGION', isProduction, 'us-east-1');
  const awsS3Bucket = requireString(env, 'AWS_S3_BUCKET', isProduction, 'kokecore-local');
  const logLevel = parseLogLevel(env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'));

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  if (isProduction && !databaseSsl) {
    throw new Error('DATABASE_SSL must be true in production');
  }

  if (corsAllowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must include at least one origin');
  }
  if (isProduction) {
    assertProductionOrigins('CORS_ALLOWED_ORIGINS', corsAllowedOrigins);
  }

  const config = {
    nodeEnv,
    port,
    databaseUrl,
    databaseSsl,
    appVersion,
    commitSha,
    buildTime,
    corsAllowedOrigins,
    awsRegion,
    awsS3Bucket,
    awsS3Endpoint: optionalString(env.AWS_S3_ENDPOINT),
    awsCloudFrontDomain: optionalString(env.AWS_CLOUDFRONT_DOMAIN),
    logLevel,
    trustProxy: parseBoolean(env.TRUST_PROXY, false),
    swaggerEnabled: isProduction
      ? false
      : parseStrictBoolean(env.SWAGGER_ENABLED, true, 'SWAGGER_ENABLED'),
  };

  return ApiConfigSchema.parse(config);
}

/**
 * Read and validate Auth configuration
 */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === 'production';
  const jwtAccessSecret = requireString(
    env,
    'JWT_ACCESS_SECRET',
    isProduction,
    'dev-secret-change-in-production-min-32-chars'
  );
  const jwtRefreshSecret = requireString(
    env,
    'JWT_REFRESH_SECRET',
    isProduction,
    'dev-secret-change-in-production-min-32-chars'
  );
  const jwtAccessExpiresSeconds = Number(env.JWT_ACCESS_EXPIRES_SECONDS ?? 900);
  const jwtRefreshExpiresSeconds = Number(env.JWT_REFRESH_EXPIRES_SECONDS ?? 2592000);
  const cookieSecure = parseBoolean(env.COOKIE_SECURE, isProduction);
  const authAllowedOrigins = parseList(
    requireString(env, 'AUTH_ALLOWED_ORIGINS', isProduction, LOCAL_ORIGIN)
  );

  if (jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  }
  if (jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
  }

  const config = {
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiresSeconds,
    jwtRefreshExpiresSeconds,
    cookieSecure,
    authAllowedOrigins,
  };

  return AuthConfigSchema.parse(config);
}

/**
 * Read and validate Organization configuration
 */
export function readOrganizationConfig(
  env: Record<string, string | undefined>
): OrganizationConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === 'production';
  const organizationInvitationExpiresSeconds = Number(
    env.ORGANIZATION_INVITATION_EXPIRES_SECONDS ?? 259200
  );
  const appWebUrl = requireString(env, 'APP_WEB_URL', isProduction, LOCAL_ORIGIN);

  if (
    !Number.isInteger(organizationInvitationExpiresSeconds) ||
    organizationInvitationExpiresSeconds <= 0
  ) {
    throw new Error('ORGANIZATION_INVITATION_EXPIRES_SECONDS must be a positive integer');
  }

  if (isProduction) {
    assertProductionOrigins('APP_WEB_URL', [appWebUrl]);
  }

  const config = {
    organizationInvitationExpiresSeconds,
    appWebUrl,
  };

  return OrganizationConfigSchema.parse(config);
}

/**
 * Read and validate Password Recovery configuration
 */
export function readPasswordRecoveryConfig(
  env: Record<string, string | undefined>
): PasswordRecoveryConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === 'production';
  const appPublicUrl = requireString(env, 'APP_PUBLIC_URL', isProduction, LOCAL_ORIGIN);
  const expiresMinutes = Number(env.PASSWORD_RECOVERY_EXPIRES_MINUTES ?? 30);
  const emailVerificationExpiresMinutes = Number(env.EMAIL_VERIFICATION_EXPIRES_MINUTES ?? 1440);
  const mailFrom = requireString(env, 'MAIL_FROM', isProduction, 'noreply@localhost');
  const mailHost = requireString(env, 'MAIL_HOST', isProduction, 'localhost');
  const mailPort = Number(env.MAIL_PORT ?? 587);
  const mailSecure = parseBoolean(env.MAIL_SECURE, false);
  const mailConnectionTimeoutMs = Number(env.MAIL_CONNECTION_TIMEOUT_MS ?? 6000);
  const mailGreetingTimeoutMs = Number(env.MAIL_GREETING_TIMEOUT_MS ?? 5000);
  const mailSocketTimeoutMs = Number(env.MAIL_SOCKET_TIMEOUT_MS ?? 5000);
  const authEmailEnabled = parseBoolean(env.AUTH_EMAIL_ENABLED, true);
  const commercialEmailEnabled = parseBoolean(env.COMMERCIAL_EMAIL_ENABLED, true);

  const config = {
    appPublicUrl,
    expiresMinutes,
    emailVerificationExpiresMinutes,
    mailFrom,
    mailHost,
    mailPort,
    mailSecure,
    mailConnectionTimeoutMs,
    mailGreetingTimeoutMs,
    mailSocketTimeoutMs,
    authEmailEnabled,
    commercialEmailEnabled,
    mailUser: optionalString(env.MAIL_USER),
    mailPassword: optionalString(env.MAIL_PASSWORD),
  };

  return PasswordRecoveryConfigSchema.parse(config);
}

/**
 * Read and validate Product Integrations configuration
 */
export function readProductIntegrationsConfig(
  env: Record<string, string | undefined>
): ProductIntegrationsConfig {
  const whatsappMode = env.WHATSAPP_MODE === 'provider' ? 'provider' : 'manual';
  const whatsappHashSecret = requireString(
    env,
    'WHATSAPP_HASH_SECRET',
    false,
    'dev-secret-must-be-at-least-32-characters-long'
  );
  const paymentGateway = env.PAYMENT_GATEWAY === 'production' ? 'production' : 'sandbox';
  const paymentSandboxSecret = requireString(
    env,
    'PAYMENT_SANDBOX_SECRET',
    false,
    'dev-secret-must-be-at-least-32-characters-long'
  );

  const config = {
    whatsappMode,
    whatsappHashSecret,
    paymentGateway,
    paymentSandboxSecret,
  };

  return ProductIntegrationsConfigSchema.parse(config);
}

/**
 * Read and validate Redis configuration
 */
export function readRedisConfig(env: Record<string, string | undefined>): RedisConfig {
  const url = requireString(env, 'REDIS_URL', false, 'redis://localhost:6379');
  const rateLimitHashSecret = requireString(
    env,
    'RATE_LIMIT_HASH_SECRET',
    false,
    'dev-secret-must-be-at-least-32-characters-long'
  );
  const rateLimitPrefix = env.RATE_LIMIT_PREFIX ?? 'rate_limit';
  const authDeliveryPrefix = env.AUTH_DELIVERY_PREFIX ?? 'auth_delivery';

  const config = {
    url,
    rateLimitHashSecret,
    rateLimitPrefix,
    authDeliveryPrefix,
  };

  return RedisConfigSchema.parse(config);
}

/**
 * Read complete runtime configuration
 */
export function readRuntimeConfig(
  env: Record<string, string | undefined>
): RuntimeEnvironmentConfig {
  return {
    api: readApiConfig(env),
    auth: readAuthConfig(env),
    organization: readOrganizationConfig(env),
    passwordRecovery: readPasswordRecoveryConfig(env),
    productIntegrations: readProductIntegrationsConfig(env),
    redis: readRedisConfig(env),
  };
}
