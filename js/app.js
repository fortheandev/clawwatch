/**
 * Main Application - Dashboard Controller
 * 
 * EXTENSION POINT: Add new features by extending the Dashboard class
 * or adding new modules.
 */

class Dashboard {
    constructor() {
        this.sessions = [];
        this.filteredSessions = [];
        this.archivedSessions = [];
        this.stats = {};
        this.settings = {};
        this.refreshInterval = null;
        this.isRefreshing = false;
        this.isPaused = false;
        this.selectedSession = null;
        this.currentView = 'active'; // 'active' or 'archived'
        
        // Base URL for API calls (handles /dashboard path for Tailscale)
        this.baseUrl = window.location.pathname.startsWith('/dashboard') ? '/dashboard' : '';
        
        // Current modal data for export
        this.currentModalData = null;
        
        // Agent status tracking
        this.agentStatuses = {};
        
        // Filter state (enhanced)
        this.filters = {
            agent: '',     // '' means all
            node: '',      // '' means all
            status: '',    // '' means all, or 'done', 'running', 'failed'
            date: '',      // '' means all, or 'today', '7days', '30days'
            search: ''     // search query
        };
        
        // Pagination state
        this.pagination = {
            currentPage: 1,
            pageSize: 20,  // Default, loaded from settings
            totalPages: 1
        };
        
        // Sort state
        this.sort = {
            column: 'updatedAt',  // 'updatedAt', 'label', 'status', 'sizeBytes'
            direction: 'desc'     // 'asc' or 'desc'
        };
        
        // DOM elements
        this.elements = {
            sessionsContainer: document.getElementById('sessions-container'),
            refreshBtn: document.getElementById('refresh-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            refreshIndicator: document.getElementById('refresh-indicator'),
            modal: document.getElementById('session-modal'),
            modalContent: document.getElementById('modal-content'),
            settingsModal: document.getElementById('settings-modal'),
            errorBanner: document.getElementById('error-banner'),
            lastUpdated: document.getElementById('last-updated'),
            sessionCount: document.getElementById('session-count'),
            agentFilter: document.getElementById('agent-filter'),
            nodeFilter: document.getElementById('node-filter'),
            filterCount: document.getElementById('filter-count'),
            settingsBtn: document.getElementById('settings-btn'),
            viewTabs: document.getElementById('view-tabs'),
            searchInput: document.getElementById('search-input'),
            dateFilter: document.getElementById('date-filter'),
            statusFilter: document.getElementById('status-filter'),
        };
        
        this.init();
    }
    
    /**
     * Initialize the dashboard
     */
    async init() {
        // Check authentication first
        const authOk = await checkAuthentication();
        if (!authOk) {
            return; // Will redirect to login
        }
        
        // Load dynamic agent filters
        await loadAgentFilters();
        
        await this.initFilterDropdowns();
        this.initViewTabs();
        this.bindEvents();
        await this.loadSettings();
        
        // Apply page size from settings
        this.pagination.pageSize = this.settings.pageSize || 20;
        
        // Apply lobster visibility setting on load
        this.applyLobsterVisibility();
        
        // Add logout button if auth is enabled
        this.initAuthUI();
        
        // Initialize header icons
        this.initHeaderIcons();
        
        await this.refresh();
        
        if (CONFIG.refresh.autoStart) {
            this.startAutoRefresh();
        }
        
        // Dashboard initialized
    }
    
    /**
     * Initialize auth-related UI (logout button)
     */
    initAuthUI() {
        if (!CONFIG.server.authEnabled) return;
        
        // Add logout button to header controls
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            const logoutIcon = typeof Icons !== 'undefined' ? Icons.get('logout', 16) : '';
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logout-btn';
            logoutBtn.className = 'btn btn-secondary';
            logoutBtn.innerHTML = `<span class="icon">${logoutIcon}</span> Logout`;
            logoutBtn.title = 'Logout and clear token';
            logoutBtn.addEventListener('click', () => {
                if (confirm('Logout from dashboard?')) {
                    logout();
                }
            });
            headerControls.appendChild(logoutBtn);
        }
    }
    
    /**
     * Initialize header button icons
     */
    initHeaderIcons() {
        if (typeof Icons === 'undefined') return;
        
        // Inject pause icon
        const pauseIconEl = document.querySelector('.icon-pause');
        if (pauseIconEl) {
            pauseIconEl.innerHTML = Icons.get('pause', 14);
        }
        
        // Inject refresh icon
        const refreshIconEl = document.querySelector('.icon-refresh');
        if (refreshIconEl) {
            refreshIconEl.innerHTML = Icons.get('refresh', 14);
        }
        
        // Inject settings icon
        const settingsIconEl = document.querySelector('.icon-settings');
        if (settingsIconEl) {
            settingsIconEl.innerHTML = Icons.get('settings', 18);
        }
        
        // Inject node filter icon (server/network icon)
        const nodeFilterIconEl = document.getElementById('node-filter-icon');
        if (nodeFilterIconEl) {
            nodeFilterIconEl.innerHTML = Icons.get('server', 14);
        }
    }
    
    /**
     * Initialize view tabs (Active / Archived)
     */
    initViewTabs() {
        if (!this.elements.viewTabs) return;
        
        const listIcon = typeof Icons !== 'undefined' ? Icons.get('list', 16) : '';
        const archiveIcon = typeof Icons !== 'undefined' ? Icons.get('archive', 16) : '';
        
        this.elements.viewTabs.innerHTML = `
            <button class="view-tab active" data-view="active">
                <span class="tab-icon">${listIcon}</span> Active Sessions
            </button>
            <button class="view-tab" data-view="archived">
                <span class="tab-icon">${archiveIcon}</span> Archived
            </button>
        `;
        
        this.elements.viewTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.view-tab');
            if (tab) {
                const view = tab.dataset.view;
                this.switchView(view);
            }
        });
    }
    
    /**
     * Switch between active and archived views
     */
    async switchView(view) {
        this.currentView = view;
        
        // Update tab active state
        this.elements.viewTabs.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        
        if (view === 'archived') {
            await this.loadArchivedSessions();
        }
        
        this.render();
    }
    
    /**
     * Load archived sessions from API
     */
    async loadArchivedSessions() {
        try {
            const response = await fetch(`${this.baseUrl}/api/archive`);
            const data = await response.json();
            this.archivedSessions = data.sessions || [];
        } catch (err) {
            console.error('Failed to load archived sessions:', err);
            this.archivedSessions = [];
        }
    }
    
    /**
     * Load settings from API
     */
    async loadSettings() {
        try {
            const response = await fetch(`${this.baseUrl}/api/settings`);
            this.settings = await response.json();
        } catch (err) {
            console.error('Failed to load settings:', err);
            this.settings = { retentionDays: 'never', autoArchive: true };
        }
    }
    
    /**
     * Initialize filter dropdowns
     */
    async initFilterDropdowns() {
        // Agent filter dropdown (dynamic from server) - using icon dropdown
        this.renderAgentFilterDropdown();
        
        // Node filter dropdown (dynamic from API) - using icon dropdown
        await this.loadNodeFilters();
        
        // Status filter dropdown with icons
        this.renderStatusFilterDropdown();
        
        // Date filter dropdown with icons
        this.renderDateFilterDropdown();
    }
    
    /**
     * Render agent filter dropdown options
     * Uses dynamically loaded agent list from server with SVG icons
     */
    renderAgentFilterDropdown() {
        const filterGroup = this.elements.agentFilter?.parentElement;
        if (!filterGroup) return;
        
        // Get agents from config (loaded from server)
        const agents = CONFIG.filters?.agents || [{ value: '', label: 'All Agents', emoji: '🤖' }];
        
        // Preserve current selection
        const currentValue = this.filters.agent;
        
        // Map agents to icon dropdown options
        const options = agents.map(agent => {
            // Map agent value to icon key
            const iconKey = this.getAgentIconKey(agent.value);
            return {
                value: agent.value,
                label: agent.label,
                iconKey: iconKey,
                iconName: iconKey ? null : 'users', // fallback for "All Agents"
                color: iconKey ? (typeof Icons !== 'undefined' ? Icons.agentColors?.[iconKey] : null) : null
            };
        });
        
        // Check if custom dropdown already exists
        const existingDropdown = filterGroup.querySelector('.icon-dropdown');
        if (existingDropdown) {
            // Just update the selection
            Components.updateIconDropdown('agent-filter', currentValue);
            return;
        }
        
        // Hide the native select
        this.elements.agentFilter.classList.add('hidden-select');
        
        // Create custom icon dropdown
        const iconDropdown = Components.createIconDropdown({
            id: 'agent-filter',
            options: options,
            value: currentValue,
            onChange: (value) => this.handleFilterChange('agent', value)
        });
        
        // Insert after the label
        filterGroup.appendChild(iconDropdown);
    }
    
    /**
     * Get icon key for an agent name
     */
    getAgentIconKey(agentName) {
        if (!agentName) return null;
        const name = agentName.toLowerCase();
        const typeMap = {
            'main': 'agentMain',
            'ivy': 'agentMain',
            'cron': 'agentCron',
            'atlas': 'agentStone',
            'stone': 'agentStone',
            'echo': 'agentLuna',
            'luna': 'agentLuna',
            'scout': 'agentAsh',
            'ash': 'agentAsh',
            'prism': 'agentSlate',
            'slate': 'agentSlate'
        };
        return typeMap[name] || null;
    }
    
    /**
     * Calculate agent statuses from session data
     */
    calculateAgentStatuses() {
        const statuses = {};
        const agentNames = CONFIG.filters.agents
            .filter(a => a.value)
            .map(a => a.value);
        
        // Initialize all agents as available
        agentNames.forEach(name => {
            statuses[name] = 'available';
        });
        
        // Check each session for activity
        for (const session of this.sessions) {
            const agentName = (session.agentName || '').toLowerCase();
            if (!agentName || !agentNames.includes(agentName)) continue;
            
            // If this agent has a recently active session, mark as working
            const ageMs = session.ageMs || Infinity;
            const sessionStatus = (session.status || '').toLowerCase();
            
            if (ageMs < 60000 && sessionStatus !== 'done' && sessionStatus !== 'failed') {
                // Active within last 60 seconds and not completed
                statuses[agentName] = 'working';
            }
        }
        
        this.agentStatuses = statuses;
    }
    
    /**
     * Load node filter options dynamically from API
     */
    async loadNodeFilters() {
        if (!this.elements.nodeFilter) return;
        
        try {
            const { nodes, error } = await api.getNodes();
            
            if (error) {
                console.warn('Failed to load nodes:', error);
                // Fallback to just "All Nodes"
                this.renderNodeDropdown([]);
                return;
            }
            
            this.renderNodeDropdown(nodes);
        } catch (err) {
            console.error('Error loading nodes:', err);
            this.renderNodeDropdown([]);
        }
    }
    
    /**
     * Render node filter dropdown options with SVG icons
     */
    renderNodeDropdown(nodes) {
        const filterGroup = this.elements.nodeFilter?.parentElement;
        if (!filterGroup) return;
        
        // Preserve current selection
        const currentValue = this.filters.node;
        
        // Build options with icons
        const options = [
            {
                value: '',
                label: 'All Nodes',
                iconName: 'server'
            }
        ];
        
        nodes.forEach(node => {
            const nodeValue = node.name.toLowerCase().replace(/\s+/g, '-');
            const status = node.connected ? '' : ' (offline)';
            options.push({
                value: nodeValue,
                label: node.name + status,
                iconName: 'server'
            });
        });
        
        // Check if custom dropdown already exists
        const existingDropdown = filterGroup.querySelector('.icon-dropdown');
        if (existingDropdown) {
            // Update the dropdown with new options
            existingDropdown.remove();
        }
        
        // Hide the native select
        this.elements.nodeFilter.classList.add('hidden-select');
        
        // Create custom icon dropdown
        const iconDropdown = Components.createIconDropdown({
            id: 'node-filter',
            options: options,
            value: currentValue,
            onChange: (value) => this.handleFilterChange('node', value)
        });
        
        filterGroup.appendChild(iconDropdown);
    }
    
    /**
     * Render status filter dropdown with icons
     */
    renderStatusFilterDropdown() {
        const filterGroup = this.elements.statusFilter?.parentElement;
        if (!filterGroup) return;
        
        const currentValue = this.filters.status;
        
        // Status options with matching icons
        const options = [
            { value: '', label: 'All Statuses', iconName: 'filter' },
            { value: 'done', label: 'Done', iconName: 'checkCircle' },
            { value: 'running', label: 'Running', iconName: 'spinner' },
            { value: 'failed', label: 'Failed', iconName: 'xCircle' }
        ];
        
        // Hide the native select
        this.elements.statusFilter.classList.add('hidden-select');
        
        // Create custom icon dropdown
        const iconDropdown = Components.createIconDropdown({
            id: 'status-filter',
            options: options,
            value: currentValue,
            onChange: (value) => this.handleFilterChange('status', value)
        });
        
        filterGroup.appendChild(iconDropdown);
    }
    
    /**
     * Render date filter dropdown with icons
     */
    renderDateFilterDropdown() {
        const filterGroup = this.elements.dateFilter?.parentElement;
        if (!filterGroup) return;
        
        const currentValue = this.filters.date;
        
        // Date options with calendar icons
        const options = [
            { value: '', label: 'All Time', iconName: 'calendar' },
            { value: 'today', label: 'Today', iconName: 'calendar' },
            { value: '7days', label: 'Last 7 Days', iconName: 'calendar' },
            { value: '30days', label: 'Last 30 Days', iconName: 'calendar' }
        ];
        
        // Hide the native select
        this.elements.dateFilter.classList.add('hidden-select');
        
        // Create custom icon dropdown
        const iconDropdown = Components.createIconDropdown({
            id: 'date-filter',
            options: options,
            value: currentValue,
            onChange: (value) => this.handleFilterChange('date', value)
        });
        
        filterGroup.appendChild(iconDropdown);
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Manual refresh button
        this.elements.refreshBtn?.addEventListener('click', () => this.refresh());
        
        // Pause/resume button
        this.elements.pauseBtn?.addEventListener('click', () => this.togglePause());
        
        // Settings button
        this.elements.settingsBtn?.addEventListener('click', () => this.openSettingsModal());
        
        // Modal close on backdrop click
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.closeModal();
            }
        });
        
        // Settings modal close on backdrop click
        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettingsModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeSettingsModal();
            }
            if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
                this.refresh();
            }
        });
        
        // Filter dropdown changes
        this.elements.agentFilter?.addEventListener('change', (e) => {
            this.handleFilterChange('agent', e.target.value);
        });
        
        this.elements.nodeFilter?.addEventListener('change', (e) => {
            this.handleFilterChange('node', e.target.value);
        });
        
        // Status filter dropdown
        this.elements.statusFilter?.addEventListener('change', (e) => {
            this.handleFilterChange('status', e.target.value);
        });
        
        // Date filter dropdown
        this.elements.dateFilter?.addEventListener('change', (e) => {
            this.handleFilterChange('date', e.target.value);
        });
        
        // Search input
        let searchTimeout;
        this.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filters.search = e.target.value.trim().toLowerCase();
                this.pagination.currentPage = 1;  // Reset to first page
                this.render();
            }, 300);  // Debounce 300ms
        });
    }
    
    /**
     * Handle filter dropdown change
     */
    handleFilterChange(filterType, value) {
        this.filters[filterType] = value;
        
        // Reset to first page when filters change
        this.pagination.currentPage = 1;
        
        // Re-render with new filters
        this.render();
    }
    
    /**
     * Apply filters and sorting to sessions
     */
    applyFilters() {
        let filtered = [...this.sessions];
        
        // Filter by agent
        if (this.filters.agent) {
            filtered = filtered.filter(s => 
                (s.agentName || '').toLowerCase() === this.filters.agent.toLowerCase()
            );
        }
        
        // Filter by node
        if (this.filters.node) {
            filtered = filtered.filter(s => 
                (s.node || '').toLowerCase() === this.filters.node.toLowerCase()
            );
        }
        
        // Filter by status
        if (this.filters.status) {
            filtered = filtered.filter(s => 
                (s.status || '').toLowerCase() === this.filters.status.toLowerCase()
            );
        }
        
        // Filter by date
        if (this.filters.date) {
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            let cutoff = 0;
            
            if (this.filters.date === 'today') {
                // Start of today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                cutoff = today.getTime();
            } else if (this.filters.date === '7days') {
                cutoff = now - (7 * dayMs);
            } else if (this.filters.date === '30days') {
                cutoff = now - (30 * dayMs);
            }
            
            if (cutoff > 0) {
                filtered = filtered.filter(s => (s.updatedAt || 0) >= cutoff);
            }
        }
        
        // Filter by search query
        if (this.filters.search) {
            const query = this.filters.search.toLowerCase();
            filtered = filtered.filter(s => {
                const label = (s.label || '').toLowerCase();
                const task = (s.task || '').toLowerCase();
                const id = (s.id || '').toLowerCase();
                return label.includes(query) || task.includes(query) || id.includes(query);
            });
        }
        
        // Apply sorting
        filtered = this.applySorting(filtered);
        
        this.filteredSessions = filtered;
        return filtered;
    }
    
    /**
     * Apply sorting to sessions array
     */
    applySorting(sessions) {
        const { column, direction } = this.sort;
        const multiplier = direction === 'asc' ? 1 : -1;
        
        return [...sessions].sort((a, b) => {
            let aVal, bVal;
            
            switch (column) {
                case 'updatedAt':
                    aVal = a.updatedAt || 0;
                    bVal = b.updatedAt || 0;
                    break;
                case 'label':
                    aVal = (a.label || '').toLowerCase();
                    bVal = (b.label || '').toLowerCase();
                    return multiplier * aVal.localeCompare(bVal);
                case 'status':
                    // Sort order: running, failed, done
                    const statusOrder = { 'running': 0, 'failed': 1, 'done': 2 };
                    aVal = statusOrder[a.status] ?? 3;
                    bVal = statusOrder[b.status] ?? 3;
                    break;
                case 'sizeBytes':
                    aVal = a.sizeBytes || 0;
                    bVal = b.sizeBytes || 0;
                    break;
                default:
                    aVal = a.updatedAt || 0;
                    bVal = b.updatedAt || 0;
            }
            
            return multiplier * (aVal - bVal);
        });
    }
    
    /**
     * Handle column header click for sorting
     */
    handleSortClick(column) {
        if (this.sort.column === column) {
            // Toggle direction
            this.sort.direction = this.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to descending for time/size, ascending for text
            this.sort.column = column;
            this.sort.direction = (column === 'updatedAt' || column === 'sizeBytes') ? 'desc' : 'asc';
        }
        this.render();
    }
    
    /**
     * Update filter count display
     */
    updateFilterCount() {
        if (!this.elements.filterCount) return;
        
        const total = this.sessions.length;
        const filtered = this.filteredSessions.length;
        const hasFilters = this.filters.agent || this.filters.node;
        
        if (hasFilters) {
            this.elements.filterCount.innerHTML = 
                `<span class="count-number">${filtered}</span> of ${total} sessions`;
        } else {
            this.elements.filterCount.innerHTML = 
                `<span class="count-number">${total}</span> sessions`;
        }
    }
    
    /**
     * Fetch and render sessions
     */
    async refresh() {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        this.updateRefreshIndicator();
        
        try {
            const { sessions, stats, error } = await api.getSessions();
            
            if (error) {
                this.showError(`Failed to fetch sessions: ${error}`);
            } else {
                this.hideError();
                this.sessions = sessions;
                this.stats = stats || {};
                this.render();
            }
        } catch (err) {
            this.showError(`Unexpected error: ${err.message}`);
        } finally {
            this.isRefreshing = false;
            this.updateRefreshIndicator();
            this.updateLastUpdated();
        }
    }
    
    /**
     * Render the sessions table
     */
    render() {
        if (!this.elements.sessionsContainer) return;
        
        if (this.currentView === 'archived') {
            this.renderArchivedSessions();
            return;
        }
        
        // Calculate agent statuses and update filter dropdown
        this.calculateAgentStatuses();
        this.renderAgentFilterDropdown();
        
        // Apply filters and sorting
        const filtered = this.applyFilters();
        
        // Calculate pagination
        const totalItems = filtered.length;
        this.pagination.totalPages = Math.ceil(totalItems / this.pagination.pageSize) || 1;
        
        // Ensure current page is valid
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = this.pagination.totalPages;
        }
        if (this.pagination.currentPage < 1) {
            this.pagination.currentPage = 1;
        }
        
        // Get page slice
        const startIdx = (this.pagination.currentPage - 1) * this.pagination.pageSize;
        const endIdx = startIdx + this.pagination.pageSize;
        const pageItems = filtered.slice(startIdx, endIdx);
        
        // Clear and re-render
        this.elements.sessionsContainer.innerHTML = '';
        
        const table = Components.sessionsTable(
            pageItems,
            (sessionId) => this.showSessionDetail(sessionId),
            (sessionId) => this.showSessionResult(sessionId),
            (sessionKey) => this.archiveSession(sessionKey),
            this.sort,  // Pass sort state
            (column) => this.handleSortClick(column)  // Pass sort handler
        );
        
        this.elements.sessionsContainer.appendChild(table);
        
        // Add pagination controls
        const paginationEl = Components.paginationControls(
            this.pagination,
            totalItems,
            (page) => this.goToPage(page),
            (size) => this.changePageSize(size)
        );
        this.elements.sessionsContainer.appendChild(paginationEl);
        
        // Update session count in header
        if (this.elements.sessionCount) {
            const running = this.sessions.filter(s => s.status === 'running').length;
            this.elements.sessionCount.textContent = `${this.sessions.length} sessions (${running} running)`;
        }
        
        // Update filter count
        this.updateFilterCount();
    }
    
    /**
     * Go to specific page
     */
    goToPage(page) {
        this.pagination.currentPage = page;
        this.render();
        // Scroll to top of table
        this.elements.sessionsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    /**
     * Change page size
     */
    changePageSize(size) {
        this.pagination.pageSize = size;
        this.pagination.currentPage = 1;  // Reset to first page
        this.render();
        
        // Save to settings
        this.settings.pageSize = size;
        this.saveSettingsSilent();
    }
    
    /**
     * Save settings without UI feedback (for auto-saves like page size)
     */
    async saveSettingsSilent() {
        try {
            await fetch(`${this.baseUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.settings)
            });
        } catch (err) {
            console.error('Failed to save settings silently:', err);
        }
    }
    
    /**
     * Render archived sessions view
     */
    renderArchivedSessions() {
        this.elements.sessionsContainer.innerHTML = '';
        
        const table = Components.archivedSessionsTable(
            this.archivedSessions,
            (sessionKey) => this.showArchivedDetail(sessionKey),
            (sessionKey) => this.restoreSession(sessionKey)
        );
        
        this.elements.sessionsContainer.appendChild(table);
        
        // Update filter count for archived
        if (this.elements.filterCount) {
            this.elements.filterCount.innerHTML = 
                `<span class="count-number">${this.archivedSessions.length}</span> archived sessions`;
        }
    }
    
    /**
     * Archive a session
     */
    async archiveSession(sessionKey) {
        if (!confirm('Archive this session? It will be compressed and moved to archive.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/api/archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('Session archived successfully');
                await this.refresh();
            } else {
                this.showToast(data.error || 'Failed to archive session', 'error');
            }
        } catch (err) {
            this.showToast('Failed to archive session', 'error');
        }
    }
    
    /**
     * Restore an archived session
     */
    async restoreSession(sessionKey) {
        if (!confirm('Restore this session to active sessions?')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/api/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('Session restored successfully');
                await this.loadArchivedSessions();
                await this.refresh();
            } else {
                this.showToast(data.error || 'Failed to restore session', 'error');
            }
        } catch (err) {
            this.showToast('Failed to restore session', 'error');
        }
    }
    
    /**
     * Show archived session detail
     */
    async showArchivedDetail(sessionKey) {
        const session = this.archivedSessions.find(s => s.key === sessionKey || s.sessionId === sessionKey);
        if (!session) return;
        
        this.selectedSession = session;
        
        // Show loading state
        this.elements.modalContent.innerHTML = '<div class="loading">Loading...</div>';
        this.elements.modal.classList.add('open');
        
        // Fetch history from archive
        try {
            const response = await fetch(`${this.baseUrl}/api/archive/${session.sessionId || sessionKey}/history`);
            const { history, error } = await response.json();
            
            const askIvyContext = {
                task: session.task || '',
                result: history?.length > 0 ? history[history.length - 1]?.content : '',
                sessionKey: session.key
            };
            
            // Store data for export
            this.currentModalData = {
                session: session,
                content: history && history.length > 0 ? history : 'No output available',
                type: 'detail',
                task: askIvyContext.task,
                result: askIvyContext.result,
                sessionKey: askIvyContext.sessionKey
            };
            
            // Render detail view
            const detail = Components.sessionDetail(session, history, askIvyContext);
            this.elements.modalContent.innerHTML = '';
            this.elements.modalContent.appendChild(detail);
            
            // Bind close button
            const closeBtn = detail.querySelector('.btn-close');
            closeBtn?.addEventListener('click', () => this.closeModal());
            
            // Bind copy button
            const copyBtn = detail.querySelector('.btn-copy');
            copyBtn?.addEventListener('click', () => this.copyOutput());
            
            // Bind export dropdown
            this.bindExportDropdown(detail);
            
            // Bind Ask Ivy section
            this.bindAskIvySection(detail);
        } catch (err) {
            this.elements.modalContent.innerHTML = '<div class="error">Failed to load archived session</div>';
        }
    }
    
    /**
     * Show session detail in modal
     */
    async showSessionDetail(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        this.selectedSession = session;
        
        // Show loading state
        this.elements.modalContent.innerHTML = '<div class="loading">Loading...</div>';
        this.elements.modal.classList.add('open');
        
        // Fetch full history
        const { history, error } = await api.getSessionHistory(sessionId);
        
        // Extract task (first user message) and result (last assistant message) from history
        const askIvyContext = this.extractAskIvyContext(session, history);
        
        // Store data for export
        const content = history && history.length > 0 ? history : (session.lastOutput || 'No output available');
        this.currentModalData = {
            session: session,
            content: content,
            type: 'detail',
            task: askIvyContext.task,
            result: askIvyContext.result,
            sessionKey: askIvyContext.sessionKey
        };
        
        // Render detail view
        const detail = Components.sessionDetail(session, history, askIvyContext);
        this.elements.modalContent.innerHTML = '';
        this.elements.modalContent.appendChild(detail);
        
        // Bind close button
        const closeBtn = detail.querySelector('.btn-close');
        closeBtn?.addEventListener('click', () => this.closeModal());
        
        // Bind copy button
        const copyBtn = detail.querySelector('.btn-copy');
        copyBtn?.addEventListener('click', () => this.copyOutput());
        
        // Bind export dropdown
        this.bindExportDropdown(detail);
        
        // Bind Ask Ivy section
        this.bindAskIvySection(detail);
    }
    
    /**
     * Show session result in modal
     */
    async showSessionResult(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        this.selectedSession = session;
        
        // Show loading state
        this.elements.modalContent.innerHTML = '<div class="loading">Loading result...</div>';
        this.elements.modal.classList.add('open');
        
        // Fetch both result and history (for task extraction)
        const [{ result, error: resultError }, { history, error: historyError }] = await Promise.all([
            api.getSessionResult(sessionId),
            api.getSessionHistory(sessionId)
        ]);
        
        // Extract task and result context
        const askIvyContext = this.extractAskIvyContext(session, history, result?.content);
        
        // Store data for export
        const content = result?.content || 'No result available';
        this.currentModalData = {
            session: session,
            content: content,
            type: 'result',
            task: askIvyContext.task,
            result: askIvyContext.result,
            sessionKey: askIvyContext.sessionKey
        };
        
        // Render result view
        const resultEl = Components.sessionResult(session, result, askIvyContext);
        this.elements.modalContent.innerHTML = '';
        this.elements.modalContent.appendChild(resultEl);
        
        // Bind close button
        const closeBtn = resultEl.querySelector('.btn-close');
        closeBtn?.addEventListener('click', () => this.closeModal());
        
        // Bind copy button
        const copyBtn = resultEl.querySelector('.btn-copy');
        copyBtn?.addEventListener('click', () => this.copyOutput());
        
        // Bind export dropdown
        this.bindExportDropdown(resultEl);
        
        // Bind Ask Ivy section
        this.bindAskIvySection(resultEl);
    }
    
    /**
     * Close the modal
     */
    closeModal() {
        this.elements.modal?.classList.remove('open');
        this.selectedSession = null;
        this.currentModalData = null;
    }
    
    /**
     * Open settings modal
     */
    async openSettingsModal() {
        if (!this.elements.settingsModal) return;
        
        // Show modal immediately with loading state for update check
        const content = Components.settingsModal(this.settings, this.stats, null);
        this.elements.settingsModal.innerHTML = '';
        this.elements.settingsModal.appendChild(content);
        this.elements.settingsModal.classList.add('open');
        
        // Bind events
        this.bindSettingsModalEvents(content);
        
        // Fetch update info asynchronously
        this.fetchAndDisplayUpdateInfo();
    }
    
    /**
     * Bind settings modal events
     */
    bindSettingsModalEvents(content) {
        const closeBtn = content.querySelector('.btn-close');
        closeBtn?.addEventListener('click', () => this.closeSettingsModal());
        
        const saveBtn = content.querySelector('.btn-save-settings');
        saveBtn?.addEventListener('click', () => this.saveSettings());
        
        const archiveNowBtn = content.querySelector('.btn-archive-now');
        archiveNowBtn?.addEventListener('click', () => this.runArchiveNow());
        
        // Bind lobster toggle (applies immediately)
        const lobsterToggle = content.querySelector('#show-lobsters');
        lobsterToggle?.addEventListener('change', (e) => {
            this.setLobsterVisibility(e.target.checked);
        });
        
        // Bind refresh interval change (applies immediately)
        const refreshSelect = content.querySelector('#refresh-interval');
        refreshSelect?.addEventListener('change', (e) => {
            const intervalMs = parseInt(e.target.value, 10);
            this.changeRefreshInterval(intervalMs);
        });
        
        // Bind copy command button if present
        this.bindCopyCommandButton(content);
    }
    
    /**
     * Bind copy command button in update banner
     */
    bindCopyCommandButton(container) {
        const copyBtn = container.querySelector('.btn-copy-command');
        const commandEl = container.querySelector('.update-command');
        
        if (copyBtn && commandEl) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(commandEl.textContent);
                    this.showToast('Command copied to clipboard!');
                } catch (err) {
                    this.showToast('Failed to copy command', 'error');
                }
            });
        }
    }
    
    /**
     * Fetch update info and update the banner in settings modal
     */
    async fetchAndDisplayUpdateInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/api/update-check`);
            const updateInfo = await response.json();
            
            // Update the banner if modal is still open
            const settingsBody = this.elements.settingsModal?.querySelector('.settings-body');
            if (!settingsBody) return;
            
            // Update the About section version display
            const aboutVersion = settingsBody.querySelector('#about-version-display');
            if (aboutVersion && updateInfo?.currentVersion) {
                aboutVersion.textContent = `v${updateInfo.currentVersion}`;
            }
            
            // Find and replace the update banner
            const existingBanner = settingsBody.querySelector('.update-banner');
            if (existingBanner) {
                const downloadIcon = typeof Icons !== 'undefined' ? Icons.get('download', 16) : '';
                const newBannerHtml = Components.buildUpdateBanner(updateInfo, downloadIcon);
                
                // Create a temporary container to parse the HTML
                const temp = document.createElement('div');
                temp.innerHTML = newBannerHtml;
                const newBanner = temp.firstElementChild;
                
                if (newBanner) {
                    existingBanner.replaceWith(newBanner);
                    // Re-bind copy button
                    this.bindCopyCommandButton(settingsBody);
                } else {
                    // No banner to show (e.g., disabled)
                    existingBanner.remove();
                }
            }
        } catch (err) {
            console.error('Failed to check for updates:', err);
            // Update banner to show error
            const existingBanner = this.elements.settingsModal?.querySelector('.update-banner');
            if (existingBanner) {
                existingBanner.className = 'update-banner update-error';
                existingBanner.innerHTML = `<span class="update-text">Could not check for updates</span>`;
            }
        }
    }
    
    /**
     * Apply lobster visibility from localStorage
     */
    applyLobsterVisibility() {
        const show = localStorage.getItem('showSwimmingLobsters');
        // Default to true if not set
        const visible = show === null ? true : show === 'true';
        const tank = document.querySelector('.lobster-tank');
        if (tank) {
            tank.style.display = visible ? '' : 'none';
        }
    }
    
    /**
     * Set lobster visibility (updates localStorage and DOM immediately)
     */
    setLobsterVisibility(visible) {
        localStorage.setItem('showSwimmingLobsters', visible ? 'true' : 'false');
        const tank = document.querySelector('.lobster-tank');
        if (tank) {
            tank.style.display = visible ? '' : 'none';
        }
    }
    
    /**
     * Change the auto-refresh interval
     */
    changeRefreshInterval(intervalMs) {
        // Save to localStorage via config helper
        if (typeof saveRefreshInterval === 'function') {
            saveRefreshInterval(intervalMs);
        } else {
            localStorage.setItem('dashboardRefreshInterval', intervalMs.toString());
            CONFIG.refresh.intervalMs = intervalMs;
        }
        
        // Stop current auto-refresh
        this.stopAutoRefresh();
        
        // Update pause state display
        if (intervalMs === 0) {
            // "Off" selected - stay stopped
            this.isPaused = true;
            this.updatePauseButton();
            this.updateRefreshIndicator();
            this.showToast('Auto-refresh disabled');
        } else {
            // Restart with new interval
            this.isPaused = false;
            this.startAutoRefresh();
            const label = CONFIG.refresh.options?.find(o => o.value === intervalMs)?.label || `${intervalMs/1000}s`;
            this.showToast(`Auto-refresh set to ${label}`);
        }
    }
    
    /**
     * Close settings modal
     */
    closeSettingsModal() {
        this.elements.settingsModal?.classList.remove('open');
    }
    
    /**
     * Save settings
     */
    async saveSettings() {
        const retentionInput = this.elements.settingsModal.querySelector('#retention-days');
        const neverRadio = this.elements.settingsModal.querySelector('#retention-never');
        const autoRadio = this.elements.settingsModal.querySelector('#retention-auto');
        
        // Determine retention value based on radio selection
        let retentionDays;
        let autoArchive;
        
        if (neverRadio?.checked) {
            retentionDays = 'never';
            autoArchive = false;
        } else {
            const val = parseInt(retentionInput?.value, 10);
            if (isNaN(val) || val < 1) {
                this.showToast('Retention days must be a positive number', 'error');
                return;
            }
            retentionDays = val;
            autoArchive = true;
        }
        
        const newSettings = {
            retentionDays: retentionDays,
            autoArchive: autoArchive,
            pageSize: this.settings.pageSize || 20
        };
        
        try {
            const response = await fetch(`${this.baseUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.error('Settings save failed:', response.status, text);
                this.showToast(`Failed to save settings: ${response.status}`, 'error');
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.settings = newSettings;
                this.showToast('Settings saved');
                this.closeSettingsModal();
            } else {
                this.showToast(data.error || 'Failed to save settings', 'error');
            }
        } catch (err) {
            console.error('Settings save error:', err);
            this.showToast('Failed to save settings: ' + err.message, 'error');
        }
    }
    
    /**
     * Run archive process now
     */
    async runArchiveNow() {
        try {
            // Use buildUrl to handle /dashboard path prefix correctly
            const baseUrl = window.location.pathname.startsWith('/dashboard') ? '/dashboard' : '';
            const token = localStorage.getItem('dashboardToken');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(`${baseUrl}/api/run-archive`, {
                method: 'POST',
                headers
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (data.archived === 0 && data.message) {
                    // No sessions archived - show info message
                    this.showToast(data.message);
                } else {
                    this.showToast(`Archived ${data.archived} sessions`);
                }
                await this.refresh();
            } else {
                this.showToast(data.error || data.message || 'Archive failed', 'error');
            }
        } catch (err) {
            console.error('Archive error:', err);
            this.showToast('Failed to run archive', 'error');
        }
    }
    
    /**
     * Bind export dropdown functionality
     */
    bindExportDropdown(container) {
        const exportBtn = container.querySelector('.btn-export');
        const exportMenu = container.querySelector('.export-menu');
        const exportOptions = container.querySelectorAll('.export-option');
        
        if (!exportBtn || !exportMenu) return;
        
        // Toggle dropdown
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportMenu.classList.toggle('open');
        });
        
        // Close dropdown on outside click
        document.addEventListener('click', () => {
            exportMenu.classList.remove('open');
        });
        
        // Handle export option clicks
        exportOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = option.dataset.format;
                this.handleExport(format);
                exportMenu.classList.remove('open');
            });
        });
    }
    
    /**
     * Bind Ask Ivy section functionality
     */
    bindAskIvySection(container) {
        const toggle = container.querySelector('.ask-ivy-toggle');
        const form = container.querySelector('.ask-ivy-form');
        const input = container.querySelector('.ask-ivy-input');
        const sendBtn = container.querySelector('.btn-ask-ivy-send');
        const copyBtn = container.querySelector('.btn-ask-ivy-copy');
        const contextEl = container.querySelector('.ask-ivy-context');
        
        if (!toggle || !form) return;
        
        // Toggle expand/collapse
        toggle.addEventListener('click', () => {
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', !isExpanded);
            form.hidden = isExpanded;
            
            if (!isExpanded && input) {
                // Focus the input when expanding
                setTimeout(() => input.focus(), 50);
            }
        });
        
        // Helper to get formatted message
        const getFormattedMessage = () => {
            const question = input?.value?.trim();
            
            if (!question) {
                this.showToast('Please enter a question first', 'error');
                input?.focus();
                return null;
            }
            
            // Get context from hidden input (enhanced format)
            const label = contextEl?.dataset.label || 'unknown';
            const agent = contextEl?.dataset.agent || 'agent';
            const status = contextEl?.dataset.status || 'unknown';
            const age = contextEl?.dataset.age || 'unknown';
            const sessionKey = contextEl?.dataset.sessionKey || '';
            const task = contextEl?.dataset.task || '';
            const result = contextEl?.dataset.result || '';
            
            return this.formatAskIvyMessage({
                label, agent, status, age, sessionKey, task, result, question
            });
        };
        
        // Send to webchat: copy to clipboard + open webchat
        sendBtn?.addEventListener('click', async () => {
            const formattedMessage = getFormattedMessage();
            if (!formattedMessage) return;
            
            try {
                // Copy to clipboard first (most reliable)
                await navigator.clipboard.writeText(formattedMessage);
                
                // Try BroadcastChannel (if webchat is already open with bridge)
                try {
                    const channel = new BroadcastChannel('openclaw-webchat');
                    channel.postMessage({
                        type: 'fill-message',
                        text: formattedMessage
                    });
                    channel.close();
                } catch (e) {
                    // BroadcastChannel not supported, that's okay
                }
                
                // Build webchat URL
                // Dashboard is at /dashboard, webchat is at root /
                const webchatUrl = new URL(window.location.origin);
                webchatUrl.searchParams.set('message', formattedMessage);
                
                // Open/focus the webchat window
                window.open(webchatUrl.toString(), 'openclaw-webchat');
                
                this.showToast('Copied! Paste in webchat 📋');
                
                // Clear the input and close the section
                input.value = '';
                toggle.setAttribute('aria-expanded', 'false');
                form.hidden = true;
                
                // Close the modal after a short delay
                setTimeout(() => this.closeModal(), 300);
            } catch (err) {
                console.error('Failed to send to webchat:', err);
                this.showToast('Failed to copy message', 'error');
            }
        });
        
        // Copy formatted message to clipboard (fallback option)
        copyBtn?.addEventListener('click', async () => {
            const formattedMessage = getFormattedMessage();
            if (!formattedMessage) return;
            
            try {
                await navigator.clipboard.writeText(formattedMessage);
                this.showToast('Copied! Paste in webchat 💬');
                
                // Clear the input
                input.value = '';
            } catch (err) {
                this.showToast('Failed to copy', 'error');
            }
        });
        
        // Allow Cmd/Ctrl+Enter to send
        input?.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                sendBtn?.click();
            }
        });
    }
    
    /**
     * Extract Ask Ivy context from session history
     * @param {Object} session - Session object
     * @param {Array} history - Array of history entries (optional)
     * @param {string} resultOverride - Override for result text (optional)
     * @returns {Object} { task, result, sessionKey }
     */
    extractAskIvyContext(session, history = [], resultOverride = null) {
        const sessionKey = session.key || '';
        let task = session.task || '';
        let result = resultOverride || '';
        
        if (history && history.length > 0) {
            // Find first user message (the task) if not already set
            if (!task) {
                const firstUserMsg = history.find(entry => entry.role === 'user');
                if (firstUserMsg && firstUserMsg.content) {
                    task = firstUserMsg.content;
                }
            }
            
            // Find last assistant message (the result) if not overridden
            if (!resultOverride) {
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i].role === 'assistant' && history[i].content) {
                        result = history[i].content;
                        break;
                    }
                }
            }
        }
        
        return { task, result, sessionKey };
    }
    
    /**
     * Format message for Ask Ivy (enhanced format with full context)
     */
    formatAskIvyMessage({ label, agent, status, age, sessionKey, task, result, question }) {
        let message = `Regarding session [${label}]\n`;
        
        // Add context line
        const contextParts = [];
        if (agent && agent !== 'agent') contextParts.push(`Agent: ${agent}`);
        if (status) contextParts.push(`Status: ${status}`);
        if (age && age !== '—') contextParts.push(age);
        
        if (contextParts.length > 0) {
            message += contextParts.join(' | ') + '\n';
        }
        
        // Add session key for lookup
        if (sessionKey) {
            message += `Session: ${sessionKey}\n`;
        }
        
        // Add task (what was the agent asked to do)
        if (task && task !== '—') {
            message += `\nTask: ${task}\n`;
        }
        
        // Add result (what did the agent produce)
        if (result && result !== 'No output available' && result !== '—') {
            message += `\nResult: ${result}\n`;
        }
        
        // Add the user's question
        message += `\nMy question: ${question}`;
        
        return message;
    }
    
    /**
     * Handle export action
     */
    handleExport(format) {
        if (!this.currentModalData) {
            this.showToast('No data to export', 'error');
            return;
        }
        
        const { type } = this.currentModalData;
        const prefix = type === 'result' ? 'result' : 'session';
        
        try {
            let filename;
            switch (format) {
                case 'markdown':
                    filename = ExportUtils.exportAsMarkdown(this.currentModalData, prefix);
                    break;
                case 'json':
                    filename = ExportUtils.exportAsJSON(this.currentModalData, prefix);
                    break;
                case 'text':
                    filename = ExportUtils.exportAsText(this.currentModalData, prefix);
                    break;
                case 'html':
                    filename = ExportUtils.exportAsHTML(this.currentModalData, prefix);
                    break;
                default:
                    this.showToast('Unknown format', 'error');
                    return;
            }
            this.showToast(`Exported: ${filename}`);
        } catch (err) {
            console.error('Export failed:', err);
            this.showToast('Export failed', 'error');
        }
    }
    
    /**
     * Copy current session output to clipboard
     */
    async copyOutput() {
        const outputEl = this.elements.modalContent.querySelector('.output-content');
        if (!outputEl) return;
        
        try {
            await navigator.clipboard.writeText(outputEl.textContent);
            this.showToast('Copied to clipboard!');
        } catch (err) {
            this.showToast('Failed to copy', 'error');
        }
    }
    
    /**
     * Start auto-refresh polling
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        // Get current interval (may have been loaded from localStorage)
        const intervalMs = typeof getRefreshInterval === 'function' 
            ? getRefreshInterval() 
            : CONFIG.refresh.intervalMs;
        
        // If interval is 0 (Off), don't start
        if (intervalMs === 0) {
            this.isPaused = true;
            this.updatePauseButton();
            this.updateRefreshIndicator();
            return;
        }
        
        this.isPaused = false;
        this.refreshInterval = setInterval(() => {
            if (!this.isPaused) {
                this.refresh();
            }
        }, intervalMs);
        this.updatePauseButton();
    }
    
    /**
     * Stop auto-refresh polling
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        this.updatePauseButton();
        this.updateRefreshIndicator();
    }
    
    /**
     * Update pause button text
     */
    updatePauseButton() {
        if (this.elements.pauseBtn) {
            const pauseIcon = typeof Icons !== 'undefined' ? Icons.get('pause', 14) : '';
            const playIcon = typeof Icons !== 'undefined' ? Icons.get('play', 14) : '';
            this.elements.pauseBtn.innerHTML = this.isPaused 
                ? `<span class="icon">${playIcon}</span> Resume` 
                : `<span class="icon">${pauseIcon}</span> Pause`;
            this.elements.pauseBtn.classList.toggle('paused', this.isPaused);
        }
    }
    
    /**
     * Update refresh indicator
     */
    updateRefreshIndicator() {
        if (this.elements.refreshIndicator) {
            const status = this.isPaused ? 'Paused' : (this.isRefreshing ? 'Refreshing...' : 'Auto-refresh');
            this.elements.refreshIndicator.innerHTML = Components.refreshIndicator(this.isRefreshing && !this.isPaused);
            this.elements.refreshIndicator.classList.toggle('paused', this.isPaused);
        }
    }
    
    /**
     * Update last updated timestamp
     */
    updateLastUpdated() {
        if (this.elements.lastUpdated) {
            this.elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }
    
    /**
     * Show error banner
     */
    showError(message) {
        if (this.elements.errorBanner) {
            this.elements.errorBanner.textContent = message;
            this.elements.errorBanner.classList.add('visible');
        }
    }
    
    /**
     * Hide error banner
     */
    hideError() {
        this.elements.errorBanner?.classList.remove('visible');
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    // EXTENSION POINT: Add methods for future features
    // filterSessions(criteria) { ... }
    // searchSessions(query) { ... }
    // killSession(id) { ... }
    // exportData() { ... }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
