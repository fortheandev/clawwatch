/**
 * Modern Icon Set - Minimalist inline SVG icons
 * 
 * Design philosophy:
 * - Consistent 1.5px stroke weight
 * - 20x20 viewBox for compact rendering
 * - Rounded linecaps and linejoins
 * - Minimal detail, geometric shapes
 * - currentColor for easy theming
 */

const Icons = {
    // Action Icons
    pause: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="3" height="12" rx="1"/><rect x="12" y="4" width="3" height="12" rx="1"/></svg>`,
    
    play: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="6,4 16,10 6,16" fill="currentColor"/></svg>`,
    
    refresh: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a7 7 0 0 1 12.9-3.8"/><path d="M17 10a7 7 0 0 1-12.9 3.8"/><polyline points="3 4 3 8 7 8"/><polyline points="17 16 17 12 13 12"/></svg>`,
    
    settings: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="2.5"/><path d="M10 1.5v2M10 16.5v2M3.5 10h2M14.5 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"/></svg>`,
    
    search: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="13" y1="13" x2="17" y2="17"/></svg>`,
    
    close: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>`,
    
    // Status Icons
    checkCircle: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5 10 9 12.5 13.5 7.5"/></svg>`,
    
    spinner: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v3"/><path d="M10 15v3" opacity="0.3"/><path d="M4.93 4.93l2.12 2.12"/><path d="M12.95 12.95l2.12 2.12" opacity="0.3"/><path d="M2 10h3"/><path d="M15 10h3" opacity="0.3"/><path d="M4.93 15.07l2.12-2.12" opacity="0.5"/><path d="M12.95 7.05l2.12-2.12" opacity="0.7"/></svg>`,
    
    xCircle: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg>`,
    
    clock: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="10 5 10 10 13 12"/></svg>`,
    
    // File/Document Icons
    fileText: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6l-4-4z"/><polyline points="12 2 12 6 16 6"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="11" y2="13"/></svg>`,
    
    fileCode: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6l-4-4z"/><polyline points="12 2 12 6 16 6"/><polyline points="8 12 6 14 8 16"/><polyline points="12 12 14 14 12 16"/></svg>`,
    
    fileJson: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6l-4-4z"/><polyline points="12 2 12 6 16 6"/><path d="M7 11c0-1.5 1-2 1-2s-1-.5-1-2"/><path d="M13 11c0-1.5-1-2-1-2s1-.5 1-2"/></svg>`,
    
    globe: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><ellipse cx="10" cy="10" rx="3" ry="8"/><line x1="2" y1="10" x2="18" y2="10"/></svg>`,
    
    // UI Icons
    copy: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M4 13V4a1 1 0 0 1 1-1h9"/></svg>`,
    
    download: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10"/><polyline points="6 10 10 14 14 10"/><path d="M3 16h14"/></svg>`,
    
    chevronDown: `<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 7 10 12 15 7"/></svg>`,
    
    chevronLeft: `<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 5 8 10 13 15"/></svg>`,
    
    chevronRight: `<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 5 12 10 7 15"/></svg>`,
    
    arrowLeft: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><polyline points="8 5 3 10 8 15"/></svg>`,
    
    arrowRight: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="10" x2="17" y2="10"/><polyline points="12 5 17 10 12 15"/></svg>`,
    
    // Data/Storage Icons
    archive: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="4" rx="1"/><path d="M3 7v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7"/><line x1="8" y1="11" x2="12" y2="11"/></svg>`,
    
    unarchive: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="4" rx="1"/><path d="M3 7v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7"/><polyline points="10 14 10 10"/><polyline points="8 12 10 10 12 12"/></svg>`,
    
    database: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="10" cy="5" rx="7" ry="3"/><path d="M3 5v10c0 1.66 3.13 3 7 3s7-1.34 7-3V5"/><path d="M3 10c0 1.66 3.13 3 7 3s7-1.34 7-3"/></svg>`,
    
    // Node/Server icon - represents compute nodes/machines
    server: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="14" height="6" rx="1"/><rect x="3" y="12" width="14" height="6" rx="1"/><line x1="6" y1="5" x2="6" y2="5"/><line x1="6" y1="15" x2="6" y2="15"/><circle cx="6" cy="5" r="0.5" fill="currentColor"/><circle cx="6" cy="15" r="0.5" fill="currentColor"/><line x1="9" y1="5" x2="14" y2="5"/><line x1="9" y1="15" x2="14" y2="15"/></svg>`,
    
    // Network nodes - connected dots
    networkNodes: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="2"/><circle cx="4" cy="4" r="1.5"/><circle cx="16" cy="4" r="1.5"/><circle cx="4" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/><line x1="8.5" y1="8.5" x2="5.5" y2="5.5"/><line x1="11.5" y1="8.5" x2="14.5" y2="5.5"/><line x1="8.5" y1="11.5" x2="5.5" y2="14.5"/><line x1="11.5" y1="11.5" x2="14.5" y2="14.5"/></svg>`,
    
    barChart: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="3" height="7" rx="0.5"/><rect x="8.5" y="6" width="3" height="11" rx="0.5"/><rect x="14" y="3" width="3" height="14" rx="0.5"/></svg>`,
    
    save: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8l4 4v9a1 1 0 0 1-1 1z"/><polyline points="13 3 13 7 7 7"/><rect x="6" y="11" width="8" height="5"/></svg>`,
    
    // Communication Icons
    messageCircle: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10c0 4.4-3.6 8-8 8a8.5 8.5 0 0 1-3-.5L2 19l1.5-5A8.5 8.5 0 0 1 2 10c0-4.4 3.6-8 8-8s8 3.6 8 8z"/></svg>`,
    
    externalLink: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/><polyline points="12 3 17 3 17 8"/><line x1="17" y1="3" x2="9" y2="11"/></svg>`,
    
    // Navigation/View Icons
    list: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="5" x2="17" y2="5"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="7" y1="15" x2="17" y2="15"/><circle cx="3.5" cy="5" r="1" fill="currentColor"/><circle cx="3.5" cy="10" r="1" fill="currentColor"/><circle cx="3.5" cy="15" r="1" fill="currentColor"/></svg>`,
    
    clipboardList: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1"/><rect x="7" y="1" width="6" height="4" rx="1"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="11" y2="13"/></svg>`,
    
    inbox: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 9 3 17 17 17 17 9"/><polyline points="3 9 7 9 8 12 12 12 13 9 17 9"/><polyline points="3 9 5 3 15 3 17 9"/></svg>`,
    
    inboxEmpty: `<svg width="48" height="48" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 9 3 17 17 17 17 9"/><polyline points="3 9 7 9 8 12 12 12 13 9 17 9"/><polyline points="3 9 5 3 15 3 17 9"/><line x1="8" y1="6" x2="12" y2="6" opacity="0.5"/></svg>`,
    
    archiveEmpty: `<svg width="48" height="48" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="4" rx="1"/><path d="M3 7v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7"/><line x1="8" y1="11" x2="12" y2="11" opacity="0.5"/></svg>`,
    
    // Misc
    logout: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3"/><polyline points="8 15 3 10 8 5"/><line x1="3" y1="10" x2="13" y2="10"/></svg>`,
    
    info: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="9" x2="10" y2="14"/><circle cx="10" cy="6" r="0.5" fill="currentColor"/></svg>`,
    
    // Filter dropdown icons
    users: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="6" r="3"/><path d="M1 18v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="14" cy="6" r="2.5"/><path d="M15.5 12h1a3.5 3.5 0 0 1 3.5 3.5V18"/></svg>`,
    
    calendar: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="16" height="14" rx="2"/><line x1="2" y1="8" x2="18" y2="8"/><line x1="6" y1="2" x2="6" y2="6"/><line x1="14" y1="2" x2="14" y2="6"/></svg>`,
    
    filter: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="2 3 18 3 11 11.5 11 16 9 18 9 11.5 2 3"/></svg>`,
    
    eye: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/></svg>`,
    
    summary: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><line x1="6" y1="7" x2="14" y2="7"/><line x1="6" y1="10" x2="14" y2="10"/><line x1="6" y1="13" x2="10" y2="13"/></svg>`,
    
    transcript: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M6 8h4"/><path d="M6 11h8"/><path d="M6 14h6"/></svg>`,
    
    playCircle: `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polygon points="8 6 14 10 8 14" fill="currentColor"/></svg>`,
    
    // Agent Type Icons - Simple, distinct SVG silhouettes
    // Each icon is designed to be recognizable at 36-40px by SHAPE alone
    
    // Main: Crown (leadership, primary agent)
    agentMain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18v2H3z" fill="currentColor" stroke="none"/><path d="M3 18l3-10 6 5 6-5 3 10"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="4" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/></svg>`,
    
    // Cron: Loop/cycle arrows (scheduled/recurring)
    agentCron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15.36 6.36"/><path d="M3 12a9 9 0 0 1 15.36-6.36"/><polyline points="21 3 21 9 15 9"/><polyline points="3 21 3 15 9 15"/></svg>`,
    
    // Ops: Hammer (worker, builder)
    agentOps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6"/><path d="M8.5 5.5l4-2 6 6-2 4"/><path d="M4.5 13.5l6 6"/></svg>`,
    
    // Content: Paintbrush (creative)
    agentContent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.37 2.63l3 3a1 1 0 0 1 0 1.41L10 18.41A2 2 0 0 1 8.59 19H5a1 1 0 0 1-1-1v-3.59a2 2 0 0 1 .59-1.41L16 2.63a1 1 0 0 1 1.41 0z"/><path d="M4 20l3-3"/></svg>`,
    
    // Research: Magnifying glass (research, discovery)
    agentResearch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="21" y2="21"/></svg>`,
    
    // Design: Pencil (design, drafting)
    agentDesign: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
    
    // Agent type icon mapping (configure your own agents in config.json)
    agentTypes: {
        'main': 'agentMain',
        'cron': 'agentCron',
        'ops': 'agentOps',
        'research': 'agentResearch',
        'content': 'agentContent',
        'design': 'agentDesign'
    },
    
    // Agent-specific colors for visual distinction
    agentColors: {
        'agentMain': '#ef4444',      // Red - primary/main
        'agentCron': '#a855f7',      // Purple - scheduled
        'agentOps': '#22c55e',       // Green - ops/worker
        'agentContent': '#3b82f6',   // Blue - content/creative
        'agentResearch': '#f97316',  // Orange - research
        'agentDesign': '#ec4899'     // Pink - design
    },
    
    /**
     * Get icon for agent type
     * Returns SVG string with appropriate size and color
     */
    getAgentIcon(agentName, size = 36) {
        if (!agentName) return null;
        const name = agentName.toLowerCase();
        const iconKey = this.agentTypes[name];
        if (!iconKey || !this[iconKey]) return null;
        
        const color = this.agentColors[iconKey] || 'currentColor';
        const svg = this[iconKey]
            .replace('<svg', `<svg width="${size}" height="${size}" style="color: ${color}"`)
            .replace(/stroke="currentColor"/g, `stroke="${color}"`);
        
        return `<span class="agent-icon">${svg}</span>`;
    },
    
    // Helper to get icon by name with optional size override
    get(name, size = null) {
        const icon = this[name];
        if (!icon) return '';
        if (!size) return icon;
        
        // Replace width and height attributes
        return icon
            .replace(/width="\d+"/, `width="${size}"`)
            .replace(/height="\d+"/, `height="${size}"`);
    },
    
    // Wrap icon in a span for consistent styling
    wrap(name, className = '', size = null) {
        const icon = this.get(name, size);
        return `<span class="icon ${className}">${icon}</span>`;
    }
};

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Icons;
}
