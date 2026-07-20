# Compatibility matrix

This matrix is the Alpha compatibility contract between Kaklen and KOKE CORE.
Kaklen is the reference consumer. A stack major must not change while package
logic is being extracted.

| Component  | Kaklen                                 | KOKE CORE                                        | Alpha decision                                                                                     | Future plan                                                                             |
| ---------- | -------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Node.js    | `>=22 <25`                             | `>=18 <25`; CI and consumer contract use Node 22 | Node 22 is the integration baseline                                                                | Raise the KOKE CORE minimum in a dedicated change after Alpha consumers are inventoried |
| pnpm       | `9.15.4`                               | `8.15.0`; engine range `>=8 <10`                 | Keep the KOKE CORE lockfile on pnpm 8 and run consumer contracts on pnpm 8 and 9                   | Converge on pnpm 9 in a separate tooling change                                         |
| TypeScript | declared `^5.8.3`, resolved `5.9.3`    | declared `^5.8.3`, resolved `5.9.3`              | KOKE CORE was moved from TypeScript 6 to 5.x; this is the only stack-major transition in this task | Evaluate TypeScript 6 only after Kaklen approves and passes its complete gate           |
| NestJS     | declared `^11.1.3`, resolved `11.1.28` | declared and resolved `11.1.28` in `auth`        | Same major and resolved version; package code must remain compatible with Kaklen's 11.x runtime    | Align declared minors through routine dependency updates, without extraction work       |
| Jest       | declared `^30.0.3`, resolved `30.4.2`  | declared and resolved `30.4.2`                   | Same resolved runner                                                                               | Converge declared ranges through Dependabot                                             |
| ts-jest    | declared `^29.4.0`, resolved `29.4.11` | declared `^29.4.0`, resolved `29.4.11`           | Shared transformer line for TypeScript 5.x and Jest 30 tests                                       | Replace only through a dedicated test-runner decision                                   |
| Turbo      | declared `^2.5.4`, resolved `2.10.4`   | declared `^2.5.4`, resolved `2.10.5`             | Same major and task graph semantics; patch difference is non-blocking                              | Converge resolved patch through the next lockfile update                                |
| Prisma     | declared `^6.11.1`, resolved `6.19.3`  | Not applicable                                   | KOKE CORE packages must not require Prisma or expose generated Prisma types                        | Add a compatibility row before any future persistence package                           |

## Known incompatibilities

- Kaklen currently references local KOKE CORE directories with `link:`. This is
  not an approved distribution contract; packaged consumer tests are the gate.
- Kaklen references `sanitizeSQL`, which is intentionally absent from the
  validation public API because string rewriting is not SQL injection
  protection. Validation extraction remains blocked until Kaklen removes that
  dependency through an approved product change.
- KOKE CORE package versions are internal and do not imply public availability.

## Change rule

Only one stack major may move in an extraction cycle. NestJS 11 and TypeScript
6 adoption in Kaklen require explicit approval and its complete test suite.
