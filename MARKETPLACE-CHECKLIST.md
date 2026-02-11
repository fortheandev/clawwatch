# Agent Dashboard — Marketplace Readiness Checklist

**Goal:** Prepare the OpenClaw Agent Dashboard for sharing on the OpenClaw Marketplace

---

## 🔒 Security (Critical — Do First)

- [x] **Add authentication**
  - [x] Token-based auth (config file with `dashboardToken`)
  - [x] All API endpoints require valid token
  - [x] Login page or token prompt on first visit

- [x] **Authorization / Access Control**
  - [x] Read-only mode option (viewer can't archive/delete)
  - [ ] Admin vs Viewer roles (optional)

- [x] **Sanitize API responses**
  - [x] Remove full file paths from responses
  - [x] Don't expose system info unnecessarily

- [ ] **Rate limiting**
  - [ ] Add basic rate limiting to API endpoints
  - [ ] Prevent abuse/DoS

---

## 🔧 Dynamic Configuration (Currently Hardcoded)

- [x] **Agent names**
  - [x] Auto-discover from session data (not hardcoded list)
  - [x] Allow user to customize display names
  - [x] Make emojis configurable

- [x] **Node names**
  - [x] Auto-discover from OpenClaw nodes API
  - [x] Remove hardcoded "Mini 1", "Mini 2"

- [x] **File paths**
  - [x] Move `~/.openclaw/agents/main/sessions/` to environment variable
  - [x] Support custom OpenClaw install locations
  - [x] Config: `OPENCLAW_SESSIONS_PATH`

- [x] **Server settings**
  - [x] Port configurable via `DASHBOARD_PORT` env var
  - [x] Bind address configurable (localhost vs 0.0.0.0)

- [x] **Branding**
  - [x] Remove "Ivy" references or make configurable
  - [x] Allow user to set their own agent name
  - [x] Config: `mainAgentName`, `mainAgentEmoji`

---

## 📦 Packaging & Installation

- [ ] **Create install script**
  - [ ] `install.sh` one-liner setup
  - [ ] Auto-detect OpenClaw location
  - [ ] Create default config file
  - [ ] Set up as systemd/launchd service (optional)

- [ ] **Dependencies**
  - [ ] Document Python version requirement
  - [ ] List any pip dependencies
  - [ ] Browser requirements (modern browser)

- [x] **Config file**
  - [x] Create `config.example.json` with all options documented
  - [x] Keep sensitive values out of git
  - [x] Support environment variables as override

---

## 📚 Documentation

- [ ] **README.md**
  - [ ] Clear description of what it does
  - [ ] Screenshots / GIF demo
  - [ ] Quick start guide
  - [ ] Full configuration reference
  - [ ] Troubleshooting section

- [ ] **LICENSE**
  - [ ] Add MIT license (or preferred)

- [ ] **CHANGELOG.md**
  - [ ] Document version history
  - [ ] Start with v1.0.0

---

## ✨ Nice-to-Have Features

- [ ] **Setup wizard**
  - [ ] First-run configuration flow
  - [ ] Auto-detect settings where possible

- [ ] **Theme toggle**
  - [ ] Dark/light mode switch
  - [ ] Remember preference

- [ ] **Keyboard shortcuts help**
  - [ ] Press `?` to show shortcuts
  - [ ] Document all shortcuts

- [ ] **Multi-agent support**
  - [ ] Support agents other than "main"
  - [ ] Agent selector if multiple configured

- [ ] **Notifications**
  - [ ] Optional webhook on session complete
  - [ ] Discord/Slack integration

- [ ] **Backup/Export**
  - [ ] Export all settings
  - [ ] Import settings from file

---

## 🧪 Testing

- [ ] **Fresh install test**
  - [ ] Test on clean machine
  - [ ] Verify install script works
  - [ ] Check all features with default config

- [ ] **Cross-browser testing**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari

- [ ] **Error handling**
  - [ ] Graceful handling when OpenClaw not running
  - [ ] Clear error messages for config issues
  - [ ] No crashes on missing files

---

## 🚀 Marketplace Submission

- [ ] **Clean up code**
  - [ ] Remove debug console.logs
  - [ ] Consistent code formatting
  - [ ] Comments where helpful

- [ ] **Version tag**
  - [ ] Tag release as v1.0.0
  - [ ] Create GitHub release (if applicable)

- [ ] **Marketplace listing**
  - [ ] Write compelling description
  - [ ] List key features
  - [ ] Add screenshots
  - [ ] Set appropriate category/tags

---

## Priority Order

1. **Security** — Auth is critical before sharing ✅
2. **Dynamic config** — Remove hardcoded values ✅
3. **Documentation** — README and install guide
4. **Packaging** — Easy install process
5. **Polish** — Nice-to-haves

---

## Implementation Details (2026-02-10)

### Files Created/Modified:

**New files:**
- `config.json` — Main configuration file
- `config.example.json` — Template with documentation
- `login.html` — Login page for token authentication

**Modified files:**
- `server.py` — Added auth middleware, env var support, sanitized responses, /api/config and /api/agents endpoints
- `js/config.js` — Dynamic config loading from server, auth helpers
- `js/api.js` — Auth headers on all requests
- `js/app.js` — Auth flow, dynamic agent filters, logout button
- `js/components.js` — Read-only mode support (hide archive/restore buttons)
- `css/dashboard.css` — Login page, logout button, radio buttons styling
- `index.html` — Cache bust version numbers

### Environment Variables Supported:
- `DASHBOARD_PORT` (default: 8889)
- `DASHBOARD_TOKEN` (optional, enables auth)
- `OPENCLAW_SESSIONS_PATH` (default: ~/.openclaw/agents/main/sessions)
- `DASHBOARD_READ_ONLY` (default: false)
- `OPENCLAW_GATEWAY` (default: http://localhost:31337)

### API Endpoints:
- `GET /api/config` — Returns safe config (no token)
- `GET /api/agents` — Returns auto-discovered agent list
- `GET /api/sessions` — Session list (requires auth if enabled)
- `GET /api/nodes` — Node list (requires auth if enabled)
- `POST /api/archive` — Archive session (blocked in read-only mode)
- `POST /api/restore` — Restore session (blocked in read-only mode)

---

*Created: 2026-02-10*
*Status: Security & Dynamic Config complete*
