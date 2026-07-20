# @kokecore/auth

Enterprise authentication with JWT, OAuth2, MFA, and session management.

## Features

- Argon2id password hashing
- JWT access/refresh token handling
- Session versioning for invalidation
- Device fingerprinting
- MFA hooks
- OAuth2 provider support
- Rate limiting
- Audit logging

## Installation

```bash
pnpm add @kokecore/auth
```

## Usage

```typescript
import { AuthService } from '@kokecore/auth';

const auth = new AuthService(config);
const { success, tokenPair } = await auth.authenticate(email, password, ip, userAgent);

await auth.logoutAll(userId);
```
