# @kokecore/auth

Internal authentication primitives. The package is not approved for auth
extraction or production use during Alpha.

## Features

- Argon2id password hashing
- JWT access/refresh token handling
- Session versioning for invalidation
- Device fingerprinting
- MFA hooks
- OAuth2 provider support
- Rate limiting
- Audit logging

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import { PasswordService } from '@kokecore/auth';

const passwords = new PasswordService(config);
const passwordHash = await passwords.hashPassword(password);
const matches = await passwords.verifyPassword(password, passwordHash);
```
