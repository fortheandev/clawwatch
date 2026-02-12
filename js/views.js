/**
 * View Components - Alternative visualization layouts for ClawWatch
 * 
 * Each view takes the same session data and renders it differently.
 * All views support: clicking sessions to open detail modal, status colors, filtering.
 */

const Views = {
    /**
     * Timeline zoom state - tracks current zoom level
     * Levels: 'auto', '1h', '6h', '24h', '7d'
     */
    timelineZoom: 'auto',
    
    /**
     * Timeline zoom options with labels
     */
    timelineZoomOptions: [
        { value: 'auto', label: 'Auto' },
        { value: '1h', label: '1 Hour' },
        { value: '6h', label: '6 Hours' },
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' }
    ],
    
    /**
     * Agent colors matching the mockups
     */
    agentColors: {
        'ivy': '#a855f7',      // Purple - Main
        'main': '#a855f7',
        'stone': '#f97316',    // Orange - Ops
        'ops': '#f97316',
        'ash': '#14b8a6',      // Teal - Research
        'research': '#14b8a6',
        'luna': '#ec4899',     // Pink - Content
        'content': '#ec4899',
        'slate': '#6366f1',    // Indigo - Design
        'design': '#6366f1',
        'cron': '#eab308',     // Yellow - Cron
        'default': '#3b82f6'   // Blue
    },
    
    /**
     * Status colors
     */
    statusColors: {
        'running': '#3b82f6',  // Blue
        'done': '#22c55e',     // Green
        'failed': '#ef4444',   // Red
        'pending': '#f59e0b'   // Orange/Amber
    },
    
    /**
     * Get agent color
     */
    getAgentColor(agentName) {
        const name = (agentName || '').toLowerCase();
        return this.agentColors[name] || this.agentColors.default;
    },
    
    /**
     * Get status color
     */
    getStatusColor(status) {
        const s = (status || 'pending').toLowerCase();
        return this.statusColors[s] || this.statusColors.pending;
    },
    
    /**
     * Group sessions by agent
     */
    groupByAgent(sessions) {
        const groups = {};
        sessions.forEach(session => {
            const agent = session.agentName || 'unknown';
            if (!groups[agent]) {
                groups[agent] = [];
            }
            groups[agent].push(session);
        });
        return groups;
    },
    
    /**
     * Group sessions by status
     */
    groupByStatus(sessions) {
        const groups = {
            running: [],
            pending: [],
            done: [],
            failed: []
        };
        sessions.forEach(session => {
            const status = (session.status || 'pending').toLowerCase();
            if (groups[status]) {
                groups[status].push(session);
            } else {
                groups.pending.push(session);
            }
        });
        return groups;
    },

    // ========================================
    // LAYOUT 1: Schematic Tree View
    // ========================================
    
    /**
     * Render hierarchical tree view (Gateway → Agents → Tasks)
     */
    renderTreeView(sessions, onSessionClick) {
        const container = document.createElement('div');
        container.className = 'view-tree';
        
        if (sessions.length === 0) {
            container.innerHTML = this.emptyState('No sessions to display in tree view');
            return container;
        }
        
        const groups = this.groupByAgent(sessions);
        const agents = Object.keys(groups).sort();
        
        // Create tree structure
        container.innerHTML = `
            <div class="tree-container">
                <!-- Gateway Node (Root) -->
                <div class="tree-root">
                    <div class="tree-node tree-node-gateway">
                        <span class="node-icon">🦞</span>
                        <span class="node-label">Gateway</span>
                    </div>
                </div>
                
                <!-- Connection lines -->
                <div class="tree-connector tree-connector-root"></div>
                
                <!-- Agents Row -->
                <div class="tree-agents">
                    ${agents.map(agent => this.renderTreeAgent(agent, groups[agent], onSessionClick)).join('')}
                </div>
            </div>
            
            ${this.renderLegend()}
        `;
        
        // Bind click events
        container.querySelectorAll('.tree-task').forEach(taskEl => {
            taskEl.addEventListener('click', () => {
                const sessionId = taskEl.dataset.sessionId;
                if (sessionId && onSessionClick) {
                    onSessionClick(sessionId);
                }
            });
        });
        
        return container;
    },
    
    /**
     * Render a single agent branch in tree view
     */
    renderTreeAgent(agentName, sessions, onSessionClick) {
        const color = this.getAgentColor(agentName);
        const displayName = agentName.charAt(0).toUpperCase() + agentName.slice(1);
        const role = this.getAgentRole(agentName);
        
        return `
            <div class="tree-agent-branch">
                <div class="tree-connector tree-connector-agent"></div>
                <div class="tree-node tree-node-agent" style="--agent-color: ${color}">
                    <span class="node-label">${displayName}</span>
                    <span class="node-role">(${role})</span>
                </div>
                <div class="tree-tasks">
                    ${sessions.map(s => this.renderTreeTask(s)).join('')}
                </div>
            </div>
        `;
    },
    
    /**
     * Render a task node in tree view
     */
    renderTreeTask(session) {
        const statusColor = this.getStatusColor(session.status);
        const agentColor = this.getAgentColor(session.agentName);
        const taskName = session.task ? Components.truncate(session.task, 20) : session.label;
        const tokens = session.totalTokens ? `${(session.totalTokens/1000).toFixed(1)}k tok` : '';
        
        return `
            <div class="tree-task" data-session-id="${session.id}" style="--agent-color: ${agentColor}">
                <div class="task-content">
                    <span class="task-name">${Components.escapeHtml(taskName)}</span>
                    <span class="task-tokens">${tokens}</span>
                </div>
                <span class="task-status" style="background-color: ${statusColor}" title="${session.status}"></span>
            </div>
        `;
    },
    
    /**
     * Get agent role description
     */
    getAgentRole(agentName) {
        const roles = {
            'ivy': 'Main',
            'main': 'Main',
            'stone': 'Ops',
            'ops': 'Ops',
            'ash': 'Research',
            'research': 'Research',
            'luna': 'Content',
            'content': 'Content',
            'slate': 'Design',
            'design': 'Design',
            'cron': 'Scheduled'
        };
        return roles[(agentName || '').toLowerCase()] || 'Agent';
    },

    // ========================================
    // LAYOUT 2: Radial Sunburst View
    // ========================================
    
    /**
     * Render radial/sunburst view with Gateway at center
     */
    renderRadialView(sessions, onSessionClick) {
        const container = document.createElement('div');
        container.className = 'view-radial';
        
        if (sessions.length === 0) {
            container.innerHTML = this.emptyState('No sessions to display in radial view');
            return container;
        }
        
        const groups = this.groupByAgent(sessions);
        const agents = Object.keys(groups);
        const angleStep = (2 * Math.PI) / Math.max(agents.length, 1);
        
        // Calculate positions
        const centerX = 50; // percentage
        const centerY = 50;
        const agentRadius = 25; // distance from center for agents
        const taskRadius = 40; // distance from center for tasks
        
        let nodesHtml = '';
        let linesHtml = '';
        
        // Gateway center node
        nodesHtml += `
            <div class="radial-node radial-gateway" style="left: ${centerX}%; top: ${centerY}%;">
                <span class="node-icon">🦞</span>
                <span class="node-label">Gateway</span>
            </div>
        `;
        
        // Agents and their tasks
        agents.forEach((agent, i) => {
            const angle = angleStep * i - Math.PI / 2; // Start from top
            const agentX = centerX + agentRadius * Math.cos(angle);
            const agentY = centerY + agentRadius * Math.sin(angle);
            const color = this.getAgentColor(agent);
            const displayName = agent.charAt(0).toUpperCase() + agent.slice(1);
            
            // Line from gateway to agent
            linesHtml += this.renderRadialLine(centerX, centerY, agentX, agentY, color);
            
            // Agent node
            nodesHtml += `
                <div class="radial-node radial-agent" style="left: ${agentX}%; top: ${agentY}%; --agent-color: ${color}">
                    <span class="node-label">${displayName}</span>
                </div>
            `;
            
            // Tasks for this agent
            const tasks = groups[agent];
            const taskAngleSpread = Math.PI / 4; // Spread tasks in 45-degree arc
            const taskAngleStart = angle - taskAngleSpread / 2;
            const taskAngleStep = tasks.length > 1 ? taskAngleSpread / (tasks.length - 1) : 0;
            
            tasks.forEach((session, j) => {
                const taskAngle = tasks.length === 1 ? angle : taskAngleStart + taskAngleStep * j;
                const taskX = centerX + taskRadius * Math.cos(taskAngle);
                const taskY = centerY + taskRadius * Math.sin(taskAngle);
                const statusColor = this.getStatusColor(session.status);
                const size = this.getNodeSize(session.totalTokens);
                
                // Line from agent to task
                linesHtml += this.renderRadialLine(agentX, agentY, taskX, taskY, color, 0.5);
                
                // Task node
                const taskLabel = session.task ? Components.truncate(session.task, 8) : '';
                nodesHtml += `
                    <div class="radial-node radial-task" 
                         data-session-id="${session.id}"
                         style="left: ${taskX}%; top: ${taskY}%; 
                                background-color: ${statusColor}; 
                                width: ${size}px; height: ${size}px;">
                        <span class="node-label">${Components.escapeHtml(taskLabel)}</span>
                    </div>
                `;
            });
        });
        
        container.innerHTML = `
            <div class="radial-container">
                <svg class="radial-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                    ${linesHtml}
                </svg>
                <div class="radial-nodes">
                    ${nodesHtml}
                </div>
            </div>
            <div class="radial-hint">Size = Token Usage</div>
            ${this.renderLegend()}
        `;
        
        // Bind click events
        container.querySelectorAll('.radial-task').forEach(taskEl => {
            taskEl.addEventListener('click', () => {
                const sessionId = taskEl.dataset.sessionId;
                if (sessionId && onSessionClick) {
                    onSessionClick(sessionId);
                }
            });
        });
        
        return container;
    },
    
    /**
     * Render SVG line for radial view
     */
    renderRadialLine(x1, y1, x2, y2, color, opacity = 1) {
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="${color}" stroke-width="0.3" stroke-opacity="${opacity}"/>`;
    },
    
    /**
     * Get node size based on token count
     */
    getNodeSize(tokens) {
        if (!tokens) return 30;
        if (tokens > 10000) return 50;
        if (tokens > 5000) return 45;
        if (tokens > 2000) return 40;
        if (tokens > 1000) return 35;
        return 30;
    },

    // ========================================
    // LAYOUT 3: Network Graph View
    // ========================================
    
    /**
     * Render force-directed network graph
     */
    renderNetworkView(sessions, onSessionClick) {
        const container = document.createElement('div');
        container.className = 'view-network';
        
        if (sessions.length === 0) {
            container.innerHTML = this.emptyState('No sessions to display in network view');
            return container;
        }
        
        const groups = this.groupByAgent(sessions);
        const agents = Object.keys(groups);
        
        // Build nodes and edges for display
        let nodesHtml = '';
        let edgesHtml = '';
        
        // Use a simple force-based layout simulation
        const positions = this.calculateNetworkPositions(groups);
        
        // Gateway node
        const gwPos = positions.gateway;
        nodesHtml += `
            <div class="network-node network-gateway" style="left: ${gwPos.x}%; top: ${gwPos.y}%;">
                <span class="node-icon">🦞</span>
                <span class="node-label">Gateway</span>
            </div>
        `;
        
        // Ivy/Main special connection to gateway
        const mainAgent = agents.find(a => ['ivy', 'main'].includes(a.toLowerCase()));
        if (mainAgent && positions.agents[mainAgent]) {
            const mainPos = positions.agents[mainAgent];
            edgesHtml += this.renderNetworkEdge(gwPos.x, gwPos.y, mainPos.x, mainPos.y, this.getAgentColor(mainAgent));
        }
        
        // Agent nodes and their tasks
        agents.forEach(agent => {
            const agentPos = positions.agents[agent];
            if (!agentPos) return;
            
            const color = this.getAgentColor(agent);
            const displayName = agent.charAt(0).toUpperCase() + agent.slice(1);
            const role = this.getAgentRole(agent);
            
            // Edge from Ivy to other agents (if Ivy exists)
            if (mainAgent && agent !== mainAgent) {
                const mainPos = positions.agents[mainAgent];
                edgesHtml += this.renderNetworkEdge(mainPos.x, mainPos.y, agentPos.x, agentPos.y, color);
            }
            
            // Agent node
            nodesHtml += `
                <div class="network-node network-agent" style="left: ${agentPos.x}%; top: ${agentPos.y}%; --agent-color: ${color}">
                    <span class="node-label">${displayName}</span>
                    <span class="node-role">${role}</span>
                </div>
            `;
            
            // Task nodes
            const tasks = groups[agent];
            tasks.forEach((session, j) => {
                const taskPos = positions.tasks[session.id];
                if (!taskPos) return;
                
                const statusColor = this.getStatusColor(session.status);
                const size = this.getNodeSize(session.totalTokens);
                
                // Edge from agent to task
                edgesHtml += this.renderNetworkEdge(agentPos.x, agentPos.y, taskPos.x, taskPos.y, color, 0.4);
                
                // Task node
                nodesHtml += `
                    <div class="network-node network-task" 
                         data-session-id="${session.id}"
                         style="left: ${taskPos.x}%; top: ${taskPos.y}%; 
                                background-color: ${statusColor};
                                width: ${size}px; height: ${size}px;">
                    </div>
                `;
            });
        });
        
        container.innerHTML = `
            <div class="network-container">
                <svg class="network-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
                    ${edgesHtml}
                </svg>
                <div class="network-nodes">
                    ${nodesHtml}
                </div>
            </div>
            <div class="network-hint">⇄ Drag to rearrange</div>
            ${this.renderLegend()}
        `;
        
        // Bind click events
        container.querySelectorAll('.network-task').forEach(taskEl => {
            taskEl.addEventListener('click', () => {
                const sessionId = taskEl.dataset.sessionId;
                if (sessionId && onSessionClick) {
                    onSessionClick(sessionId);
                }
            });
        });
        
        // Enable drag functionality
        this.enableDragging(container);
        
        return container;
    },
    
    /**
     * Calculate positions for network layout
     */
    calculateNetworkPositions(groups) {
        const positions = {
            gateway: { x: 50, y: 50 },
            agents: {},
            tasks: {}
        };
        
        const agents = Object.keys(groups);
        const angleStep = (2 * Math.PI) / Math.max(agents.length, 1);
        const agentRadius = 25;
        const taskRadius = 12;
        
        agents.forEach((agent, i) => {
            // Offset to make Ivy at top
            const baseAngle = -Math.PI / 2;
            const angle = baseAngle + angleStep * i;
            
            positions.agents[agent] = {
                x: 50 + agentRadius * Math.cos(angle),
                y: 50 + agentRadius * Math.sin(angle)
            };
            
            // Position tasks around their agent
            const tasks = groups[agent];
            tasks.forEach((session, j) => {
                const taskAngle = angle + (j - tasks.length / 2) * 0.3;
                const jitter = Math.random() * 5 - 2.5;
                positions.tasks[session.id] = {
                    x: positions.agents[agent].x + (taskRadius + jitter) * Math.cos(taskAngle + Math.PI),
                    y: positions.agents[agent].y + (taskRadius + jitter) * Math.sin(taskAngle + Math.PI)
                };
            });
        });
        
        return positions;
    },
    
    /**
     * Render SVG edge for network view
     */
    renderNetworkEdge(x1, y1, x2, y2, color, opacity = 0.6) {
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="${color}" stroke-width="0.2" stroke-opacity="${opacity}"/>`;
    },
    
    /**
     * Enable dragging for network nodes
     */
    enableDragging(container) {
        const nodes = container.querySelectorAll('.network-node');
        
        nodes.forEach(node => {
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            
            node.addEventListener('mousedown', (e) => {
                if (node.classList.contains('network-task')) return; // Don't drag tasks
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseFloat(node.style.left);
                startTop = parseFloat(node.style.top);
                node.style.cursor = 'grabbing';
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const containerRect = container.querySelector('.network-container').getBoundingClientRect();
                const dx = (e.clientX - startX) / containerRect.width * 100;
                const dy = (e.clientY - startY) / containerRect.height * 100;
                node.style.left = Math.max(5, Math.min(95, startLeft + dx)) + '%';
                node.style.top = Math.max(5, Math.min(95, startTop + dy)) + '%';
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    node.style.cursor = '';
                }
            });
        });
    },

    // ========================================
    // LAYOUT 4: Kanban Board View
    // ========================================
    
    /**
     * Render Kanban board with status columns
     */
    renderKanbanView(sessions, onSessionClick) {
        const container = document.createElement('div');
        container.className = 'view-kanban';
        
        const groups = this.groupByStatus(sessions);
        
        const columns = [
            { key: 'running', label: 'Running', icon: '🔵', color: this.statusColors.running },
            { key: 'pending', label: 'Pending', icon: '⏳', color: this.statusColors.pending },
            { key: 'done', label: 'Done', icon: '✅', color: this.statusColors.done },
            { key: 'failed', label: 'Failed', icon: '❌', color: this.statusColors.failed }
        ];
        
        container.innerHTML = `
            <div class="kanban-board">
                ${columns.map(col => this.renderKanbanColumn(col, groups[col.key], onSessionClick)).join('')}
            </div>
        `;
        
        // Bind click events
        container.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('click', () => {
                const sessionId = card.dataset.sessionId;
                if (sessionId && onSessionClick) {
                    onSessionClick(sessionId);
                }
            });
        });
        
        return container;
    },
    
    /**
     * Render a Kanban column
     */
    renderKanbanColumn(column, sessions, onSessionClick) {
        const count = sessions.length;
        
        return `
            <div class="kanban-column" style="--column-color: ${column.color}">
                <div class="kanban-header">
                    <span class="column-icon">${column.icon}</span>
                    <span class="column-label">${column.label}</span>
                    <span class="column-count">${count}</span>
                </div>
                <div class="kanban-cards">
                    ${sessions.length === 0 
                        ? '<div class="kanban-empty">No tasks</div>'
                        : sessions.map(s => this.renderKanbanCard(s)).join('')}
                </div>
            </div>
        `;
    },
    
    /**
     * Render a Kanban card
     */
    renderKanbanCard(session) {
        const agentColor = this.getAgentColor(session.agentName);
        const agentName = (session.agentName || 'Agent').charAt(0).toUpperCase() + (session.agentName || 'agent').slice(1);
        const taskName = session.task ? Components.truncate(session.task, 30) : session.label;
        const tokens = session.totalTokens ? `🔢 ${(session.totalTokens/1000).toFixed(1)}k tokens` : '';
        const usagePct = session.usagePct || 0;
        
        return `
            <div class="kanban-card" data-session-id="${session.id}" style="--agent-color: ${agentColor}">
                <div class="card-agent-badge" style="background-color: ${agentColor}">${agentName}</div>
                <div class="card-task">${Components.escapeHtml(taskName)}</div>
                <div class="card-tokens">${tokens}</div>
                ${session.status === 'running' ? `
                    <div class="card-progress">
                        <div class="progress-bar" style="width: ${usagePct}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ========================================
    // LAYOUT 5: Timeline View
    // ========================================
    
    /**
     * Calculate time range based on zoom level
     */
    calculateTimeRange(sessions, zoomLevel) {
        const now = Date.now();
        const HOUR = 60 * 60 * 1000;
        const DAY = 24 * HOUR;
        
        // For preset zoom levels, use fixed time windows ending at now
        if (zoomLevel === '1h') {
            return { minTime: now - HOUR, maxTime: now };
        } else if (zoomLevel === '6h') {
            return { minTime: now - 6 * HOUR, maxTime: now };
        } else if (zoomLevel === '24h') {
            return { minTime: now - DAY, maxTime: now };
        } else if (zoomLevel === '7d') {
            return { minTime: now - 7 * DAY, maxTime: now };
        }
        
        // Auto mode: calculate from session data
        let minTime = now;
        let maxTime = now;
        
        sessions.forEach(s => {
            const start = s.startedAt || (s.updatedAt - (s.durationMs || 0));
            const end = s.updatedAt || now;
            if (start < minTime) minTime = start;
            if (end > maxTime) maxTime = end;
        });
        
        return { minTime, maxTime };
    },
    
    /**
     * Get current zoom label for display
     */
    getCurrentZoomLabel() {
        const option = this.timelineZoomOptions.find(o => o.value === this.timelineZoom);
        return option ? option.label : 'Auto';
    },
    
    /**
     * Cycle to next zoom level
     */
    cycleZoomLevel() {
        const currentIndex = this.timelineZoomOptions.findIndex(o => o.value === this.timelineZoom);
        const nextIndex = (currentIndex + 1) % this.timelineZoomOptions.length;
        this.timelineZoom = this.timelineZoomOptions[nextIndex].value;
        return this.timelineZoom;
    },
    
    /**
     * Render Gantt-style timeline view
     */
    renderTimelineView(sessions, onSessionClick, onZoomChange) {
        const container = document.createElement('div');
        container.className = 'view-timeline';
        
        if (sessions.length === 0) {
            container.innerHTML = this.emptyState('No sessions to display in timeline view');
            return container;
        }
        
        const groups = this.groupByAgent(sessions);
        const agents = Object.keys(groups).sort();
        
        // Calculate time range based on zoom level
        const now = Date.now();
        const { minTime, maxTime } = this.calculateTimeRange(sessions, this.timelineZoom);
        
        // Add padding to time range
        const timeRange = maxTime - minTime;
        const paddedMin = minTime - timeRange * 0.05;
        const paddedMax = maxTime + timeRange * 0.1;
        const totalDuration = paddedMax - paddedMin;
        
        // Generate time markers
        const timeMarkers = this.generateTimeMarkers(paddedMin, paddedMax);
        
        // Current zoom label
        const zoomLabel = this.getCurrentZoomLabel();
        
        container.innerHTML = `
            <div class="timeline-container">
                <div class="timeline-header">
                    <div class="timeline-agent-header"></div>
                    <div class="timeline-time-axis">
                        ${timeMarkers.map(m => `
                            <div class="time-marker" style="left: ${m.position}%">
                                <span class="time-label">${m.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="timeline-body">
                    ${agents.map(agent => this.renderTimelineLane(agent, groups[agent], paddedMin, totalDuration, now)).join('')}
                </div>
                <div class="timeline-now" style="left: ${((now - paddedMin) / totalDuration) * 100}%">
                    <span class="now-label">NOW</span>
                </div>
            </div>
            <div class="timeline-controls">
                <button class="btn-zoom" title="Click to cycle zoom levels">🔍 ${zoomLabel}</button>
                <span class="zoom-hint">Click to change time range</span>
            </div>
            ${this.renderLegend()}
        `;
        
        // Bind click events for timeline bars
        container.querySelectorAll('.timeline-bar').forEach(bar => {
            bar.addEventListener('click', () => {
                const sessionId = bar.dataset.sessionId;
                if (sessionId && onSessionClick) {
                    onSessionClick(sessionId);
                }
            });
        });
        
        // Bind zoom button click - cycles through zoom levels and triggers re-render
        const zoomBtn = container.querySelector('.btn-zoom');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', () => {
                this.cycleZoomLevel();
                // Trigger re-render via callback or by re-rendering directly
                if (onZoomChange) {
                    onZoomChange(this.timelineZoom);
                }
            });
        }
        
        return container;
    },
    
    /**
     * Render a timeline swim lane for an agent
     */
    renderTimelineLane(agentName, sessions, minTime, totalDuration, now) {
        const color = this.getAgentColor(agentName);
        const displayName = agentName.charAt(0).toUpperCase() + agentName.slice(1);
        
        return `
            <div class="timeline-lane" style="--agent-color: ${color}">
                <div class="timeline-agent-label">${displayName}</div>
                <div class="timeline-bars">
                    ${sessions.map(s => this.renderTimelineBar(s, minTime, totalDuration, now)).join('')}
                </div>
            </div>
        `;
    },
    
    /**
     * Render a timeline bar for a session
     */
    renderTimelineBar(session, minTime, totalDuration, now) {
        const start = session.startedAt || (session.updatedAt - (session.durationMs || 60000));
        const end = session.status === 'running' ? now : (session.updatedAt || now);
        const duration = end - start;
        
        const left = ((start - minTime) / totalDuration) * 100;
        const width = Math.max((duration / totalDuration) * 100, 1); // Min 1% width
        
        const statusColor = this.getStatusColor(session.status);
        const taskName = session.task ? Components.truncate(session.task, 25) : session.label;
        const tokens = session.totalTokens ? `${(session.totalTokens/1000).toFixed(1)}k` : '';
        const isRunning = session.status === 'running';
        
        return `
            <div class="timeline-bar ${isRunning ? 'running' : ''}" 
                 data-session-id="${session.id}"
                 style="left: ${left}%; width: ${width}%; background-color: ${statusColor};">
                <span class="bar-label">${Components.escapeHtml(taskName)}</span>
                ${isRunning ? '<span class="bar-arrow">→</span>' : ''}
            </div>
            <div class="bar-tokens" style="left: ${left + width/2}%">${tokens}</div>
        `;
    },
    
    /**
     * Generate time markers for timeline axis
     */
    generateTimeMarkers(minTime, maxTime) {
        const markers = [];
        const duration = maxTime - minTime;
        const numMarkers = 6;
        
        for (let i = 0; i <= numMarkers; i++) {
            const time = minTime + (duration * i / numMarkers);
            const date = new Date(time);
            const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            markers.push({
                position: (i / numMarkers) * 100,
                label: label
            });
        }
        
        return markers;
    },

    // ========================================
    // Shared Components
    // ========================================
    
    /**
     * Render status legend
     */
    renderLegend() {
        return `
            <div class="view-legend">
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: ${this.statusColors.running}"></span>
                    <span class="legend-label">Running</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: ${this.statusColors.done}"></span>
                    <span class="legend-label">Done</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: ${this.statusColors.failed}"></span>
                    <span class="legend-label">Failed</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: ${this.statusColors.pending}"></span>
                    <span class="legend-label">Pending</span>
                </div>
            </div>
        `;
    },
    
    /**
     * Empty state component
     */
    emptyState(message) {
        return `
            <div class="view-empty">
                <span class="empty-icon">📊</span>
                <p>${message}</p>
            </div>
        `;
    }
};

// Export for use in app.js
window.Views = Views;
