# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AROS, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report via our secure contact form:

- **Report here:** [nirtek.net/support](https://nirtek.net/support.html#contact)
- **Subject:** Security Vulnerability Report
- **Include:** Description, steps to reproduce, potential impact, and any suggested fix.

We will acknowledge receipt within 48 hours and provide an initial assessment within 5 business days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| < 1.0   | Best effort |

## Security Practices

- All data encrypted in transit (TLS) and at rest (AES-256)
- Role-based access control (RBAC) with per-workspace isolation
- Session-based authentication with MFA support
- Immutable audit logs for all administrative actions
- No third-party tracking cookies
- Regular dependency audits

## Scope

This policy covers the AROS platform software distributed via this repository. For infrastructure or hosted service issues, use the contact form above.
