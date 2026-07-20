# Kaklen configuration integration inventory

## Evidence scope

- Audit date: 2026-07-20
- KOKE CORE baseline: `9d74f7f39bdf3bce027dd97ec7d0d203950b26fd`
- Kaklen baseline: `4e8e01f85207b1af377c5465229171492ad0e0ce`
- Search commands:
  - `rg -n '"@kokecore/config"|@kokecore/config' --glob 'package.json' .`
  - `rg -n '@kokecore/config' --glob '!node_modules' .`
  - `rg -l 'process\\.env' --glob '!node_modules' --glob '!dist' .`
  - `rg -n '@kokecore/config/' --glob '!node_modules' .`

The audit found no deep import from `@kokecore/config`. All current imports use
the package root.

## Classification

| Classification     | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `CORE`             | Product-neutral behavior suitable for the certified public package API.    |
| `KAKLEN_ONLY`      | Product, deployment, or test behavior that remains owned by Kaklen.        |
| `ADAPTER_REQUIRED` | Kaklen owns the schema and may consume neutral KOKE CORE parsing helpers.  |
| `REMOVE`           | Redundant dependency or export that must be removed during this migration. |
| `REVIEW`           | Existing direct environment access retained without behavioral change.     |

## Dependency and import inventory

| Location                       | Current use                                      | Decision           | Result required                                                   |
| ------------------------------ | ------------------------------------------------ | ------------------ | ----------------------------------------------------------------- |
| `apps/api/package.json`        | Direct `link:` dependency, no source import      | `REMOVE`           | Remove only this unused Config dependency.                        |
| `packages/config/package.json` | Direct `link:` dependency                        | `ADAPTER_REQUIRED` | Replace with the immutable certified tarball.                     |
| `packages/config/src/index.ts` | Reexports two product-shaped KOKE CORE symbols   | `REMOVE`           | Remove reexports and consume only neutral root exports.           |
| `pnpm-lock.yaml`               | Two `link:` resolutions for Config               | `REMOVE`           | Regenerate with the relative versioned tarball and its integrity. |
| Other KOKE CORE dependencies   | Seven local links outside this package migration | `KAKLEN_ONLY`      | Preserve byte-for-byte except for lockfile mechanical ordering.   |

## Schema, default, and validation ownership

| Kaklen configuration area | Examples                                                                      | Decision           |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| API runtime               | ports, PostgreSQL, CORS, AWS, Swagger, proxy trust, build metadata            | `KAKLEN_ONLY`      |
| Authentication            | JWT secrets and durations, cookies, allowed origins                           | `KAKLEN_ONLY`      |
| Organizations             | invitation duration and application URL                                       | `KAKLEN_ONLY`      |
| Email and recovery        | SMTP, reset and verification expiration, feature flags                        | `KAKLEN_ONLY`      |
| Product integrations      | WhatsApp mode, payment sandbox, product-specific secret policy                | `KAKLEN_ONLY`      |
| Redis                     | Kaklen key prefixes, TLS and production-host restrictions                     | `KAKLEN_ONLY`      |
| String normalization      | trim, optional values, required/default behavior                              | `CORE`             |
| Primitive coercion        | strict booleans, bounded integers, comma-separated lists, enums               | `CORE`             |
| Schema composition        | combining independently owned configuration readers                           | `CORE`             |
| Unknown-variable policy   | explicit allow/reject behavior without exposing values                        | `CORE`             |
| Error safety              | typed issue codes and messages that never include environment values          | `CORE`             |
| Product security policy   | HTTPS-only origins, PostgreSQL TLS, Redis TLS, cryptographic secret diversity | `ADAPTER_REQUIRED` |

The six product schemas previously exposed by `@kokecore/config` are classified
`REMOVE`. Their names, defaults, and deployment policy belong to Kaklen. The
certified Core package exposes only neutral readers, coercers, schema composition,
unknown-variable validation, and safe typed errors.

## Runtime environment access

### Product runtime

| Files                                                                                                                                                              | Decision           | Rationale                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| `apps/api/src/main.ts`, `common/runtime-logging.ts`, `health/health.service.ts`                                                                                    | `KAKLEN_ONLY`      | Application bootstrap and operational metadata remain at the Kaklen boundary.                  |
| `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/jwt-auth.guard.ts`                                                                                        | `ADAPTER_REQUIRED` | Existing Kaklen Auth config remains unchanged; future dependency injection is a separate task. |
| `notifications/mail.service.ts`, `organizations/organizations.service.ts`, `redis/redis.service.ts`                                                                | `ADAPTER_REQUIRED` | Product schemas remain in Kaklen and may use certified primitive helpers.                      |
| `payments/payments.service.ts`, `payments/sandbox-payment.gateway.ts`, `quotation-portal/quotation-portal.service.ts`, `whatsapp/whatsapp-notification.service.ts` | `ADAPTER_REQUIRED` | Commercial and delivery configuration must never move to Core.                                 |
| `storage/s3-storage.service.ts`, `storage/storage.module.ts`                                                                                                       | `ADAPTER_REQUIRED` | AWS product wiring remains in Kaklen.                                                          |
| `quotations/quotation-document.service.ts` and direct `NODE_ENV` branches in Organizations and Payments                                                            | `REVIEW`           | Direct mode checks are retained to avoid a functional change in this certification.            |

### Test fixtures

The following files mutate or read `process.env` only to exercise Kaklen-owned
behavior and are classified `KAKLEN_ONLY`:

```text
apps/api/src/auth/auth-delivery-queue.integration.spec.ts
apps/api/src/auth/auth.controller.spec.ts
apps/api/src/auth/auth.e2e-spec.ts
apps/api/src/auth/auth.service.spec.ts
apps/api/src/auth/jwt-auth.guard.spec.ts
apps/api/src/auth/password-recovery.service.spec.ts
apps/api/src/health/health.service.spec.ts
apps/api/src/notifications/mail.service.integration.spec.ts
apps/api/src/notifications/mail.service.spec.ts
apps/api/src/organizations/organizations.service.spec.ts
apps/api/src/payments/payments.service.lifecycle.spec.ts
apps/api/src/payments/payments.service.spec.ts
apps/api/src/payments/sandbox-payment.gateway.spec.ts
apps/api/src/quotation-portal/quotation-portal.service.spec.ts
apps/api/src/quotations/quotations.repair.integration.spec.ts
apps/api/src/redis/redis.service.spec.ts
apps/api/src/security/distributed-rate-limit.integration.spec.ts
apps/api/src/security/global-throttling.integration.spec.ts
apps/api/src/storage/storage.service.spec.ts
apps/api/src/whatsapp/whatsapp-notification.service.spec.ts
```

### Local tooling and browser tests

These consumers are application tooling rather than reusable configuration and
are classified `KAKLEN_ONLY`:

```text
e2e/accessibility.spec.mjs
e2e/assisted-product.spec.mjs
e2e/demo-data.spec.mjs
e2e/email-verification.spec.mjs
e2e/mvp.spec.mjs
e2e/password-recovery.spec.mjs
playwright.config.mjs
scripts/build-fresh.mjs
scripts/build-info.mjs
scripts/build-web-pt-br.mjs
scripts/capture-assisted-screenshots.mjs
scripts/db-reset-dev.mjs
scripts/db-validate.mjs
scripts/dev-fresh.mjs
scripts/dev-full-i18n.mjs
scripts/dev-i18n.mjs
scripts/e2e-runner-core.mjs
scripts/init-local.mjs
scripts/local-db-utils.mjs
scripts/quality-pipeline-core.mjs
scripts/run-accessibility.mjs
scripts/run-api-tests.mjs
scripts/run-e2e.mjs
scripts/run-mail-verify.mjs
scripts/run-web-tests.mjs
scripts/serve-i18n.mjs
scripts/start.mjs
scripts/technical-scorecard-core.mjs
scripts/test-coverage.mjs
scripts/test-mutation-critical.mjs
scripts/verify-api-build.mjs
scripts/verify-api-start.mjs
scripts/verify-commit-message.mjs
scripts/verify-external-readiness.mjs
scripts/verify-full-local.mjs
scripts/verify-i18n-server.mjs
scripts/verify-migrations.mjs
scripts/verify-repository-governance.mjs
scripts/write-runtime-config.mjs
```

## Certified integration boundary

Kaklen keeps all variable names, defaults, product validation, and configuration
object shapes. `@kokecore/config` supplies only product-neutral mechanisms:

1. normalize optional strings;
2. read required strings with neutral defaults;
3. coerce booleans, bounded integers, lists, enums, and runtime modes;
4. compose typed schemas;
5. reject unknown variables when the consumer opts in;
6. return typed, value-safe validation errors.

This boundary prevents KOKE CORE from knowing Kaklen domains, routes, clients,
credentials, key prefixes, or commercial integration modes.
