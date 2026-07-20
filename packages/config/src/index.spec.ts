import {
  CONFIG_ISSUE_CODES,
  ConfigurationError,
  assertKnownVariables,
  coerceBoolean,
  coerceEnum,
  coerceInteger,
  coerceStringList,
  composeConfigSchemas,
  defineConfigSchema,
  isConfigurationError,
  normalizeOptionalString,
  readBoolean,
  readEnum,
  readInteger,
  readOptionalString,
  readRuntimeMode,
  readString,
  readStringList,
  validateEnvironment,
} from './index';
import * as publicApi from './public';

function captureConfigurationError(action: () => unknown): ConfigurationError {
  try {
    action();
  } catch (error) {
    expect(isConfigurationError(error)).toBe(true);
    if (isConfigurationError(error)) return error;
  }
  throw new Error('Expected a ConfigurationError');
}

describe('safe string readers', () => {
  it('normalizes optional values without exposing empty strings', () => {
    expect(normalizeOptionalString('  value  ')).toBe('value');
    expect(normalizeOptionalString('  value  ', { trim: false })).toBe('  value  ');
    expect(normalizeOptionalString('   ')).toBeUndefined();
    expect(normalizeOptionalString(undefined)).toBeUndefined();
  });

  it('reads required, optional, and default string values', () => {
    const environment = { REQUIRED: '  present  ', OPTIONAL: '  optional  ' };
    expect(readString(environment, 'REQUIRED')).toBe('present');
    expect(readString(environment, 'DEFAULTED', { defaultValue: 'fallback' })).toBe('fallback');
    expect(readOptionalString(environment, 'OPTIONAL')).toBe('optional');
    expect(readOptionalString(environment, 'MISSING')).toBeUndefined();
  });

  it('rejects missing required strings with a typed issue', () => {
    const error = captureConfigurationError(() => readString({ EMPTY: ' ' }, 'EMPTY'));
    expect(error.code).toBe(CONFIG_ISSUE_CODES.MISSING_VALUE);
    expect(error.message).toBe('EMPTY is required');
    expect(error.issues).toEqual([
      { code: CONFIG_ISSUE_CODES.MISSING_VALUE, key: 'EMPTY', expected: 'present' },
    ]);
  });
});

describe('boolean coercion', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['YES', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['NO', false],
    ['off', false],
  ])('coerces %s to %s', (value, expected) => {
    expect(coerceBoolean(value)).toBe(expected);
  });

  it('supports defaults, custom values, and case-sensitive parsing', () => {
    expect(coerceBoolean(undefined, { defaultValue: true })).toBe(true);
    expect(
      coerceBoolean('enabled', {
        trueValues: ['enabled'],
        falseValues: ['disabled'],
      })
    ).toBe(true);
    expect(
      coerceBoolean('N', {
        trueValues: ['Y'],
        falseValues: ['N'],
        caseSensitive: true,
      })
    ).toBe(false);
    expect(readBoolean({ FEATURE: 'false' }, 'FEATURE')).toBe(false);
  });

  it('rejects missing and invalid booleans without echoing values', () => {
    expect(captureConfigurationError(() => coerceBoolean(undefined)).code).toBe(
      CONFIG_ISSUE_CODES.MISSING_VALUE
    );
    const secret = 'test-only-sensitive-value';
    const error = captureConfigurationError(() =>
      coerceBoolean(secret, { key: 'FEATURE_ENABLED' })
    );
    expect(error.message).toBe('FEATURE_ENABLED must be a boolean');
    expect(error.message).not.toContain(secret);
  });
});

describe('integer coercion', () => {
  it('reads safe integers and bounded defaults', () => {
    expect(coerceInteger('42')).toBe(42);
    expect(coerceInteger(undefined, { defaultValue: 10, minimum: 1, maximum: 20 })).toBe(10);
    expect(readInteger({ PORT: '3000' }, 'PORT', { minimum: 1, maximum: 65535 })).toBe(3000);
  });

  it('rejects non-integers and each bound shape', () => {
    expect(captureConfigurationError(() => coerceInteger(undefined)).code).toBe(
      CONFIG_ISSUE_CODES.MISSING_VALUE
    );
    expect(captureConfigurationError(() => coerceInteger('1.5')).message).toBe(
      'value must be an integer'
    );
    expect(captureConfigurationError(() => coerceInteger('0', { minimum: 1 })).message).toBe(
      'value must be an integer greater than or equal to 1'
    );
    expect(captureConfigurationError(() => coerceInteger('11', { maximum: 10 })).message).toBe(
      'value must be an integer less than or equal to 10'
    );
    expect(
      captureConfigurationError(() => coerceInteger('21', { minimum: 1, maximum: 20 })).message
    ).toBe('value must be an integer between 1 and 20');
    expect(
      captureConfigurationError(() =>
        coerceInteger(undefined, { defaultValue: 0, minimum: 1, maximum: 20 })
      ).message
    ).toBe('value must be an integer between 1 and 20');
  });
});

describe('list and enum coercion', () => {
  it('parses trimmed, unique lists and environment values', () => {
    expect(coerceStringList('one, two, ,one', { unique: true })).toEqual(['one', 'two']);
    expect(readStringList({ ORIGINS: 'one,two' }, 'ORIGINS')).toEqual(['one', 'two']);
    expect(coerceStringList(undefined, { defaultValue: ['fallback'] })).toEqual(['fallback']);
  });

  it('supports custom separators and preservation options', () => {
    expect(
      coerceStringList(' one | |two ', {
        separator: '|',
        trim: false,
        omitEmpty: false,
      })
    ).toEqual([' one ', ' ', 'two ']);
    expect(captureConfigurationError(() => coerceStringList(undefined)).code).toBe(
      CONFIG_ISSUE_CODES.MISSING_VALUE
    );
    expect(captureConfigurationError(() => coerceStringList('one', { separator: '' })).code).toBe(
      CONFIG_ISSUE_CODES.INVALID_VALUE
    );
  });

  it('coerces enums with typed defaults and rejects unsupported values', () => {
    const levels = ['debug', 'info', 'error'] as const;
    expect(coerceEnum('info', levels)).toBe('info');
    expect(coerceEnum(undefined, levels, { defaultValue: 'debug' })).toBe('debug');
    expect(readEnum({ LEVEL: 'error' }, 'LEVEL', levels)).toBe('error');
    expect(captureConfigurationError(() => coerceEnum(undefined, levels)).code).toBe(
      CONFIG_ISSUE_CODES.MISSING_VALUE
    );

    const secret = 'test-only-invalid-secret';
    const error = captureConfigurationError(() => coerceEnum(secret, levels, { key: 'LEVEL' }));
    expect(error.message).toBe('LEVEL must be one of: debug, info, error');
    expect(error.message).not.toContain(secret);
  });
});

describe('runtime mode', () => {
  it.each(['development', 'test', 'production'] as const)('supports %s', (mode) => {
    expect(readRuntimeMode({ NODE_ENV: mode })).toBe(mode);
  });

  it('defaults to development and rejects invalid modes', () => {
    expect(readRuntimeMode({})).toBe('development');
    expect(readRuntimeMode({}, 'APP_MODE', 'test')).toBe('test');
    expect(captureConfigurationError(() => readRuntimeMode({ NODE_ENV: 'preview' })).message).toBe(
      'NODE_ENV must be one of: development, test, production'
    );
  });
});

describe('schema composition and validation', () => {
  const serverSchema = defineConfigSchema(['HOST', 'PORT'], (environment) => ({
    host: readString(environment, 'HOST', { defaultValue: 'localhost' }),
    port: readInteger(environment, 'PORT', { defaultValue: 3000, minimum: 1 }),
  }));
  const featureSchema = defineConfigSchema(['FEATURE'], (environment) => ({
    feature: readBoolean(environment, 'FEATURE', { defaultValue: false }),
  }));

  it('composes typed schemas and validates known variables', () => {
    const schema = composeConfigSchemas(serverSchema, featureSchema);
    expect(schema.keys).toEqual(['HOST', 'PORT', 'FEATURE']);
    expect(
      validateEnvironment(
        schema,
        { HOST: 'example.test', PORT: '8080', FEATURE: 'yes' },
        {
          unknownVariables: 'reject',
        }
      )
    ).toEqual({ host: 'example.test', port: 8080, feature: true });
  });

  it('allows unknown variables by default and supports ignored keys', () => {
    expect(validateEnvironment(serverSchema, { EXTRA: 'allowed' })).toEqual({
      host: 'localhost',
      port: 3000,
    });
    expect(() =>
      assertKnownVariables(
        { HOST: 'localhost', IGNORED: 'yes', ABSENT: undefined },
        ['HOST'],
        ['IGNORED']
      )
    ).not.toThrow();
  });

  it('returns all unknown variables as safe typed issues', () => {
    const error = captureConfigurationError(() =>
      validateEnvironment(
        serverSchema,
        { HOST: 'localhost', UNKNOWN_B: 'secret-b', UNKNOWN_A: 'secret-a' },
        { unknownVariables: 'reject' }
      )
    );
    expect(error.issues.map((issue) => issue.key)).toEqual(['UNKNOWN_A', 'UNKNOWN_B']);
    expect(error.issues.every((issue) => issue.code === CONFIG_ISSUE_CODES.UNKNOWN_VARIABLE)).toBe(
      true
    );
    expect(error.message).not.toContain('secret-a');
    expect(error.message).not.toContain('secret-b');
  });

  it('rejects duplicate declarations within and across schemas', () => {
    expect(
      captureConfigurationError(() => defineConfigSchema(['PORT', 'PORT'], () => ({}))).code
    ).toBe(CONFIG_ISSUE_CODES.DUPLICATE_SCHEMA_KEY);
    const duplicate = defineConfigSchema(['PORT'], () => ({ secure: true }));
    expect(
      captureConfigurationError(() => composeConfigSchemas(serverSchema, duplicate)).message
    ).toBe('PORT must be declared by only one configuration schema');
  });

  it('preserves typed errors and masks arbitrary parser errors', () => {
    const typedFailure = defineConfigSchema(['REQUIRED'], (environment) => ({
      required: readString(environment, 'REQUIRED'),
    }));
    expect(captureConfigurationError(() => typedFailure.parse({})).code).toBe(
      CONFIG_ISSUE_CODES.MISSING_VALUE
    );

    const secret = 'test-only-parser-secret';
    const unsafeFailure = defineConfigSchema(['SECRET'], () => {
      throw new Error(secret);
    });
    const error = captureConfigurationError(() => unsafeFailure.parse({ SECRET: secret }));
    expect(error.code).toBe(CONFIG_ISSUE_CODES.SCHEMA_VALIDATION_FAILED);
    expect(error.message).toBe('Configuration schema must produce valid configuration');
    expect(error.message).not.toContain(secret);
  });
});

describe('ConfigurationError', () => {
  it('requires issues and identifies only its own error type', () => {
    expect(() => new ConfigurationError([])).toThrow(TypeError);
    expect(isConfigurationError(new Error('ordinary'))).toBe(false);
  });
});

describe('public API', () => {
  it('resolves the certified root exports', () => {
    expect(publicApi.CONFIG_ISSUE_CODES).toBe(CONFIG_ISSUE_CODES);
    expect(publicApi.ConfigurationError).toBe(ConfigurationError);
    expect(publicApi.readString).toBe(readString);
    expect(publicApi.composeConfigSchemas).toBe(composeConfigSchemas);
    expect(publicApi.validateEnvironment).toBe(validateEnvironment);
    expect(Object.values(publicApi).every((value) => value !== undefined)).toBe(true);
  });
});
