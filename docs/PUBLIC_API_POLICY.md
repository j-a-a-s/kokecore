# Public API policy

## Package boundary

Every package exposes exactly one entry point: `src/public.ts`, compiled as
`dist/public.js` and `dist/public.d.ts`. `src/index.ts` is implementation code.
The package `exports` map exposes only `.` and packaged files exclude `src`.

Consumers must import only from the package root:

```ts
import { defineConfigSchema, readString } from '@kokecore/config';
```

Deep imports, repository-relative imports, and imports from `src` or `dist`
are unsupported and blocked by automated validation.

## Compatibility and versioning

- Public symbols and declarations are recorded in a checked-in API snapshot.
- `pnpm api:verify` fails on additions, removals, or signature changes.
- An intentional API change requires updating the snapshot with
  `pnpm api:snapshot`, adding a changeset, and reviewing consumer contracts.
- Backward-compatible additions increment the minor version once a package is
  beta; fixes increment patch.
- Removing or changing a public contract is a breaking change and requires a
  major version after a documented deprecation period.
- Internal and experimental packages may change before `1.0.0`, but every
  change still requires a changeset and consumer evidence.

Deprecations must include a code annotation, replacement guidance, target
removal version, and changelog entry. Accidental exports are defects.
