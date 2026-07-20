# @kokecore/errors

Structured error handling with consistent error codes, context, and recovery suggestions.

## Features

- Hierarchical error code catalog
- Error categories (4xx, 5xx, business logic)
- Context-aware errors with request/organization/user IDs
- Recovery suggestions for consumers
- Aggregated errors for batch validation
- Circuit breaker exception

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import { ErrorFactory, ERROR_CODES, ValidationError } from '@kokecore/errors';

const error = ErrorFactory.validation(
  ERROR_CODES.VALIDATION_INVALID_INPUT,
  'Invalid email format',
  'email'
);

console.log(error.toJSON());
```

## Error Factory Methods

- `ErrorFactory.validation(code, message, field, context?)`
- `ErrorFactory.authentication(code, message, context?)`
- `ErrorFactory.authorization(code, message, context?)`
- `ErrorFactory.notFound(code, message, resourceId, context?)`
- `ErrorFactory.conflict(code, message, context?)`
- `ErrorFactory.rateLimit(retryAfterSeconds, message?, context?)`
- `ErrorFactory.internal(code?, message?, context?)`
- `ErrorFactory.serviceUnavailable(code, message, context?)`
- `ErrorFactory.aggregated(errors, context?)`
- `ErrorFactory.circuitBreaker(serviceName, context?)`
