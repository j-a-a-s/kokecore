export type Environment = Readonly<Record<string, string | undefined>>;

export type RuntimeMode = 'development' | 'test' | 'production';

export const CONFIG_ISSUE_CODES = {
  MISSING_VALUE: 'CONFIG_MISSING_VALUE',
  INVALID_VALUE: 'CONFIG_INVALID_VALUE',
  UNKNOWN_VARIABLE: 'CONFIG_UNKNOWN_VARIABLE',
  DUPLICATE_SCHEMA_KEY: 'CONFIG_DUPLICATE_SCHEMA_KEY',
  SCHEMA_VALIDATION_FAILED: 'CONFIG_SCHEMA_VALIDATION_FAILED',
} as const;

export type ConfigIssueCode = (typeof CONFIG_ISSUE_CODES)[keyof typeof CONFIG_ISSUE_CODES];

export interface ConfigIssue {
  readonly code: ConfigIssueCode;
  readonly key: string;
  readonly expected: string;
}

export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError';
  readonly code: ConfigIssueCode;
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    if (issues.length === 0) {
      throw new TypeError('ConfigurationError requires at least one issue');
    }

    const safeIssues = issues.map((issue) => Object.freeze({ ...issue }));
    super(safeIssues.map(formatIssue).join('; '));
    this.code = safeIssues[0]!.code;
    this.issues = Object.freeze(safeIssues);
  }
}

export interface StringReadOptions {
  readonly defaultValue?: string;
  readonly trim?: boolean;
}

export interface BooleanCoercionOptions {
  readonly key?: string;
  readonly defaultValue?: boolean;
  readonly trueValues?: readonly string[];
  readonly falseValues?: readonly string[];
  readonly caseSensitive?: boolean;
}

export interface IntegerCoercionOptions {
  readonly key?: string;
  readonly defaultValue?: number;
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface StringListCoercionOptions {
  readonly key?: string;
  readonly defaultValue?: readonly string[];
  readonly separator?: string;
  readonly trim?: boolean;
  readonly omitEmpty?: boolean;
  readonly unique?: boolean;
}

export interface EnumCoercionOptions<T extends string> {
  readonly key?: string;
  readonly defaultValue?: T;
}

export interface ConfigSchema<T extends object> {
  readonly keys: readonly string[];
  readonly parse: (environment: Environment) => T;
}

export interface EnvironmentValidationOptions {
  readonly unknownVariables?: 'allow' | 'reject';
  readonly ignoredKeys?: readonly string[];
}

type SchemaOutput<T> = T extends ConfigSchema<infer Output> ? Output : never;
type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never;
type ComposedSchemaOutput<T extends readonly ConfigSchema<object>[]> = UnionToIntersection<
  SchemaOutput<T[number]>
> &
  object;

const DEFAULT_TRUE_VALUES = ['true', '1', 'yes', 'on'] as const;
const DEFAULT_FALSE_VALUES = ['false', '0', 'no', 'off'] as const;
const RUNTIME_MODES = ['development', 'test', 'production'] as const;

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function normalizeOptionalString(
  value: string | undefined,
  options: Pick<StringReadOptions, 'trim'> = {}
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = options.trim === false ? value : value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function readString(
  environment: Environment,
  key: string,
  options: StringReadOptions = {}
): string {
  const value = normalizeOptionalString(environment[key], options);
  if (value !== undefined) return value;

  const defaultValue = normalizeOptionalString(options.defaultValue, options);
  if (defaultValue !== undefined) return defaultValue;

  throw createError(CONFIG_ISSUE_CODES.MISSING_VALUE, key, 'present');
}

export function readOptionalString(
  environment: Environment,
  key: string,
  options: Pick<StringReadOptions, 'trim'> = {}
): string | undefined {
  return normalizeOptionalString(environment[key], options);
}

export function coerceBoolean(
  value: string | undefined,
  options: BooleanCoercionOptions = {}
): boolean {
  const key = options.key ?? 'value';
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined) {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw createError(CONFIG_ISSUE_CODES.MISSING_VALUE, key, 'present');
  }

  const normalize =
    options.caseSensitive === true ? identity : (item: string) => item.toLowerCase();
  const candidate = normalize(normalized);
  const trueValues = (options.trueValues ?? DEFAULT_TRUE_VALUES).map(normalize);
  const falseValues = (options.falseValues ?? DEFAULT_FALSE_VALUES).map(normalize);

  if (trueValues.includes(candidate)) return true;
  if (falseValues.includes(candidate)) return false;
  throw createError(CONFIG_ISSUE_CODES.INVALID_VALUE, key, 'a boolean');
}

export function readBoolean(
  environment: Environment,
  key: string,
  options: Omit<BooleanCoercionOptions, 'key'> = {}
): boolean {
  return coerceBoolean(environment[key], { ...options, key });
}

export function coerceInteger(
  value: string | undefined,
  options: IntegerCoercionOptions = {}
): number {
  const key = options.key ?? 'value';
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined) {
    if (options.defaultValue !== undefined) {
      return validateInteger(options.defaultValue, key, options);
    }
    throw createError(CONFIG_ISSUE_CODES.MISSING_VALUE, key, 'present');
  }

  if (!/^[+-]?\d+$/.test(normalized)) {
    throw createError(CONFIG_ISSUE_CODES.INVALID_VALUE, key, integerExpectation(options));
  }
  return validateInteger(Number(normalized), key, options);
}

export function readInteger(
  environment: Environment,
  key: string,
  options: Omit<IntegerCoercionOptions, 'key'> = {}
): number {
  return coerceInteger(environment[key], { ...options, key });
}

export function coerceStringList(
  value: string | undefined,
  options: StringListCoercionOptions = {}
): string[] {
  const key = options.key ?? 'value';
  const normalized = normalizeOptionalString(value, { trim: false });
  if (normalized === undefined) {
    if (options.defaultValue !== undefined) return [...options.defaultValue];
    throw createError(CONFIG_ISSUE_CODES.MISSING_VALUE, key, 'present');
  }

  const separator = options.separator ?? ',';
  if (separator.length === 0) {
    throw createError(CONFIG_ISSUE_CODES.INVALID_VALUE, key, 'parsed with a non-empty separator');
  }

  const values = normalized
    .split(separator)
    .map((item) => (options.trim === false ? item : item.trim()))
    .filter((item) => options.omitEmpty === false || item.length > 0);

  return options.unique === true ? [...new Set(values)] : values;
}

export function readStringList(
  environment: Environment,
  key: string,
  options: Omit<StringListCoercionOptions, 'key'> = {}
): string[] {
  return coerceStringList(environment[key], { ...options, key });
}

export function coerceEnum<const Values extends readonly string[]>(
  value: string | undefined,
  values: Values,
  options: EnumCoercionOptions<Values[number]> = {}
): Values[number] {
  const key = options.key ?? 'value';
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined) {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw createError(CONFIG_ISSUE_CODES.MISSING_VALUE, key, 'present');
  }
  if ((values as readonly string[]).includes(normalized)) return normalized as Values[number];
  throw createError(CONFIG_ISSUE_CODES.INVALID_VALUE, key, `one of: ${values.join(', ')}`);
}

export function readEnum<const Values extends readonly string[]>(
  environment: Environment,
  key: string,
  values: Values,
  options: Omit<EnumCoercionOptions<Values[number]>, 'key'> = {}
): Values[number] {
  return coerceEnum(environment[key], values, { ...options, key });
}

export function readRuntimeMode(
  environment: Environment,
  key = 'NODE_ENV',
  defaultValue: RuntimeMode = 'development'
): RuntimeMode {
  return readEnum(environment, key, RUNTIME_MODES, { defaultValue });
}

export function defineConfigSchema<T extends object>(
  keys: readonly string[],
  parser: (environment: Environment) => T
): ConfigSchema<T> {
  assertNoDuplicateKeys(keys);
  const frozenKeys = Object.freeze([...keys]);

  return Object.freeze({
    keys: frozenKeys,
    parse(environment: Environment): T {
      try {
        return parser(environment);
      } catch (error) {
        if (isConfigurationError(error)) throw error;
        throw createError(
          CONFIG_ISSUE_CODES.SCHEMA_VALIDATION_FAILED,
          '$schema',
          'valid configuration'
        );
      }
    },
  });
}

export function composeConfigSchemas<const Schemas extends readonly ConfigSchema<object>[]>(
  ...schemas: Schemas
): ConfigSchema<ComposedSchemaOutput<Schemas>> {
  const keys = schemas.flatMap((schema) => schema.keys);
  assertNoDuplicateKeys(keys);

  return defineConfigSchema<ComposedSchemaOutput<Schemas>>(keys, (environment) => {
    const parts = schemas.map((schema) => schema.parse(environment));
    return Object.assign({}, ...parts) as ComposedSchemaOutput<Schemas>;
  });
}

export function assertKnownVariables(
  environment: Environment,
  knownKeys: readonly string[],
  ignoredKeys: readonly string[] = []
): void {
  const allowed = new Set([...knownKeys, ...ignoredKeys]);
  const issues = Object.keys(environment)
    .filter((key) => environment[key] !== undefined && !allowed.has(key))
    .sort()
    .map((key) => ({
      code: CONFIG_ISSUE_CODES.UNKNOWN_VARIABLE,
      key,
      expected: 'declared by the configuration schema',
    }));

  if (issues.length > 0) throw new ConfigurationError(issues);
}

export function validateEnvironment<T extends object>(
  schema: ConfigSchema<T>,
  environment: Environment,
  options: EnvironmentValidationOptions = {}
): T {
  if (options.unknownVariables === 'reject') {
    assertKnownVariables(environment, schema.keys, options.ignoredKeys);
  }
  return schema.parse(environment);
}

function identity(value: string): string {
  return value;
}

function validateInteger(value: number, key: string, options: IntegerCoercionOptions): number {
  if (
    !Number.isSafeInteger(value) ||
    (options.minimum !== undefined && value < options.minimum) ||
    (options.maximum !== undefined && value > options.maximum)
  ) {
    throw createError(CONFIG_ISSUE_CODES.INVALID_VALUE, key, integerExpectation(options));
  }
  return value;
}

function integerExpectation(options: IntegerCoercionOptions): string {
  if (options.minimum !== undefined && options.maximum !== undefined) {
    return `an integer between ${options.minimum} and ${options.maximum}`;
  }
  if (options.minimum !== undefined)
    return `an integer greater than or equal to ${options.minimum}`;
  if (options.maximum !== undefined) return `an integer less than or equal to ${options.maximum}`;
  return 'an integer';
}

function assertNoDuplicateKeys(keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      throw createError(
        CONFIG_ISSUE_CODES.DUPLICATE_SCHEMA_KEY,
        key,
        'declared by only one configuration schema'
      );
    }
    seen.add(key);
  }
}

function createError(code: ConfigIssueCode, key: string, expected: string): ConfigurationError {
  return new ConfigurationError([{ code, key, expected }]);
}

function formatIssue(issue: ConfigIssue): string {
  switch (issue.code) {
    case CONFIG_ISSUE_CODES.MISSING_VALUE:
      return `${issue.key} is required`;
    case CONFIG_ISSUE_CODES.INVALID_VALUE:
      return `${issue.key} must be ${issue.expected}`;
    case CONFIG_ISSUE_CODES.UNKNOWN_VARIABLE:
      return `${issue.key} is not allowed`;
    case CONFIG_ISSUE_CODES.DUPLICATE_SCHEMA_KEY:
      return `${issue.key} must be ${issue.expected}`;
    case CONFIG_ISSUE_CODES.SCHEMA_VALIDATION_FAILED:
      return `Configuration schema must produce ${issue.expected}`;
  }
}
