/**
 * Logs Viewer Panel
 * Displays function execution logs and performance metrics
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";

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

  const activeProject = projectStorage.getProjectById(
    projectStorage.getActiveProjectId() || "",
  );

  const projectName = activeProject?.projectName || "";
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

  panel.webview.html = getLogsViewerHtml(safeProjectName);
  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "refresh":
        panel.webview.postMessage({
          command: "updateLogs",
          logs: getPlaceholderLogs(),
        });
        break;
      case "openConsole":
        await vscode.commands.executeCommand("appforge.openAppwriteConsole");
        break;
    }
  });

  // Send initial logs
  panel.webview.postMessage({
    command: "updateLogs",
    logs: getPlaceholderLogs(),
  });
}

/**
 * Get HTML content for the logs viewer
 */
function getLogsViewerHtml(projectName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      color: #e0e0e0;
      background-color: #1e1e1e;
      margin: 0;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      color: #61affe;
      margin-top: 0;
      border-bottom: 2px solid #61affe;
      padding-bottom: 10px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .project-info {
      background-color: #252526;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      margin-left: 8px;
    }
    
    .status-coming {
      background-color: #414e24;
      color: #98c379;
    }
    
    .features {
      background-color: #252526;
      border-left: 3px solid #61affe;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    
    .features h3 {
      margin-top: 0;
      color: #61affe;
      font-size: 14px;
    }
    
    .features ul {
      list-style: none;
      padding-left: 0;
      margin: 10px 0;
    }
    
    .features li {
      padding: 6px 0;
      color: #a6acaf;
      font-size: 13px;
    }
    
    .features li:before {
      content: "✓ ";
      color: #98c379;
      margin-right: 8px;
      font-weight: bold;
    }
    
    .placeholder {
      background-color: #252526;
      padding: 20px;
      border-radius: 4px;
      text-align: center;
      color: #a6acaf;
      margin: 20px 0;
    }
    
    .placeholder-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    
    .console-link {
      display: inline-block;
      margin-top: 12px;
      padding: 8px 16px;
      background-color: #61affe;
      color: #1e1e1e;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
    }
    
    .console-link:hover {
      background-color: #82c4ff;
    }
    
    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid #3e3e42;
      margin: 20px 0 0 0;
    }
    
    .tab {
      padding: 12px 16px;
      cursor: pointer;
      background-color: #1e1e1e;
      color: #a6acaf;
      border: none;
      font-size: 13px;
      border-bottom: 2px solid transparent;
    }
    
    .tab.active {
      color: #61affe;
      border-bottom: 2px solid #61affe;
    }
    
    .tab-content {
      display: none;
      padding: 16px;
      background-color: #252526;
      border-radius: 0 0 4px 4px;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .log-entry {
      padding: 8px 0;
      border-bottom: 1px solid #3e3e42;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    
    .log-entry:last-child {
      border-bottom: none;
    }
    
    .log-timestamp {
      color: #858585;
      margin-right: 8px;
    }
    
    .log-level-info {
      color: #4dabf7;
    }
    
    .log-level-error {
      color: #ff6b6b;
    }
    
    .log-level-warning {
      color: #ffd43b;
    }
    
    .log-message {
      color: #a6acaf;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 AppForge Logs Viewer</h1>
      <div class="project-info">
        <strong>Project:</strong> ${projectName}
        <span class="status-badge status-coming">v0.2.1-alpha</span>
      </div>
    </div>
    
    <div class="features">
      <h3>Coming in v0.2.1-alpha</h3>
      <ul>
        <li>Function execution history with detailed traces</li>
        <li>Real-time log streams and live monitoring</li>
        <li>Performance metrics and latency analysis</li>
        <li>Error details with stack traces</li>
        <li>Advanced filtering and search capabilities</li>
        <li>Log export and integration options</li>
      </ul>
    </div>
    
    <div class="placeholder">
      <div class="placeholder-icon">🚀</div>
      <p><strong>Logs Viewer</strong> is coming soon!</p>
      <p style="margin-bottom: 16px;">For now, view function logs and metrics in your Appwrite Console.</p>
      <a href="#" class="console-link" onclick="vscode.postMessage({command: 'openConsole'})">Open Appwrite Console</a>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('overview')">Overview</button>
      <button class="tab" onclick="showTab('logs')">Sample Logs</button>
      <button class="tab" onclick="showTab('metrics')">Performance Metrics</button>
    </div>
    
    <div id="overview" class="tab-content active">
      <h4 style="color: #61affe; margin-top: 0;">Feature Overview</h4>
      <p>The Logs Viewer will provide:</p>
      <ul style="color: #a6acaf;">
        <li><strong>Execution History:</strong> Browse complete history of function executions with timestamps</li>
        <li><strong>Real-time Streams:</strong> Live view of running functions with status updates</li>
        <li><strong>Performance Data:</strong> Memory usage, CPU time, and execution duration metrics</li>
        <li><strong>Error Analysis:</strong> Detailed error information with full stack traces</li>
      </ul>
    </div>
    
    <div id="logs" class="tab-content">
      <h4 style="color: #61affe; margin-top: 0;">Sample Log Format</h4>
      <div id="log-container">
        <!-- Logs will be inserted here -->
      </div>
    </div>
    
    <div id="metrics" class="tab-content">
      <h4 style="color: #61affe; margin-top: 0;">Performance Metrics (Coming Soon)</h4>
      <p style="color: #a6acaf;">
        Performance metrics will include:
      </p>
      <ul style="color: #a6acaf;">
        <li><strong>Execution Time:</strong> Total duration of function execution</li>
        <li><strong>Memory Usage:</strong> Peak and average memory consumption</li>
        <li><strong>CPU Usage:</strong> Processor utilization percentage</li>
        <li><strong>Network I/O:</strong> Bytes in/out metrics</li>
        <li><strong>Cold Start Time:</strong> Time to initialize new instances</li>
      </ul>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    function showTab(tabName) {
      const tabs = document.querySelectorAll('.tab');
      const contents = document.querySelectorAll('.tab-content');
      
      tabs.forEach(tab => tab.classList.remove('active'));
      contents.forEach(content => content.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    }
    
    // Render sample logs
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'updateLogs') {
        const logContainer = document.getElementById('log-container');
        logContainer.innerHTML = message.logs.map(log => 
          \`<div class="log-entry">
            <span class="log-timestamp">[\${log.timestamp}]</span>
            <span class="log-level-\${log.level}">[\${log.level.toUpperCase()}]</span>
            <span class="log-message">\${log.message}</span>
          </div>\`
        ).join('');
      }
    });
  </script>
</body>
</html>
  `;
}

/**
 * Get placeholder logs for demonstration
 */
function getPlaceholderLogs(): Array<{
  timestamp: string;
  level: string;
  message: string;
}> {
  return [
    {
      timestamp: new Date().toISOString().split("T")[1].split("Z")[0],
      level: "info",
      message: "Function execution started",
    },
    {
      timestamp: new Date(Date.now() + 100)
        .toISOString()
        .split("T")[1]
        .split("Z")[0],
      level: "info",
      message: "Initializing dependencies",
    },
    {
      timestamp: new Date(Date.now() + 200)
        .toISOString()
        .split("T")[1]
        .split("Z")[0],
      level: "info",
      message: "Processing request",
    },
    {
      timestamp: new Date(Date.now() + 300)
        .toISOString()
        .split("T")[1]
        .split("Z")[0],
      level: "info",
      message: "Execution completed successfully",
    },
  ];
}
