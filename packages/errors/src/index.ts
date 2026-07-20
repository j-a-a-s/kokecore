/**
 * @kokecore/errors
 *
 * Enterprise-grade error handling with:
 * - Consistent error codes with hierarchy
 * - Error context for debugging
 * - Error aggregation for multiple errors
 * - Recovery suggestions
 * - Circuit breaker pattern support
 */

/**
 * Error code categories
 */
export enum ErrorCategory {
  // Client errors (4xx)
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',

  // Server errors (5xx)
  INTERNAL = 'INTERNAL',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  NETWORK = 'NETWORK',

  // Business logic errors
  BUSINESS = 'BUSINESS',
  WORKFLOW = 'WORKFLOW',
}

/**
 * Detailed error codes with hierarchy
 */
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_INVALID_TYPE: 'VALIDATION_INVALID_TYPE',

  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  AUTH_PASSWORD_MISMATCH: 'AUTH_PASSWORD_MISMATCH',
  AUTH_PASSWORD_POLICY: 'AUTH_PASSWORD_POLICY',
  AUTH_PASSWORD_REUSE: 'AUTH_PASSWORD_REUSE',

  // Authorization errors
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  AUTH_ORGANIZATION_ACCESS: 'AUTH_ORGANIZATION_ACCESS',

  // Not found errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',

  // Conflict errors
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  DUPLICATE_TAX_ID: 'DUPLICATE_TAX_ID',
  VERSION_CONFLICT: 'VERSION_CONFLICT',

  // Rate limit errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_BACKEND_UNAVAILABLE: 'RATE_LIMIT_BACKEND_UNAVAILABLE',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INTERNAL_UNEXPECTED: 'INTERNAL_UNEXPECTED',

  // Database errors
  DATABASE_CONNECTION: 'DATABASE_CONNECTION',
  DATABASE_QUERY: 'DATABASE_QUERY',
  DATABASE_CONSTRAINT: 'DATABASE_CONSTRAINT',
  DATABASE_TIMEOUT: 'DATABASE_TIMEOUT',

  // External service errors
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_TIMEOUT: 'EXTERNAL_SERVICE_TIMEOUT',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AUTH_DELIVERY_UNAVAILABLE: 'AUTH_DELIVERY_UNAVAILABLE',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // Business logic errors
  BUSINESS_INVALID_STATE: 'BUSINESS_INVALID_STATE',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  QUOTATION_INVALID_STATUS: 'QUOTATION_INVALID_STATUS',
  EVENT_INVALID_STATUS: 'EVENT_INVALID_STATUS',

  // Workflow errors
  WORKFLOW_INVALID_TRANSITION: 'WORKFLOW_INVALID_TRANSITION',
  WORKFLOW_BLOCKED: 'WORKFLOW_BLOCKED',

  // Money validation errors
  MONEY_PRECISION_INVALID: 'MONEY_PRECISION_INVALID',
  CLP_FRACTION_NOT_ALLOWED: 'CLP_FRACTION_NOT_ALLOWED',
  QUOTATION_MONEY_MISMATCH: 'QUOTATION_MONEY_MISMATCH',
  QUOTATION_MONEY_REPAIR_NOT_ALLOWED: 'QUOTATION_MONEY_REPAIR_NOT_ALLOWED',
  QUOTATION_MONEY_REPAIR_NOT_POSSIBLE: 'QUOTATION_MONEY_REPAIR_NOT_POSSIBLE',
  QUOTATION_MONEY_REPAIR_CONFLICT: 'QUOTATION_MONEY_REPAIR_CONFLICT',

  // Chilean-specific errors
  RUT_INVALID: 'RUT_INVALID',
  RUT_REQUIRED: 'RUT_REQUIRED',

  // Token errors
  PASSWORD_RESET_TOKEN_INVALID: 'PASSWORD_RESET_TOKEN_INVALID',
  PASSWORD_RESET_TOKEN_EXPIRED: 'PASSWORD_RESET_TOKEN_EXPIRED',
  PASSWORD_RESET_TOKEN_USED: 'PASSWORD_RESET_TOKEN_USED',
  PASSWORD_RESET_TOKEN_REVOKED: 'PASSWORD_RESET_TOKEN_REVOKED',
  EMAIL_VERIFICATION_TOKEN_INVALID: 'EMAIL_VERIFICATION_TOKEN_INVALID',
  EMAIL_VERIFICATION_TOKEN_EXPIRED: 'EMAIL_VERIFICATION_TOKEN_EXPIRED',
  EMAIL_VERIFICATION_TOKEN_USED: 'EMAIL_VERIFICATION_TOKEN_USED',
  EMAIL_VERIFICATION_TOKEN_REVOKED: 'EMAIL_VERIFICATION_TOKEN_REVOKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Error context for debugging and recovery
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  organizationId?: string;
  resourceId?: string;
  field?: string;
  timestamp?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Recovery suggestion for error handling
 */
export interface RecoverySuggestion {
  action: string;
  description: string;
  automated?: boolean;
}

/**
 * Base error response structure
 */
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  statusCode: number;
  category: ErrorCategory;
  context?: ErrorContext;
  recovery?: RecoverySuggestion;
  repairable?: boolean;
  field?: string;
  resourceId?: string;
  retryAfter?: number;
  errors?: ErrorResponse[];
}

/**
 * Base Kokecore error class
 */
export class KokecoreError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly category: ErrorCategory;
  public readonly context?: ErrorContext;
  public readonly recovery?: RecoverySuggestion;
  public readonly repairable: boolean;
  public readonly field?: string;
  public readonly resourceId?: string;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    category: ErrorCategory = ErrorCategory.INTERNAL,
    context?: ErrorContext,
    recovery?: RecoverySuggestion,
    repairable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.category = category;
    this.context = context;
    this.recovery = recovery;
    this.repairable = repairable;
    this.field = context?.field;
    this.resourceId = context?.resourceId;
    this.timestamp = context?.timestamp || new Date().toISOString();

    const errorConstructor = Error as ErrorConstructor & {
      captureStackTrace?: (targetObject: object, constructorOpt?: object) => void;
    };
    errorConstructor.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      category: this.category,
      recovery: this.recovery,
      repairable: this.repairable,
      field: this.field,
      resourceId: this.resourceId,
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends KokecoreError {
  constructor(code: ErrorCode, message: string, field?: string, context?: ErrorContext) {
    super(
      code,
      message,
      400,
      ErrorCategory.VALIDATION,
      { ...context, field },
      {
        action: 'fix_validation',
        description: 'Correct the invalid field value and retry the request',
        automated: false,
      },
      true
    );
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends KokecoreError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(
      code,
      message,
      401,
      ErrorCategory.AUTHENTICATION,
      context,
      {
        action: 'reauthenticate',
        description: 'Please log in again to continue',
        automated: false,
      },
      false
    );
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends KokecoreError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(
      code,
      message,
      403,
      ErrorCategory.AUTHORIZATION,
      context,
      {
        action: 'request_permissions',
        description: 'Contact your administrator to request the necessary permissions',
        automated: false,
      },
      false
    );
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends KokecoreError {
  constructor(code: ErrorCode, message: string, resourceId?: string, context?: ErrorContext) {
    super(
      code,
      message,
      404,
      ErrorCategory.NOT_FOUND,
      { ...context, resourceId },
      {
        action: 'verify_resource',
        description: 'Verify the resource ID and try again',
        automated: false,
      },
      false
    );
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends KokecoreError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(
      code,
      message,
      409,
      ErrorCategory.CONFLICT,
      context,
      {
        action: 'resolve_conflict',
        description: 'Resolve the conflict and retry the request',
        automated: false,
      },
      true
    );
  }
}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitExceededException extends KokecoreError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests', context?: ErrorContext) {
    super(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message,
      429,
      ErrorCategory.RATE_LIMIT,
      context,
      {
        action: 'retry_later',
        description: `Please wait ${retryAfterSeconds} seconds before retrying`,
        automated: true,
      },
      false
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }

  override toJSON(): ErrorResponse {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfterSeconds,
    } as ErrorResponse;
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends KokecoreError {
  constructor(
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    message = 'Internal server error',
    context?: ErrorContext
  ) {
    super(
      code,
      message,
      500,
      ErrorCategory.INTERNAL,
      context,
      {
        action: 'contact_support',
        description: 'An unexpected error occurred. Please try again later or contact support',
        automated: false,
      },
      false
    );
  }
}

/**
 * External service unavailable error (503)
 */
export class ServiceUnavailableError extends KokecoreError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(
      code,
      message,
      503,
      ErrorCategory.EXTERNAL_SERVICE,
      context,
      {
        action: 'retry_later',
        description: 'The service is temporarily unavailable. Please try again later',
        automated: true,
      },
      false
    );
  }
}

/**
 * Aggregated error for multiple validation errors
 */
export class AggregatedError extends KokecoreError {
  public readonly errors: KokecoreError[];

  constructor(errors: KokecoreError[], context?: ErrorContext) {
    super(
      ERROR_CODES.VALIDATION_INVALID_INPUT,
      'Multiple validation errors occurred',
      400,
      ErrorCategory.VALIDATION,
      context,
      {
        action: 'fix_all_errors',
        description: 'Fix all validation errors and retry the request',
        automated: false,
      },
      true
    );
    this.errors = errors;
  }

  override toJSON(): ErrorResponse {
    return {
      ...super.toJSON(),
      errors: this.errors.map((e) => e.toJSON()),
    } as ErrorResponse;
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends KokecoreError {
  constructor(serviceName: string, context?: ErrorContext) {
    super(
      ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE,
      `Service ${serviceName} is temporarily unavailable due to circuit breaker`,
      503,
      ErrorCategory.EXTERNAL_SERVICE,
      { ...context, metadata: { serviceName } },
      {
        action: 'retry_later',
        description: 'The service is temporarily unavailable. Please try again later',
        automated: true,
      },
      false
    );
  }
}

/**
 * Helper function to get error code from HTTP status
 */
export function codeForStatus(statusCode: number): ErrorCode {
  const statusMap: Record<number, ErrorCode> = {
    400: ERROR_CODES.VALIDATION_INVALID_INPUT,
    401: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    403: ERROR_CODES.AUTH_FORBIDDEN,
    404: ERROR_CODES.RESOURCE_NOT_FOUND,
    409: ERROR_CODES.RESOURCE_CONFLICT,
    429: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    500: ERROR_CODES.INTERNAL_ERROR,
    503: ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE,
  };
  return statusMap[statusCode] || ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Helper function to get category from error code
 */
export function categoryForCode(code: ErrorCode): ErrorCategory {
  if (code.startsWith('VALIDATION')) return ErrorCategory.VALIDATION;
  if (code === ERROR_CODES.AUTH_FORBIDDEN || code === ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS) {
    return ErrorCategory.AUTHORIZATION;
  }
  if (code.startsWith('EXTERNAL') || code.includes('DELIVERY'))
    return ErrorCategory.EXTERNAL_SERVICE;
  if (code.startsWith('AUTH')) return ErrorCategory.AUTHENTICATION;
  if (code.startsWith('RESOURCE') || code.endsWith('_NOT_FOUND')) return ErrorCategory.NOT_FOUND;
  if (code.startsWith('DUPLICATE') || code.includes('CONFLICT')) return ErrorCategory.CONFLICT;
  if (code.startsWith('RATE_LIMIT')) return ErrorCategory.RATE_LIMIT;
  if (code.startsWith('DATABASE')) return ErrorCategory.DATABASE;
  if (code.startsWith('NETWORK')) return ErrorCategory.NETWORK;
  if (code.startsWith('BUSINESS')) return ErrorCategory.BUSINESS;
  if (code.startsWith('WORKFLOW')) return ErrorCategory.WORKFLOW;
  return ErrorCategory.INTERNAL;
}

/**
 * Error factory for creating typed errors
 */
export class ErrorFactory {
  static validation(
    code: ErrorCode,
    message: string,
    field?: string,
    context?: ErrorContext
  ): ValidationError {
    return new ValidationError(code, message, field, context);
  }

  static authentication(
    code: ErrorCode,
    message: string,
    context?: ErrorContext
  ): AuthenticationError {
    return new AuthenticationError(code, message, context);
  }

  static authorization(
    code: ErrorCode,
    message: string,
    context?: ErrorContext
  ): AuthorizationError {
    return new AuthorizationError(code, message, context);
  }

  static notFound(
    code: ErrorCode,
    message: string,
    resourceId?: string,
    context?: ErrorContext
  ): NotFoundError {
    return new NotFoundError(code, message, resourceId, context);
  }

  static conflict(code: ErrorCode, message: string, context?: ErrorContext): ConflictError {
    return new ConflictError(code, message, context);
  }

  static rateLimit(
    retryAfterSeconds: number,
    message?: string,
    context?: ErrorContext
  ): RateLimitExceededException {
    return new RateLimitExceededException(retryAfterSeconds, message, context);
  }

  static internal(code?: ErrorCode, message?: string, context?: ErrorContext): InternalServerError {
    return new InternalServerError(code, message, context);
  }

  static serviceUnavailable(
    code: ErrorCode,
    message: string,
    context?: ErrorContext
  ): ServiceUnavailableError {
    return new ServiceUnavailableError(code, message, context);
  }

  static aggregated(errors: KokecoreError[], context?: ErrorContext): AggregatedError {
    return new AggregatedError(errors, context);
  }

  static circuitBreaker(serviceName: string, context?: ErrorContext): CircuitBreakerOpenError {
    return new CircuitBreakerOpenError(serviceName, context);
  }
}

/**
 * Error handler middleware interface
 */
export interface ErrorHandler {
  handle(error: unknown): ErrorResponse;
}

/**
 * Default error handler
 */
export class DefaultErrorHandler implements ErrorHandler {
  handle(error: unknown): ErrorResponse {
    if (error instanceof KokecoreError) {
      return error.toJSON();
    }

    // Handle standard JavaScript errors
    if (error instanceof Error) {
      return new InternalServerError(ERROR_CODES.INTERNAL_UNEXPECTED, error.message, {
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }).toJSON();
    }

    // Handle unknown errors
    return new InternalServerError(
      ERROR_CODES.INTERNAL_UNEXPECTED,
      'An unexpected error occurred',
      {
        timestamp: new Date().toISOString(),
      }
    ).toJSON();
  }
}
