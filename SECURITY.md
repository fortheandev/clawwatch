# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in ClawWatch, please report it responsibly:

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: security@fortheanlabs.com
3. Include detailed information about the vulnerability
4. Allow up to 48 hours for an initial response

## Security Features

ClawWatch includes multiple security measures:

### Authentication
- **Token-based auth** with multiple modes (none, key, login, both)
- **Secure cookie storage** (HttpOnly, SameSite=Strict, optional Secure)
- **Token hashing** using SHA-256 before storage
- **Constant-time comparison** for token validation

### Data Protection
- **No secrets in config** — Token is never exposed via `/api/config`
- **Path sanitization** — System paths are stripped from API responses
- **XSS prevention** — HTML escaping for all user-controlled content
- **CORS control** — Configurable cross-origin policies
- **Read-only mode** — Prevent modifications via `readOnly: true`

### Network Security
- **Same-origin by default** — No CORS headers unless explicitly configured
- **CSRF protection** — SameSite=Strict cookies prevent cross-site requests
- **Local binding** — Server binds to all interfaces but auth is required

## Best Practices

1. **Always set a token** — Never run in production without `dashboardToken`
2. **Use HTTPS** — Put behind a reverse proxy with TLS for remote access
3. **Limit network exposure** — Use Tailscale or similar for secure remote access
4. **Enable read-only** — Use `readOnly: true` for view-only access
5. **Review logs** — Monitor `server.log` for suspicious access patterns

## Dependencies

ClawWatch uses only Python standard library (no external dependencies), minimizing supply chain risk.

---

*Last updated: 2026-02-10*
