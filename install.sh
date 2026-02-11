#!/usr/bin/env bash
#
# ClawWatch Installer
# Installs ClawWatch dashboard for OpenClaw agent monitoring
#
# Usage:
#   curl -sSL https://clawhub.dev/clawwatch/install.sh | bash
#   ./install.sh [--port PORT] [--no-service] [--uninstall]
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Default settings
CLAWWATCH_PORT="${CLAWWATCH_PORT:-8889}"
INSTALL_SERVICE=true
UNINSTALL=false

# Installation paths
INSTALL_DIR="${HOME}/.openclaw/clawwatch"
OPENCLAW_HOME="${OPENCLAW_HOME:-${HOME}/.openclaw}"
LAUNCHD_PLIST="${HOME}/Library/LaunchAgents/com.openclaw.clawwatch.plist"
SYSTEMD_SERVICE="${HOME}/.config/systemd/user/clawwatch.service"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            CLAWWATCH_PORT="$2"
            shift 2
            ;;
        --no-service)
            INSTALL_SERVICE=false
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        --help|-h)
            echo "ClawWatch Installer"
            echo ""
            echo "Usage: ./install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --port PORT     Set server port (default: 8889)"
            echo "  --no-service    Don't create system service"
            echo "  --uninstall     Remove ClawWatch installation"
            echo "  --help          Show this help"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            OS="macos"
            ;;
        Linux*)
            OS="linux"
            ;;
        *)
            echo -e "${RED}Unsupported operating system: $(uname -s)${NC}"
            exit 1
            ;;
    esac
}

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                 🐾 ClawWatch Installer                     ║"
    echo "║          OpenClaw Agent Dashboard                         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Find OpenClaw installation
find_openclaw() {
    echo -e "${BLUE}→ Detecting OpenClaw installation...${NC}"
    
    # Check OPENCLAW_HOME env var
    if [[ -d "${OPENCLAW_HOME}" ]]; then
        echo -e "  ${GREEN}✓ Found at: ${OPENCLAW_HOME}${NC}"
        return 0
    fi
    
    # Try openclaw CLI
    if command -v openclaw &> /dev/null; then
        echo -e "  ${GREEN}✓ OpenClaw CLI found${NC}"
        
        # Try to get config path from status
        if openclaw status --json 2>/dev/null | grep -q "configPath"; then
            OPENCLAW_HOME=$(openclaw status --json 2>/dev/null | grep -o '"configPath"[^,]*' | cut -d'"' -f4 | xargs dirname 2>/dev/null || echo "${HOME}/.openclaw")
            echo -e "  ${GREEN}✓ Config at: ${OPENCLAW_HOME}${NC}"
            return 0
        fi
    fi
    
    # Fallback to default
    OPENCLAW_HOME="${HOME}/.openclaw"
    if [[ -d "${OPENCLAW_HOME}" ]]; then
        echo -e "  ${GREEN}✓ Using default: ${OPENCLAW_HOME}${NC}"
    else
        echo -e "  ${YELLOW}⚠ OpenClaw not found, will use: ${OPENCLAW_HOME}${NC}"
    fi
}

# Find sessions directory
find_sessions() {
    echo -e "${BLUE}→ Detecting sessions directory...${NC}"
    
    # Check common locations
    local candidates=(
        "${OPENCLAW_HOME}/agents/main/sessions"
        "${OPENCLAW_HOME}/sessions"
        "${HOME}/.openclaw/agents/main/sessions"
    )
    
    for dir in "${candidates[@]}"; do
        if [[ -d "$dir" ]]; then
            SESSIONS_PATH="$dir"
            echo -e "  ${GREEN}✓ Found: ${SESSIONS_PATH}${NC}"
            return 0
        fi
    done
    
    # Default
    SESSIONS_PATH="${OPENCLAW_HOME}/agents/main/sessions"
    echo -e "  ${YELLOW}⚠ Using default: ${SESSIONS_PATH}${NC}"
}

# Check Python version
check_python() {
    echo -e "${BLUE}→ Checking Python...${NC}"
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
        PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
        
        if [[ "$PYTHON_MAJOR" -ge 3 ]] && [[ "$PYTHON_MINOR" -ge 6 ]]; then
            echo -e "  ${GREEN}✓ Python ${PYTHON_VERSION}${NC}"
            return 0
        fi
    fi
    
    echo -e "  ${RED}✗ Python 3.6+ required${NC}"
    exit 1
}

# Copy files
copy_files() {
    echo -e "${BLUE}→ Installing ClawWatch...${NC}"
    
    # Get source directory (where this script is)
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Create install directory
    mkdir -p "${INSTALL_DIR}"
    
    # Copy all files
    if [[ -d "$script_dir" ]] && [[ -f "$script_dir/server.py" ]]; then
        cp -r "$script_dir"/* "${INSTALL_DIR}/" 2>/dev/null || true
        echo -e "  ${GREEN}✓ Files copied to ${INSTALL_DIR}${NC}"
    else
        echo -e "  ${RED}✗ Source files not found in $script_dir${NC}"
        exit 1
    fi
    
    # Make server.py executable
    chmod +x "${INSTALL_DIR}/server.py"
}

# Generate config
generate_config() {
    echo -e "${BLUE}→ Generating configuration...${NC}"
    
    local config_file="${INSTALL_DIR}/config.json"
    
    # Don't overwrite existing config
    if [[ -f "$config_file" ]]; then
        echo -e "  ${YELLOW}⚠ Config exists, keeping: ${config_file}${NC}"
        return 0
    fi
    
    # Generate a random token
    local token
    token=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -c 32)
    
    cat > "$config_file" << EOF
{
  "port": ${CLAWWATCH_PORT},
  "dashboardToken": "${token}",
  "authMode": "login",
  "readOnly": false,
  "mainAgentName": "Main",
  "mainAgentEmoji": "🏠"
}
EOF
    
    echo -e "  ${GREEN}✓ Config created: ${config_file}${NC}"
    echo -e "  ${CYAN}  Auth token: ${token}${NC}"
}

# Create launchd plist (macOS)
create_launchd_service() {
    echo -e "${BLUE}→ Creating launchd service...${NC}"
    
    mkdir -p "$(dirname "$LAUNCHD_PLIST")"
    
    cat > "$LAUNCHD_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.clawwatch</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>${INSTALL_DIR}/server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CLAWWATCH_PORT</key>
        <string>${CLAWWATCH_PORT}</string>
        <key>OPENCLAW_HOME</key>
        <string>${OPENCLAW_HOME}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${INSTALL_DIR}/server.log</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_DIR}/server.log</string>
</dict>
</plist>
EOF
    
    echo -e "  ${GREEN}✓ Created: ${LAUNCHD_PLIST}${NC}"
    
    # Load the service
    launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
    launchctl load "$LAUNCHD_PLIST"
    echo -e "  ${GREEN}✓ Service loaded${NC}"
}

# Create systemd service (Linux)
create_systemd_service() {
    echo -e "${BLUE}→ Creating systemd service...${NC}"
    
    mkdir -p "$(dirname "$SYSTEMD_SERVICE")"
    
    cat > "$SYSTEMD_SERVICE" << EOF
[Unit]
Description=ClawWatch - OpenClaw Agent Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=CLAWWATCH_PORT=${CLAWWATCH_PORT}
Environment=OPENCLAW_HOME=${OPENCLAW_HOME}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/server.py
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
    
    echo -e "  ${GREEN}✓ Created: ${SYSTEMD_SERVICE}${NC}"
    
    # Enable and start the service
    systemctl --user daemon-reload
    systemctl --user enable clawwatch
    systemctl --user start clawwatch
    echo -e "  ${GREEN}✓ Service enabled and started${NC}"
}

# Create service based on OS
create_service() {
    if [[ "$INSTALL_SERVICE" != true ]]; then
        echo -e "${YELLOW}→ Skipping service creation (--no-service)${NC}"
        return 0
    fi
    
    case "$OS" in
        macos)
            create_launchd_service
            ;;
        linux)
            create_systemd_service
            ;;
    esac
}

# Uninstall
do_uninstall() {
    echo -e "${BLUE}→ Uninstalling ClawWatch...${NC}"
    
    # Stop and remove services
    case "$OS" in
        macos)
            if [[ -f "$LAUNCHD_PLIST" ]]; then
                launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
                rm -f "$LAUNCHD_PLIST"
                echo -e "  ${GREEN}✓ Removed launchd service${NC}"
            fi
            ;;
        linux)
            if [[ -f "$SYSTEMD_SERVICE" ]]; then
                systemctl --user stop clawwatch 2>/dev/null || true
                systemctl --user disable clawwatch 2>/dev/null || true
                rm -f "$SYSTEMD_SERVICE"
                systemctl --user daemon-reload
                echo -e "  ${GREEN}✓ Removed systemd service${NC}"
            fi
            ;;
    esac
    
    # Remove installation directory (keep config backup)
    if [[ -d "$INSTALL_DIR" ]]; then
        if [[ -f "${INSTALL_DIR}/config.json" ]]; then
            cp "${INSTALL_DIR}/config.json" "${INSTALL_DIR}/config.json.backup" 2>/dev/null || true
            echo -e "  ${YELLOW}⚠ Config backed up to config.json.backup${NC}"
        fi
        rm -rf "$INSTALL_DIR"
        echo -e "  ${GREEN}✓ Removed ${INSTALL_DIR}${NC}"
    fi
    
    echo -e "${GREEN}✓ ClawWatch uninstalled${NC}"
}

# Print success message
print_success() {
    local url="http://localhost:${CLAWWATCH_PORT}"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           🎉 ClawWatch installed successfully!             ║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Dashboard URL: ${CYAN}${url}${NC}                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Install dir:   ${INSTALL_DIR}             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                            ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "To start manually:"
    echo -e "  ${CYAN}cd ${INSTALL_DIR} && python3 server.py${NC}"
    echo ""
    if [[ "$INSTALL_SERVICE" == true ]]; then
        case "$OS" in
            macos)
                echo -e "Service commands:"
                echo -e "  ${CYAN}launchctl stop com.openclaw.clawwatch${NC}    # Stop"
                echo -e "  ${CYAN}launchctl start com.openclaw.clawwatch${NC}   # Start"
                echo -e "  ${CYAN}launchctl unload ~/Library/LaunchAgents/com.openclaw.clawwatch.plist${NC}  # Disable"
                ;;
            linux)
                echo -e "Service commands:"
                echo -e "  ${CYAN}systemctl --user stop clawwatch${NC}     # Stop"
                echo -e "  ${CYAN}systemctl --user start clawwatch${NC}    # Start"
                echo -e "  ${CYAN}systemctl --user status clawwatch${NC}   # Status"
                ;;
        esac
    fi
}

# Main
main() {
    print_banner
    detect_os
    
    if [[ "$UNINSTALL" == true ]]; then
        do_uninstall
        exit 0
    fi
    
    find_openclaw
    find_sessions
    check_python
    copy_files
    generate_config
    create_service
    print_success
}

main "$@"
