# @kokecore/config

Type-safe environment configuration with validation and schema support.

## Features

- Environment variable parsing with sensible defaults
- Zod schema validation
- Production-specific safety checks
- CORS origin validation
- Type-safe configuration objects

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import { readRuntimeConfig, readApiConfig } from '@kokecore/config';

const config = readRuntimeConfig(process.env);
console.log(config.api.port);
console.log(config.auth.jwtAccessSecret);
```

## Configuration Modules

- `readApiConfig(env)` - API configuration
- `readAuthConfig(env)` - Authentication configuration
- `readOrganizationConfig(env)` - Organization configuration
- `readPasswordRecoveryConfig(env)` - Email/recovery configuration
- `readProductIntegrationsConfig(env)` - Integrations configuration
- `readRedisConfig(env)` - Redis configuration
- `readRuntimeConfig(env)` - Complete configuration

## Environment Variables

See `src/index.ts` for the full list of supported variables.
