# @kokecore/rbac

Role-Based and Attribute-Based Access Control (RBAC/ABAC) with improved permission system.

## Features

- Hierarchical role permissions
- Attribute-based rules
- Permission caching
- Permission auditing
- Conflict detection
- Permission templates

## Installation

```bash
pnpm add @kokecore/rbac
```

## Usage

```typescript
import { Role, PermissionChecker, ABACEngine, permissionsForRole } from '@kokecore/rbac';

const permissions = permissionsForRole(Role.MANAGER);
console.log(permissions);

const checker = new PermissionChecker(new ABACEngine());
checker.checkPermissions(Role.MANAGER, ['events.read'], { userId, organizationId });
```

## Roles

- `OWNER`
- `ADMIN`
- `MANAGER`
- `MEMBER`
- `VIEWER`
