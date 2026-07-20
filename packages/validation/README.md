# @kokecore/validation

Comprehensive validation and sanitization library with international support.

## Features

- Zod schema helpers
- Chilean RUT validation
- Money precision validation
- International phone validation
- IBAN validation
- HTML escaping for display boundaries
- PII masking

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import {
  isValidChileanRut,
  normalizeChileanRut,
  createMoneySchema,
  sanitizeInput,
} from '@kokecore/validation';

isValidChileanRut('12.345.678-5'); // true
normalizeChileanRut('12.345.678-5'); // '12345678-5'

const clpSchema = createMoneySchema('CLP');
clpSchema.parse(1000); // ok
```

## Common Schemas

- `commonSchemas.email`
- `commonSchemas.chileanRut`
- `commonSchemas.iban`
- `commonSchemas.uuid`
- `createMoneySchema(currency)`
- `createPhoneSchema(countryCode?)`
