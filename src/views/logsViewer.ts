/**
 * Logs Viewer Panel
 * Displays function execution logs and performance metrics
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { telemetryManager } from "../core/logs/logTelemetryManager";

/**
 * Create and show the logs viewer panel
 */
export function showLogsViewer(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): void {
  const panel = vscode.window.createWebviewPanel(
    "appforgeLogsViewer",
    "AppForge Logs Viewer",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  const activeProjectId = projectStorage.getActiveProjectId() || "";
  const activeProject = projectStorage.getProjectById(activeProjectId);
  const projectName = activeProject?.projectName || "No Active Project";

  const safeProjectName = projectName.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[ch] ?? ch;
  });

  panel.webview.html = getLogsViewerHtml(safeProjectName, activeProjectId);
  telemetryManager.registerWebview(panel);

  // Trigger evaluation refresh sequences instantly when opened
  vscode.commands.executeCommand("appforge.verifyAppwriteProjectEnvironment");

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "triggerDiagnosticsRefresh":
        await vscode.commands.executeCommand("appforge.verifyAppwriteProjectEnvironment");
        break;
      case "openConsole":
        await vscode.commands.executeCommand("appforge.openAppwriteConsole");
        break;
      case "requestInitialState":
        panel.webview.postMessage({
          command: "loadFullState",
          logs: telemetryManager.getLogs(),
          metrics: telemetryManager.getSnapshotMetrics(),
          diagnostics: telemetryManager.getDiagnostics()
        });
        break;
    }
  });
}

/**
 * Get HTML content for the logs viewer
 */
function getLogsViewerHtml(projectName: string, projectId: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #cccccc;
      background-color: #1e1e1e;
      margin: 0;
      padding: 24px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #333333;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    
    h1 {
      font-size: 20px;
      color: #61affe;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .project-badge {
      background-color: #252526;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid #444444;
    }
    
    .tabs-row {
      display: flex;
      border-bottom: 1px solid #333333;
      margin-bottom: 20px;
    }
    
    .tab-btn {
      background: none;
      border: none;
      color: #888888;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    
    .tab-btn:hover {
      color: #ffffff;
    }
    
    .tab-btn.active {
      color: #61affe;
      border-bottom: 2px solid #61affe;
    }
    
    .tab-view {
      display: none;
    }
    
    .tab-view.active {
      display: block;
    }
    
    .filter-controls {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      align-items: center;
    }
    
    .search-input {
      background-color: #252526;
      border: 1px solid #444444;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 13px;
      flex-grow: 1;
    }
    
    .filter-select {
      background-color: #252526;
      border: 1px solid #444444;
      color: #ffffff;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .terminal-container {
      background-color: #111111;
      border: 1px solid #2d2d2d;
      border-radius: 6px;
      padding: 14px;
      height: 440px;
      overflow-y: auto;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 12px;
      line-height: 1.6;
    }
    
    .log-line {
      margin: 4px 0;
      word-break: break-all;
    }
    
    .lvl-info { color: #4dabf7; font-weight: bold; }
    .lvl-success { color: #98c379; font-weight: bold; }
    .lvl-warning { color: #ffd43b; font-weight: bold; }
    .lvl-error { color: #ff6b6b; font-weight: bold; }
    .msg-timestamp { color: #666666; margin-right: 6px; }
    .msg-mod { color: #ec4899; margin-right: 6px; }
    
    .diagnostic-card {
      background-color: #252526;
      border: 1px solid #333333;
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .diag-title {
      font-weight: 600;
      font-size: 14px;
      color: #f0f0f0;
    }
    
    .diag-desc {
      font-size: 12px;
      color: #a6acaf;
      margin-top: 4px;
    }
    
    .badge-pass { background-color: #2e7d32; color: #e0e0e0; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .badge-fail { background-color: #c62828; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .badge-pending { background-color: #37474f; color: #bbbbbb; padding: 4px 10px; border-radius: 4px; font-size: 11px; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .metric-card {
      background-color: #252526;
      border: 1px solid #333333;
      border-radius: 6px;
      padding: 20px 16px;
      text-align: center;
    }
    
    .metric-val {
      font-size: 28px;
      font-weight: bold;
      color: #61affe;
      margin-top: 10px;
    }
    
    .metric-lbl {
      font-size: 12px;
      color: #a6acaf;
    }
    
    .btn-action {
      background-color: #007acc;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-action:hover { background-color: #0062a3; }
  </style>
</head>
<body>

  <div class="header">
    <h1>📋 AppForge Cockpit Monitor</h1>
    <div class="project-badge">
      <strong>Active:</strong> ${projectName} <code style="color:#888;">(${projectId || "none"})</code>
    </div>
  </div>

  <div class="tabs-row">
    <button class="tab-btn active" onclick="switchView(event, 'view-logs')">Live Logs</button>
    <button class="tab-btn" onclick="switchView(event, 'view-diagnostics')">Diagnostics</button>
    <button class="tab-btn" onclick="switchView(event, 'view-performance')">Performance</button>
    <button class="tab-btn" onclick="switchView(event, 'view-functions')">Function Execution</button>
  </div>

  <div id="view-logs" class="tab-view active">
    <div class="filter-controls">
      <input type="text" id="logSearch" class="search-input" placeholder="Filter log outputs dynamically..." oninput="filterLogs()">
      <select id="logLevelFilter" class="filter-select" onchange="filterLogs()">
        <option value="all">All Levels</option>
        <option value="info">Info</option>
        <option value="success">Success</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </select>
    </div>
    <div id="terminal" class="terminal-container"></div>
  </div>

  <div id="view-diagnostics" class="tab-view">
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:12px; color:#a6acaf;">System assertion records updated dynamically:</span>
      <button class="btn-action" onclick="refreshDiagnostics()">Re-run Diagnostics</button>
    </div>
    <div id="diag-target"></div>
  </div>

  <div id="view-performance" class="tab-view">
    <div class="metrics-grid" id="metrics-target"></div>
  </div>

  <div id="view-functions" class="tab-view">
    <div id="func-logs-target" class="terminal-container" style="height:420px;">
      <div style="color:#555; text-align:center; padding-top:100px;">No function execution context loaded yet. Use "View Function Logs" in the sidebar tree.</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let logsHistory = [];

    // Initialize state pull
    vscode.postMessage({ command: "requestInitialState" });

    function switchView(evt, targetId) {
      document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(targetId).classList.add('active');
      evt.target.classList.add('active');
    }

    function refreshDiagnostics() {
      document.getElementById('diag-target').innerHTML = '<div style="color:#666; padding:20px;">Evaluating endpoint health vectors...</div>';
      vscode.postMessage({ command: "triggerDiagnosticsRefresh" });
    }

    function buildLineHtml(log) {
      return \`<div class="log-line" data-level="\${log.level}">
        <span class="msg-timestamp">[\${log.timestamp}]</span>
        <span class="lvl-\${log.level}">[\${log.level.toUpperCase()}]</span>
        <span class="msg-mod">[\${log.module}]</span>
        <span class="msg-text">\${log.message}</span>
      </div>\`;
    }

    function filterLogs() {
      const query = document.getElementById('logSearch').value.toLowerCase();
      const level = document.getElementById('logLevelFilter').value;
      const nodes = document.querySelectorAll('#terminal .log-line');

      nodes.forEach(node => {
        const text = node.textContent.toLowerCase();
        const nodeLevel = node.getAttribute('data-level');
        const matchQuery = text.includes(query);
        const matchLevel = level === 'all' || nodeLevel === level;

        node.style.display = (matchQuery && matchLevel) ? 'block' : 'none';
      });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      
      if (msg.command === 'loadFullState') {
        logsHistory = msg.logs;
        const term = document.getElementById('terminal');
        term.innerHTML = logsHistory.map(buildLineHtml).join('');
        term.scrollTop = term.scrollHeight;
        filterLogs();

        renderDiagnosticsCards(msg.diagnostics);
        renderMetricsCards(msg.metrics);
      }
      
      else if (msg.command === 'appendTelemetryLog') {
        logsHistory.push(msg.log);
        const term = document.getElementById('terminal');
        const autoScroll = term.scrollHeight - term.clientHeight <= term.scrollTop + 40;
        
        term.insertAdjacentHTML('beforeend', buildLineHtml(msg.log));
        if (autoScroll) {
          term.scrollTop = term.scrollHeight;
        }
        filterLogs();
      }

      else if (msg.command === 'updatePerformanceMetrics') {
        renderMetricsCards(msg.metrics);
      }

      else if (msg.command === 'updateDiagnosticTab') {
        renderDiagnosticsCards(msg.diagnostics);
      }

      else if (msg.command === 'updateFunctionLogs') {
        const target = document.getElementById('func-logs-target');
        if (!msg.logs || msg.logs.length === 0) {
          target.innerHTML = '<div style="color:#666; padding:20px; text-align:center;">This function has no historic executions.</div>';
          return;
        }
        target.innerHTML = \`<table style="width:100%; text-align:left; border-collapse:collapse; font-size:12px;">
          <tr style="color:#888; border-bottom:1px solid #333;">
            <th style="padding:8px;">Execution ID</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Created Time</th>
            <th>Errors</th>
          </tr>
          \${msg.logs.map(l => \`
            <tr style="border-bottom:1px solid #252526; color:\${l.status === 'failed' ? '#ff6b6b' : '#e0e0e0'}">
              <td style="padding:8px; font-family:monospace; color:#61affe;">\${l.id}</td>
              <td><strong>\${l.status.toUpperCase()}</strong></td>
              <td>\${l.duration}ms</td>
              <td>\${l.createdAt}</td>
              <td style="color:#ff6b6b;">\${l.errors || '-'}</td>
            </tr>
          \`).join('')}
        </table>\`;
      }
    });

    function renderDiagnosticsCards(diags) {
      const target = document.getElementById('diag-target');
      if (!diags) return;
      
      const workflow = [
        { key: 'projectLoaded', label: 'Project Loaded' },
        { key: 'endpointReachable', label: 'Endpoint Reachable' },
        { key: 'databasesAccessible', label: 'Databases Accessible' },
        { key: 'functionsAccessible', label: 'Functions Accessible' },
        { key: 'storageAccessible', label: 'Storage Accessible' }
      ];

      target.innerHTML = workflow.map(item => {
        const node = diags[item.key] || { status: 'pending', details: 'Awaiting verification' };
        const badge = node.status === 'pass' ? 'badge-pass' : (node.status === 'fail' ? 'badge-fail' : 'badge-pending');
        const label = node.status === 'pass' ? '✓ PASS' : (node.status === 'fail' ? '× FAIL' : 'PENDING');
        
        return \`<div class="diagnostic-card" style="border-left: 4px solid \${node.status === 'pass' ? '#2e7d32' : (node.status === 'fail' ? '#c62828' : '#37474f')}">
          <div>
            <div class="diag-title">\${item.label}</div>
            <div class="diag-desc">\${node.details}</div>
          </div>
          <span class="\${badge}">\${label}</span>
        </div>\`;
      }).join('');
    }

    function renderMetricsCards(m) {
      const target = document.getElementById('metrics-target');
      if (!m) return;

      const dataset = [
        { val: m.databaseLoadDuration ? \`\${m.databaseLoadDuration}ms\` : '0ms', label: 'Database Load Duration' },
        { val: m.functionLoadDuration ? \`\${m.functionLoadDuration}ms\` : '0ms', label: 'Function Load Duration' },
        { val: m.storageLoadDuration ? \`\${m.storageLoadDuration}ms\` : '0ms', label: 'Storage Load Duration' },
        { val: m.averageResponseTime ? \`\${m.averageResponseTime}ms\` : '0ms', label: 'Average API Response Time' },
        { val: m.failedRequestsCount || 0, label: 'Failed Requests Count', color: m.failedRequestsCount > 0 ? '#ff6b6b' : '#98c379' }
      ];

      target.innerHTML = dataset.map(item => \`
        <div class="metric-card">
          <div class="metric-lbl">\place\${item.label}</div>
          <div class="metric-val" style="color:\${item.color || '#61affe'}">\${item.val}</div>
        </div>
      \`).join('');
    }
  </script>
</body>
</html>
  `;
}