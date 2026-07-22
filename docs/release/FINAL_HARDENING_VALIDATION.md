# Final Hardening Validation

## Scope

This report certifies the package, public API, security, and isolated-consumer
controls for Kokecore commit
`96b7632e3affb4138773cc95b9f7b42a9d5365a7`. It changes no package behavior and
does not publish any artifact.

## Packages

| Package                | Version        |
| ---------------------- | -------------- |
| `@kokecore/auth`       | `0.3.0-beta.0` |
| `@kokecore/calendar`   | `0.3.0-beta.0` |
| `@kokecore/config`     | `0.2.0`        |
| `@kokecore/errors`     | `0.2.0`        |
| `@kokecore/logging`    | `0.2.0`        |
| `@kokecore/rbac`       | `0.2.0`        |
| `@kokecore/storage`    | `0.3.0-beta.0` |
| `@kokecore/validation` | `0.2.0`        |

## Results

| Control                            | Result |
| ---------------------------------- | ------ |
| Independent clean clone            | PASS   |
| `pnpm install --frozen-lockfile`   | PASS   |
| Lint and typecheck                 | PASS   |
| Unit tests and package coverage    | PASS   |
| Build                              | PASS   |
| Eight package contents             | PASS   |
| Public API snapshots               | PASS   |
| Secret scan and Config SAST        | PASS   |
| High-severity dependency audit     | PASS   |
| SBOM generation                    | PASS   |
| Packed consumer with pnpm `8.15.0` | PASS   |
| Packed consumer with pnpm `9.15.4` | PASS   |
| 24 deep-import attempts rejected   | PASS   |
| Kaklen Config compatibility        | PASS   |
| Compatibility rollback             | PASS   |

The consumer tests generated eight temporary tarballs, installed them outside
the workspace, compiled and executed the consumer, and rejected `src`,
`src/public`, and `dist/internal` imports for every package with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. No tarball remained in the repository.

The compatibility certification used Kaklen commit
`75be865718c1302bfde0beb499a29914679ce84e`, installed the generated Config
artifact in a temporary checkout, passed all 513 API tests and build checks, and
restored the original dependency successfully. Integration took 44566 ms and
rollback took 17975 ms.

## Commands Executed

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm package:validate
pnpm api:verify
pnpm security:scan
pnpm config:sast
pnpm security:audit
KOKE_CONSUMER_PNPM_VERSION=8.15.0 pnpm test:consumer
KOKE_CONSUMER_PNPM_VERSION=9.15.4 pnpm test:consumer
KAKLEN_EXPECTED_SHA=75be865718c1302bfde0beb499a29914679ce84e pnpm config:certify:kaklen
```

## Observed Environmental Failures

1. A consumer run timed out while the execution sandbox blocked registry
   traffic. The unchanged command passed for pnpm `8.15.0` and `9.15.4` after
   network access was granted.
2. The first Config-to-Kaklen run reached 512 of 513 tests because Redis was not
   available to the queue integration test. After the declared Redis service
   returned `PONG`, the unchanged certification passed all 513 tests.

Neither retry required source, package, threshold, or test changes.

## Risks

- Some current package builds emit lint warnings or CommonJS optimization
  notices, but no lint errors, contract failures, or consumer runtime failures.
- Package publication remains intentionally blocked. This certification covers
  private immutable tarballs and consumers, not a public registry release.
- Kaklen pins Kokecore commit
  `b0025e737d94a1dae4be2f8f71dcdcfea72c695f`; Kaklen's recursive-clone Quality
  Gate builds and tests that exact submodule revision.

GitHub issue searches on `2026-07-22` returned zero open P0 and zero open P1
issues for Kokecore.

## Reproduction and Rollback

Run the commands above from an independent clean clone with Node 22. Consumer
tests must use temporary directories and must not retain `.tgz` files. For
rollback, restore the previous dependency in the temporary Kaklen checkout,
reinstall with the frozen lockfile, and rerun typecheck, tests, and build. The
certification script performed that rollback successfully.

## Workflows

- [KOKE CORE Quality Gate](https://github.com/j-a-a-s/kokecore/actions/workflows/ci.yml)
- [Config Package Artifact](https://github.com/j-a-a-s/kokecore/actions/workflows/config-package.yml)
- [CodeQL](https://github.com/j-a-a-s/kokecore/actions/workflows/codeql.yml)
