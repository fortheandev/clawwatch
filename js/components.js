/**
 * UI Components - Reusable component functions
 * 
 * EXTENSION POINT: Add new components here.
 * Components should be pure functions that return HTML strings or DOM elements.
 */

const Components = {
    /**
     * Channel name mappings for user-readable display
     */
    channelNames: {
        'signal': 'Signal',
        'whatsapp': 'WhatsApp',
        'telegram': 'Telegram',
        'discord': 'Discord',
        'slack': 'Slack',
        'webchat': 'Web Chat',
        'imessage': 'iMessage',
        'googlechat': 'Google Chat',
        'teams': 'Microsoft Teams',
        'unknown': 'Unknown'
    },
    
    /**
     * Format channel name for display
     * Converts raw channel values (e.g., 'signal') to branded names (e.g., 'Signal')
     * @param {string} channel - Raw channel value
     * @returns {string} User-readable channel name
     */
    formatChannelName(channel) {
        if (!channel) return '—';
        const lower = channel.toLowerCase().trim();
        return this.channelNames[lower] || channel;
    },
    
    /**
     * Get icon or emoji for agent based on label
     * Prefers SVG icons for special agent types (main, cron), falls back to emoji
     */
    getAgentEmoji(label) {
        const lower = (label || '').toLowerCase();
        
        // Check for SVG icon first (for main, cron, etc.)
        if (typeof Icons !== 'undefined' && Icons.getAgentIcon) {
            for (const agentType of Object.keys(Icons.agentTypes || {})) {
                if (lower.includes(agentType)) {
                    const svgIcon = Icons.getAgentIcon(agentType, 36);
                    if (svgIcon) return svgIcon;
                }
            }
        }
        
        // Fall back to emoji
        for (const [key, emoji] of Object.entries(CONFIG.agentEmojis)) {
            if (lower.includes(key)) return emoji;
        }
        return CONFIG.agentEmojis.default;
    },
    
    /**
     * Format duration from milliseconds or seconds
     */
    formatDuration(ms) {
        if (!ms) return '—';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${remainingSeconds}s`;
    },
    
    /**
     * Format timestamp for display
     */
    formatTime(timestamp) {
        if (!timestamp) return '—';
        const date = new Date(timestamp);
        
        if (CONFIG.display.dateFormat === 'relative') {
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            return date.toLocaleDateString();
        }
        
        return date.toLocaleString();
    },
    
    /**
     * Truncate text with ellipsis
     */
    truncate(text, maxLength = CONFIG.display.previewLength) {
        if (!text) return '—';
        const clean = text.replace(/\n/g, ' ').trim();
        if (clean.length <= maxLength) return clean;
        return clean.substring(0, maxLength) + '...';
    },
    
    /**
     * Get status badge HTML
     */
    statusBadge(status) {
        const normalizedStatus = (status || 'pending').toLowerCase();
        const iconName = CONFIG.status.iconNames[normalizedStatus] || CONFIG.status.iconNames.pending;
        const color = CONFIG.status.colors[normalizedStatus] || CONFIG.status.colors.pending;
        const iconSvg = typeof Icons !== 'undefined' ? Icons.get(iconName, 14) : '';
        
        return `<span class="status-badge status-${normalizedStatus}" style="--status-color: ${color}">
            <span class="status-icon">${iconSvg}</span>
            <span class="status-text">${normalizedStatus}</span>
        </span>`;
    },
    
    /**
     * Format age from milliseconds
     */
    formatAge(ageMs) {
        if (!ageMs && ageMs !== 0) return '—';
        const seconds = Math.floor(ageMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        if (seconds > 0) return `${seconds}s ago`;
        return 'just now';
    },
    
    /**
     * Token usage bar component
     */
    tokenUsageBar(usagePct, totalTokens) {
        const colorClass = usagePct >= 90 ? 'critical' : usagePct >= 70 ? 'warning' : 'normal';
        const formattedTokens = totalTokens > 1000 ? `${(totalTokens/1000).toFixed(1)}k` : totalTokens;
        return `<div class="token-usage ${colorClass}" title="${formattedTokens} tokens (${usagePct}%)">
            <div class="token-bar" style="width: ${Math.min(usagePct, 100)}%"></div>
            <span class="token-label">${usagePct}%</span>
        </div>`;
    },
    
    /**
     * Render a single session row
     */
    sessionRow(session, onViewClick, onResultClick, onArchiveClick) {
        const row = document.createElement('tr');
        row.className = 'session-row';
        row.dataset.sessionId = session.id;
        
        // Use agentName for emoji lookup if available
        const emojiKey = session.agentName || session.label;
        const emoji = this.getAgentEmoji(emojiKey);
        const status = this.statusBadge(session.status);
        const age = this.formatAge(session.ageMs);
        const tokenUsage = this.tokenUsageBar(session.usagePct || 0, session.totalTokens || 0);
        const sizeFormatted = session.sizeFormatted || '—';
        const taskPreview = session.task ? this.truncate(session.task, 50) : '—';
        
        // Check if read-only mode (hide archive button)
        const readOnly = typeof isReadOnly === 'function' && isReadOnly();
        const archiveIcon = typeof Icons !== 'undefined' ? Icons.get('archive', 14) : '';
        const transcriptIcon = typeof Icons !== 'undefined' ? Icons.get('transcript', 13) : '';
        const summaryIcon = typeof Icons !== 'undefined' ? Icons.get('summary', 13) : '';
        const archiveButton = readOnly ? '' : 
            `<button class="btn-archive" data-session-key="${session.key}" title="Archive">${archiveIcon}</button>`;
        
        row.innerHTML = `
            <td class="col-agent">
                <div class="agent-info">
                    <span class="agent-emoji">${emoji}</span>
                    <div class="agent-details">
                        <span class="agent-label">${session.label || session.id}</span>
                        <span class="agent-task" title="${this.escapeHtml(session.task || '')}">${taskPreview}</span>
                    </div>
                </div>
            </td>
            <td class="col-status">${status}</td>
            <td class="col-size" title="${session.sizeBytes} bytes">${sizeFormatted}</td>
            <td class="col-tokens">${tokenUsage}</td>
            <td class="col-model"><span class="model-badge">${(session.model || '').split('/').pop() || '—'}</span></td>
            <td class="col-time">${age}</td>
            <td class="col-actions">
                <div class="actions-wrapper">
                    <button class="btn-view" data-session-id="${session.id}">${transcriptIcon} Transcript</button>
                    <button class="btn-result" data-session-id="${session.id}">${summaryIcon} Summary</button>
                    ${archiveButton}
                </div>
            </td>
        `;
        
        // Attach click handlers
        const viewBtn = row.querySelector('.btn-view');
        viewBtn.addEventListener('click', () => onViewClick(session.id));
        
        const resultBtn = row.querySelector('.btn-result');
        resultBtn.addEventListener('click', () => onResultClick(session.id));
        
        const archiveBtn = row.querySelector('.btn-archive');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', () => onArchiveClick(session.key));
        }
        
        return row;
    },
    
    /**
     * Render a single archived session row
     */
    archivedSessionRow(session, onViewClick, onRestoreClick) {
        const row = document.createElement('tr');
        row.className = 'session-row archived-row';
        row.dataset.sessionId = session.sessionId || session.key;
        
        const emoji = this.getAgentEmoji(session.label);
        const archivedDate = new Date(session.archivedAt).toLocaleDateString();
        const originalSize = this.formatBytes(session.originalSize);
        const compressedSize = this.formatBytes(session.compressedSize);
        const taskPreview = session.task ? this.truncate(session.task, 50) : '—';
        
        // Check if read-only mode (hide restore button)
        const readOnly = typeof isReadOnly === 'function' && isReadOnly();
        const unarchiveIcon = typeof Icons !== 'undefined' ? Icons.get('unarchive', 14) : '';
        const transcriptIcon = typeof Icons !== 'undefined' ? Icons.get('transcript', 13) : '';
        const restoreButton = readOnly ? '' : 
            `<button class="btn-restore" data-session-key="${session.key}" title="Restore to active">${unarchiveIcon} Restore</button>`;
        
        row.innerHTML = `
            <td class="col-agent">
                <div class="agent-info">
                    <span class="agent-emoji">${emoji}</span>
                    <div class="agent-details">
                        <span class="agent-label">${session.label || session.key}</span>
                        <span class="agent-task" title="${this.escapeHtml(session.task || '')}">${taskPreview}</span>
                    </div>
                </div>
            </td>
            <td class="col-archived-date">${archivedDate}</td>
            <td class="col-size" title="Original: ${originalSize}">${compressedSize}</td>
            <td class="col-model"><span class="model-badge">${(session.model || '').split('/').pop() || '—'}</span></td>
            <td class="col-channel">${this.formatChannelName(session.channel)}</td>
            <td class="col-actions">
                <div class="actions-wrapper">
                    <button class="btn-view" data-session-key="${session.key}">${transcriptIcon} Transcript</button>
                    ${restoreButton}
                </div>
            </td>
        `;
        
        // Attach click handlers
        const viewBtn = row.querySelector('.btn-view');
        viewBtn.addEventListener('click', () => onViewClick(session.key));
        
        const restoreBtn = row.querySelector('.btn-restore');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => onRestoreClick(session.key));
        }
        
        return row;
    },
    
    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (!bytes) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    
    /**
     * Render the sessions table with sortable headers
     */
    sessionsTable(sessions, onViewClick, onResultClick, onArchiveClick, sortState = {}, onSortClick = null) {
        const container = document.createElement('div');
        container.className = 'sessions-table-container';
        
        if (sessions.length === 0) {
            const emptyIcon = typeof Icons !== 'undefined' ? Icons.get('inboxEmpty', 48) : '';
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${emptyIcon}</span>
                    <p>No sessions found</p>
                </div>
            `;
            return container;
        }
        
        const table = document.createElement('table');
        table.className = 'sessions-table';
        
        // Helper to get sort indicator
        const sortArrow = (column) => {
            if (sortState.column !== column) return '';
            return sortState.direction === 'asc' ? ' ↑' : ' ↓';
        };
        
        // Helper to get sortable class
        const sortableClass = (column) => {
            const base = 'sortable';
            return sortState.column === column ? `${base} sorted` : base;
        };
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="col-agent ${sortableClass('label')}" data-sort="label">
                        Session / Task${sortArrow('label')}
                    </th>
                    <th class="col-status ${sortableClass('status')}" data-sort="status">
                        Status${sortArrow('status')}
                    </th>
                    <th class="col-size ${sortableClass('sizeBytes')}" data-sort="sizeBytes">
                        Size${sortArrow('sizeBytes')}
                    </th>
                    <th class="col-tokens">Tokens</th>
                    <th class="col-model">Model</th>
                    <th class="col-time ${sortableClass('updatedAt')}" data-sort="updatedAt">
                        Last Active${sortArrow('updatedAt')}
                    </th>
                    <th class="col-actions">Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        // Add click handlers to sortable headers
        if (onSortClick) {
            table.querySelectorAll('th.sortable').forEach(th => {
                th.addEventListener('click', () => {
                    const column = th.dataset.sort;
                    if (column) onSortClick(column);
                });
            });
        }
        
        const tbody = table.querySelector('tbody');
        sessions.forEach(session => {
            tbody.appendChild(this.sessionRow(session, onViewClick, onResultClick, onArchiveClick));
        });
        
        container.appendChild(table);
        return container;
    },
    
    /**
     * Pagination controls component
     */
    paginationControls(pagination, totalItems, onPageChange, onPageSizeChange) {
        const container = document.createElement('div');
        container.className = 'pagination-container';
        
        const { currentPage, pageSize, totalPages } = pagination;
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);
        
        // Build page numbers
        let pageNumbers = [];
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }
        
        const leftArrow = typeof Icons !== 'undefined' ? Icons.get('chevronLeft', 12) : '←';
        const rightArrow = typeof Icons !== 'undefined' ? Icons.get('chevronRight', 12) : '→';
        
        container.innerHTML = `
            <div class="pagination-info">
                Showing <strong>${startItem}-${endItem}</strong> of <strong>${totalItems}</strong> sessions
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>
                    ${leftArrow} Prev
                </button>
                <div class="pagination-pages">
                    ${startPage > 1 ? `<button class="pagination-btn" data-page="1">1</button>` : ''}
                    ${startPage > 2 ? '<span class="pagination-ellipsis">…</span>' : ''}
                    ${pageNumbers.map(n => `
                        <button class="pagination-btn ${n === currentPage ? 'active' : ''}" data-page="${n}">${n}</button>
                    `).join('')}
                    ${endPage < totalPages - 1 ? '<span class="pagination-ellipsis">…</span>' : ''}
                    ${endPage < totalPages ? `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>` : ''}
                </div>
                <button class="pagination-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>
                    Next ${rightArrow}
                </button>
            </div>
            <div class="pagination-size">
                <label for="page-size-select">Per page:</label>
                <select id="page-size-select" class="page-size-select">
                    <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
        `;
        
        // Bind page button clicks
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                const page = btn.dataset.page;
                if (page === 'prev') {
                    onPageChange(currentPage - 1);
                } else if (page === 'next') {
                    onPageChange(currentPage + 1);
                } else {
                    onPageChange(parseInt(page, 10));
                }
            });
        });
        
        // Bind page size change
        const sizeSelect = container.querySelector('#page-size-select');
        sizeSelect?.addEventListener('change', (e) => {
            onPageSizeChange(parseInt(e.target.value, 10));
        });
        
        return container;
    },
    
    /**
     * Render the archived sessions table
     */
    archivedSessionsTable(sessions, onViewClick, onRestoreClick) {
        const container = document.createElement('div');
        container.className = 'sessions-table-container';
        
        if (sessions.length === 0) {
            const emptyIcon = typeof Icons !== 'undefined' ? Icons.get('archiveEmpty', 48) : '';
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${emptyIcon}</span>
                    <p>No archived sessions</p>
                    <p class="empty-hint">Sessions will appear here after being archived</p>
                </div>
            `;
            return container;
        }
        
        const table = document.createElement('table');
        table.className = 'sessions-table archived-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="col-agent">Session / Task</th>
                    <th class="col-archived-date">Archived</th>
                    <th class="col-size">Size</th>
                    <th class="col-model">Model</th>
                    <th class="col-channel">Channel</th>
                    <th class="col-actions"></th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        sessions.forEach(session => {
            tbody.appendChild(this.archivedSessionRow(session, onViewClick, onRestoreClick));
        });
        
        container.appendChild(table);
        return container;
    },
    
    /**
     * Export dropdown HTML
     */
    exportDropdown(type = 'session') {
        const copyIcon = typeof Icons !== 'undefined' ? Icons.get('copy', 14) : '';
        const downloadIcon = typeof Icons !== 'undefined' ? Icons.get('download', 14) : '';
        const chevronIcon = typeof Icons !== 'undefined' ? Icons.get('chevronDown', 10) : '';
        const fileTextIcon = typeof Icons !== 'undefined' ? Icons.get('fileText', 14) : '';
        const fileJsonIcon = typeof Icons !== 'undefined' ? Icons.get('fileCode', 14) : '';
        const fileIcon = typeof Icons !== 'undefined' ? Icons.get('fileText', 14) : '';
        const globeIcon = typeof Icons !== 'undefined' ? Icons.get('globe', 14) : '';
        
        return `
            <div class="export-dropdown">
                <button class="btn-copy" title="Copy to clipboard">${copyIcon} Copy</button>
                <div class="export-menu-wrapper">
                    <button class="btn-export" title="Export options">
                        ${downloadIcon} Export <span class="dropdown-arrow">${chevronIcon}</span>
                    </button>
                    <div class="export-menu">
                        <button class="export-option" data-format="markdown" title="Export as Markdown">
                            <span class="export-icon">${fileTextIcon}</span> Markdown
                        </button>
                        <button class="export-option" data-format="json" title="Export as JSON">
                            <span class="export-icon">${fileJsonIcon}</span> JSON
                        </button>
                        <button class="export-option" data-format="text" title="Export as Plain Text">
                            <span class="export-icon">${fileIcon}</span> Text
                        </button>
                        <button class="export-option" data-format="html" title="Export as HTML">
                            <span class="export-icon">${globeIcon}</span> HTML
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Render session detail modal content
     * @param {Object} session - Session object
     * @param {Array} history - Array of history entries
     * @param {Object} askAgentContext - Context for Ask Agent: { task, result, sessionKey }
     */
    sessionDetail(session, history, askAgentContext = {}) {
        const container = document.createElement('div');
        container.className = 'session-detail';
        container.dataset.type = 'detail';
        
        const emoji = this.getAgentEmoji(session.label);
        const status = this.statusBadge(session.status);
        
        // Format the full output/history
        let outputHtml = '';
        if (history && history.length > 0) {
            outputHtml = history.map(entry => {
                const role = entry.role || 'unknown';
                const content = this.escapeHtml(entry.content || JSON.stringify(entry));
                return `<div class="history-entry role-${role}">
                    <span class="entry-role">${role}</span>
                    <pre class="entry-content">${content}</pre>
                </div>`;
            }).join('');
        } else {
            outputHtml = `<pre class="full-output">${this.escapeHtml(session.lastOutput || 'No output available')}</pre>`;
        }
        
        const closeIcon = typeof Icons !== 'undefined' ? Icons.get('close', 18) : '×';
        
        container.innerHTML = `
            <div class="detail-header">
                <div class="detail-title">
                    <span class="agent-emoji">${emoji}</span>
                    <span class="agent-label">${session.label || session.id}</span>
                    ${status}
                </div>
                <button class="btn-close" aria-label="Close">${closeIcon}</button>
            </div>
            <div class="detail-meta">
                <span><strong>ID:</strong> ${session.id || session.sessionId}</span>
                <span><strong>Duration:</strong> ${this.formatDuration(session.durationMs)}</span>
                <span><strong>Size:</strong> ${session.sizeFormatted || this.formatBytes(session.originalSize) || '—'}</span>
                <span><strong>Started:</strong> ${this.formatTime(session.startedAt || session.updatedAt)}</span>
            </div>
            ${askAgentContext.task ? `<div class="detail-task"><strong>Task:</strong> ${this.escapeHtml(this.truncate(askAgentContext.task, 200))}</div>` : ''}
            <div class="detail-output">
                <div class="output-header">
                    <span>Output</span>
                    ${this.exportDropdown('session')}
                </div>
                <div class="output-content">${outputHtml}</div>
            </div>
            ${this.askAgentSection(session, askAgentContext)}
        `;
        
        return container;
    },
    
    /**
     * Render session result modal content
     * @param {Object} session - Session object
     * @param {Object} result - Result object with content
     * @param {Object} askAgentContext - Context for Ask Agent: { task, result, sessionKey }
     */
    sessionResult(session, result, askAgentContext = {}) {
        const container = document.createElement('div');
        container.className = 'session-detail session-result-modal';
        container.dataset.type = 'result';
        
        const emoji = this.getAgentEmoji(session.agentName || session.label);
        const status = this.statusBadge(session.status);
        
        // Format the result
        let resultHtml = '';
        if (result && result.content) {
            resultHtml = `<pre class="result-content">${this.escapeHtml(result.content)}</pre>`;
        } else {
            resultHtml = '<p class="no-result">No result available for this session</p>';
        }
        
        const closeIcon = typeof Icons !== 'undefined' ? Icons.get('close', 18) : '×';
        const clipboardIcon = typeof Icons !== 'undefined' ? Icons.get('clipboardList', 14) : '';
        
        container.innerHTML = `
            <div class="detail-header">
                <div class="detail-title">
                    <span class="agent-emoji">${emoji}</span>
                    <span class="agent-label">${session.label || session.id}</span>
                    ${status}
                    <span class="result-badge">${clipboardIcon} Result</span>
                </div>
                <button class="btn-close" aria-label="Close">${closeIcon}</button>
            </div>
            ${askAgentContext.task ? `<div class="detail-task"><strong>Task:</strong> ${this.escapeHtml(this.truncate(askAgentContext.task, 200))}</div>` : ''}
            <div class="detail-output">
                <div class="output-header">
                    <span>Final Result</span>
                    ${this.exportDropdown('result')}
                </div>
                <div class="output-content result-output">${resultHtml}</div>
            </div>
            ${this.askAgentSection(session, askAgentContext)}
        `;
        
        return container;
    },
    
    /**
     * Get agent status dot HTML for filter buttons
     */
    agentStatusDot(status) {
        const statusMap = {
            'working': { color: 'var(--status-running)', title: 'Working' },
            'available': { color: 'var(--status-done)', title: 'Available' },
            'paused': { color: '#f59e0b', title: 'Paused' },
            'stopped': { color: '#6b7280', title: 'Stopped' }
        };
        const s = statusMap[status] || statusMap.available;
        return `<span class="agent-status-dot" style="background-color: ${s.color}" title="${s.title}"></span>`;
    },
    
    /**
     * Get node status dot HTML for filter buttons
     */
    nodeStatusDot(status, message) {
        const statusMap = {
            'ok': { color: 'var(--status-done)', title: message || 'OK' },          // 🟢
            'warning': { color: '#f59e0b', title: message || 'Warning' },            // 🟡
            'error': { color: 'var(--status-failed)', title: message || 'Error' },   // 🔴
            'offline': { color: '#6b7280', title: message || 'Offline' }             // ⚫
        };
        const s = statusMap[status] || statusMap.offline;
        return `<span class="node-status-dot" style="background-color: ${s.color}" title="${s.title}"></span>`;
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Refresh indicator component
     */
    refreshIndicator(isRefreshing) {
        return `<span class="refresh-indicator ${isRefreshing ? 'active' : ''}">
            <span class="refresh-dot"></span>
            ${isRefreshing ? 'Refreshing...' : 'Auto-refresh'}
        </span>`;
    },
    
    /**
     * Ask Agent section for modals
     * @param {Object} session - Session object with id, label, status, etc.
     * @param {Object} context - Additional context: { task, result, sessionKey }
     */
    askAgentSection(session, context = {}) {
        const agentName = session.agentName || 'agent';
        const label = session.label || session.id;
        const status = session.status || 'unknown';
        const age = this.formatAge(session.ageMs);
        const sessionKey = context.sessionKey || session.key || '';
        
        // Task: first user message (up to 300 chars)
        const task = context.task ? 
            this.truncate(context.task.replace(/\n/g, ' ').trim(), 300) : 
            '';
        
        // Result: last assistant text message (up to 1000 chars)
        const result = context.result ? 
            this.truncate(context.result.replace(/\n/g, ' ').trim(), 1000) : 
            '';
        
        const messageIcon = typeof Icons !== 'undefined' ? Icons.get('messageCircle', 16) : '';
        const chevronIcon = typeof Icons !== 'undefined' ? Icons.get('chevronDown', 12) : '';
        const externalIcon = typeof Icons !== 'undefined' ? Icons.get('externalLink', 14) : '';
        const copyIcon = typeof Icons !== 'undefined' ? Icons.get('copy', 14) : '';
        
        return `
            <div class="ask-agent-section">
                <button class="ask-agent-toggle" aria-expanded="false">
                    <span class="ask-agent-icon">${messageIcon}</span>
                    <span class="ask-agent-label">Ask ${typeof getMainAgentName === 'function' ? getMainAgentName() : (CONFIG.server?.mainAgentName || 'Agent')} About This Session</span>
                    <span class="ask-agent-arrow">${chevronIcon}</span>
                </button>
                <div class="ask-agent-form" hidden>
                    <textarea 
                        class="ask-agent-input" 
                        placeholder="What would you like to know about this session?"
                        rows="3"
                    ></textarea>
                    <div class="ask-agent-actions">
                        <button class="btn-ask-agent-send" title="Copy and open webchat">
                            ${externalIcon} Copy & Open Chat
                        </button>
                        <button class="btn-ask-agent-copy" title="Just copy to clipboard">
                            ${copyIcon}
                        </button>
                    </div>
                    <input type="hidden" class="ask-agent-context" 
                        data-label="${this.escapeHtml(label)}"
                        data-agent="${this.escapeHtml(agentName)}"
                        data-status="${this.escapeHtml(status)}"
                        data-age="${this.escapeHtml(age)}"
                        data-session-key="${this.escapeHtml(sessionKey)}"
                        data-task="${this.escapeHtml(task)}"
                        data-result="${this.escapeHtml(result)}"
                    />
                </div>
            </div>
        `;
    },
    
    /**
     * Settings modal content
     * @param {Object} settings - Current settings { retentionDays, autoArchive, pageSize }
     * @param {Object} stats - Storage stats { activeCount, activeSizeFormatted, archivedCount, archivedSizeFormatted }
     * @param {Object} updateInfo - Update check info { currentVersion, latestVersion, updateAvailable, error }
     */
    settingsModal(settings, stats = {}, updateInfo = null) {
        const container = document.createElement('div');
        container.className = 'modal-content settings-content';
        
        const currentRetention = settings.retentionDays;
        const isNever = currentRetention === 'never';
        const retentionValue = isNever ? 30 : parseInt(currentRetention, 10) || 30;
        // If "never" is set, auto-archive should be off
        const autoArchiveEnabled = !isNever && settings.autoArchive !== false;
        
        const { 
            activeCount = 0, 
            activeSizeFormatted = '0 B', 
            archivedCount = 0, 
            archivedSizeFormatted = '0 B' 
        } = stats;
        
        const settingsIcon = typeof Icons !== 'undefined' ? Icons.get('settings', 20) : '';
        const closeIcon = typeof Icons !== 'undefined' ? Icons.get('close', 18) : '×';
        const barChartIcon = typeof Icons !== 'undefined' ? Icons.get('barChart', 16) : '';
        const listIcon = typeof Icons !== 'undefined' ? Icons.get('list', 16) : '';
        const archiveIcon = typeof Icons !== 'undefined' ? Icons.get('archive', 16) : '';
        const clockIcon = typeof Icons !== 'undefined' ? Icons.get('clock', 16) : '';
        const playIcon = typeof Icons !== 'undefined' ? Icons.get('playCircle', 14) : '';
        const saveIcon = typeof Icons !== 'undefined' ? Icons.get('save', 14) : '';
        const refreshIcon = typeof Icons !== 'undefined' ? Icons.get('refresh', 16) : '';
        const downloadIcon = typeof Icons !== 'undefined' ? Icons.get('download', 16) : '';
        
        // Get current refresh interval from config
        const currentRefreshInterval = typeof getRefreshInterval === 'function' ? getRefreshInterval() : (CONFIG.refresh?.intervalMs || 30000);
        const refreshOptions = CONFIG.refresh?.options || [
            { value: 1000, label: '1 second' },
            { value: 5000, label: '5 seconds' },
            { value: 10000, label: '10 seconds' },
            { value: 30000, label: '30 seconds' },
            { value: 60000, label: '1 minute' },
            { value: 120000, label: '2 minutes' },
            { value: 300000, label: '5 minutes' },
            { value: 0, label: 'Off' }
        ];
        
        // Build update notification banner
        const updateBanner = this.buildUpdateBanner(updateInfo, downloadIcon);
        
        container.innerHTML = `
            <div class="detail-header">
                <div class="detail-title">
                    <span class="settings-icon">${settingsIcon}</span>
                    <span>Settings</span>
                </div>
                <button class="btn-close" aria-label="Close">${closeIcon}</button>
            </div>
            <div class="settings-body">
                <!-- Update Notification Banner -->
                ${updateBanner}
                
                <!-- Storage Statistics Section -->
                <div class="settings-section stats-section">
                    <h3 class="settings-section-title">${barChartIcon} Storage Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-card-icon">${listIcon}</span>
                            <div class="stat-card-info">
                                <span class="stat-card-value">${activeCount}</span>
                                <span class="stat-card-label">Active Sessions</span>
                            </div>
                            <span class="stat-card-size">${activeSizeFormatted}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-card-icon">${archiveIcon}</span>
                            <div class="stat-card-info">
                                <span class="stat-card-value">${archivedCount}</span>
                                <span class="stat-card-label">Archived Sessions</span>
                            </div>
                            <span class="stat-card-size">${archivedSizeFormatted}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Auto-Refresh Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">${refreshIcon} Auto-Refresh</h3>
                    <p class="settings-section-desc">
                        How often the dashboard should refresh session data.
                    </p>
                    <div class="refresh-setting">
                        <label for="refresh-interval" class="refresh-label">Refresh every:</label>
                        <select id="refresh-interval" class="refresh-select">
                            ${refreshOptions.map(opt => `
                                <option value="${opt.value}" ${opt.value === currentRefreshInterval ? 'selected' : ''}>
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <!-- Retention Policy Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">${clockIcon} Retention Policy</h3>
                    <p class="settings-section-desc">
                        Choose how sessions should be handled over time.
                    </p>
                    <div class="retention-options">
                        <label class="radio-label">
                            <input type="radio" name="retention-policy" id="retention-never" value="never" ${isNever ? 'checked' : ''}>
                            <span class="radio-custom"></span>
                            <span class="radio-text">Never archive (keep forever)</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="retention-policy" id="retention-auto" value="auto" ${!isNever ? 'checked' : ''}>
                            <span class="radio-custom"></span>
                            <span class="radio-text">Auto-archive after</span>
                            <div class="retention-input-group">
                                <input type="number" 
                                       id="retention-days" 
                                       class="retention-input" 
                                       min="1" 
                                       value="${retentionValue}"
                                       ${isNever ? 'disabled' : ''}
                                       placeholder="30">
                                <span class="retention-unit">days</span>
                            </div>
                        </label>
                    </div>
                </div>
                
                <!-- Appearance Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">${settingsIcon} Appearance</h3>
                    <label class="checkbox-label">
                        <input type="checkbox" id="show-lobsters" ${this.getLobsterSetting() ? 'checked' : ''}>
                        Show swimming lobsters
                    </label>
                </div>
                
                <!-- Manual Archive Section (hidden in read-only mode) -->
                ${(typeof isReadOnly === 'function' && isReadOnly()) ? '' : `
                <div class="settings-section">
                    <h3 class="settings-section-title">${archiveIcon} Manual Archive</h3>
                    <p class="settings-section-desc">
                        Run the archiving process now based on current retention settings.
                    </p>
                    <button class="btn-archive-now" title="Archive sessions older than retention period">
                        ${playIcon} Run Archive Now
                    </button>
                </div>
                `}
                
                <div class="settings-actions">
                    <button class="btn btn-primary btn-save-settings">${saveIcon} Save Settings</button>
                </div>
                
                <!-- About Section -->
                <div class="settings-about">
                    <div class="about-header">
                        <span class="about-logo">
                            <svg class="about-logo-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                                <defs>
                                    <linearGradient id="lobster-main-about" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#ff4d4d"/>
                                        <stop offset="100%" stop-color="#991b1b"/>
                                    </linearGradient>
                                    <linearGradient id="lobster-shadow-about" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#cc3333"/>
                                        <stop offset="100%" stop-color="#661111"/>
                                    </linearGradient>
                                </defs>
                                <g transform="translate(8, 18) scale(0.45)" opacity="0.85">
                                    <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="url(#lobster-shadow-about)"/>
                                    <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="url(#lobster-shadow-about)"/>
                                    <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="url(#lobster-shadow-about)"/>
                                    <circle cx="45" cy="35" r="5" fill="#050810"/>
                                    <circle cx="75" cy="35" r="5" fill="#050810"/>
                                    <circle cx="46" cy="34" r="2" fill="#00e5cc"/>
                                    <circle cx="76" cy="34" r="2" fill="#00e5cc"/>
                                </g>
                                <g transform="translate(58, 18) scale(0.45)" opacity="0.85">
                                    <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="url(#lobster-shadow-about)"/>
                                    <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="url(#lobster-shadow-about)"/>
                                    <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="url(#lobster-shadow-about)"/>
                                    <circle cx="45" cy="35" r="5" fill="#050810"/>
                                    <circle cx="75" cy="35" r="5" fill="#050810"/>
                                    <circle cx="46" cy="34" r="2" fill="#00e5cc"/>
                                    <circle cx="76" cy="34" r="2" fill="#00e5cc"/>
                                </g>
                                <g transform="translate(27, 32) scale(0.55)">
                                    <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="url(#lobster-main-about)"/>
                                    <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="url(#lobster-main-about)"/>
                                    <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="url(#lobster-main-about)"/>
                                    <path d="M45 15 Q35 5 30 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/>
                                    <path d="M75 15 Q85 5 90 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/>
                                    <circle cx="45" cy="35" r="6" fill="#050810"/>
                                    <circle cx="75" cy="35" r="6" fill="#050810"/>
                                    <circle cx="46" cy="34" r="2.5" fill="#00e5cc"/>
                                    <circle cx="76" cy="34" r="2.5" fill="#00e5cc"/>
                                </g>
                            </svg>
                            ClawWatch
                        </span>
                        <span class="about-version" id="about-version-display">v${this.escapeHtml(updateInfo?.currentVersion || '—')}</span>
                    </div>
                    <div class="about-info">
                        <div class="about-row">
                            <span class="about-label">Developer</span>
                            <span class="about-value">Forthean Labs LLC</span>
                        </div>
                        <div class="about-row">
                            <span class="about-label">Website</span>
                            <a href="https://fortheanlabs.com" target="_blank" rel="noopener noreferrer" class="about-link">
                                ${typeof Icons !== 'undefined' ? Icons.get('globe', 12) : ''}
                                fortheanlabs.com
                            </a>
                        </div>
                        <div class="about-row">
                            <span class="about-label">Support</span>
                            <a href="https://github.com/anthropics/courses/issues" target="_blank" rel="noopener noreferrer" class="about-link">
                                ${typeof Icons !== 'undefined' ? Icons.get('externalLink', 12) : ''}
                                GitHub Issues
                            </a>
                        </div>
                        <div class="about-row">
                            <span class="about-label">License</span>
                            <span class="about-value">MIT</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Get references to radio buttons and input
        const neverRadio = container.querySelector('#retention-never');
        const autoRadio = container.querySelector('#retention-auto');
        const retentionInput = container.querySelector('#retention-days');
        
        // Helper to update UI state based on selected radio
        const updateArchiveState = () => {
            const isNever = neverRadio?.checked;
            
            // Disable/enable retention input based on selection
            if (retentionInput) {
                retentionInput.disabled = isNever;
                retentionInput.closest('.retention-input-group')?.classList.toggle('disabled', isNever);
            }
        };
        
        // Bind radio button changes
        neverRadio?.addEventListener('change', updateArchiveState);
        autoRadio?.addEventListener('change', updateArchiveState);
        
        // When clicking the days input, auto-select the auto-archive radio
        retentionInput?.addEventListener('focus', () => {
            if (autoRadio && !autoRadio.checked) {
                autoRadio.checked = true;
                updateArchiveState();
            }
        });
        
        // Validate input
        retentionInput?.addEventListener('input', () => {
            const val = parseInt(retentionInput.value, 10);
            if (val < 1 || isNaN(val)) {
                retentionInput.classList.add('invalid');
            } else {
                retentionInput.classList.remove('invalid');
            }
        });
        
        return container;
    },
    
    /**
     * Build update notification banner HTML
     * @param {Object|null} updateInfo - { currentVersion, latestVersion, updateAvailable, error, disabled }
     * @param {string} downloadIcon - SVG icon for download
     * @returns {string} HTML for the update banner
     */
    buildUpdateBanner(updateInfo, downloadIcon = '') {
        // Still loading
        if (updateInfo === null) {
            return `<div class="update-banner update-loading">
                <span class="update-icon">🔄</span>
                <span class="update-text">Checking for updates...</span>
            </div>`;
        }
        
        // Update checking disabled
        if (updateInfo.disabled) {
            return ''; // Don't show anything
        }
        
        // Error checking for updates
        if (updateInfo.error) {
            return `<div class="update-banner update-error">
                <span class="update-text">${this.escapeHtml(updateInfo.error)}</span>
            </div>`;
        }
        
        // Update available!
        if (updateInfo.updateAvailable && updateInfo.latestVersion) {
            return `<div class="update-banner update-available">
                <div class="update-content">
                    <span class="update-icon">🦞</span>
                    <div class="update-info">
                        <span class="update-title">ClawWatch v${this.escapeHtml(updateInfo.latestVersion)} available!</span>
                        <span class="update-subtitle">You're on v${this.escapeHtml(updateInfo.currentVersion)}</span>
                    </div>
                </div>
                <div class="update-action">
                    <code class="update-command">clawhub update clawwatch</code>
                    <button class="btn-copy-command" title="Copy command">
                        ${typeof Icons !== 'undefined' ? Icons.get('copy', 14) : '📋'}
                    </button>
                </div>
            </div>`;
        }
        
        // Up to date
        return `<div class="update-banner update-current">
            <span class="update-icon">✅</span>
            <span class="update-text">ClawWatch is up to date (v${this.escapeHtml(updateInfo.currentVersion)})</span>
        </div>`;
    },
    
    /**
     * Get lobster visibility setting from localStorage
     * @returns {boolean} true if lobsters should be shown (default: true)
     */
    getLobsterSetting() {
        const stored = localStorage.getItem('showSwimmingLobsters');
        // Default to true if not set
        return stored === null ? true : stored === 'true';
    },
    
    /**
     * Create a custom icon dropdown component
     * @param {Object} config - Configuration object
     * @param {string} config.id - Dropdown ID
     * @param {Array} config.options - Array of { value, label, icon, iconKey, color }
     * @param {string} config.value - Currently selected value
     * @param {Function} config.onChange - Callback when value changes
     * @returns {HTMLElement} Dropdown element
     */
    createIconDropdown(config) {
        const { id, options, value = '', onChange } = config;
        
        const container = document.createElement('div');
        container.className = 'icon-dropdown';
        container.id = `${id}-dropdown`;
        
        // Find selected option
        const selectedOption = options.find(o => o.value === value) || options[0];
        
        // Get chevron icon
        const chevronIcon = typeof Icons !== 'undefined' ? Icons.get('chevronDown', 12) : '▼';
        
        // Build trigger button
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'icon-dropdown-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        
        const iconHtml = this.getDropdownIcon(selectedOption);
        trigger.innerHTML = `
            <span class="icon-dropdown-icon">${iconHtml}</span>
            <span class="icon-dropdown-label">${this.escapeHtml(selectedOption.label)}</span>
            <span class="icon-dropdown-arrow">${chevronIcon}</span>
        `;
        
        // Build menu
        const menu = document.createElement('div');
        menu.className = 'icon-dropdown-menu';
        menu.setAttribute('role', 'listbox');
        
        options.forEach(option => {
            const optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'icon-dropdown-option';
            if (option.value === value) {
                optionBtn.classList.add('selected');
            }
            optionBtn.setAttribute('role', 'option');
            optionBtn.setAttribute('data-value', option.value);
            if (option.iconKey) {
                optionBtn.setAttribute('data-agent-icon', option.iconKey);
            }
            
            const optionIconHtml = this.getDropdownIcon(option);
            optionBtn.innerHTML = `
                <span class="icon-dropdown-option-icon">${optionIconHtml}</span>
                <span class="icon-dropdown-option-label">${this.escapeHtml(option.label)}</span>
            `;
            
            optionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Update selected state
                menu.querySelectorAll('.icon-dropdown-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                optionBtn.classList.add('selected');
                
                // Update trigger display
                const newIconHtml = this.getDropdownIcon(option);
                trigger.querySelector('.icon-dropdown-icon').innerHTML = newIconHtml;
                trigger.querySelector('.icon-dropdown-label').textContent = option.label;
                
                // Close dropdown
                container.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                
                // Call onChange callback
                if (onChange) {
                    onChange(option.value);
                }
            });
            
            menu.appendChild(optionBtn);
        });
        
        // Toggle dropdown on trigger click
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = container.classList.toggle('open');
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Close on Escape key
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                container.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });
        
        container.appendChild(trigger);
        container.appendChild(menu);
        
        return container;
    },
    
    /**
     * Get icon HTML for a dropdown option
     * @param {Object} option - Option with icon/iconKey/iconName properties
     * @returns {string} Icon HTML
     */
    getDropdownIcon(option) {
        if (typeof Icons === 'undefined') return '';
        
        // If option has a direct icon property (SVG string)
        if (option.icon) {
            return option.icon;
        }
        
        // If option has an iconKey (for agent icons)
        if (option.iconKey) {
            const icon = Icons[option.iconKey];
            if (icon) {
                // Apply color and sizing
                const color = option.color || Icons.agentColors?.[option.iconKey] || 'currentColor';
                // Add width/height if not present, apply color
                let svg = icon;
                if (!svg.includes('width="')) {
                    svg = svg.replace('<svg', '<svg width="18" height="18"');
                }
                svg = svg
                    .replace(/<svg/, `<svg style="color: ${color}"`)
                    .replace(/stroke="currentColor"/g, `stroke="${color}"`);
                return svg;
            }
        }
        
        // If option has an iconName (for Icons.get())
        if (option.iconName) {
            return Icons.get(option.iconName, 16) || '';
        }
        
        return '';
    },
    
    /**
     * Update a custom icon dropdown's selected value
     * @param {string} id - Dropdown ID
     * @param {string} value - New selected value
     */
    updateIconDropdown(id, value) {
        const container = document.getElementById(`${id}-dropdown`);
        if (!container) return;
        
        const menu = container.querySelector('.icon-dropdown-menu');
        const trigger = container.querySelector('.icon-dropdown-trigger');
        if (!menu || !trigger) return;
        
        // Find and select the matching option
        const options = menu.querySelectorAll('.icon-dropdown-option');
        options.forEach(opt => {
            const isSelected = opt.getAttribute('data-value') === value;
            opt.classList.toggle('selected', isSelected);
            
            if (isSelected) {
                // Update trigger display
                const iconEl = opt.querySelector('.icon-dropdown-option-icon');
                const labelEl = opt.querySelector('.icon-dropdown-option-label');
                if (iconEl) {
                    trigger.querySelector('.icon-dropdown-icon').innerHTML = iconEl.innerHTML;
                }
                if (labelEl) {
                    trigger.querySelector('.icon-dropdown-label').textContent = labelEl.textContent;
                }
            }
        });
    },
    
    // ========================================
    // View Layout Selector (Dropdown)
    // ========================================
    
    /**
     * Available view layouts with icons
     */
    viewLayouts: [
        { value: 'table', label: 'Table', icon: '⊞', iconName: 'list', description: 'Traditional sortable table' },
        { value: 'tree', label: 'Tree', icon: '⊟', iconName: 'gitBranch', description: 'Hierarchical org-chart view' },
        { value: 'radial', label: 'Radial', icon: '◎', iconName: 'target', description: 'Sunburst visualization' },
        { value: 'network', label: 'Network', icon: '◇', iconName: 'share2', description: 'Force-directed graph' },
        { value: 'kanban', label: 'Kanban', icon: '▦', iconName: 'columns', description: 'Status columns board' },
        { value: 'timeline', label: 'Timeline', icon: '▬', iconName: 'clock', description: 'Gantt-style timeline' }
    ],
    
    /**
     * Create the view layout selector as a dropdown
     * @param {string} currentLayout - Currently selected layout
     * @param {Function} onChange - Callback when layout changes
     * @returns {HTMLElement} View selector element
     */
    createViewLayoutSelector(currentLayout, onChange) {
        const container = document.createElement('div');
        container.className = 'view-layout-selector';
        container.id = 'view-layout-selector';
        
        // Find current layout
        const currentOption = this.viewLayouts.find(l => l.value === currentLayout) || this.viewLayouts[0];
        
        // Get icons
        const chevronIcon = typeof Icons !== 'undefined' ? Icons.get('chevronDown', 12) : '▼';
        const viewIcon = typeof Icons !== 'undefined' && currentOption.iconName 
            ? Icons.get(currentOption.iconName, 16) 
            : currentOption.icon;
        
        // Create dropdown container
        const dropdown = document.createElement('div');
        dropdown.className = 'view-dropdown';
        dropdown.id = 'view-dropdown';
        
        // Create trigger button
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'view-dropdown-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.title = 'Change view layout';
        trigger.innerHTML = `
            <span class="view-dropdown-icon">${viewIcon}</span>
            <span class="view-dropdown-label">${currentOption.label}</span>
            <span class="view-dropdown-arrow">${chevronIcon}</span>
        `;
        
        // Create menu
        const menu = document.createElement('div');
        menu.className = 'view-dropdown-menu';
        menu.setAttribute('role', 'listbox');
        
        this.viewLayouts.forEach(layout => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'view-dropdown-option';
            option.dataset.view = layout.value;
            option.setAttribute('role', 'option');
            option.title = layout.description;
            
            if (layout.value === currentLayout) {
                option.classList.add('selected');
            }
            
            const optionIcon = typeof Icons !== 'undefined' && layout.iconName
                ? Icons.get(layout.iconName, 16)
                : layout.icon;
            
            option.innerHTML = `
                <span class="view-option-icon">${optionIcon}</span>
                <span class="view-option-label">${layout.label}</span>
                <span class="view-option-desc">${layout.description}</span>
            `;
            
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Update selected state
                menu.querySelectorAll('.view-dropdown-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
                
                // Update trigger
                const newIcon = typeof Icons !== 'undefined' && layout.iconName
                    ? Icons.get(layout.iconName, 16)
                    : layout.icon;
                trigger.querySelector('.view-dropdown-icon').innerHTML = newIcon;
                trigger.querySelector('.view-dropdown-label').textContent = layout.label;
                
                // Close dropdown
                dropdown.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                
                // Save to localStorage
                localStorage.setItem('clawwatchViewLayout', layout.value);
                
                // Trigger callback
                if (onChange) {
                    onChange(layout.value);
                }
            });
            
            menu.appendChild(option);
        });
        
        // Toggle dropdown on trigger click
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Close on Escape
        dropdown.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });
        
        dropdown.appendChild(trigger);
        dropdown.appendChild(menu);
        container.appendChild(dropdown);
        
        return container;
    },
    
    /**
     * Get saved view layout from localStorage
     * @returns {string} Layout name (default: 'table')
     */
    getSavedViewLayout() {
        return localStorage.getItem('clawwatchViewLayout') || 'table';
    }
    
    // EXTENSION POINT: Add more components
    // filterPanel() { ... }
    // searchBar() { ... }
    // chartWidget() { ... }
};
