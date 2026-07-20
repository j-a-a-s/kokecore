# Kokecore

Internal reusable libraries for KOKE GROUP Node.js/TypeScript applications.

> **Alpha:** every package is private and `UNLICENSED`. Public npm publishing
> is blocked. No package is declared stable or production-ready.

## Runtime requirements

- Node.js `>=22 <25`
- pnpm `>=8 <10`

Node.js 18 and 20 are not supported because they are not covered by the current
compatibility and consumer-test matrix.

## Overview

KOKE CORE is a collection of reusable library candidates being hardened before
approved consumption. Each library is designed to be:

- **Framework-agnostic**: Works with NestJS, Express, Fastify, or vanilla Node.js
- **Type-safe**: Full TypeScript support with strict mode
- **Well-tested**: Comprehensive unit and integration tests
- **Secure**: Security-first approach with best practices
- **Documented**: Clear API documentation and examples

## Packages

### @kokecore/config

Product-neutral environment readers, coercion, and typed schema composition.

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

## Internal development

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:coverage
pnpm test:consumer
pnpm package:validate
```

## Usage

### @kokecore/config

```typescript
import { defineConfigSchema, readInteger, validateEnvironment } from '@kokecore/config';

const serverSchema = defineConfigSchema(['PORT'], (environment) => ({
  port: readInteger(environment, 'PORT', { defaultValue: 3000, minimum: 1 }),
}));

const config = validateEnvironment(serverSchema, process.env);
```

### @kokecore/auth

```typescript
import { PasswordService } from '@kokecore/auth';

const passwordService = new PasswordService(authConfig);
const hash = await passwordService.hashPassword(password);
```

### @kokecore/calendar

```typescript
import { CalendarProvider, type CalendarEvent } from '@kokecore/calendar';

const provider: CalendarProvider = CalendarProvider.GOOGLE;
const event: CalendarEvent = loadEvent();
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

## Governance

The binding package controls are documented in:

- [Compatibility matrix](docs/COMPATIBILITY_MATRIX.md)
- [Licensing and IP policy](docs/LICENSING_AND_IP_POLICY.md)
- [Public API policy](docs/PUBLIC_API_POLICY.md)
- [Package maturity](docs/PACKAGE_MATURITY.md)
- [Kaklen consumption gate](docs/KAKLEN_CONSUMPTION_GATE.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Legal status

Proprietary and internal during Alpha. See [LICENSE](LICENSE) and the
[licensing policy](docs/LICENSING_AND_IP_POLICY.md). Public distribution
requires a later legal decision.

## Support

Use the private repository issue tracker. Do not disclose source, package
tarballs, security findings, or credentials in public channels.
