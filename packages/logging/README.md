# @kokecore/logging

Structured logging with OpenTelemetry tracing and sensitive data redaction.

## Features

- Pino-based JSON logging
- Request ID tracking
- Correlation ID middleware
- Performance monitoring
- Sensitive data redaction
- OpenTelemetry trace/span context

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import { initLogger, info, error, createRequestLoggingMiddleware } from '@kokecore/logging';

initLogger({
  service: 'my-service',
  environment: 'production',
  level: 'info',
});

info('User signed in', { userId });
error('Database query failed', err, { query });
```

## Express Middleware

```typescript
import express from 'express';
import { createRequestLoggingMiddleware } from '@kokecore/logging';

const app = express();
app.use(createRequestLoggingMiddleware({ service: 'my-service', environment: 'production' }));
```
