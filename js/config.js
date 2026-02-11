/**
 * Dashboard Configuration
 * 
 * Loads configuration dynamically from server with sensible defaults.
 * Config is loaded from /api/config which returns safe values (no secrets).
 */

// Default configuration (used before server config loads)
const DEFAULT_CONFIG = {
    // API Settings
    api: {
        baseUrl: '',
        endpoints: {
            sessions: '/api/sessions',
            history: '/api/sessions/{id}/history',
            config: '/api/config',
            agents: '/api/agents',
            nodes: '/api/nodes'
        }
    },
    
    // Refresh Settings
    refresh: {
        intervalMs: 30000,  // Default 30s, loaded from localStorage
        autoStart: true,
        showIndicator: true,
        // Available options: value in ms, label for display
        options: [
            { value: 1000, label: '1 second' },
            { value: 5000, label: '5 seconds' },
            { value: 10000, label: '10 seconds' },
            { value: 30000, label: '30 seconds' },
            { value: 60000, label: '1 minute' },
            { value: 120000, label: '2 minutes' },
            { value: 300000, label: '5 minutes' },
            { value: 0, label: 'Off' }
        ]
    },
    
    // Display Settings
    display: {
        maxSessions: 20,
        previewLength: 80,
        dateFormat: 'relative',
        theme: 'dark'
    },
    
    // Status Configuration
    status: {
        colors: {
            done: '#22c55e',
            running: '#3b82f6',
            failed: '#ef4444',
            pending: '#9ca3af'
        },
        // Icons now provided by Icons module - these are fallback identifiers
        iconNames: {
            done: 'checkCircle',
            running: 'spinner',
            failed: 'xCircle',
            pending: 'clock'
        }
    },
    
    // Agent Label Emojis (loaded from server config)
    // Configure your agent emojis in config.json
    agentEmojis: {
        'main': '🏠',
        'cron': '⏰',
        'default': '🤖'
    },
    
    // Filter Configuration (agents loaded dynamically from server)
    filters: {
        agents: [
            { value: '', label: 'All Agents', emoji: '🤖' }
        ],
        defaultNodeEmoji: '🖥️',
        gatewayEmoji: '🟢',
        remoteNodeEmoji: '🔵'
    },
    
    // Server config (loaded from /api/config)
    server: {
        authEnabled: false,
        authMode: 'login',  // 'none', 'key', 'login', 'both'
        readOnly: false,
        mainAgentName: 'Main',
        mainAgentEmoji: '🏠'
    },
    
    // Feature flags
    features: {
        notifications: false,
        search: true,
        charts: false,
        multiGateway: false
    }
};

// Make CONFIG mutable so we can update it after loading from server
let CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

/**
 * Load refresh interval from localStorage
 */
function loadRefreshInterval() {
    const stored = localStorage.getItem('dashboardRefreshInterval');
    if (stored !== null) {
        const intervalMs = parseInt(stored, 10);
        // Validate it's a known option
        const validOption = CONFIG.refresh.options.some(opt => opt.value === intervalMs);
        if (validOption || intervalMs === 0) {
            CONFIG.refresh.intervalMs = intervalMs;
            // If 0 (Off), disable auto-start
            if (intervalMs === 0) {
                CONFIG.refresh.autoStart = false;
            }
        }
    }
}

/**
 * Save refresh interval to localStorage
 */
function saveRefreshInterval(intervalMs) {
    localStorage.setItem('dashboardRefreshInterval', intervalMs.toString());
    CONFIG.refresh.intervalMs = intervalMs;
    CONFIG.refresh.autoStart = intervalMs > 0;
}

/**
 * Get current refresh interval in ms
 */
function getRefreshInterval() {
    return CONFIG.refresh.intervalMs;
}

// Load refresh interval immediately
loadRefreshInterval();

/**
 * Load configuration from server
 * Called early in app initialization
 */
async function loadServerConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const serverConfig = await response.json();
            
            // Merge server config into CONFIG
            CONFIG.server.authEnabled = serverConfig.authEnabled || false;
            CONFIG.server.authMode = serverConfig.authMode || 'login';
            CONFIG.server.readOnly = serverConfig.readOnly || false;
            CONFIG.server.mainAgentName = serverConfig.mainAgentName || 'Main';
            CONFIG.server.mainAgentEmoji = serverConfig.mainAgentEmoji || '🏠';
            
            // Update agent emojis from server
            if (serverConfig.agentEmojis) {
                CONFIG.agentEmojis = { ...CONFIG.agentEmojis, ...serverConfig.agentEmojis };
                // Also add main agent emoji
                CONFIG.agentEmojis['main'] = serverConfig.mainAgentEmoji || '🏠';
            }
            
            // Update node emojis from server
            if (serverConfig.nodeEmojis) {
                CONFIG.filters.gatewayEmoji = serverConfig.nodeEmojis.gateway || '🟢';
                CONFIG.filters.remoteNodeEmoji = serverConfig.nodeEmojis.remote || '🔵';
                CONFIG.filters.defaultNodeEmoji = serverConfig.nodeEmojis.default || '🖥️';
            }
            
            console.log('[Config] Loaded from server:', {
                authEnabled: CONFIG.server.authEnabled,
                authMode: CONFIG.server.authMode,
                readOnly: CONFIG.server.readOnly,
                mainAgentName: CONFIG.server.mainAgentName
            });
        }
    } catch (err) {
        console.warn('[Config] Failed to load from server, using defaults:', err);
    }
}

/**
 * Load agent filter options from server (auto-discovered from sessions)
 */
async function loadAgentFilters() {
    try {
        const token = localStorage.getItem('dashboardToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // Handle /dashboard path prefix for Tailscale serve
        const basePath = window.location.pathname.startsWith('/dashboard') ? '/dashboard' : '';
        
        const response = await fetch(`${basePath}/api/agents`, { headers });
        if (response.ok) {
            const { agents } = await response.json();
            if (agents && agents.length > 0) {
                CONFIG.filters.agents = agents;
                console.log('[Config] Loaded agent filters:', agents.length, 'agents');
            }
        } else {
            console.warn('[Config] Failed to load agents, status:', response.status);
        }
    } catch (err) {
        console.warn('[Config] Failed to load agent filters:', err);
    }
}

/**
 * Check if authentication is required and user is authenticated
 * Returns true if OK to proceed, false if redirect/error needed
 */
async function checkAuthentication() {
    // First load server config to know if auth is enabled
    await loadServerConfig();
    
    if (!CONFIG.server.authEnabled) {
        // No auth required (authMode: 'none' or no token configured)
        return true;
    }
    
    const authMode = CONFIG.server.authMode;
    
    // For 'key' mode only, we rely on server-side cookie validation
    // The cookie is set when user accesses with ?key= param
    // Try to make an API call to see if we're authenticated (cookie or localStorage token)
    
    // Check for localStorage token (used by 'login' and 'both' modes)
    const token = localStorage.getItem('dashboardToken');
    
    // Try to validate - server will accept cookie OR bearer token OR key param
    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch('/api/sessions', { headers });
        
        if (response.ok) {
            // Authenticated (via cookie or token)
            return true;
        }
        
        if (response.status === 401) {
            // Not authenticated
            localStorage.removeItem('dashboardToken');
            
            // Redirect based on auth mode
            if (authMode === 'login' || authMode === 'both') {
                // Show login page
                window.location.href = './login.html';
            } else if (authMode === 'key') {
                // Key-only mode: show error (no login page available)
                window.location.href = './login.html?mode=key';
            }
            return false;
        }
        
        return true;
    } catch (err) {
        console.error('[Config] Auth check failed:', err);
        return false;
    }
}

/**
 * Get auth header for API requests
 */
function getAuthHeaders() {
    const token = localStorage.getItem('dashboardToken');
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

/**
 * Clear authentication and redirect to login
 * Clears both localStorage token AND server-side cookie
 */
async function logout() {
    // Clear localStorage token
    localStorage.removeItem('dashboardToken');
    
    // Clear server-side cookie via API
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
        console.warn('[Config] Failed to clear server cookie:', err);
    }
    
    // Redirect to login page (or show key-only error)
    const authMode = CONFIG.server.authMode;
    if (authMode === 'key') {
        window.location.href = './login.html?mode=key';
    } else {
        window.location.href = './login.html';
    }
}

/**
 * Get the current auth mode
 */
function getAuthMode() {
    return CONFIG.server.authMode || 'login';
}

/**
 * Get emoji for agent name
 */
function getAgentEmoji(agentName) {
    if (!agentName) return CONFIG.agentEmojis.default || '🤖';
    const name = agentName.toLowerCase();
    return CONFIG.agentEmojis[name] || CONFIG.agentEmojis.default || '🤖';
}

/**
 * Get display name for main agent
 */
function getMainAgentName() {
    return CONFIG.server.mainAgentName || 'Main';
}

/**
 * Check if dashboard is in read-only mode
 */
function isReadOnly() {
    return CONFIG.server.readOnly || false;
}
