# @kokecore/config package certification

## Status

`@kokecore/config@0.2.0` is certified as a private, immutable Alpha artifact for
controlled Kaklen integration tests. This certification does not mark the
package as stable, publish it publicly, or authorize a permanent dependency
replacement.

| Field                    | Certified value                                                    |
| ------------------------ | ------------------------------------------------------------------ |
| Package                  | `@kokecore/config`                                                 |
| Version                  | `0.2.0`                                                            |
| Artifact source commit   | `b23ab90810a5dea9bfcbc6aa1a2d55941d709c26`                         |
| Kaklen validation commit | `87bf3bb32ff612109efdb2d96073344df50abfa5`                         |
| Generated at             | `2026-07-21T17:44:23.605Z`                                         |
| Tarball                  | `kokecore-config-0.2.0.tgz`                                        |
| Size                     | `5309` bytes                                                       |
| SHA-256                  | `007e6bd182d01fa842d644303dfa9b982d29f347121a45933299fd0e5d68be08` |
| Reproducible             | Yes, two clean builds produced the same archive checksum           |
| Maturity                 | Beta                                                               |

## Package contract

The package is private and proprietary (`private: true`, `UNLICENSED`), supports
Node `>=22 <25` and pnpm `>=8 <10`, and has no runtime dependencies. Its only
public export is the package root. `main`, `types`, and `exports["."]` resolve to
compiled files in `dist`; source and internal paths cannot be imported by a
consumer.

The archive contains exactly:

```text
package/NOTICE
package/README.md
package/dist/index.d.ts
package/dist/index.js
package/dist/public.d.ts
package/dist/public.js
package/package.json
```

The archive excludes `src/`, tests, coverage, source maps, changelogs,
environment files, logs, temporary files, private configuration, workspace
metadata, lockfiles, and every other KOKE CORE package. No `.tgz` is versioned
in KOKE CORE or Kaklen.

## Build and package results

The following commands passed from a clean KOKE CORE checkout:

```bash
pnpm install --frozen-lockfile
pnpm --filter @kokecore/config lint
pnpm --filter @kokecore/config typecheck
pnpm --filter @kokecore/config test
pnpm --filter @kokecore/config test:coverage
pnpm --filter @kokecore/config build
pnpm package:validate
```

Config passed `29/29` tests. Coverage was 100% statements, 99.04% branches,
100% functions, and 100% lines. The package validator confirmed the exact
seven-entry allowlist, declarations, root-only export, absence of runtime
dependencies, and absence of forbidden files. Two independent clean builds
produced byte-identical tarballs with the certified SHA-256.

## Isolated installation

Each consumer was created outside the workspace with only the generated
tarball installed. TypeScript compilation and runtime execution succeeded for
valid configuration, invalid configuration was rejected, and TypeScript plus
Node runtime deep imports were blocked.

| Node       | pnpm     | Valid config | Invalid config | Deep imports | Duration |
| ---------- | -------- | ------------ | -------------- | ------------ | -------- |
| `v22.23.1` | `8.15.0` | Passed       | Rejected       | Blocked      | 1099 ms  |
| `v22.23.1` | `9.15.4` | Passed       | Rejected       | Blocked      | 1069 ms  |

## Kaklen integration

A clean temporary clone of Kaklen at
`87bf3bb32ff612109efdb2d96073344df50abfa5` replaced only
`@kokecore/config` with a temporary `file:` reference to the certified
tarball. The other KOKE CORE packages retained their existing development
links. The generated lockfile contained no `link:` or workspace reference for
Config during the integration run.

All required commands passed:

```bash
pnpm env:verify
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm architecture:check
pnpm security:scan
```

The test run included 55 API suites with 513 passing tests and all Web, Shared,
Config, and repository script suites. Architecture validation reported no
dependency-cycle regression, and the security scan passed. Integration took
35,957 ms. The temporary checkout was removed after validation.

## Rollback

Rollback was rehearsed in the same isolated Kaklen workflow:

1. restore the original Config dependency declaration and baseline lockfile;
2. reinstall dependencies;
3. run `pnpm typecheck`, `pnpm test`, and `pnpm build`;
4. remove the temporary checkout and artifact reference.

The rollback passed in 18,064 ms. Kaklen's permanent dependency remains the
pre-certification development link, so this task introduced no product behavior
change and requires no repository rollback.

## Alpha distribution

`.github/workflows/config-package.yml` builds the package from a commit, verifies
it, writes checksums and archive contents, and uploads a private GitHub Actions
artifact named with the source commit. Upload overwrite is disabled. Public npm,
absolute paths, permanent local tarballs, `workspace:`, and public publication
are prohibited.

This CI artifact is the temporary Alpha distribution mechanism. A private
GitHub Release or GitHub Packages registry is still preferred before permanent
Kaklen adoption.

## Risks

- GitHub Actions artifacts currently have a 30-day retention period and may be
  deleted administratively; checksum verification remains mandatory.
- A private long-lived release or registry location has not yet been approved.
- Config remains Beta and is not covered by a stable compatibility promise.
- Kaklen has validated the artifact but has not permanently replaced its local
  development dependency.
- Consumers must continue to verify the source commit and SHA-256 before use.

## Definition of done

- [x] Tarball generated outside version control
- [x] SHA-256 recorded
- [x] Exact archive content validated
- [x] Clean build reproducibility confirmed
- [x] Isolated installation passed
- [x] pnpm 8.15.0 passed on Node 22
- [x] pnpm 9.15.4 passed on Node 22
- [x] Deep imports blocked
- [x] Kaklen consumed the temporary tarball
- [x] Config local link absent during the integration test
- [x] Kaklen lint, typecheck, tests, build, architecture, and security passed
- [x] Rollback passed
- [x] Evidence documented

## Reproduction

Run on Node 22 with a clean Kaklen source checkout:

```bash
KAKLEN_SOURCE_PATH=/path/to/kaklen \
KAKLEN_EXPECTED_SHA=87bf3bb32ff612109efdb2d96073344df50abfa5 \
pnpm config:certify:package -- --output /controlled/output
```

The next action is to approve a private immutable distribution location, upload
this exact artifact with its checksum, and then perform the separately reviewed
permanent Kaklen dependency replacement.
