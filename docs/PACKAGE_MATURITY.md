# Package maturity

Allowed statuses are `experimental`, `internal`, `beta`, `stable`, and
`deprecated`. A `stable` Alpha package is approved only for the exact internal
artifact and consumer contract recorded in its package gate; it is not approved
for public distribution.

| Package                | Status       | Owner               | Version        | Coverage (S/B/F/L)          | Known consumers                       | Compatibility             | Known risks                                                                   | Production ready |
| ---------------------- | ------------ | ------------------- | -------------- | --------------------------- | ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| `@kokecore/auth`       | internal     | KOKE GROUP Platform | `0.3.0-beta.0` | 100 / 95 / 100 / 100        | Kaklen local link; reference consumer | Node 22, TS 5.8, Nest 11  | JWT, MFA and OAuth adapters contain simulated behavior; extraction prohibited | No               |
| `@kokecore/calendar`   | experimental | KOKE GROUP Platform | `0.3.0-beta.0` | 99.49 / 94.20 / 100 / 100   | Kaklen local link                     | Node 22, TS 5.8           | Provider adapters contain simulated behavior                                  | No               |
| `@kokecore/config`     | beta         | KOKE GROUP Platform | `0.2.0`        | 100 / 99.04 / 100 / 100     | Certified temporary Kaklen consumer   | Node 22, pnpm 8/9, TS 5.8 | Permanent private distribution is not approved; public publication prohibited | No               |
| `@kokecore/errors`     | beta         | KOKE GROUP Platform | `0.2.0`        | 100 / 91.30 / 100 / 100     | Kaklen local link; reference consumer | Node 22, TS 5.8           | Error-code compatibility requires snapshots                                   | No               |
| `@kokecore/logging`    | beta         | KOKE GROUP Platform | `0.2.0`        | 100 / 96.55 / 100 / 100     | Kaklen local link; reference consumer | Node 22, TS 5.8           | Transport and telemetry paths need integration evidence                       | No               |
| `@kokecore/rbac`       | internal     | KOKE GROUP Platform | `0.2.0`        | 100 / 97.43 / 100 / 100     | Kaklen local link; reference consumer | Node 22, TS 5.8           | Permission evolution is product-coupled                                       | No               |
| `@kokecore/storage`    | experimental | KOKE GROUP Platform | `0.3.0-beta.0` | 100 / 92.30 / 100 / 100     | Kaklen local link                     | Node 22, TS 5.8           | Cloud adapters contain simulated behavior                                     | No               |
| `@kokecore/validation` | internal     | KOKE GROUP Platform | `0.2.0`        | 97.86 / 92.64 / 100 / 99.41 | Kaklen local link; reference consumer | Node 22, TS 5.8           | Kaklen still references removed `sanitizeSQL`; extraction remains blocked     | No               |

Coverage is reported as statements / branches / functions / lines and was
measured by `pnpm test:coverage` for TASK-AUDIT-001. The table must be updated
with measured evidence whenever package maturity changes.

The Config measurement was refreshed by TASK-CONFIG-001. Package certification
evidence is recorded separately and does not promote the package beyond beta.
