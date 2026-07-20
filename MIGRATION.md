# Migration Guide: Kaklen → Kokecore

This guide describes how to migrate Kaklen from its internal packages and inline implementations to the new `kokecore` reusable libraries.

## Overview

Kaklen currently contains several cross-cutting concerns embedded in `apps/api` and `packages`:

- `packages/config` → `@kokecore/config`
- `apps/api/src/common/error-codes.ts` and `api-error.filter.ts` → `@kokecore/errors`
- `apps/api/src/common/runtime-logging.ts` → `@kokecore/logging`
- `apps/api/src/auth/*` → `@kokecore/auth`
- `apps/api/src/storage/*` → `@kokecore/storage`
- `apps/api/src/organizations/permissions.ts` and `organization-access.guard.ts` → `@kokecore/rbac`
- `apps/api` validation patterns → `@kokecore/validation`
- New calendar integration → `@kokecore/calendar`

## Step 1: Publish Kokecore

Before Kaklen can consume the libraries, publish them to your private registry or npm:

```bash
cd /Users/jorgealarcon/CascadeProjects/kokecore
pnpm install
pnpm build
pnpm changeset
pnpm release
pnpm release:publish
```

Or, for local development, link packages with pnpm:

```bash
cd /Users/jorgealarcon/CascadeProjects/kokecore
pnpm link --global

cd /path/to/kaklen
pnpm link --global @kokecore/config @kokecore/auth @kokecore/errors @kokecore/logging @kokecore/rbac @kokecore/storage @kokecore/validation @kokecore/calendar
```

## Step 2: Update Kaklen Dependencies

Add to Kaklen root `package.json` or `apps/api/package.json`:

```json
{
  "dependencies": {
    "@kokecore/config": "workspace:*",
    "@kokecore/errors": "workspace:*",
    "@kokecore/logging": "workspace:*",
    "@kokecore/auth": "workspace:*",
    "@kokecore/storage": "workspace:*",
    "@kokecore/rbac": "workspace:*",
    "@kokecore/validation": "workspace:*",
    "@kokecore/calendar": "workspace:*"
  }
}
```

For published versions, replace `workspace:*` with the version range.

## Step 3: Replace Configuration

### Before (Kaklen)

```typescript
import { readApiConfig } from '@kaklen/config';
```

### After (Kokecore)

```typescript
import { readApiConfig, readRuntimeConfig } from '@kokecore/config';
```

Kokecore config adds Zod schemas on top of the manual validation. No runtime API changes are required; however, error messages are more descriptive.

## Step 4: Replace Error Handling

### Before

```typescript
import { ERROR_CODES } from './common/error-codes';
throw new BadRequestException('Invalid storage scope');
```

### After

```typescript
import { ErrorFactory, ERROR_CODES } from '@kokecore/errors';
throw ErrorFactory.validation(ERROR_CODES.VALIDATION_INVALID_INPUT, 'Invalid storage scope');
```

Or with NestJS integration:

```typescript
import { KokecoreError, ValidationError } from '@kokecore/errors';

@Catch(KokecoreError)
class KokecoreExceptionFilter implements ExceptionFilter {
  catch(error: KokecoreError, host: ArgumentsHost) { ... }
}
```

## Step 5: Replace Logging

### Before

```typescript
import { runtimeLoggingMiddleware } from './common/runtime-logging';
app.use(runtimeLoggingMiddleware);
```

### After

```typescript
import { initLogger, createRequestLoggingMiddleware } from '@kokecore/logging';

const logger = initLogger({
  service: 'kaklen-api',
  environment: process.env.NODE_ENV || 'development',
});
app.use(
  createRequestLoggingMiddleware({
    service: 'kaklen-api',
    environment: process.env.NODE_ENV || 'development',
  })
);
```

## Step 6: Replace RBAC

### Before

```typescript
import { Role, PERMISSIONS, permissionsForRole } from './organizations/permissions';
```

### After

```typescript
import { Role, PERMISSIONS, PermissionChecker, ABACEngine } from '@kokecore/rbac';

const checker = new PermissionChecker(new ABACEngine(), ...);
checker.checkPermissions(role, ['events.read', 'events.update'], { organizationId, userId });
```

## Step 7: Replace Storage

### Before

```typescript
import { S3StorageService } from './storage/s3-storage.service';
```

### After

```typescript
import { StorageFactory, StorageProvider, EnhancedStorageService } from '@kokecore/storage';

const storage = StorageFactory.create({
  provider: StorageProvider.S3,
  awsRegion: 'us-east-1',
  awsS3Bucket: 'my-bucket',
});

const enhanced = new EnhancedStorageService(storage, config);
const result = await enhanced.createSecureUploadUrl(input);
const downloadUrl = await enhanced.createCdnDownloadUrl({ key: result.key });
```

## Step 8: Replace Authentication

### Before

```typescript
import { AuthService } from './auth/auth.service';
```

### After

```typescript
import { AuthService } from '@kokecore/auth';

const authService = new AuthService(config);
const { success, tokenPair } = await authService.authenticate(email, password, ip, userAgent);
```

## Step 9: Add Calendar Integration

Kaklen can now use `@kokecore/calendar` to sync events with Google/Outlook/Apple calendars:

```typescript
import { CalendarService, CalendarProvider } from '@kokecore/calendar';

const calendar = new CalendarService();
calendar.registerIntegration({
  provider: CalendarProvider.GOOGLE,
  userId,
  organizationId,
  credentials: { accessToken, refreshToken, expiresAt },
  syncEnabled: true,
  syncDirection: 'BIDIRECTIONAL',
});

const result = await calendar.syncEvent(event);
```

## Step 10: Update Validation

Replace inline validation helpers with `@kokecore/validation`:

```typescript
import {
  isValidChileanRut,
  assertMoneyPrecision,
  sanitizeInput,
  createPhoneSchema,
} from '@kokecore/validation';
```

## Step 11: Testing

Run Kaklen's test suite after each replacement to catch regressions:

```bash
cd /path/to/kaklen
pnpm install
pnpm test
```

## Backwards Compatibility

Kokecore libraries are framework-agnostic. If a NestJS-specific implementation is required, wrap Kokecore classes in NestJS providers or create thin adapters in Kaklen.

## Recommended Migration Order

1. `@kokecore/config` (no internal dependencies)
2. `@kokecore/errors` (no internal dependencies)
3. `@kokecore/validation` (no internal dependencies)
4. `@kokecore/logging` (depends on errors for audit context)
5. `@kokecore/rbac` (no dependencies)
6. `@kokecore/storage` (depends on errors/validation)
7. `@kokecore/auth` (depends on errors/validation)
8. `@kokecore/calendar` (depends on auth/storage)

## Gotchas

- `zod` errors in `@kokecore/config` use `ZodError` exceptions. Catch them and translate to HTTP responses.
- `@kokecore/auth` does not provide a NestJS `JwtService`. Use it inside a NestJS provider.
- `@kokecore/storage` abstract clients are placeholders until real cloud SDK instances are injected.

## Support

Open an issue in the `kokecore` repository for migration questions.
