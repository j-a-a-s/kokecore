import { PasswordService, type AuthConfig } from '@kokecore/auth';
import {
  defineConfigSchema,
  readInteger,
  readRuntimeMode,
  validateEnvironment,
} from '@kokecore/config';
import { ERROR_CODES, ErrorFactory } from '@kokecore/errors';
import { redactSensitiveData } from '@kokecore/logging';
import { Role, roleHasPermission } from '@kokecore/rbac';
import { createMoneySchema, isValidChileanRut } from '@kokecore/validation';

const authConfig: AuthConfig = {
  jwtAccessSecret: 'test-only-access-secret-with-32-characters',
  jwtRefreshSecret: 'test-only-refresh-secret-with-32-characters',
  jwtAccessExpiresSeconds: 900,
  jwtRefreshExpiresSeconds: 604800,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: true,
  maxSessionsPerUser: 3,
  sessionTimeoutMinutes: 60,
  mfaEnabled: false,
};

export function runReferenceConsumer(): Record<string, boolean | number | string> {
  const runtimeSchema = defineConfigSchema(['NODE_ENV', 'PORT'], (environment) => ({
    nodeEnv: readRuntimeMode(environment),
    port: readInteger(environment, 'PORT', { defaultValue: 3000, minimum: 1 }),
  }));
  const runtime = validateEnvironment(
    runtimeSchema,
    { NODE_ENV: 'test', PORT: '3100' },
    {
      unknownVariables: 'reject',
    }
  );
  const passwordCheck = new PasswordService(authConfig).validatePassword('Valid-Passw0rd!');
  const validationError = ErrorFactory.validation(
    ERROR_CODES.VALIDATION_INVALID_INPUT,
    'Invalid input',
    'email'
  );
  const redacted = redactSensitiveData({
    password: 'test-only-consumer-value',
    visible: 'yes',
  }) as Record<string, unknown>;
  const usd = createMoneySchema('USD').parse(10.25);

  return {
    config: runtime.nodeEnv === 'test' && runtime.port === 3100,
    error: validationError.toJSON().code === ERROR_CODES.VALIDATION_INVALID_INPUT,
    logging: redacted.password === '[REDACTED]' && redacted.visible === 'yes',
    validation: isValidChileanRut('12.345.678-5') && usd === 10.25,
    auth: passwordCheck.valid,
    rbac: roleHasPermission(Role.MANAGER, 'clients.read'),
  };
}

const result = runReferenceConsumer();
if (Object.values(result).some((value) => value !== true)) {
  throw new Error(`Reference consumer contract failed: ${JSON.stringify(result)}`);
}
console.log('REFERENCE_CONSUMER_OK');
