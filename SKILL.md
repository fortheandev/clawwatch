---
name: clawwatch
description: Agent session monitoring dashboard for OpenClaw
metadata:
  {
    "openclaw": {
      "emoji": "🦞",
      "requires": { "bins": ["python3"] },
      "homepage": "https://fortheanlabs.com"
    }
  }
---

# ClawWatch

A real-time web dashboard for monitoring OpenClaw agent sessions.

## Features

- **Real-time session monitoring** with auto-refresh
- **Token usage visualization** with progress bars
- **Full transcript viewing** and export
- **Archive management** for old sessions
- **Multiple authentication modes** (none, key, login, both)
- **Multi-agent and multi-node support**

## Installation

```bash
./install.sh
```

Or via ClawHub:

```bash
openclaw skill install clawwatch
```

## Requirements

- Python 3.6+
- OpenClaw gateway running

## Configuration

Copy `config.example.json` to `config.json` and customize. All settings support environment variables and CLI arguments.

## Usage

```bash
python3 server.py
```

Then open http://localhost:8889 in your browser.
