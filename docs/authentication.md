# Dashboard Authentication

The OpenClaw Agent Dashboard supports multiple authentication modes for flexibility in different deployment scenarios.

## Authentication Modes

Configure authentication via `config.json`:

```json
{
  "authMode": "both",
  "dashboardToken": "your-secret-token"
}
```

### Mode: `none`
No authentication required. Dashboard is open to anyone who can access the URL.

**Use case:** Local development, trusted networks, or when behind another auth layer.

### Mode: `key` (URL Key Auth)
Authentication via URL parameter. Users access the dashboard with a key in the URL:

```
https://your-host/dashboard?key=your-secret-token
```

**How it works:**
1. User opens URL with `?key=` parameter
2. Server validates the key against `dashboardToken`
3. If valid, sets a secure `dashboard_auth` cookie (HttpOnly, SameSite=Strict)
4. Redirects to clean URL (without the key in URL)
5. Subsequent visits use the cookie (no key needed in URL)

**Use case:** Shareable links with embedded auth, similar to Tailscale. Great for sharing with trusted users without them needing to know/enter the token.

### Mode: `login` (Login Page Auth)
Traditional login page authentication. Users enter the token on a login form.

**How it works:**
1. User visits dashboard → redirected to login page
2. User enters token → validated against server
3. Token stored in localStorage
4. Authorization: Bearer header sent with API requests

**Use case:** Standard password-style authentication where users manually enter credentials.

### Mode: `both`
Accepts both URL key and login page authentication. Either method works.

**Use case:** Maximum flexibility. Share links with key for convenience, or let users log in manually.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `authMode` | string | `login` | One of: `none`, `key`, `login`, `both` |
| `dashboardToken` | string | `""` | The secret token for authentication |
| `cookieMaxAgeDays` | number | `30` | How long the auth cookie lasts (for key mode) |

## Cookie Details

For `key` and `both` modes, the auth cookie has these properties:

- **Name:** `dashboard_auth`
- **Value:** SHA-256 hash of the token (not the raw token)
- **HttpOnly:** Yes (not accessible via JavaScript)
- **SameSite:** Strict (not sent on cross-site requests)
- **Secure:** Yes (if accessed via HTTPS or Tailscale)
- **Max-Age:** Configurable (default 30 days)

## Security Considerations

1. **Never expose the raw token:** The cookie stores a hash, not the actual token
2. **Use HTTPS:** The Secure flag is set automatically for HTTPS and Tailscale domains
3. **Key URLs are sensitive:** Treat URLs with `?key=` like passwords
4. **Cookie expiry:** Users need to re-authenticate after cookie expires
5. **Logout clears both:** The logout function clears localStorage AND the server cookie

## API Authentication

All `/api/*` endpoints (except `/api/config`) require authentication. The server accepts:

1. **Bearer token header:** `Authorization: Bearer your-token`
2. **URL key parameter:** `?key=your-token`
3. **Cookie:** `dashboard_auth` with valid token hash

## Example Configurations

### Public dashboard (no auth)
```json
{
  "authMode": "none"
}
```

### Key-only (shareable links)
```json
{
  "authMode": "key",
  "dashboardToken": "super-secret-key-12345",
  "cookieMaxAgeDays": 7
}
```

### Login page only (traditional)
```json
{
  "authMode": "login",
  "dashboardToken": "my-password"
}
```

### Both methods (maximum flexibility)
```json
{
  "authMode": "both",
  "dashboardToken": "flexible-auth-token",
  "cookieMaxAgeDays": 30
}
```

## Troubleshooting

### "Invalid key" error
The `?key=` parameter doesn't match `dashboardToken`. Check for typos.

### Cookie not being set
- Check if using HTTPS (cookies may require Secure flag)
- Check browser cookie settings
- Try accessing via Tailscale domain

### Login page shows for key-only mode
This happens when the cookie expires or is cleared. User needs to get a new keyed URL.

### Can't logout
The logout function clears both localStorage and the server cookie. If issues persist, manually clear cookies in browser settings.
