# Licensing and intellectual-property policy

## Ownership and Alpha status

KOKE CORE and Kaklen are proprietary software owned by KOKE GROUP. KOKE CORE is
an internal Alpha repository. Package names and semantic versions identify
technical artifacts; they do not grant a distribution license.

All root and package manifests must remain `private: true` and
`license: UNLICENSED` during Alpha. Public npm access, public `publishConfig`,
and local publishing are prohibited. `pnpm release:publish` is deliberately
blocked.

## Kaklen-origin code

Kaklen code retains its proprietary status when evaluated for reuse. Moving,
copying, or adapting it into KOKE CORE requires:

1. documented ownership and provenance;
2. approval from the responsible KOKE GROUP owner;
3. completed tests and the Kaklen consumption gate;
4. a changeset that identifies the affected package;
5. confirmation that no customer data, secret, or private configuration moves.

This task does not move Kaklen logic and does not authorize auth extraction.

## Future distribution decision

Any public or third-party distribution requires a later legal decision that
defines the license, trademark use, ownership notices, support obligations, and
approved registry. Engineering approval alone is insufficient. Once approved,
publication must occur only from protected CI with review, immutable commit
identity, validated tarballs, SBOM, and provenance or attestation where the
registry supports it.
