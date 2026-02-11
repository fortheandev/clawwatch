# Changelog

All notable changes to ClawWatch will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-02-10

### Added
- **About section** in Settings modal with:
  - Developer info (Forthean Labs LLC)
  - Website link (fortheanlabs.com)
  - GitHub Issues support link
  - License display (MIT)
  - Version display with update indicator
  - Lobster emoji branding and animation

### Changed
- Enhanced settings modal layout
- Improved About section styling

## [2.2.0] - 2026-02-10

### Added
- **Update check functionality** - Checks ClawHub registry for new versions
- **Update notification banner** in Settings modal
- Copy-to-clipboard button for update command
- 24-hour caching for update checks

### Changed
- Settings modal now shows current version and update status
- Improved visual hierarchy in settings

## [2.1.0] - 2026-02-10

### Added
- **Portability release** - Ready for distribution via ClawHub
- **Install script** (`install.sh`) - One-command setup for macOS and Linux
  - Auto-detects OpenClaw installation
  - Creates launchd (macOS) or systemd (Linux) service
  - Generates config with random auth token
  - Supports `--port`, `--no-service`, `--uninstall` options
- **Command line arguments** for server.py:
  - `--port` / `-p` — Set server port
  - `--session-path` / `-s` — Sessions directory path
  - `--token` / `-t` — Authentication token
  - `--read-only` / `-r` — Enable read-only mode
  - `--version` / `-v` — Show version and exit
  - `--help` / `-h` — Show help
- **Environment variable aliases** for consistency:
  - `CLAWWATCH_PORT` (alias for `DASHBOARD_PORT`)
  - `CLAWWATCH_TOKEN` (alias for `DASHBOARD_TOKEN`)
  - `CLAWWATCH_SESSION_PATH` (alias for `OPENCLAW_SESSIONS_PATH`)
  - `OPENCLAW_HOME` — Set OpenClaw base directory
- **Auto-detection of OpenClaw paths**:
  - Queries `openclaw status --json` to find installation
  - Falls back to `~/.openclaw/` if CLI unavailable
  - Respects `OPENCLAW_HOME` environment variable
- **Port configuration in config.json** — Can now set port in config file
- **Enhanced startup banner** — Shows detected paths and version

### Changed
- Configuration priority: CLI args > env vars > config.json
- Updated config.example.json with comprehensive documentation
- README.md rewritten with installation and troubleshooting guides
- Server prints clearer startup diagnostics

## [2.0.0] - 2026-02-10

### Added
- **Marketplace release candidate** - Ready for ClawHub distribution
- **Multi-mode authentication** - Support for `none`, `key`, `login`, `both` modes
- **URL key authentication** - Share access links like Tailscale (?key=token)
- **Cookie-based sessions** - Secure HttpOnly cookies with configurable expiry
- **Read-only mode** - Viewer access without archive/delete permissions
- **Auto-discovered agents** - Dynamic agent list from session data
- **Auto-discovered nodes** - Dynamic node list from OpenClaw nodes API
- **Configurable CORS** - Control cross-origin access for production
- **Ask Ivy integration** - Send context to webchat with one click
- **Webchat bridge** - BroadcastChannel support for seamless handoff
- **Export functionality** - Markdown, JSON, Text, HTML export formats
- **Session search** - Real-time search across sessions
- **Date/status filters** - Filter by today, 7 days, 30 days, or status
- **Sortable columns** - Click headers to sort by label, status, size, time
- **Pagination controls** - Configurable page size (10, 25, 50, 100)
- **Settings modal** - Configure retention, refresh interval, appearance
- **Lobster mascots** - Fun animated lobsters (toggleable in settings)
- **Session archiving** - Compress old sessions with gzip
- **Archive index** - Searchable archive with metadata
- **Restore functionality** - Bring archived sessions back to active
- **Token usage display** - Visual progress bar for context usage
- **Task preview** - First user message shown in session list
- **MIT License** - Open source release

### Changed
- **Breaking:** Renamed from "Agent Dashboard" to "ClawWatch"
- Agent emojis now configurable in config.json
- Main agent name/emoji sourced from openclaw.json
- Improved responsive design for mobile
- Better error messages for connection issues
- Cleaner session labels with agent type detection

### Security
- All API endpoints require authentication (except /api/config)
- Token hashed before cookie storage (SHA-256)
- Path sanitization prevents file path disclosure
- XSS prevention with consistent HTML escaping
- CSRF protection via SameSite=Strict cookies
- Secure flag on cookies when HTTPS detected

### Fixed
- Session filtering now works correctly with multiple criteria
- Archive button hidden in read-only mode
- Proper handling of sessions without task data
- Node name normalization for consistent filtering

## [1.5.8] - 2026-02-10

### Added
- SVG icon library for consistent UI
- Custom icon dropdowns for filters
- Agent status indicators
- Cron job name lookup

### Changed
- Replaced emoji with SVG icons in UI
- Improved filter dropdown styling
- Better visual hierarchy in session rows

## [1.5.0] - 2026-02-09

### Added
- Session result/summary view
- Full transcript modal
- Archive and restore functionality
- Storage statistics in settings

### Changed
- Improved modal design
- Better loading states
- Enhanced error handling

## [1.0.0] - 2026-02-08

### Added
- Initial release
- Real-time session monitoring
- Auto-refresh with configurable interval
- Pause/resume refresh
- Session detail view
- Dark theme
- Responsive design
- Keyboard shortcuts (R to refresh, Esc to close)

---

[2.3.0]: https://github.com/openclaw/clawwatch/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/openclaw/clawwatch/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/openclaw/clawwatch/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/openclaw/clawwatch/compare/v1.5.8...v2.0.0
[1.5.8]: https://github.com/openclaw/clawwatch/compare/v1.5.0...v1.5.8
[1.5.0]: https://github.com/openclaw/clawwatch/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/openclaw/clawwatch/releases/tag/v1.0.0
