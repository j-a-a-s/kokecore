# @kokecore/config

Product-neutral environment readers, primitive coercion, and typed schema
composition for Node.js applications.

## Runtime

- Node.js `>=22 <25`
- pnpm `>=8 <10` for internal package workflows

## Certified public API

The package root exposes:

- safe required and optional string readers;
- boolean, integer, list, enum, and runtime-mode coercion;
- typed schema definition and composition;
- optional rejection of unknown variables;
- `ConfigurationError` with value-safe issue codes and messages.

It does not define application variable names, product defaults, deployment
policy, credentials, routes, or business schemas.

## Usage

```typescript
import {
  defineConfigSchema,
  readBoolean,
  readInteger,
  readString,
  validateEnvironment,
} from '@kokecore/config';

const serviceSchema = defineConfigSchema(
  ['SERVICE_HOST', 'SERVICE_PORT', 'FEATURE_ENABLED'],
  (environment) => ({
    host: readString(environment, 'SERVICE_HOST'),
    port: readInteger(environment, 'SERVICE_PORT', {
      defaultValue: 3000,
      minimum: 1,
      maximum: 65535,
    }),
    featureEnabled: readBoolean(environment, 'FEATURE_ENABLED', {
      defaultValue: false,
    }),
  })
);

const config = validateEnvironment(serviceSchema, process.env);
```

Reject unknown variables only when the supplied environment object has already
been scoped to the application contract:

```typescript
const config = validateEnvironment(serviceSchema, scopedEnvironment, {
  unknownVariables: 'reject',
});
```

Invalid input values are never included in `ConfigurationError.message` or its
typed `issues`. Consumers may log the key, code, and expected constraint without
logging the rejected value.

## Distribution

Install only from the immutable, checksum-verified internal Alpha artifact.
Public registry publication and deep imports are prohibited. Import exclusively
from `@kokecore/config`.
