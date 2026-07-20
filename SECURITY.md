# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly.

**Do not create a public issue.**

Instead, send an email to: security@kokecore.dev

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if known)

## Supported Versions

Only the latest major version receives security updates.

## Security Best Practices

### Dependencies

- Dependencies are automatically scanned via Dependabot
- Security patches are applied within 7 days
- Regular dependency updates are tested before merging

### Code Review

- All code changes require review
- Security-sensitive changes require at least 2 reviewers
- Security audits are performed annually

### Secrets Management

- Never commit secrets or API keys
- Use environment variables for configuration
- Rotate secrets regularly
- Use secret scanning tools

## Security Features

### @kokecore/auth

- Argon2id password hashing
- JWT with refresh token rotation
- Session versioning
- Rate limiting
- MFA support

### @kokecore/storage

- Path traversal protection
- MIME type validation
- File size limits
- Virus scanning support
- Encryption at rest

### @kokecore/validation

- Input sanitization
- XSS prevention
- SQL injection prevention
- PII masking

## Disclosure Policy

- Vulnerabilities are disclosed within 90 days of fix
- Credit is given to reporters
- CVEs are requested for critical issues
