#!/usr/bin/env python3
"""
ClawWatch - OpenClaw Agent Dashboard Server

A simple HTTP server that:
1. Serves static files (HTML, CSS, JS)
2. Proxies API calls to the OpenClaw gateway
3. Handles CORS for development
4. Token-based authentication (optional)
5. Read-only mode support

Environment Variables:
- CLAWWATCH_PORT / DASHBOARD_PORT: Server port (default: 8889)
- CLAWWATCH_TOKEN / DASHBOARD_TOKEN: Auth token (optional, enables auth if set)
- CLAWWATCH_SESSION_PATH / OPENCLAW_SESSIONS_PATH: Path to sessions directory
- OPENCLAW_HOME: OpenClaw base directory (default: auto-detect or ~/.openclaw)
- DASHBOARD_READ_ONLY: Enable read-only mode (default: false)
- OPENCLAW_GATEWAY: Gateway URL (default: http://localhost:31337)

Command Line Arguments:
- --port PORT: Server port (overrides env vars)
- --session-path PATH: Sessions directory path
- --token TOKEN: Authentication token
- --read-only: Enable read-only mode
"""

import argparse
import gzip
import hashlib
import http.cookies
import http.server
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='ClawWatch - OpenClaw Agent Dashboard Server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python3 server.py                         # Use defaults
  python3 server.py --port 9000             # Custom port
  python3 server.py --session-path ~/my/sessions
  
Environment variables (lower priority than CLI args):
  CLAWWATCH_PORT, CLAWWATCH_TOKEN, CLAWWATCH_SESSION_PATH, OPENCLAW_HOME
        '''
    )
    parser.add_argument('--port', '-p', type=int, help='Server port (default: 8889)')
    parser.add_argument('--session-path', '-s', type=str, help='Sessions directory path')
    parser.add_argument('--token', '-t', type=str, help='Authentication token')
    parser.add_argument('--read-only', '-r', action='store_true', help='Enable read-only mode')
    parser.add_argument('--version', '-v', action='store_true', help='Show version and exit')
    return parser.parse_args()


# Parse CLI args early
CLI_ARGS = parse_args()

# Handle --version
if CLI_ARGS.version:
    version_file = Path(__file__).parent / 'version.json'
    if version_file.exists():
        with open(version_file) as f:
            v = json.load(f)
            print(f"ClawWatch v{v.get('version', 'unknown')}")
    else:
        print("ClawWatch (version unknown)")
    sys.exit(0)

# ================================
# Configuration (from env vars, config.json, and CLI args)
# ================================
STATIC_DIR = Path(__file__).parent
CONFIG_FILE = STATIC_DIR / 'config.json'


def detect_openclaw_home():
    """
    Detect OpenClaw installation directory.
    Priority:
    1. CLI --session-path (derived)
    2. OPENCLAW_HOME env var
    3. `openclaw status --json` output
    4. ~/.openclaw fallback
    """
    # Check environment variable first
    env_home = os.environ.get('OPENCLAW_HOME')
    if env_home:
        home_path = Path(env_home).expanduser()
        if home_path.exists():
            return home_path
    
    # Try to detect via CLI
    try:
        result = subprocess.run(
            ['openclaw', 'status', '--json'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            # Find JSON in output (may have prefix lines)
            output = result.stdout
            start = output.find('{')
            if start >= 0:
                data = json.loads(output[start:])
                # Look for config path or workspace path
                config_path = data.get('configPath') or data.get('config', {}).get('path')
                if config_path:
                    # Config is usually at ~/.openclaw/openclaw.json
                    return Path(config_path).parent
                workspace = data.get('workspace') or data.get('workspaceRoot')
                if workspace:
                    # Workspace is usually ~/.openclaw/workspaces/...
                    workspace_path = Path(workspace)
                    if 'workspaces' in workspace_path.parts:
                        idx = workspace_path.parts.index('workspaces')
                        return Path(*workspace_path.parts[:idx])
    except (subprocess.SubprocessError, FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    
    # Fallback to ~/.openclaw
    default = Path.home() / '.openclaw'
    if default.exists():
        return default
    
    return default  # Return even if doesn't exist, will be created


def detect_sessions_path(openclaw_home):
    """
    Detect sessions directory path.
    Priority:
    1. CLI --session-path
    2. CLAWWATCH_SESSION_PATH env var
    3. OPENCLAW_SESSIONS_PATH env var
    4. Auto-detect from OpenClaw config
    5. Default: {openclaw_home}/agents/main/sessions
    """
    # CLI arg highest priority
    if CLI_ARGS.session_path:
        return Path(CLI_ARGS.session_path).expanduser()
    
    # Environment variables
    for env_var in ('CLAWWATCH_SESSION_PATH', 'OPENCLAW_SESSIONS_PATH'):
        env_path = os.environ.get(env_var)
        if env_path:
            return Path(env_path).expanduser()
    
    # Try to read from OpenClaw config
    openclaw_config = openclaw_home / 'openclaw.json'
    if openclaw_config.exists():
        try:
            with open(openclaw_config) as f:
                config = json.load(f)
            # Check for custom sessions path in config
            agents_config = config.get('agents', {})
            sessions_path = agents_config.get('sessionsPath')
            if sessions_path:
                return Path(sessions_path).expanduser()
        except (json.JSONDecodeError, OSError):
            pass
    
    # Default path
    return openclaw_home / 'agents' / 'main' / 'sessions'


def detect_port():
    """
    Detect server port.
    Priority:
    1. CLI --port
    2. CLAWWATCH_PORT env var
    3. DASHBOARD_PORT env var
    4. config.json port setting
    5. Default: 8889
    """
    # CLI arg highest priority
    if CLI_ARGS.port:
        return CLI_ARGS.port
    
    # Environment variables
    for env_var in ('CLAWWATCH_PORT', 'DASHBOARD_PORT'):
        env_port = os.environ.get(env_var)
        if env_port:
            try:
                return int(env_port)
            except ValueError:
                pass
    
    # Config file
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                config = json.load(f)
            port = config.get('port')
            if port:
                return int(port)
        except (json.JSONDecodeError, OSError, ValueError):
            pass
    
    return 8889


def detect_token():
    """
    Detect auth token.
    Priority:
    1. CLI --token
    2. CLAWWATCH_TOKEN env var
    3. DASHBOARD_TOKEN env var
    4. config.json dashboardToken
    """
    # CLI arg highest priority
    if CLI_ARGS.token:
        return CLI_ARGS.token
    
    # Environment variables
    for env_var in ('CLAWWATCH_TOKEN', 'DASHBOARD_TOKEN'):
        env_token = os.environ.get(env_var)
        if env_token:
            return env_token
    
    return None  # Will be loaded from config.json later


# Detect OpenClaw installation
OPENCLAW_HOME = detect_openclaw_home()


def load_openclaw_config():
    """Load agent identity info from OpenClaw's main config file."""
    openclaw_config_path = OPENCLAW_HOME / 'openclaw.json'
    result = {
        'mainAgentName': None,
        'mainAgentEmoji': None,
        'agentEmojis': {}
    }
    
    if not openclaw_config_path.exists():
        return result
    
    try:
        with open(openclaw_config_path) as f:
            oc_config = json.load(f)
        
        agents_list = oc_config.get('agents', {}).get('list', [])
        for agent in agents_list:
            agent_id = agent.get('id', '')
            identity = agent.get('identity', {})
            name = identity.get('name')
            emoji = identity.get('emoji')
            
            if agent_id == 'main':
                # Main agent identity
                if name:
                    result['mainAgentName'] = name
                if emoji:
                    result['mainAgentEmoji'] = emoji
            elif name:
                # Other agents: map name (lowercase) to emoji
                if emoji:
                    result['agentEmojis'][name.lower()] = emoji
    except (json.JSONDecodeError, OSError) as e:
        print(f"[Dashboard] Warning: Failed to load openclaw.json: {e}")
    
    return result


def load_config():
    """Load configuration from config.json with env var overrides."""
    config = {
        'dashboardToken': '',
        'authMode': 'login',  # 'none', 'key', 'login', 'both'
        'cookieMaxAgeDays': 30,  # Cookie expiry in days
        'readOnly': False,
        'corsOrigin': None,  # None = same-origin only, '*' = any, or specific origin
        'mainAgentName': 'Main',
        'mainAgentEmoji': '🏠',
        'agentEmojis': {
            'ops': '🔧',
            'research': '🔍',
            'content': '✏️',
            'design': '🎨',
            'cron': '⏰',
            'default': '🤖'
        },
        'nodeEmojis': {
            'gateway': '🟢',
            'remote': '🔵',
            'default': '🖥️'
        }
    }
    
    # Load from OpenClaw config first (provides defaults from agent identities)
    oc_config = load_openclaw_config()
    if oc_config['mainAgentName']:
        config['mainAgentName'] = oc_config['mainAgentName']
    if oc_config['mainAgentEmoji']:
        config['mainAgentEmoji'] = oc_config['mainAgentEmoji']
    if oc_config['agentEmojis']:
        config['agentEmojis'].update(oc_config['agentEmojis'])
    
    # Load from config.json if exists (overrides OpenClaw config)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                file_config = json.load(f)
                # Deep merge
                for key, value in file_config.items():
                    if key.startswith('_'):  # Skip comments
                        continue
                    if isinstance(value, dict) and key in config and isinstance(config[key], dict):
                        config[key].update(value)
                    else:
                        config[key] = value
        except (json.JSONDecodeError, OSError) as e:
            print(f"[Dashboard] Warning: Failed to load config.json: {e}")
    
    # Environment variable overrides (in priority order)
    # Token: CLI > CLAWWATCH_TOKEN > DASHBOARD_TOKEN > config
    cli_token = detect_token()
    if cli_token:
        config['dashboardToken'] = cli_token
    elif os.environ.get('DASHBOARD_TOKEN'):
        config['dashboardToken'] = os.environ['DASHBOARD_TOKEN']
    
    # Read-only: CLI > env var > config
    if CLI_ARGS.read_only:
        config['readOnly'] = True
    elif os.environ.get('DASHBOARD_READ_ONLY', '').lower() in ('true', '1', 'yes'):
        config['readOnly'] = True
    
    return config

# Load configuration
APP_CONFIG = load_config()

# Server configuration (from detection functions)
PORT = detect_port()
GATEWAY_URL = os.environ.get('OPENCLAW_GATEWAY', 'http://localhost:31337')

# Sessions path (from detection function)
SESSIONS_DIR = detect_sessions_path(OPENCLAW_HOME)

ARCHIVE_DIR = SESSIONS_DIR / 'archive'
SETTINGS_FILE = STATIC_DIR / 'settings.json'
ARCHIVE_INDEX_FILE = ARCHIVE_DIR / 'archive-index.json'
UPDATE_CACHE_FILE = STATIC_DIR / '.update-cache.json'

# Update check cache (in-memory + file-based)
_update_cache = {
    'data': None,
    'timestamp': 0
}


def get_auth_mode():
    """Get the authentication mode."""
    mode = APP_CONFIG.get('authMode', 'login')
    # Validate mode
    if mode not in ('none', 'key', 'login', 'both'):
        mode = 'login'
    return mode


def is_auth_enabled():
    """Check if authentication is enabled (any mode except 'none')."""
    mode = get_auth_mode()
    # Auth is disabled if mode is 'none' OR if no token is configured
    if mode == 'none':
        return False
    return bool(APP_CONFIG.get('dashboardToken'))


def is_read_only():
    """Check if read-only mode is enabled."""
    return APP_CONFIG.get('readOnly', False)


def hash_token(token):
    """Create a secure hash of the token for cookie storage."""
    # Use SHA-256 with a salt derived from the token itself
    # This creates a deterministic but irreversible hash
    return hashlib.sha256(f"openclaw-dashboard:{token}".encode()).hexdigest()


def validate_token_hash(token_hash):
    """Validate a hashed token against the configured token."""
    if not token_hash or not APP_CONFIG.get('dashboardToken'):
        return False
    expected_hash = hash_token(APP_CONFIG['dashboardToken'])
    return secrets.compare_digest(token_hash, expected_hash)


def get_safe_config():
    """Get config that's safe to expose to the frontend (no token!)."""
    return {
        'authEnabled': is_auth_enabled(),
        'authMode': get_auth_mode(),
        'readOnly': is_read_only(),
        'mainAgentName': APP_CONFIG.get('mainAgentName', 'Main'),
        'mainAgentEmoji': APP_CONFIG.get('mainAgentEmoji', '🏠'),
        'agentEmojis': APP_CONFIG.get('agentEmojis', {}),
        'nodeEmojis': APP_CONFIG.get('nodeEmojis', {}),
    }


def sanitize_path(path_str):
    """Remove full system paths, return just filename."""
    if not path_str:
        return path_str
    return Path(path_str).name


def sanitize_session(session):
    """Remove sensitive paths from session data."""
    sanitized = dict(session)
    
    # Remove or sanitize path fields
    path_fields = ['transcriptPath', 'filePath', 'path', 'sessionPath']
    for field in path_fields:
        if field in sanitized:
            # Convert to just filename
            sanitized[field] = sanitize_path(sanitized[field])
    
    # Remove internal keys that shouldn't be exposed
    internal_fields = ['_internal', 'fullPath', 'absolutePath']
    for field in internal_fields:
        sanitized.pop(field, None)
    
    return sanitized


def get_file_size_bytes(file_path):
    """Get file size in bytes, returns 0 if file doesn't exist."""
    try:
        return file_path.stat().st_size
    except (OSError, FileNotFoundError):
        return 0


def format_size(bytes_size):
    """Format bytes to human readable string."""
    if bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f} KB"
    else:
        return f"{bytes_size / (1024 * 1024):.1f} MB"


def extract_first_user_message(jsonl_path):
    """Extract the first user message (the task/request) from a JSONL transcript."""
    try:
        with open(jsonl_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get('type') == 'message':
                        msg = entry.get('message', {})
                        if msg.get('role') == 'user':
                            content = msg.get('content', '')
                            # Handle content as string or array
                            if isinstance(content, list):
                                text_parts = []
                                for item in content:
                                    if isinstance(item, dict) and item.get('type') == 'text':
                                        text_parts.append(item.get('text', ''))
                                    elif isinstance(item, str):
                                        text_parts.append(item)
                                content = '\n'.join(text_parts)
                            return content.strip()[:500]  # Truncate to 500 chars
                except json.JSONDecodeError:
                    continue
    except (OSError, FileNotFoundError):
        pass
    return None


def parse_friendly_session_label(session_key, session_data):
    """
    Parse a session key and data to produce a user-friendly label.
    
    Examples:
    - "agent:main:signal:group:xyz" -> "Signal Group Chat"
    - "agent:main:signal:dm:+1234567890" -> "Signal: +1 234 567 890"
    - "agent:main:discord:dm:username" -> "Discord: username"
    - "agent:main:subagent:uuid" -> uses label field or "Subagent Task"
    """
    # If there's already a nice label, use it (but not if it's just the raw key)
    existing_label = session_data.get('label', '')
    if existing_label and not existing_label.startswith('agent:') and not existing_label.startswith('signal:'):
        return existing_label
    
    # Check displayName for origin info
    display_name = session_data.get('displayName', '')
    origin = session_data.get('origin', {})
    channel = session_data.get('channel') or session_data.get('lastChannel', '')
    
    # Parse Signal sessions
    if ':signal:' in session_key or channel == 'signal':
        # Check if it's a group or DM
        chat_type = session_data.get('chatType', '')
        
        if 'group' in session_key or chat_type == 'group':
            # Try to get group name from origin or displayName
            group_label = origin.get('label', '') or origin.get('groupName', '')
            
            # Clean up the label - remove "id:..." suffix if present
            if group_label:
                # Pattern: "Group Name id:xyz..." -> extract just "Group Name"
                if ' id:' in group_label:
                    group_label = group_label.split(' id:')[0].strip()
                # Skip if it's just the group ID (starts with "group:" or looks like a hash)
                if group_label and not group_label.startswith('group:'):
                    # Check if it looks like a real name (not a long hash)
                    if len(group_label) < 30 and not re.match(r'^[a-z0-9]{20,}$', group_label.lower()):
                        return f"Signal: {group_label}"
            
            # Try displayName as fallback (e.g., "signal:g-my-team")
            if display_name:
                if display_name.startswith('signal:g-'):
                    # Extract group name from "signal:g-group-name"
                    group_name = display_name[9:]
                    # Skip if it starts with "group-" followed by a hash
                    if group_name.startswith('group-'):
                        return "Signal Group Chat"
                    # Only use if it looks like a real name
                    if len(group_name) < 30:
                        return f"Signal: {group_name.replace('-', ' ').title()}"
            
            return "Signal Group Chat"
        
        # DM - try to extract phone number or name
        origin_label = origin.get('label', '') or origin.get('from', '')
        if origin_label:
            # Clean up signal:+number format
            if origin_label.startswith('signal:'):
                phone = origin_label[7:]  # Remove 'signal:' prefix
                # Format phone number nicely
                phone = format_phone_number(phone)
                return f"Signal: {phone}"
            # Could be a name
            if not origin_label.startswith('group:'):
                return f"Signal: {origin_label}"
        
        return "Signal DM"
    
    # Parse Discord sessions
    if ':discord:' in session_key or channel == 'discord':
        origin_label = origin.get('label', '') or origin.get('channelName', '')
        if origin_label:
            return f"Discord: {origin_label}"
        return "Discord Chat"
    
    # Parse Telegram sessions
    if ':telegram:' in session_key or channel == 'telegram':
        origin_label = origin.get('label', '') or origin.get('chatTitle', '')
        if origin_label:
            return f"Telegram: {origin_label}"
        return "Telegram Chat"
    
    # Parse WhatsApp sessions
    if ':whatsapp:' in session_key or channel == 'whatsapp':
        origin_label = origin.get('label', '') or origin.get('from', '')
        if origin_label:
            return f"WhatsApp: {origin_label}"
        return "WhatsApp Chat"
    
    # Parse Slack sessions
    if ':slack:' in session_key or channel == 'slack':
        origin_label = origin.get('label', '') or origin.get('channelName', '')
        if origin_label:
            return f"Slack: {origin_label}"
        return "Slack Chat"
    
    # Fallback: return the key portion after the agent prefix
    # e.g., "agent:main:signal:group:xyz" -> "signal:group:xyz"
    parts = session_key.split(':')
    if len(parts) > 2:
        return ':'.join(parts[2:])
    
    return session_key


def format_phone_number(phone):
    """Format a phone number for display."""
    if not phone:
        return phone
    
    # Remove any non-digit characters except leading +
    has_plus = phone.startswith('+')
    digits = ''.join(c for c in phone if c.isdigit())
    
    # US format: +1 XXX XXX XXXX
    if len(digits) == 11 and digits.startswith('1'):
        formatted = f"+1 {digits[1:4]} {digits[4:7]} {digits[7:]}"
        return formatted
    elif len(digits) == 10:
        formatted = f"+1 {digits[:3]} {digits[3:6]} {digits[6:]}"
        return formatted
    
    # Return with + prefix if it had one
    return f"+{digits}" if has_plus else phone


def get_all_agent_sessions_dirs():
    """
    Get all agent session directories.
    Returns a list of (agent_id, sessions_dir) tuples.
    """
    agents_base = OPENCLAW_HOME / 'agents'
    session_dirs = []
    
    if not agents_base.exists():
        # Fallback to just the main sessions dir
        return [('main', SESSIONS_DIR)]
    
    # Scan for all agent directories
    for agent_dir in agents_base.iterdir():
        if not agent_dir.is_dir():
            continue
        if agent_dir.name.startswith('.'):
            continue
        
        sessions_dir = agent_dir / 'sessions'
        if sessions_dir.exists():
            session_dirs.append((agent_dir.name, sessions_dir))
    
    # Ensure main is included even if not found
    if not any(agent_id == 'main' for agent_id, _ in session_dirs):
        if SESSIONS_DIR.exists():
            session_dirs.append(('main', SESSIONS_DIR))
    
    return session_dirs


def load_settings():
    """Load settings from settings.json."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    # Return defaults
    return {
        'retentionDays': 'never',  # Number (any positive integer) or 'never'
        'autoArchive': True,  # Archive instead of delete
        'pageSize': 20,  # Sessions per page (10, 25, 50, 100)
    }


def get_current_version():
    """Get current version from version.json."""
    version_file = STATIC_DIR / 'version.json'
    if version_file.exists():
        try:
            with open(version_file) as f:
                v = json.load(f)
                return v.get('version', '0.0.0')
        except (json.JSONDecodeError, OSError):
            pass
    return '0.0.0'


def compare_versions(current, latest):
    """Compare semantic versions. Returns True if latest > current."""
    def parse_version(v):
        # Handle versions like "2.1.0" or "2.1.0-beta.1"
        parts = v.split('-')[0].split('.')
        return [int(p) for p in parts[:3]]
    
    try:
        curr_parts = parse_version(current)
        latest_parts = parse_version(latest)
        return latest_parts > curr_parts
    except (ValueError, IndexError):
        return False


def load_update_cache():
    """Load update check cache from file."""
    global _update_cache
    
    if UPDATE_CACHE_FILE.exists():
        try:
            with open(UPDATE_CACHE_FILE) as f:
                cached = json.load(f)
                _update_cache['data'] = cached.get('data')
                _update_cache['timestamp'] = cached.get('timestamp', 0)
        except (json.JSONDecodeError, OSError):
            pass
    
    return _update_cache


def save_update_cache(data):
    """Save update check result to cache file."""
    global _update_cache
    
    _update_cache['data'] = data
    _update_cache['timestamp'] = int(time.time())
    
    try:
        with open(UPDATE_CACHE_FILE, 'w') as f:
            json.dump({
                'data': data,
                'timestamp': _update_cache['timestamp']
            }, f)
    except OSError as e:
        print(f"[Dashboard] Warning: Could not save update cache: {e}")


def check_for_updates():
    """
    Check for updates from ClawHub registry.
    Returns dict with currentVersion, latestVersion, updateAvailable.
    Caches result for 24 hours.
    """
    global _update_cache
    
    # Check if update checking is enabled
    update_config = APP_CONFIG.get('updateCheck', {})
    if not update_config.get('enabled', True):
        return {
            'currentVersion': get_current_version(),
            'latestVersion': None,
            'updateAvailable': False,
            'disabled': True
        }
    
    # Load cache if needed
    if _update_cache['timestamp'] == 0:
        load_update_cache()
    
    # Check if cache is still valid (24 hours = 86400 seconds)
    cache_ttl = 24 * 60 * 60
    now = int(time.time())
    
    if _update_cache['data'] and (now - _update_cache['timestamp']) < cache_ttl:
        # Use cached result, but update current version in case it changed
        cached = _update_cache['data'].copy()
        cached['currentVersion'] = get_current_version()
        cached['updateAvailable'] = compare_versions(
            cached['currentVersion'], 
            cached.get('latestVersion', '0.0.0')
        )
        cached['cached'] = True
        return cached
    
    # Fetch latest version from registry
    current_version = get_current_version()
    registry_url = update_config.get(
        'registryUrl', 
        'https://clawhub.ai/api/skills/clawwatch/latest'
    )
    
    try:
        # Make HTTP request with timeout
        req = urllib.request.Request(
            registry_url,
            headers={'User-Agent': f'ClawWatch/{current_version}'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            latest_version = data.get('version', current_version)
            
            result = {
                'currentVersion': current_version,
                'latestVersion': latest_version,
                'updateAvailable': compare_versions(current_version, latest_version),
                'releaseNotes': data.get('releaseNotes'),
                'releaseUrl': data.get('releaseUrl'),
                'cached': False
            }
            
            # Cache the result
            save_update_cache(result)
            return result
            
    except urllib.error.URLError as e:
        print(f"[Dashboard] Update check failed (network): {e}")
        return {
            'currentVersion': current_version,
            'latestVersion': None,
            'updateAvailable': False,
            'error': 'Could not check for updates'
        }
    except json.JSONDecodeError as e:
        print(f"[Dashboard] Update check failed (parse): {e}")
        return {
            'currentVersion': current_version,
            'latestVersion': None,
            'updateAvailable': False,
            'error': 'Invalid response from registry'
        }
    except Exception as e:
        print(f"[Dashboard] Update check failed: {e}")
        return {
            'currentVersion': current_version,
            'latestVersion': None,
            'updateAvailable': False,
            'error': 'Could not check for updates'
        }


def save_settings(settings):
    """Save settings to settings.json."""
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)


def load_archive_index():
    """Load archive index from archive-index.json."""
    if ARCHIVE_INDEX_FILE.exists():
        try:
            with open(ARCHIVE_INDEX_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {'sessions': [], 'totalSize': 0}


def save_archive_index(index):
    """Save archive index to archive-index.json."""
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARCHIVE_INDEX_FILE, 'w') as f:
        json.dump(index, f, indent=2)


def archive_session(session_key, session_data):
    """
    Archive a session by compressing its JSONL file.
    Returns (True, None) on success, (False, error_message) on failure.
    """
    # Find the JSONL file
    session_id = session_data.get('sessionId', session_key)
    jsonl_file = SESSIONS_DIR / f'{session_id}.jsonl'
    
    if not jsonl_file.exists():
        # Try to find by key pattern
        matching = list(SESSIONS_DIR.glob(f'*{session_id}*.jsonl'))
        if matching:
            jsonl_file = matching[0]
        else:
            return (False, f"Transcript file not found: {session_id}.jsonl")
    
    # Create archive directory if needed
    try:
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    except PermissionError as e:
        return (False, f"Cannot create archive directory: permission denied")
    except Exception as e:
        return (False, f"Cannot create archive directory: {e}")
    
    # Compress the file
    archive_file = ARCHIVE_DIR / f'{jsonl_file.stem}.jsonl.gz'
    try:
        with open(jsonl_file, 'rb') as f_in:
            with gzip.open(archive_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
    except PermissionError:
        return (False, f"Permission denied writing to archive")
    except Exception as e:
        return (False, f"Failed to compress file: {e}")
    
    try:
        # Get sizes
        original_size = get_file_size_bytes(jsonl_file)
        compressed_size = get_file_size_bytes(archive_file)
        
        # Update archive index
        index = load_archive_index()
        index['sessions'].append({
            'key': session_key,
            'sessionId': session_id,
            'label': session_data.get('label', session_key),
            'archivedAt': int(time.time() * 1000),
            'originalSize': original_size,
            'compressedSize': compressed_size,
            'updatedAt': session_data.get('updatedAt', 0),
            'model': session_data.get('model'),
            'channel': session_data.get('channel') or session_data.get('lastChannel'),
            'task': extract_first_user_message(jsonl_file),
        })
        index['totalSize'] = sum(s.get('compressedSize', 0) for s in index['sessions'])
        save_archive_index(index)
        
        # Remove original file
        jsonl_file.unlink()
        
        # Remove from sessions.json
        sessions_file = SESSIONS_DIR / 'sessions.json'
        if sessions_file.exists():
            with open(sessions_file) as f:
                sessions = json.load(f)
            if session_key in sessions:
                del sessions[session_key]
                with open(sessions_file, 'w') as f:
                    json.dump(sessions, f, indent=2)
        
        return (True, None)
    except Exception as e:
        print(f"[Dashboard] Error archiving session: {e}")
        # Clean up partial archive if it exists
        if archive_file.exists():
            try:
                archive_file.unlink()
            except:
                pass
        return (False, f"Archive failed: {e}")


def restore_session(session_key):
    """
    Restore an archived session by decompressing it.
    Returns True on success, False on failure.
    """
    index = load_archive_index()
    
    # Find session in index
    session_info = None
    for s in index['sessions']:
        if s['key'] == session_key or s.get('sessionId') == session_key:
            session_info = s
            break
    
    if not session_info:
        return False
    
    session_id = session_info.get('sessionId', session_key)
    archive_file = ARCHIVE_DIR / f'{session_id}.jsonl.gz'
    
    if not archive_file.exists():
        return False
    
    # Decompress
    jsonl_file = SESSIONS_DIR / f'{session_id}.jsonl'
    try:
        with gzip.open(archive_file, 'rb') as f_in:
            with open(jsonl_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        # Add back to sessions.json
        sessions_file = SESSIONS_DIR / 'sessions.json'
        sessions = {}
        if sessions_file.exists():
            with open(sessions_file) as f:
                sessions = json.load(f)
        
        sessions[session_info['key']] = {
            'sessionId': session_id,
            'label': session_info.get('label'),
            'updatedAt': session_info.get('updatedAt'),
            'model': session_info.get('model'),
            'channel': session_info.get('channel'),
            'restoredAt': int(time.time() * 1000),
        }
        
        with open(sessions_file, 'w') as f:
            json.dump(sessions, f, indent=2)
        
        # Remove from archive
        archive_file.unlink()
        
        # Update index
        index['sessions'] = [s for s in index['sessions'] if s['key'] != session_key]
        index['totalSize'] = sum(s.get('compressedSize', 0) for s in index['sessions'])
        save_archive_index(index)
        
        return True
    except Exception as e:
        print(f"[Dashboard] Error restoring session: {e}")
        return False


def read_archived_transcript(session_key):
    """Read transcript from an archived (gzipped) session."""
    index = load_archive_index()
    
    # Find session in index
    session_info = None
    for s in index['sessions']:
        if s['key'] == session_key or s.get('sessionId') == session_key:
            session_info = s
            break
    
    if not session_info:
        return None
    
    session_id = session_info.get('sessionId', session_key)
    archive_file = ARCHIVE_DIR / f'{session_id}.jsonl.gz'
    
    if not archive_file.exists():
        return None
    
    history = []
    try:
        with gzip.open(archive_file, 'rt') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get('type') == 'message' and 'message' in entry:
                        msg = entry['message']
                        role = msg.get('role', 'unknown')
                        
                        if role == 'toolResult':
                            continue
                        
                        content = msg.get('content', '')
                        if isinstance(content, list):
                            text_parts = []
                            for item in content:
                                if isinstance(item, dict):
                                    if item.get('type') == 'text':
                                        text_parts.append(item.get('text', ''))
                                    elif item.get('type') == 'toolCall':
                                        tool_name = item.get('name', 'tool')
                                        text_parts.append(f"[Called: {tool_name}]")
                                elif isinstance(item, str):
                                    text_parts.append(item)
                            content = '\n'.join(text_parts)
                        
                        if content:
                            history.append({
                                'role': role,
                                'content': content,
                                'timestamp': entry.get('timestamp')
                            })
                except json.JSONDecodeError:
                    continue
        return history
    except Exception as e:
        print(f"[Dashboard] Error reading archived transcript: {e}")
        return None


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler for dashboard routes and API proxy."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)
    
    def check_auth(self):
        """Check if request has valid auth token. Returns True if valid or auth disabled."""
        if not is_auth_enabled():
            return True
        
        # Check Authorization: Bearer header
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            if token == APP_CONFIG['dashboardToken']:
                return True
        
        # Check ?key= URL parameter
        parsed = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed.query)
        key_param = query_params.get('key', [None])[0]
        if key_param and key_param == APP_CONFIG['dashboardToken']:
            return True
        
        # Check dashboard_auth cookie
        cookie_header = self.headers.get('Cookie', '')
        if cookie_header:
            cookies = http.cookies.SimpleCookie()
            try:
                cookies.load(cookie_header)
                if 'dashboard_auth' in cookies:
                    token_hash = cookies['dashboard_auth'].value
                    if validate_token_hash(token_hash):
                        return True
            except Exception:
                pass
        
        return False
    
    def get_key_param(self):
        """Extract ?key= parameter from URL if present."""
        parsed = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed.query)
        return query_params.get('key', [None])[0]
    
    def set_auth_cookie(self):
        """Set the dashboard_auth cookie with hashed token."""
        token_hash = hash_token(APP_CONFIG['dashboardToken'])
        max_age_days = APP_CONFIG.get('cookieMaxAgeDays', 30)
        max_age_seconds = max_age_days * 24 * 60 * 60
        
        # Build cookie with security attributes
        cookie = http.cookies.SimpleCookie()
        cookie['dashboard_auth'] = token_hash
        cookie['dashboard_auth']['path'] = '/'
        cookie['dashboard_auth']['max-age'] = str(max_age_seconds)
        cookie['dashboard_auth']['httponly'] = True
        cookie['dashboard_auth']['samesite'] = 'Strict'
        
        # Set Secure flag if request appears to be HTTPS
        # (Check X-Forwarded-Proto for reverse proxy scenarios)
        forwarded_proto = self.headers.get('X-Forwarded-Proto', '')
        if forwarded_proto == 'https' or self.headers.get('Host', '').endswith('.ts.net'):
            cookie['dashboard_auth']['secure'] = True
        
        return cookie['dashboard_auth'].OutputString()
    
    def clear_auth_cookie(self):
        """Clear the dashboard_auth cookie."""
        cookie = http.cookies.SimpleCookie()
        cookie['dashboard_auth'] = ''
        cookie['dashboard_auth']['path'] = '/'
        cookie['dashboard_auth']['max-age'] = '0'
        cookie['dashboard_auth']['expires'] = 'Thu, 01 Jan 1970 00:00:00 GMT'
        return cookie['dashboard_auth'].OutputString()
    
    def redirect_without_key(self):
        """Redirect to the same URL but without the ?key= parameter."""
        parsed = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed.query)
        
        # Remove the 'key' parameter
        query_params.pop('key', None)
        
        # Rebuild query string
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        
        # Rebuild URL
        new_path = parsed.path
        if new_query:
            new_path += '?' + new_query
        
        return new_path or '/'
    
    def check_write_permission(self):
        """Check if write operations are allowed."""
        if is_read_only():
            self.send_error_json(403, 'Dashboard is in read-only mode')
            return False
        return True
    
    def do_GET(self):
        """Handle GET requests."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        # Public routes (no auth required)
        if path == '/api/config':
            self.handle_get_config()
            return
        
        # Check for login page request
        if path == '/login' or path == '/login.html':
            super().do_GET()
            return
        
        # Handle key-based auth: check for ?key= on any page request
        key_param = self.get_key_param()
        if key_param and is_auth_enabled():
            auth_mode = get_auth_mode()
            # Key auth is allowed in 'key' or 'both' modes
            if auth_mode in ('key', 'both'):
                if key_param == APP_CONFIG.get('dashboardToken'):
                    # Valid key: set cookie and redirect to clean URL
                    new_path = self.redirect_without_key()
                    self.send_response(302)
                    self.send_header('Location', new_path)
                    self.send_header('Set-Cookie', self.set_auth_cookie())
                    self.send_cors_headers()
                    self.end_headers()
                    return
                else:
                    # Invalid key
                    self.send_error_json(401, 'Invalid key')
                    return
        
        # API Routes (require auth)
        if path.startswith('/api/'):
            if not self.check_auth():
                self.send_error_json(401, 'Unauthorized. Please provide a valid token.')
                return
            
            if path == '/api/sessions':
                self.handle_sessions_list()
            elif path == '/api/nodes':
                self.handle_nodes_list()
            elif path == '/api/settings':
                self.handle_get_settings()
            elif path == '/api/archive':
                self.handle_archive_list()
            elif path == '/api/agents':
                self.handle_agents_list()
            elif path == '/api/update-check':
                self.handle_update_check()
            elif path.startswith('/api/sessions/') and path.endswith('/history'):
                session_id = path.split('/')[3]
                self.handle_session_history(session_id)
            elif path.startswith('/api/sessions/') and path.endswith('/result'):
                session_id = path.split('/')[3]
                self.handle_session_result(session_id)
            elif path.startswith('/api/archive/') and path.endswith('/history'):
                session_id = path.split('/')[3]
                self.handle_archived_history(session_id)
            else:
                self.send_error_json(404, 'Not found')
        else:
            # Serve static files
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        # Logout endpoint - doesn't require auth (just clears cookie)
        if path == '/api/logout':
            self.handle_logout()
            return
        
        # Auth check for all POST APIs
        if path.startswith('/api/'):
            if not self.check_auth():
                self.send_error_json(401, 'Unauthorized. Please provide a valid token.')
                return
        
        if path == '/api/settings':
            self.handle_save_settings()
        elif path == '/api/archive':
            if self.check_write_permission():
                self.handle_archive_session()
        elif path == '/api/restore':
            if self.check_write_permission():
                self.handle_restore_session()
        elif path == '/api/run-archive':
            if self.check_write_permission():
                self.handle_run_archive()
        else:
            self.send_error_json(404, 'Not found')
    
    def handle_logout(self):
        """Handle logout - clear auth cookie."""
        content = json.dumps({'success': True}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(content))
        self.send_header('Set-Cookie', self.clear_auth_cookie())
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(content)
    
    def handle_get_config(self):
        """Return safe configuration (no token!) for frontend."""
        self.send_json(get_safe_config())
    
    def handle_update_check(self):
        """Check for updates from ClawHub registry."""
        result = check_for_updates()
        self.send_json(result)
    
    def handle_agents_list(self):
        """Get list of unique agents discovered from session data, including sub-agents."""
        try:
            agents = set()
            
            # Sub-agent mappings: agent_id -> (display_name, parent_agent)
            # These are loaded from openclaw.json config; examples shown for reference
            # Users should configure their own agent names in openclaw.json
            subagent_info = {
                # Example: 'subagent-id': ('Display Name', 'parent'),
            }
            
            # Known agent names from config (always include these)
            known_agents = set(APP_CONFIG.get('agentEmojis', {}).keys())
            known_agents.discard('default')  # Remove the 'default' key
            
            # Add sub-agent names to known agents
            for agent_id, (display_name, _) in subagent_info.items():
                known_agents.add(display_name.lower())
                known_agents.add(agent_id.lower())
            
            # Get all agent session directories
            agent_session_dirs = get_all_agent_sessions_dirs()
            
            # Scan all agent session directories
            for agent_id, sessions_dir in agent_session_dirs:
                sessions_file = sessions_dir / 'sessions.json'
                
                # Add the agent ID itself (discovered from session directories)
                if agent_id in subagent_info:
                    # Use the display name for sub-agents
                    agents.add(subagent_info[agent_id][0].lower())
                elif agent_id == 'main':
                    agents.add('main')
                
                if not sessions_file.exists():
                    continue
                
                try:
                    with open(sessions_file) as f:
                        raw_data = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue
                
                for key, session in raw_data.items():
                    # Extract agent name from session key or data
                    agent_name = None
                    
                    # Check for sub-agent patterns in the key
                    # e.g., agent:subagent-id:subagent:uuid
                    key_parts = key.split(':')
                    if len(key_parts) >= 2:
                        agent_prefix = key_parts[1]  # agent ID from session key
                        if agent_prefix in subagent_info:
                            agent_name = subagent_info[agent_prefix][0].lower()
                    
                    if ':spawn:' in key or ':subagent:' in key:
                        parts = key.split(':spawn:') if ':spawn:' in key else key.split(':subagent:')
                        if len(parts) > 1:
                            spawn_label = parts[1]
                            # Check if spawn label starts with known agent name
                            spawn_first = spawn_label.split('-')[0].lower()
                            if spawn_first in known_agents:
                                agent_name = spawn_first
                    elif ':cron:' in key:
                        agent_name = 'cron'
                    elif key == 'agent:main:main':
                        agent_name = 'main'
                    
                    # Also check label for agent name patterns
                    label = session.get('label', '')
                    if label:
                        label_lower = label.lower()
                        for known in known_agents:
                            if label_lower.startswith(known + '-') or label_lower == known:
                                agent_name = known
                                break
                        
                        if not agent_name and '-' in label:
                            first_word = label.split('-')[0].lower()
                            if first_word in known_agents:
                                agent_name = first_word
                    
                    if agent_name:
                        agents.add(agent_name)
            
            # Also include all known agents that might have sessions in archives
            archive_index = load_archive_index()
            for archived in archive_index.get('sessions', []):
                label = archived.get('label', '')
                if label:
                    label_lower = label.lower()
                    for known in known_agents:
                        if label_lower.startswith(known + '-') or label_lower == known:
                            agents.add(known)
                            break
                    if '-' in label:
                        first_word = label.split('-')[0].lower()
                        if first_word in known_agents:
                            agents.add(first_word)
            
            # Build agent list with emojis from config
            agent_emojis = APP_CONFIG.get('agentEmojis', {})
            main_name = APP_CONFIG.get('mainAgentName', 'Main')
            main_emoji = APP_CONFIG.get('mainAgentEmoji', '🏠')
            
            agent_list = [{'value': '', 'label': 'All Agents', 'emoji': '🤖'}]
            
            # Add main agent first (always include it)
            agents.add('main')  # Ensure main is always present
            if 'main' in agents:
                agent_list.append({
                    'value': 'main',
                    'label': f'{main_name} (main)',
                    'emoji': main_emoji
                })
                agents.discard('main')
            
            # Add cron if present
            if 'cron' in agents:
                agent_list.append({
                    'value': 'cron',
                    'label': 'Cron',
                    'emoji': agent_emojis.get('cron', '⏰')
                })
                agents.discard('cron')
            
            # Add sub-agents with their display names
            for agent_id, (display_name, _) in sorted(subagent_info.items()):
                # Check if this sub-agent has sessions (either by display name or agent id)
                if display_name.lower() in agents or agent_id in agents:
                    emoji = agent_emojis.get(display_name.lower(), 
                            agent_emojis.get(agent_id, 
                            agent_emojis.get('default', '🤖')))
                    agent_list.append({
                        'value': agent_id,  # Use agent_id for filtering
                        'label': f'{display_name} ({agent_id})',
                        'emoji': emoji
                    })
                    agents.discard(display_name.lower())
                    agents.discard(agent_id)
            
            # Add any remaining agents alphabetically
            for agent in sorted(agents):
                emoji = agent_emojis.get(agent, agent_emojis.get('default', '🤖'))
                agent_list.append({
                    'value': agent,
                    'label': agent.capitalize(),
                    'emoji': emoji
                })
            
            self.send_json({'agents': agent_list})
            
        except Exception as e:
            print(f"[Dashboard] Error loading agents: {e}")
            self.send_error_json(500, str(e))
    
    def handle_sessions_list(self):
        """Get list of all sessions from all agent session directories."""
        try:
            # Get all agent session directories
            agent_session_dirs = get_all_agent_sessions_dirs()
            
            sessions_list = []
            total_size = 0
            
            # Read sessions from each agent's sessions.json
            for agent_id, sessions_dir in agent_session_dirs:
                sessions_file = sessions_dir / 'sessions.json'
                
                if not sessions_file.exists():
                    continue
                
                try:
                    with open(sessions_file) as f:
                        raw_data = json.load(f)
                except (json.JSONDecodeError, OSError) as e:
                    print(f"[Dashboard] Error reading {sessions_file}: {e}")
                    continue
                
                for key, session in raw_data.items():
                    session['key'] = key
                    session['_agentId'] = agent_id  # Track which agent this belongs to
                    session['_sessionsDir'] = str(sessions_dir)  # Track the sessions dir
                    
                    # Add file size
                    session_id = session.get('sessionId', key)
                    jsonl_file = sessions_dir / f'{session_id}.jsonl'
                    if jsonl_file.exists():
                        size_bytes = get_file_size_bytes(jsonl_file)
                        session['sizeBytes'] = size_bytes
                        session['sizeFormatted'] = format_size(size_bytes)
                        total_size += size_bytes
                        
                        # Extract first user message (task) if not already present
                        if 'task' not in session:
                            task = extract_first_user_message(jsonl_file)
                            if task:
                                session['task'] = task
                    else:
                        session['sizeBytes'] = 0
                        session['sizeFormatted'] = '—'
                    
                    # Sanitize the session data
                    sessions_list.append(sanitize_session(session))
            
            if sessions_list:
                # Sort by updatedAt descending
                sessions_list.sort(key=lambda x: x.get('updatedAt', 0), reverse=True)
                
                sessions = self.transform_sessions({'sessions': sessions_list})
                
                # Get archive stats
                archive_index = load_archive_index()
                archive_count = len(archive_index.get('sessions', []))
                archive_size = archive_index.get('totalSize', 0)
                
                self.send_json({
                    'sessions': sessions,
                    'stats': {
                        'activeCount': len(sessions),
                        'activeSizeBytes': total_size,
                        'activeSizeFormatted': format_size(total_size),
                        'archivedCount': archive_count,
                        'archivedSizeBytes': archive_size,
                        'archivedSizeFormatted': format_size(archive_size),
                    }
                })
            else:
                sessions = self.get_sessions_fallback()
                self.send_json({
                    'sessions': sessions,
                    'stats': {
                        'activeCount': len(sessions),
                        'activeSizeBytes': 0,
                        'activeSizeFormatted': '0 B',
                        'archivedCount': 0,
                        'archivedSizeBytes': 0,
                        'archivedSizeFormatted': '0 B',
                    }
                })
                
        except Exception as e:
            print(f"[Dashboard] Error loading sessions: {e}")
            self.send_error_json(500, str(e))
    
    def handle_nodes_list(self):
        """Get list of available nodes dynamically from session data across all agents."""
        try:
            nodes = []
            known_names = set()  # Track normalized names (lowercase) to avoid duplicates
            
            # Add the gateway (local machine) as first node
            hostname = socket.gethostname()
            gateway_name = self.normalize_node_name(hostname)
            gateway_value = gateway_name.lower().replace(' ', '-')
            nodes.append({
                'id': 'gateway',
                'name': gateway_name,
                'value': gateway_value,
                'displayName': gateway_name,
                'isGateway': True,
                'connected': True,
                'status': 'ok',
                'statusMessage': 'Gateway running'
            })
            known_names.add(gateway_name.lower())
            
            # Get remote nodes from openclaw nodes status (if available)
            try:
                result = subprocess.run(
                    ['openclaw', 'nodes', 'status', '--json'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    output = result.stdout
                    start = output.find('{')
                    if start >= 0:
                        data = json.loads(output[start:])
                        for node in data.get('nodes', []):
                            node_name = self.normalize_node_name(
                                node.get('displayName', node.get('nodeId', 'unknown'))
                            )
                            
                            if node_name.lower() in known_names:
                                continue
                            
                            # Determine node status
                            connected = node.get('connected', False)
                            paired = node.get('paired', False)
                            
                            if connected and paired:
                                status = 'ok'
                                status_message = f"Connected - v{node.get('version', 'unknown')}"
                            elif paired and not connected:
                                status = 'offline'
                                status_message = 'Paired but not connected'
                            elif not paired:
                                status = 'warning'
                                status_message = 'Not paired'
                            else:
                                status = 'offline'
                                status_message = 'Disconnected'
                            
                            node_value = node_name.lower().replace(' ', '-')
                            nodes.append({
                                'id': node.get('nodeId'),
                                'name': node_name,
                                'value': node_value,
                                'displayName': node.get('displayName'),
                                'isGateway': False,
                                'connected': connected,
                                'status': status,
                                'statusMessage': status_message,
                                'version': node.get('version'),
                                'platform': node.get('platform'),
                                'caps': node.get('caps', [])
                            })
                            known_names.add(node_name.lower())
            except (subprocess.SubprocessError, FileNotFoundError, json.JSONDecodeError):
                # openclaw CLI not available or failed - continue with session scanning
                pass
            
            # Scan ALL agent session directories for unique node values
            agent_session_dirs = get_all_agent_sessions_dirs()
            
            for agent_id, sessions_dir in agent_session_dirs:
                sessions_file = sessions_dir / 'sessions.json'
                if not sessions_file.exists():
                    continue
                
                try:
                    with open(sessions_file) as f:
                        raw_data = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue
                
                for session in raw_data.values():
                    # Check both 'node' and 'hostname' fields
                    node_name = session.get('node') or session.get('hostname')
                    if not node_name:
                        continue
                    
                    # Normalize the name for display
                    normalized = self.normalize_node_name(node_name)
                    
                    if normalized.lower() in known_names:
                        continue
                    
                    node_value = normalized.lower().replace(' ', '-')
                    nodes.append({
                        'id': node_name,
                        'name': normalized,
                        'value': node_value,
                        'displayName': node_name,
                        'isGateway': False,
                        'connected': False,  # Unknown connection status for discovered nodes
                        'status': 'unknown',
                        'statusMessage': 'Discovered from session data'
                    })
                    known_names.add(normalized.lower())
            
            # Also check archived sessions for nodes
            try:
                archive_index = load_archive_index()
                for archived in archive_index.get('sessions', []):
                    node_name = archived.get('node') or archived.get('hostname')
                    if not node_name:
                        continue
                    
                    normalized = self.normalize_node_name(node_name)
                    if normalized.lower() in known_names:
                        continue
                    
                    node_value = normalized.lower().replace(' ', '-')
                    nodes.append({
                        'id': node_name,
                        'name': normalized,
                        'value': node_value,
                        'displayName': node_name,
                        'isGateway': False,
                        'connected': False,
                        'status': 'archived',
                        'statusMessage': 'Found in archived sessions'
                    })
                    known_names.add(normalized.lower())
            except Exception:
                pass
            
            # Sort: gateway first, then alphabetically by name
            nodes.sort(key=lambda n: (not n.get('isGateway', False), n['name'].lower()))
            
            self.send_json({'nodes': nodes})
            
        except Exception as e:
            print(f"[Dashboard] Error loading nodes: {e}")
            self.send_error_json(500, str(e))
    
    def normalize_node_name(self, name):
        """Convert hostname to friendly display name."""
        if not name:
            return 'Unknown'
        
        # Clean up common suffixes
        name = name.replace('.local', '').replace('.attlocal.net', '')
        
        # Convert "My-Mac-mini-1" or "Mac mini 1" to "Mini 1"
        match = re.search(r'mini[- ]?(\d+)', name, re.IGNORECASE)
        if match:
            return f"Mini {match.group(1)}"
        
        # Convert "Mac mini 2" style
        match = re.search(r'mac\s*mini\s*(\d+)', name, re.IGNORECASE)
        if match:
            return f"Mini {match.group(1)}"
        
        return name
    
    def handle_session_history(self, session_id):
        """Get full transcript for a session by reading the JSONL file directly."""
        try:
            jsonl_file = None
            
            # Search all agent session directories for the JSONL file
            for agent_id, sessions_dir in get_all_agent_sessions_dirs():
                candidate = sessions_dir / f'{session_id}.jsonl'
                if candidate.exists():
                    jsonl_file = candidate
                    break
                # Try partial match
                matching_files = list(sessions_dir.glob(f'*{session_id}*.jsonl'))
                if matching_files:
                    jsonl_file = matching_files[0]
                    break
            
            if not jsonl_file:
                self.send_json({'history': [], 'error': 'Session transcript not found'})
                return
            
            history = []
            with open(jsonl_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        # Only process message entries (skip session, model_change, etc.)
                        if entry.get('type') == 'message' and 'message' in entry:
                            msg = entry['message']
                            role = msg.get('role', 'unknown')
                            
                            # Skip toolResult entries for cleaner display
                            if role == 'toolResult':
                                continue
                            
                            # Extract content - can be string or array
                            content = msg.get('content', '')
                            if isinstance(content, list):
                                # Extract text from content array
                                text_parts = []
                                for item in content:
                                    if isinstance(item, dict):
                                        if item.get('type') == 'text':
                                            text_parts.append(item.get('text', ''))
                                        elif item.get('type') == 'thinking':
                                            # Skip thinking blocks for cleaner output
                                            pass
                                        elif item.get('type') == 'toolCall':
                                            # Show tool calls briefly
                                            tool_name = item.get('name', 'tool')
                                            text_parts.append(f"[Called: {tool_name}]")
                                    elif isinstance(item, str):
                                        text_parts.append(item)
                                content = '\n'.join(text_parts)
                            
                            if content:  # Only add non-empty messages
                                history.append({
                                    'role': role,
                                    'content': content,
                                    'timestamp': entry.get('timestamp')
                                })
                    except json.JSONDecodeError:
                        continue
            
            self.send_json({'history': history})
            
        except Exception as e:
            print(f"[Dashboard] Error reading session history: {e}")
            self.send_error_json(500, str(e))
    
    def handle_session_result(self, session_id):
        """Get the final result/summary message from a session transcript."""
        try:
            jsonl_file = None
            
            # Search all agent session directories for the JSONL file
            for agent_id, sessions_dir in get_all_agent_sessions_dirs():
                candidate = sessions_dir / f'{session_id}.jsonl'
                if candidate.exists():
                    jsonl_file = candidate
                    break
                # Try partial match
                matching_files = list(sessions_dir.glob(f'*{session_id}*.jsonl'))
                if matching_files:
                    jsonl_file = matching_files[0]
                    break
            
            if not jsonl_file:
                self.send_json({'result': None, 'error': 'Session transcript not found'})
                return
            
            # Find the last assistant text message (the "result")
            last_assistant_text = None
            
            with open(jsonl_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        if entry.get('type') != 'message':
                            continue
                        
                        msg = entry.get('message', {})
                        role = msg.get('role', '')
                        
                        if role != 'assistant':
                            continue
                        
                        # Extract text content from assistant messages
                        content = msg.get('content', '')
                        text_content = ''
                        
                        if isinstance(content, str):
                            text_content = content
                        elif isinstance(content, list):
                            # Find text blocks (not tool calls, not thinking)
                            text_parts = []
                            for item in content:
                                if isinstance(item, dict) and item.get('type') == 'text':
                                    text = item.get('text', '')
                                    if text:
                                        text_parts.append(text)
                            text_content = '\n'.join(text_parts)
                        
                        # Only update if we found actual text content
                        if text_content.strip():
                            last_assistant_text = {
                                'content': text_content,
                                'timestamp': entry.get('timestamp')
                            }
                    except json.JSONDecodeError:
                        continue
            
            self.send_json({'result': last_assistant_text})
            
        except Exception as e:
            print(f"[Dashboard] Error reading session result: {e}")
            self.send_error_json(500, str(e))
    
    def handle_get_settings(self):
        """Get current settings."""
        settings = load_settings()
        self.send_json(settings)
    
    def handle_save_settings(self):
        """Save settings from POST body."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            new_settings = json.loads(body)
            
            # Validate retention days - allow 'never' or any positive integer
            retention = new_settings.get('retentionDays')
            if retention != 'never':
                try:
                    retention_int = int(retention)
                    if retention_int < 1:
                        self.send_error_json(400, 'Retention days must be positive')
                        return
                    new_settings['retentionDays'] = retention_int
                except (ValueError, TypeError):
                    self.send_error_json(400, 'Invalid retention period')
                    return
            
            # Validate page size
            valid_page_sizes = [10, 25, 50, 100]
            page_size = new_settings.get('pageSize', 20)
            if page_size not in valid_page_sizes:
                new_settings['pageSize'] = 20
            
            save_settings(new_settings)
            self.send_json({'success': True, 'settings': new_settings})
        except Exception as e:
            print(f"[Dashboard] Error saving settings: {e}")
            self.send_error_json(500, str(e))
    
    def handle_archive_list(self):
        """Get list of archived sessions."""
        index = load_archive_index()
        # Sort by archivedAt descending
        sessions = sorted(
            index.get('sessions', []),
            key=lambda x: x.get('archivedAt', 0),
            reverse=True
        )
        # Sanitize archived sessions too
        sessions = [sanitize_session(s) for s in sessions]
        self.send_json({
            'sessions': sessions,
            'totalSize': index.get('totalSize', 0),
            'totalSizeFormatted': format_size(index.get('totalSize', 0))
        })
    
    def handle_archived_history(self, session_id):
        """Get transcript for an archived session."""
        history = read_archived_transcript(session_id)
        if history is not None:
            self.send_json({'history': history})
        else:
            self.send_json({'history': [], 'error': 'Archived session not found'})
    
    def handle_archive_session(self):
        """Archive a specific session."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            session_key = data.get('sessionKey')
            
            if not session_key:
                self.send_error_json(400, 'sessionKey required')
                return
            
            # Get session data from sessions.json
            sessions_file = SESSIONS_DIR / 'sessions.json'
            if not sessions_file.exists():
                self.send_error_json(404, 'Sessions file not found')
                return
            
            with open(sessions_file) as f:
                sessions = json.load(f)
            
            if session_key not in sessions:
                self.send_error_json(404, 'Session not found in sessions.json')
                return
            
            session_data = sessions[session_key]
            success, error_msg = archive_session(session_key, session_data)
            
            if success:
                self.send_json({'success': True})
            else:
                self.send_error_json(500, error_msg or 'Failed to archive session')
        except Exception as e:
            print(f"[Dashboard] Error archiving session: {e}")
            self.send_error_json(500, str(e))
    
    def handle_restore_session(self):
        """Restore an archived session."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            session_key = data.get('sessionKey')
            
            if not session_key:
                self.send_error_json(400, 'sessionKey required')
                return
            
            success = restore_session(session_key)
            
            if success:
                self.send_json({'success': True})
            else:
                self.send_error_json(500, 'Failed to restore session')
        except Exception as e:
            print(f"[Dashboard] Error restoring session: {e}")
            self.send_error_json(500, str(e))
    
    def handle_run_archive(self):
        """Run the archiving process based on retention policy."""
        try:
            settings = load_settings()
            retention_days = settings.get('retentionDays', 'never')
            
            if retention_days == 'never':
                self.send_json({'success': True, 'archived': 0, 'message': 'Retention set to never'})
                return
            
            retention_days = int(retention_days)
            cutoff_ms = int(time.time() * 1000) - (retention_days * 24 * 60 * 60 * 1000)
            
            sessions_file = SESSIONS_DIR / 'sessions.json'
            if not sessions_file.exists():
                self.send_json({'success': True, 'archived': 0})
                return
            
            with open(sessions_file) as f:
                sessions = json.load(f)
            
            archived_count = 0
            for key, session in list(sessions.items()):
                updated_at = session.get('updatedAt', 0)
                if updated_at < cutoff_ms:
                    if archive_session(key, session):
                        archived_count += 1
            
            self.send_json({'success': True, 'archived': archived_count})
        except Exception as e:
            print(f"[Dashboard] Error running archive: {e}")
            self.send_error_json(500, str(e))
    
    def transform_sessions(self, data):
        """Transform raw OpenClaw session data to dashboard format."""
        sessions = []
        raw_sessions = data if isinstance(data, list) else data.get('sessions', [])
        
        # Load cron job names for better labels
        cron_names = self.load_cron_names()
        
        # Get main agent name from config
        main_agent_name = APP_CONFIG.get('mainAgentName', 'Main')
        
        # Sub-agent mappings: agent_id -> display_name
        # These are loaded from openclaw.json config; no hardcoded defaults
        subagent_names = {
            # Example: 'subagent-id': 'display-name',
        }
        
        for s in raw_sessions:
            key = s.get('key', '')
            
            # Skip :run: sub-sessions (duplicates of cron sessions)
            if ':run:' in key:
                continue
            
            # Determine agent type and friendly label
            agent_name = None
            label = s.get('label') or s.get('displayName', '')
            
            # Extract agent ID from key (e.g., agent:subagent-id:subagent:uuid -> subagent-id)
            key_parts = key.split(':')
            agent_id_from_key = key_parts[1] if len(key_parts) >= 2 else None
            
            # Check if this is a sub-agent session
            if agent_id_from_key in subagent_names:
                agent_name = subagent_names[agent_id_from_key]
            
            if ':spawn:' in key or ':subagent:' in key:
                # Spawn/subagent session
                # Check for stored label first
                stored_label = s.get('label', '')
                if stored_label and not stored_label.startswith('agent:'):
                    label = stored_label
                    # Extract agent name from label (e.g., "ops-calendar-fixes" -> "ops")
                    if not agent_name:
                        agent_name = stored_label.split('-')[0].lower() if '-' in stored_label else stored_label.lower()
                else:
                    # Fallback: parse from key
                    parts = key.split(':spawn:') if ':spawn:' in key else key.split(':subagent:')
                    if len(parts) > 1:
                        spawn_label = parts[1]
                        if not agent_name:
                            agent_name = spawn_label.split('-')[0].lower()
                        label = spawn_label
            elif ':cron:' in key:
                # Cron session: agent:main:cron:uuid
                agent_name = 'cron'
                # Extract cron ID and look up name
                cron_id = key.split(':cron:')[-1].split(':')[0]
                if cron_id in cron_names:
                    label = f"Cron: {cron_names[cron_id]}"
                else:
                    label = f"Cron Job"
            elif key == 'agent:main:main':
                agent_name = 'main'
                # Show configured agent name with (main) suffix
                label = f'{main_agent_name} (main)'
            elif ':signal:' in key or ':discord:' in key or ':telegram:' in key or ':whatsapp:' in key or ':slack:' in key:
                # Chat platform sessions - use friendly label parser
                label = parse_friendly_session_label(key, s)
                # Still set agent name if this is a sub-agent's chat session
                if not agent_name and agent_id_from_key == 'main':
                    agent_name = 'main'
            else:
                # Use friendly label parser for other sessions too
                label = parse_friendly_session_label(key, s) if not label else label
            
            # Determine status
            status = 'done'
            if s.get('abortedLastRun'):
                status = 'failed'
            # Check if recently active (within 60 seconds)
            age_ms = s.get('ageMs', float('inf'))
            if age_ms < 60000:
                status = 'running'
            
            # Calculate ageMs from updatedAt if not provided
            updated_at = s.get('updatedAt', 0)
            if age_ms == float('inf') and updated_at:
                age_ms = int(time.time() * 1000) - updated_at
            
            # Token usage percentage
            total_tokens = s.get('totalTokens', 0)
            context_tokens = s.get('contextTokens', 200000)  # Default to 200k
            usage_pct = round((total_tokens / context_tokens) * 100, 1) if context_tokens else 0
            
            # Determine node (hostname) and normalize it
            raw_node = s.get('node') or s.get('hostname')
            if raw_node:
                node = self.normalize_node_name(raw_node).lower().replace(' ', '-')
            else:
                # Default to gateway node
                node = self.normalize_node_name(socket.gethostname()).lower().replace(' ', '-')
            
            sessions.append(sanitize_session({
                'id': s.get('sessionId') or key,
                'key': key,
                'label': label,
                'agentName': agent_name,
                'status': status,
                'updatedAt': updated_at,
                'ageMs': age_ms,
                'channel': s.get('channel') or s.get('lastChannel', 'unknown'),
                'model': s.get('model', 'unknown'),
                'totalTokens': total_tokens,
                'contextTokens': context_tokens,
                'usagePct': usage_pct,
                'node': node,
                'sizeBytes': s.get('sizeBytes', 0),
                'sizeFormatted': s.get('sizeFormatted', '—'),
                'task': s.get('task'),
            }))
        
        return sessions
    
    def load_cron_names(self):
        """Load cron job names from openclaw cron list."""
        try:
            result = subprocess.run(
                ['openclaw', 'cron', 'list', '--json'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                # Skip any non-JSON prefix (like plugin registration lines)
                output = result.stdout
                start = output.find('{')
                if start >= 0:
                    data = json.loads(output[start:])
                    return {job['id']: job['name'] for job in data.get('jobs', [])}
        except Exception as e:
            print(f"[Dashboard] Error loading cron names: {e}")
        return {}
    
    def normalize_status(self, status):
        """Normalize status to standard values."""
        status = str(status).lower()
        if status in ['done', 'completed', 'success', 'finished']:
            return 'done'
        elif status in ['running', 'active', 'in_progress']:
            return 'running'
        elif status in ['failed', 'error', 'crashed']:
            return 'failed'
        return 'pending'
    
    def parse_text_output(self, text):
        """Parse text output when JSON is not available."""
        sessions = []
        for line in text.strip().split('\n'):
            if line.strip():
                sessions.append({
                    'id': line[:20],
                    'label': line,
                    'status': 'done',
                    'lastOutput': '',
                    'durationMs': 0,
                    'startedAt': None
                })
        return sessions
    
    def get_sessions_fallback(self):
        """Fallback method to get sessions - returns demo data if CLI unavailable."""
        # Try reading from session files directly
        session_dir = OPENCLAW_HOME / 'sessions'
        sessions = []
        
        if session_dir.exists():
            for f in sorted(session_dir.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)[:20]:
                try:
                    with open(f) as fp:
                        data = json.load(fp)
                        sessions.append(sanitize_session({
                            'id': f.stem,
                            'label': data.get('label', f.stem),
                            'status': data.get('status', 'done'),
                            'lastOutput': data.get('lastOutput', ''),
                            'durationMs': data.get('durationMs', 0),
                            'startedAt': data.get('startedAt')
                        }))
                except:
                    pass
        
        # If no sessions found, return empty list (no demo data for production)
        return sessions
    
    def send_json(self, data):
        """Send JSON response."""
        content = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(content))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(content)
    
    def send_error_json(self, code, message):
        """Send error as JSON."""
        content = json.dumps({'error': message}).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(content))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(content)
    
    def send_cors_headers(self):
        """Add CORS headers based on configuration."""
        cors_origin = APP_CONFIG.get('corsOrigin')
        if cors_origin:
            # Use configured origin (could be '*' or specific domain)
            self.send_header('Access-Control-Allow-Origin', cors_origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        # If corsOrigin is None/empty, no CORS headers are sent (same-origin only)
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[Dashboard] {args[0]}")


def main():
    """Start the dashboard server."""
    auth_mode = get_auth_mode()
    auth_mode_labels = {
        'none': '🔓 No auth (open access)',
        'key': '🔑 Key auth only (URL ?key=)',
        'login': '🔒 Login page auth only',
        'both': '🔐 Key + Login auth (both methods)',
    }
    auth_status = auth_mode_labels.get(auth_mode, '🔒 Token auth enabled')
    if auth_mode != 'none' and not APP_CONFIG.get('dashboardToken'):
        auth_status = '⚠️  Auth enabled but no token configured!'
    readonly_status = "📖 Read-only mode" if is_read_only() else "✏️ Read-write mode"
    
    # Load version
    version_str = "unknown"
    version_file = STATIC_DIR / 'version.json'
    if version_file.exists():
        try:
            with open(version_file) as f:
                v = json.load(f)
                version_str = v.get('version', 'unknown')
        except:
            pass
    
    # Check if sessions dir exists
    sessions_status = "✓" if SESSIONS_DIR.exists() else "✗ (will be created)"
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║         🐾 ClawWatch v{version_str:<10}                           ║
║         OpenClaw Agent Dashboard                              ║
╠══════════════════════════════════════════════════════════════╣
║  URL:      http://localhost:{PORT:<5}                            ║
║  OpenClaw: {str(OPENCLAW_HOME):<50}
║  Sessions: {str(SESSIONS_DIR):<46} {sessions_status}
║  Gateway:  {GATEWAY_URL:<48}
║  {auth_status:<58}
║  {readonly_status:<58}
╚══════════════════════════════════════════════════════════════╝
    """)
    
    server = http.server.HTTPServer(('0.0.0.0', PORT), DashboardHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Dashboard] Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
