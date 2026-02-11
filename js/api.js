/**
 * API Layer - Handles all communication with OpenClaw Gateway
 * 
 * Includes authentication token handling.
 * All API calls should go through this layer.
 */

class SessionAPI {
    constructor(config = CONFIG.api) {
        this.endpoints = config.endpoints;
        // Detect if running under /dashboard path (Tailscale serve)
        const path = window.location.pathname;
        this.baseUrl = path.startsWith('/dashboard') ? '/dashboard' : '';
    }
    
    /**
     * Build full URL for an endpoint
     * Uses absolute URLs to bypass <base> tag effects on fetch
     */
    buildUrl(endpoint, params = {}) {
        let url = `${window.location.origin}${this.baseUrl}${endpoint}`;
        
        // Replace path parameters like {id}
        Object.keys(params).forEach(key => {
            url = url.replace(`{${key}}`, encodeURIComponent(params[key]));
        });
        
        return url;
    }
    
    /**
     * Get auth headers for requests
     */
    getAuthHeaders() {
        const token = localStorage.getItem('dashboardToken');
        if (token) {
            return { 'Authorization': `Bearer ${token}` };
        }
        return {};
    }
    
    /**
     * Make a fetch request with error handling and auth
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                    ...options.headers
                }
            });
            
            // Handle auth errors
            if (response.status === 401) {
                // Token invalid or missing, redirect to login if auth is enabled
                if (CONFIG.server?.authEnabled) {
                    localStorage.removeItem('dashboardToken');
                    window.location.href = './login.html';
                    throw new Error('Authentication required');
                }
            }
            
            // Handle read-only mode for write operations
            if (response.status === 403) {
                const data = await response.json();
                throw new Error(data.error || 'Operation not permitted');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    /**
     * Get list of all sessions (active + recent)
     * Returns: { sessions: [...], stats: {...}, error: null } or { sessions: [], stats: {}, error: string }
     */
    async getSessions() {
        try {
            const url = this.buildUrl(this.endpoints.sessions);
            const data = await this.request(url);
            return { sessions: data.sessions || [], stats: data.stats || {}, error: null };
        } catch (error) {
            return { sessions: [], stats: {}, error: error.message };
        }
    }
    
    /**
     * Get full transcript for a specific session
     * Returns: { history: [...], error: null } or { history: [], error: string }
     */
    async getSessionHistory(sessionId) {
        try {
            const url = this.buildUrl(this.endpoints.history, { id: sessionId });
            const data = await this.request(url);
            return { history: data.history || [], error: null };
        } catch (error) {
            return { history: [], error: error.message };
        }
    }
    
    /**
     * Get list of available nodes
     * Returns: { nodes: [...], error: null } or { nodes: [], error: string }
     */
    async getNodes() {
        try {
            const url = this.buildUrl('/api/nodes');
            const data = await this.request(url);
            return { nodes: data.nodes || [], error: null };
        } catch (error) {
            return { nodes: [], error: error.message };
        }
    }
    
    /**
     * Get list of discovered agents
     * Returns: { agents: [...], error: null } or { agents: [], error: string }
     */
    async getAgents() {
        try {
            const url = this.buildUrl('/api/agents');
            const data = await this.request(url);
            return { agents: data.agents || [], error: null };
        } catch (error) {
            return { agents: [], error: error.message };
        }
    }
    
    /**
     * Get the final result/summary for a specific session
     * Returns: { result: { content, timestamp }, error: null } or { result: null, error: string }
     */
    async getSessionResult(sessionId) {
        try {
            const url = this.buildUrl('/api/sessions/{id}/result', { id: sessionId });
            const data = await this.request(url);
            return { result: data.result, error: null };
        } catch (error) {
            return { result: null, error: error.message };
        }
    }
    
    /**
     * Archive a session
     */
    async archiveSession(sessionKey) {
        const url = this.buildUrl('/api/archive');
        return await this.request(url, {
            method: 'POST',
            body: JSON.stringify({ sessionKey })
        });
    }
    
    /**
     * Restore an archived session
     */
    async restoreSession(sessionKey) {
        const url = this.buildUrl('/api/restore');
        return await this.request(url, {
            method: 'POST',
            body: JSON.stringify({ sessionKey })
        });
    }
    
    /**
     * Get archived sessions
     */
    async getArchivedSessions() {
        try {
            const url = this.buildUrl('/api/archive');
            const data = await this.request(url);
            return { sessions: data.sessions || [], error: null };
        } catch (error) {
            return { sessions: [], error: error.message };
        }
    }
}

// Export singleton instance
const api = new SessionAPI();
