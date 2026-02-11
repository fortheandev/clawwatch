# 🐾 ClawWatch

A real-time web dashboard for monitoring OpenClaw agent sessions. Watch your agents work, browse transcripts, manage archives, and track token usage — all from a beautiful dark-mode interface.

![Version](https://img.shields.io/badge/version-2.6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.6+-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)

<!-- Screenshots -->
<!-- ![Dashboard Screenshot](assets/screenshot-dashboard.png) -->
<!-- ![Transcript View](assets/screenshot-transcript.png) -->

---

## ✨ Features

### Session Monitoring
- **Real-time updates** — Auto-refresh with configurable interval (1s to 5min)
- **Session status** — See running, completed, and failed sessions at a glance
- **Token usage** — Visual progress bar shows context utilization
- **Task preview** — First user message shown in session list
- **Multi-agent support** — Filter by agent with auto-discovery of all sub-agents
- **Multi-node support** — Dynamic node discovery across all sessions
- **Friendly labels** — Signal groups, Discord channels, etc. shown with readable names

### Transcript & Results
- **Full transcript view** — Browse complete conversation history
- **Summary view** — Quick access to final assistant response
- **Export options** — Download as Markdown, JSON, Text, or HTML
- **Ask agent** — Send session context to webchat with one click

### Archive Management
- **Automatic archiving** — Compress old sessions based on retention policy
- **Manual archive** — Archive individual sessions on demand
- **Restore sessions** — Bring archived sessions back to active
- **Storage stats** — Track active and archived session sizes

### Security
- **Multiple auth modes** — None, URL key, login page, or both
- **Secure cookies** — HttpOnly, SameSite=Strict, optional Secure flag
- **Read-only mode** — Allow viewing without modification rights
- **Path sanitization** — No system paths exposed in API

---

## 🚀 Quick Install

### One-liner (from ClawHub)

```bash
curl -sSL https://clawhub.dev/clawwatch/install.sh | bash
```

### From Git

```bash
git clone https://github.com/FortheanLabs/clawwatch.git
cd clawwatch
./install.sh
```

The installer will:
- ✅ Detect your OpenClaw installation
- ✅ Install to `~/.openclaw/clawwatch/`
- ✅ Generate config with random auth token
- ✅ Create launchd (macOS) or systemd (Linux) service
- ✅ Start the dashboard

---

## 📦 Manual Installation

If you prefer manual setup:

```bash
# 1. Copy files to your preferred location
mkdir -p ~/.openclaw/clawwatch
cp -r ./* ~/.openclaw/clawwatch/

# 2. Create your config
cd ~/.openclaw/clawwatch
cp config.example.json config.json
# Edit config.json with your settings

# 3. Start the server
python3 server.py
```

Open http://localhost:8889 in your browser.

---

## ⚙️ Configuration

ClawWatch is highly configurable through three methods (in priority order):

1. **Command line arguments** (highest priority)
2. **Environment variables**
3. **config.json file** (lowest priority)

### Command Line Arguments

```bash
python3 server.py --port 9000                    # Custom port
python3 server.py --session-path ~/my/sessions   # Custom sessions dir
python3 server.py --token mysecrettoken          # Auth token
python3 server.py --read-only                    # Read-only mode
python3 server.py --version                      # Show version
python3 server.py --help                         # Show help
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAWWATCH_PORT` | Server port (default: 8889) |
| `CLAWWATCH_TOKEN` | Authentication token |
| `CLAWWATCH_SESSION_PATH` | Sessions directory path |
| `OPENCLAW_HOME` | OpenClaw base directory |
| `DASHBOARD_READ_ONLY` | Enable read-only mode (`true`/`false`) |

Example:
```bash
export CLAWWATCH_PORT=9000
export CLAWWATCH_TOKEN=mysecrettoken
python3 server.py
```

### config.json

Copy `config.example.json` to `config.json` and customize:

```json
{
  "port": 8889,
  "dashboardToken": "your-secret-token-here",
  "authMode": "login",
  "readOnly": false,
  "mainAgentName": "Assistant",
  "mainAgentEmoji": "🏠",
  "agentEmojis": {
    "ops": "🔧",
    "research": "🔍",
    "default": "🤖"
  }
}
```

### Path Detection

ClawWatch automatically detects OpenClaw paths:

1. **`OPENCLAW_HOME` env var** — If set, uses this as base
2. **`openclaw status --json`** — Queries CLI for config location  
3. **`~/.openclaw/`** — Falls back to default location

Sessions directory is detected similarly, or can be explicitly set via `CLAWWATCH_SESSION_PATH`.

---

## 🔐 Authentication

ClawWatch supports four authentication modes:

| Mode | Description | Best For |
|------|-------------|----------|
| `none` | No auth required | Local development only |
| `key` | URL key only (`?key=token`) | Shareable links |
| `login` | Login page only | Traditional password entry |
| `both` | Either method works | Maximum flexibility |

### URL Key Authentication

Share a link with the key parameter:
```
https://your-host:8889/?key=your-secret-token
```

The server validates the key, sets a secure cookie, and redirects to the clean URL. Perfect for team access via Tailscale or similar!

### Login Page Authentication

Users visit the dashboard and enter the token on a login page. Token is stored securely for subsequent visits.

---

## 🖥️ Service Management

### macOS (launchd)

The installer creates a launchd service that runs at login:

```bash
# Stop
launchctl stop com.openclaw.clawwatch

# Start
launchctl start com.openclaw.clawwatch

# Disable (remove from login)
launchctl unload ~/Library/LaunchAgents/com.openclaw.clawwatch.plist

# Re-enable
launchctl load ~/Library/LaunchAgents/com.openclaw.clawwatch.plist

# View logs
tail -f ~/.openclaw/clawwatch/server.log
```

### Linux (systemd)

The installer creates a user systemd service:

```bash
# Status
systemctl --user status clawwatch

# Stop
systemctl --user stop clawwatch

# Start  
systemctl --user start clawwatch

# Restart
systemctl --user restart clawwatch

# View logs
journalctl --user -u clawwatch -f
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :8889

# Use a different port
python3 server.py --port 9000
```

### Sessions Not Showing

1. Check that OpenClaw is running and has sessions
2. Verify sessions path: `ls ~/.openclaw/agents/main/sessions/`
3. Set explicit path: `CLAWWATCH_SESSION_PATH=~/.openclaw/agents/main/sessions python3 server.py`

### Authentication Issues

- Ensure `dashboardToken` is set in config or via env var
- Clear browser cookies and try again
- Check `authMode` matches your login method

### Service Won't Start

macOS:
```bash
# Check for errors
launchctl error com.openclaw.clawwatch

# View service log
cat ~/.openclaw/clawwatch/server.log
```

Linux:
```bash
# Check status
systemctl --user status clawwatch

# View detailed logs
journalctl --user -u clawwatch --no-pager
```

---

## 🗂️ Project Structure

```
clawwatch/
├── server.py           # Python HTTP server (main entry point)
├── index.html          # Dashboard UI
├── login.html          # Authentication page
├── config.json         # Your configuration (create from example)
├── config.example.json # Config template with documentation
├── settings.json       # User preferences (auto-created)
├── version.json        # Version info
├── install.sh          # Installation script
├── README.md           # This file
├── CHANGELOG.md        # Version history
├── LICENSE             # MIT License
├── css/
│   └── dashboard.css   # Styles
├── js/
│   ├── app.js          # Main application
│   ├── api.js          # API client
│   ├── components.js   # UI components
│   ├── config.js       # Config management
│   ├── export.js       # Export utilities
│   ├── icons.js        # SVG icon library
│   └── webchat-bridge.js
├── assets/
│   ├── favicon.svg     # Logo
│   └── lobster-*.png   # Mascot images
├── docs/
│   └── authentication.md
└── scripts/
    └── archive-sessions.py
```

---

## 🔌 API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Safe config (no token) |

### Protected Endpoints (require auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List active sessions |
| GET | `/api/sessions/{id}/history` | Full transcript |
| GET | `/api/sessions/{id}/result` | Final result only |
| GET | `/api/agents` | Discovered agents |
| GET | `/api/nodes` | Available nodes |
| GET | `/api/settings` | User settings |
| POST | `/api/settings` | Save settings |
| GET | `/api/archive` | Archived sessions |
| POST | `/api/archive` | Archive a session |
| POST | `/api/restore` | Restore from archive |
| POST | `/api/run-archive` | Run retention policy |
| POST | `/api/logout` | Clear auth cookie |

### Authentication Methods

**Bearer Token:**
```
Authorization: Bearer your-token
```

**URL Parameter:**
```
/api/sessions?key=your-token
```

**Cookie:** Automatically set after key-based login.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `R` | Refresh sessions |
| `Esc` | Close modal |

---

## 🛠️ Requirements

- **Python 3.6+** — Standard library only, no pip install needed
- **Modern browser** — Chrome, Firefox, Safari, Edge with ES6 support
- **OpenClaw** — Gateway should be running for live session data

---

## 🗑️ Uninstall

```bash
# Via installer
./install.sh --uninstall

# Manual
launchctl unload ~/Library/LaunchAgents/com.openclaw.clawwatch.plist  # macOS
systemctl --user disable --now clawwatch  # Linux
rm -rf ~/.openclaw/clawwatch
```

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔮 Roadmap

- [ ] Light theme toggle
- [ ] Browser notifications
- [ ] Webhook integrations  
- [ ] Multi-gateway support
- [ ] Session diff view
- [ ] Usage analytics

---

## 💡 Contributing

Contributions welcome! Please read the code, maintain the style, and test your changes.

---

*Developed for [OpenClaw](https://openclaw.dev) by [Forthean Labs LLC](https://fortheanlabs.com)*
