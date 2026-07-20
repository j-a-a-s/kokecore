# @kokecore/config consumption gate

## Certified identity

- Package: `@kokecore/config@0.2.0`
- Artifact source: `cf1acdb6f6bfc3487a5af3b0d1b6f5b1da044c34`
- Neutral API source: `feddd60edeee4c70ce800b21475898d827ce4f1c`
- Packaged integration mechanism: `cf4c86b225d4bcac27859467dbe8d8a738342666`
- Focused SAST: `cc5eea7d82f2dde688ef88eabf30c1592c399f2f`
- Kaklen integration: `0f9bebd49f49a8a1aa5633e09b19bad181760134`
- Kaklen rollback rehearsal: `8f3f64c029a3b7ec15b0f301aa6b6fd573e03581`
- Tarball: `kokecore-config-0.2.0.tgz`
- SHA-256: `bc7d748217b7f9de70cb32280e7fa39e82a9e7a3a8040cb3280c2af9cb854f99`
- Distribution: proprietary internal Alpha artifact; public npm publication prohibited

## Provenance and scope

KOKE GROUP owns both repositories under the proprietary Alpha policy. The
certified implementation was authored in KOKE CORE and did not copy Kaklen
schemas, defaults, customer configuration, credentials, routes, or business
logic. Kaklen retains its product policy in `@kaklen/config` and delegates only
neutral coercion helpers to the package root. KOKE GROUP Platform approves this
record solely for internal Alpha consumption by Kaklen.

No other KOKE CORE package was migrated. Kaklen retains local links for Auth,
Calendar, Errors, Logging, RBAC, Storage, and Validation.

## Public API

The frozen root export contains:

- errors and codes: `CONFIG_ISSUE_CODES`, `ConfigurationError`,
  `isConfigurationError`, `ConfigIssue`, `ConfigIssueCode`;
- schemas: `ConfigSchema`, `defineConfigSchema`, `composeConfigSchemas`,
  `validateEnvironment`, `assertKnownVariables`;
- readers: `readString`, `readOptionalString`, `readBoolean`, `readInteger`,
  `readStringList`, `readEnum`, `readRuntimeMode`;
- coercion: `normalizeOptionalString`, `coerceBoolean`, `coerceInteger`,
  `coerceStringList`, `coerceEnum`;
- types and options: `Environment`, `RuntimeMode`, `StringReadOptions`,
  `BooleanCoercionOptions`, `IntegerCoercionOptions`,
  `StringListCoercionOptions`, `EnumCoercionOptions`, and
  `EnvironmentValidationOptions`.

The package exports only `.`. Product schemas, named product variables, direct
environment access, deep imports, and runtime dependencies are excluded.

## Gate checklist

- [x] IP y procedencia aprobadas
  - Proprietary ownership and no-transfer finding are recorded above and in
    `docs/LICENSING_AND_IP_POLICY.md`.
- [x] Node 22 certificado
  - Node `22.22.0` built Config and passed `29/29` tests. The supported engine is
    `>=22 <25`; Node 18 and 20 are excluded.
- [x] pnpm 9 certificado con Kaklen
  - The clean integration used Kaklen pnpm `9.15.4` with a frozen lockfile.
- [x] API pública congelada
  - `packages/config/api/public-api.json` passes `pnpm api:verify`.
- [x] Deep imports bloqueados
  - The consumer contract checks 3 forbidden paths across all 8 packages: 24/24 rejected.
- [x] Unit tests
  - Config: `29/29`; artifact validator: `3/3`; integration contract helpers: `4/4`.
- [x] Integration tests
  - Kaklen Config compatibility: `5/5`; full Kaklen integration completed.
- [x] Packaged consumer test
  - `REFERENCE_CONSUMER_OK` with pnpm `8.15.0` and `9.15.4` from real tarballs.
- [x] Kaklen build
  - `4/4` workspace builds passed in the clean temporary checkout.
- [x] Kaklen tests
  - Scripts `224/224`, Web `105/105`, API `513/513`, Shared `15/15`, Config `5/5`.
- [x] Kaklen architecture check
  - No cycles across 373 source files.
- [x] Cobertura mínima
  - Config statements/branches/functions/lines: `100/99.04/100/100`; threshold: 80%.
- [x] SAST
  - `pnpm config:sast`: 2 production files, 0 findings; CodeQL remains enabled in CI.
- [x] Secret scan
  - Repository and extracted tarball scans: 0 credential findings.
- [x] Dependency audit
  - `pnpm audit --audit-level high`: no known vulnerabilities.
- [x] SBOM
  - CycloneDX 1.6 generated successfully with 690 components.
- [x] Tarball validado
  - Exact 9-file allowlist, root export, declarations, proprietary LICENSE/NOTICE,
    README, no source maps, no runtime dependencies, no product strings, and checksum verified.
- [x] README actualizado
  - Root and package READMEs document runtime, public API, usage, and internal distribution.
- [x] API snapshot
  - Snapshot contains the 30 certified root declarations and passes verification.
- [x] Changeset
  - `.changeset/certify-neutral-config.md` records the neutral API change.
- [x] Rollback probado
  - Temporary rehearsal ended with `KAKLEN_CONFIG_ROLLBACK_PASSED`; full-checkout
    rollback was rejected after exposing a browser regression, then corrected to restore only Config.
- [x] Link local eliminado
  - Kaklen uses the versioned internal tarball for Config; all other seven links remain local.
- [x] Evidencia ligada a commits exactos
  - Artifact, API, integration, rollback, and security SHAs are listed under Certified identity.

## Reproducible commands

```bash
pnpm config:artifact -- --output /controlled/output
KOKE_CONSUMER_PNPM_VERSION=8.15.0 pnpm test:consumer
KOKE_CONSUMER_PNPM_VERSION=9.15.4 pnpm test:consumer
KAKLEN_SOURCE_PATH=/path/to/kaklen \
  KAKLEN_EXPECTED_SHA=0f9bebd49f49a8a1aa5633e09b19bad181760134 \
  pnpm config:certify:kaklen
pnpm config:sast
```

Kaklen rollback instructions and the executable rehearsal are in
`docs/rollback/KOKECORE_CONFIG_ROLLBACK.md` in the Kaklen repository.

## Decision

All individual controls pass and no Config P0 or P1 remains open.
`@kokecore/config@0.2.0` is therefore `stable` for the exact internal Alpha
artifact above. This decision does not authorize public publication, a registry
migration, or migration of another package.
