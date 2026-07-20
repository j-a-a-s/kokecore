import {
  ErrorFactory,
  DefaultErrorHandler,
  codeForStatus,
  categoryForCode,
  ERROR_CODES,
  ErrorCategory,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitExceededException,
  AggregatedError,
} from './index';

describe('ErrorFactory', () => {
  it('creates validation errors with field info', () => {
    const error = ErrorFactory.validation(
      ERROR_CODES.VALIDATION_INVALID_INPUT,
      'Invalid input',
      'email'
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Invalid input');
    expect(error.toJSON().statusCode).toBe(400);
    expect(error.toJSON().field).toBe('email');
  });

  it('creates authentication errors', () => {
    const error = ErrorFactory.authentication(
      ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      'Invalid credentials'
    );
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.toJSON().statusCode).toBe(401);
  });

  it('creates not found errors with resource id', () => {
    const error = ErrorFactory.notFound(ERROR_CODES.RESOURCE_NOT_FOUND, 'Not found', 'user-123');
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.toJSON().statusCode).toBe(404);
    expect(error.toJSON().resourceId).toBe('user-123');
  });

  it('creates conflict errors', () => {
    const error = ErrorFactory.conflict(ERROR_CODES.RESOURCE_CONFLICT, 'Conflict');
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.toJSON().statusCode).toBe(409);
  });

  it('creates rate limit errors with retry after', () => {
    const error = ErrorFactory.rateLimit(60, 'Too many requests');
    expect(error).toBeInstanceOf(RateLimitExceededException);
    expect(error.toJSON().statusCode).toBe(429);
    expect(error.toJSON().retryAfter).toBe(60);
  });

  it('creates aggregated errors from multiple errors', () => {
    const errors = [ErrorFactory.validation(ERROR_CODES.VALIDATION_INVALID_INPUT, 'Bad')];
    const aggregated = ErrorFactory.aggregated(errors);
    expect(aggregated).toBeInstanceOf(AggregatedError);
    expect(aggregated.toJSON().errors).toHaveLength(1);
  });
});

describe('Error helpers', () => {
  it('maps HTTP status codes to error codes', () => {
    expect(codeForStatus(400)).toBe(ERROR_CODES.VALIDATION_INVALID_INPUT);
    expect(codeForStatus(401)).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    expect(codeForStatus(403)).toBe(ERROR_CODES.AUTH_FORBIDDEN);
    expect(codeForStatus(404)).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
    expect(codeForStatus(409)).toBe(ERROR_CODES.RESOURCE_CONFLICT);
    expect(codeForStatus(429)).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    expect(codeForStatus(500)).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(codeForStatus(503)).toBe(ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE);
    expect(codeForStatus(999)).toBe(ERROR_CODES.INTERNAL_ERROR);
  });

  it('maps error codes to categories', () => {
    expect(categoryForCode(ERROR_CODES.VALIDATION_INVALID_INPUT)).toBe(ErrorCategory.VALIDATION);
    expect(categoryForCode(ERROR_CODES.AUTH_FORBIDDEN)).toBe(ErrorCategory.AUTHORIZATION);
    expect(categoryForCode(ERROR_CODES.RESOURCE_NOT_FOUND)).toBe(ErrorCategory.NOT_FOUND);
    expect(categoryForCode(ERROR_CODES.RATE_LIMIT_EXCEEDED)).toBe(ErrorCategory.RATE_LIMIT);
    expect(categoryForCode('UNKNOWN_CODE' as any)).toBe(ErrorCategory.INTERNAL);
  });
});

describe('DefaultErrorHandler', () => {
  const handler = new DefaultErrorHandler();

  it('returns JSON for KokecoreError', () => {
    const error = ErrorFactory.conflict(ERROR_CODES.RESOURCE_CONFLICT, 'Conflict');
    const response = handler.handle(error);
    expect(response.statusCode).toBe(409);
    expect(response.message).toBe('Conflict');
    expect(response.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);
  });

  it('wraps standard Error in InternalServerError', () => {
    const response = handler.handle(new Error('Something broke'));
    expect(response.statusCode).toBe(500);
    expect(response.message).toBe('Something broke');
    expect(response.code).toBe(ERROR_CODES.INTERNAL_UNEXPECTED);
  });

  it('wraps unknown errors safely', () => {
    const response = handler.handle('boom');
    expect(response.statusCode).toBe(500);
    expect(response.message).toBe('An unexpected error occurred');
  });
});
