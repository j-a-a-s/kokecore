# Changesets

This directory contains changeset configuration.

To add a new changeset:

```bash
pnpm changeset
```

Follow the prompts and commit the generated `.md` file.

## Versioning internal packages

```bash
pnpm release        # Bump versions
```

Public publishing is blocked during Alpha. See
[`docs/LICENSING_AND_IP_POLICY.md`](../docs/LICENSING_AND_IP_POLICY.md).
