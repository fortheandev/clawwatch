/**
 * Export Utilities - File download functions for session data
 * 
 * Provides export functionality for sessions in multiple formats:
 * - Markdown (.md)
 * - JSON (.json)
 * - Plain Text (.txt)
 * - HTML (.html)
 */

const ExportUtils = {
    /**
     * Trigger a file download in the browser
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Export content as Markdown
     */
    exportAsMarkdown(data, filenamePrefix) {
        const { session, content, type } = data;
        const timestamp = new Date().toISOString().split('T')[0];
        
        let md = `# ${type === 'result' ? 'Session Result' : 'Session Detail'}\n\n`;
        md += `**Session:** ${session.label || session.id}\n`;
        md += `**ID:** \`${session.id}\`\n`;
        md += `**Status:** ${session.status || 'unknown'}\n`;
        md += `**Model:** ${session.model || 'N/A'}\n`;
        md += `**Exported:** ${new Date().toLocaleString()}\n\n`;
        md += `---\n\n`;
        
        if (type === 'result') {
            md += `## Result\n\n`;
            md += `\`\`\`\n${content}\n\`\`\`\n`;
        } else if (Array.isArray(content)) {
            // History entries
            md += `## Conversation History\n\n`;
            content.forEach((entry, i) => {
                const role = entry.role || 'unknown';
                const text = entry.content || JSON.stringify(entry);
                md += `### ${i + 1}. ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n`;
                md += `\`\`\`\n${text}\n\`\`\`\n\n`;
            });
        } else {
            md += `## Output\n\n`;
            md += `\`\`\`\n${content}\n\`\`\`\n`;
        }
        
        const filename = `${filenamePrefix}-${session.id.slice(0, 8)}.md`;
        this.downloadFile(md, filename, 'text/markdown');
        return filename;
    },
    
    /**
     * Export data as JSON
     */
    exportAsJSON(data, filenamePrefix) {
        const { session, content, type } = data;
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            type: type,
            session: {
                id: session.id,
                label: session.label,
                status: session.status,
                model: session.model,
                agentName: session.agentName,
                startedAt: session.startedAt,
                durationMs: session.durationMs,
                totalTokens: session.totalTokens,
                usagePct: session.usagePct
            },
            content: content
        };
        
        const json = JSON.stringify(exportData, null, 2);
        const filename = `${filenamePrefix}-${session.id.slice(0, 8)}.json`;
        this.downloadFile(json, filename, 'application/json');
        return filename;
    },
    
    /**
     * Export content as plain text
     */
    exportAsText(data, filenamePrefix) {
        const { session, content, type } = data;
        
        let text = `Session: ${session.label || session.id}\n`;
        text += `ID: ${session.id}\n`;
        text += `Status: ${session.status || 'unknown'}\n`;
        text += `Model: ${session.model || 'N/A'}\n`;
        text += `Exported: ${new Date().toLocaleString()}\n`;
        text += `${'='.repeat(60)}\n\n`;
        
        if (type === 'result') {
            text += `RESULT:\n\n${content}\n`;
        } else if (Array.isArray(content)) {
            text += `CONVERSATION HISTORY:\n\n`;
            content.forEach((entry, i) => {
                const role = (entry.role || 'unknown').toUpperCase();
                const entryContent = entry.content || JSON.stringify(entry);
                text += `[${role}]\n${entryContent}\n\n${'-'.repeat(40)}\n\n`;
            });
        } else {
            text += `OUTPUT:\n\n${content}\n`;
        }
        
        const filename = `${filenamePrefix}-${session.id.slice(0, 8)}.txt`;
        this.downloadFile(text, filename, 'text/plain');
        return filename;
    },
    
    /**
     * Export content as HTML
     */
    exportAsHTML(data, filenamePrefix) {
        const { session, content, type } = data;
        
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        let contentHtml = '';
        if (type === 'result') {
            contentHtml = `<section class="result"><h2>Result</h2><pre>${escapeHtml(content)}</pre></section>`;
        } else if (Array.isArray(content)) {
            contentHtml = `<section class="history"><h2>Conversation History</h2>`;
            content.forEach((entry, i) => {
                const role = entry.role || 'unknown';
                const entryContent = entry.content || JSON.stringify(entry);
                contentHtml += `
                    <div class="entry ${role}">
                        <span class="role">${escapeHtml(role)}</span>
                        <pre>${escapeHtml(entryContent)}</pre>
                    </div>`;
            });
            contentHtml += `</section>`;
        } else {
            contentHtml = `<section class="output"><h2>Output</h2><pre>${escapeHtml(content)}</pre></section>`;
        }
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${type === 'result' ? 'Session Result' : 'Session Detail'} - ${escapeHtml(session.label || session.id)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            padding: 2rem;
            line-height: 1.6;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #3b82f6; }
        h2 { font-size: 1.2rem; margin: 1.5rem 0 1rem; color: #94a3b8; }
        .meta { 
            background: #1e293b; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
        }
        .meta p { margin: 0.25rem 0; }
        .meta strong { color: #94a3b8; }
        .meta code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
        .status { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 9999px; 
            font-size: 0.75rem; 
            background: rgba(255,255,255,0.1);
        }
        .status.done { color: #22c55e; }
        .status.running { color: #3b82f6; }
        .status.failed { color: #ef4444; }
        pre {
            background: #1e293b;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
            font-size: 0.85rem;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .entry {
            margin-bottom: 1rem;
            padding: 1rem;
            background: #1e293b;
            border-radius: 8px;
            border-left: 3px solid #334155;
        }
        .entry.user { border-left-color: #3b82f6; }
        .entry.assistant { border-left-color: #22c55e; }
        .entry.system { border-left-color: #9ca3af; }
        .entry .role {
            display: inline-block;
            padding: 2px 8px;
            margin-bottom: 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            background: #334155;
        }
        .entry.user .role { background: #3b82f6; }
        .entry.assistant .role { background: #22c55e; color: #000; }
        .entry pre { background: transparent; padding: 0; }
        footer { margin-top: 2rem; font-size: 0.75rem; color: #64748b; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐾 ${type === 'result' ? 'Session Result' : 'Session Detail'}</h1>
        <div class="meta">
            <p><strong>Session:</strong> ${escapeHtml(session.label || session.id)}</p>
            <p><strong>ID:</strong> <code>${escapeHtml(session.id)}</code></p>
            <p><strong>Status:</strong> <span class="status ${(session.status || '').toLowerCase()}">${escapeHtml(session.status || 'unknown')}</span></p>
            <p><strong>Model:</strong> ${escapeHtml(session.model || 'N/A')}</p>
        </div>
        ${contentHtml}
        <footer>Exported from OpenClaw Agent Dashboard on ${new Date().toLocaleString()}</footer>
    </div>
</body>
</html>`;
        
        const filename = `${filenamePrefix}-${session.id.slice(0, 8)}.html`;
        this.downloadFile(html, filename, 'text/html');
        return filename;
    }
};
