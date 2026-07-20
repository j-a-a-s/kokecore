# Kokecore

Enterprise-grade reusable libraries for Node.js/TypeScript applications.

## Overview

Kokecore is a collection of production-ready, battle-tested libraries extracted from real-world applications. Each library is designed to be:

- **Framework-agnostic**: Works with NestJS, Express, Fastify, or vanilla Node.js
- **Type-safe**: Full TypeScript support with strict mode
- **Well-tested**: Comprehensive unit and integration tests
- **Secure**: Security-first approach with best practices
- **Documented**: Clear API documentation and examples

## Packages

### @kokecore/config

Type-safe environment configuration with validation and schema support.

### @kokecore/errors

Structured error handling with consistent error codes and context.

### @kokecore/logging

Structured logging with OpenTelemetry tracing and sensitive data redaction.

### @kokecore/validation

Comprehensive validation and sanitization library with international support.

### @kokecore/rbac

Role-Based and Attribute-Based Access Control (RBAC/ABAC).

### @kokecore/storage

Multi-cloud storage abstraction with S3, Azure, GCS, and MinIO support.

### @kokecore/auth

Enterprise authentication with JWT, OAuth2, MFA, and session management.

### @kokecore/calendar

Calendar synchronization with Google Calendar, Microsoft Graph, and Apple Calendar.

## Installation

```bash
# Install individual packages
pnpm add @kokecore/config
pnpm add @kokecore/auth
```

## Usage

### @kokecore/config

```typescript
import { readApiConfig } from '@kokecore/config';

const config = readApiConfig(process.env);
// Fully typed configuration with validation
```

### @kokecore/auth

```typescript
import { JwtAuthGuard } from '@kokecore/auth';

@Controller('protected')
@UseGuards(JwtAuthGuard)
class ProtectedController {
  // Your controller logic
}
```

### @kokecore/calendar

```typescript
import { GoogleCalendarService } from '@kokecore/calendar';

const calendarService = new GoogleCalendarService(credentials);
await calendarService.syncEvent(event);
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

## Best Practices

Kokecore libraries follow these principles:

1. **Security First**: All libraries are built with security as a primary concern
2. **Type Safety**: Full TypeScript support with no `any` types
3. **Testing**: >80% code coverage with comprehensive test suites
4. **Documentation**: Clear API docs with examples
5. **Performance**: Optimized for production workloads
6. **Maintainability**: Clean code with clear separation of concerns

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues and questions, please use the GitHub issue tracker.
