/**
 * Setup Guide Panel
 * Persistent webview panel that guides users through Appwrite project setup
 * Stays open while users retrieve credentials from browser
 */

import * as vscode from "vscode";
import * as path from "path";

export class SetupGuidePanel {
  public static currentPanel: SetupGuidePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ): void {
    if (SetupGuidePanel.currentPanel) {
      SetupGuidePanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "appforgeSetupGuide",
      "AppForge Setup Guide",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    SetupGuidePanel.currentPanel = new SetupGuidePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables,
    );

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _handleMessage(message: any): void {
    switch (message.command) {
      case "openUrl":
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;
      case "copyToClipboard":
        vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage(`Copied: ${message.label}`);
        break;
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const appforgeIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "appforge.png"),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AppForge Setup Guide</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 500px;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }
        .header img {
            width: 48px;
            height: 48px;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
        }
        .step {
            background-color: var(--vscode-editorGroup-border);
            border-left: 3px solid var(--vscode-inputValidation-infoForeground);
            padding: 16px;
            margin-bottom: 16px;
            border-radius: 4px;
        }
        .step.active {
            border-left-color: #007ACC;
            background-color: var(--vscode-editor-selectionBackground);
        }
        .step-number {
            display: inline-block;
            background-color: #007ACC;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            text-align: center;
            line-height: 24px;
            font-weight: bold;
            margin-right: 8px;
            font-size: 12px;
        }
        .step-title {
            font-weight: 600;
            margin-bottom: 8px;
        }
        .step-description {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
        }
        .button-group {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .button {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .info-box {
            background-color: var(--vscode-inputValidation-infoBorder);
            border: 1px solid var(--vscode-inputValidation-infoForeground);
            padding: 12px;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 12px;
        }
        .code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 12px;
        }
        .divider {
            border-top: 1px solid var(--vscode-editorGroup-border);
            margin: 20px 0;
        }
        .footer {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 20px;
        }
        a {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${appforgeIconUri}" alt="AppForge Logo">
            <h1>Setup Guide</h1>
        </div>

        <p>Follow these steps to add your Appwrite project. Keep this guide open while you get the required information from your Appwrite console.</p>

        <div class="step active">
            <div class="step-title">
                <span class="step-number">1</span>
                Get Your Project Information
            </div>
            <div class="step-description">
                You'll need: Project Name, Endpoint URL, and Project ID from your Appwrite console.
            </div>
            <div class="button-group">
                <button class="button" onclick="openUrl('https://appwrite.io/console')">
                    Open Appwrite Console
                </button>
            </div>
            <div class="info-box">
                💡 Tip: Log in to your Appwrite account and navigate to your project.
            </div>
        </div>

        <div class="step">
            <div class="step-title">
                <span class="step-number">2</span>
                Create an API Key
            </div>
            <div class="step-description">
                Generate a new API Key with Database and Functions access.
            </div>
            <div class="button-group">
                <button class="button" onclick="openUrl('https://appwrite.io/docs/authentication-api-keys')">
                    API Keys Documentation
                </button>
            </div>
            <div class="info-box">
                💡 Scopes needed: <span class="code">databases.read</span>, <span class="code">functions.read</span>
            </div>
        </div>

        <div class="step">
            <div class="step-title">
                <span class="step-number">3</span>
                Start Setup in VS Code
            </div>
            <div class="step-description">
                Run the "Add Project" command in the AppForge panel (you'll be prompted for the information you gathered).
            </div>
            <div class="button-group">
                <button class="button secondary" onclick="copyCommand('AppForge: Add Project')">
                    Copy Command
                </button>
            </div>
            <div class="info-box">
                ⌘/Ctrl + Shift + P then type "AppForge: Add Project"
            </div>
        </div>

        <div class="step">
            <div class="step-title">
                <span class="step-number">4</span>
                Fill In Your Information
            </div>
            <div class="step-description">
                When prompted, enter:
            </div>
            <ul style="margin: 8px 0; padding-left: 24px; font-size: 13px;">
                <li><strong>Project Name</strong> - Display name for your project</li>
                <li><strong>Endpoint URL</strong> - https://your-appwrite-instance.com/v1</li>
                <li><strong>Project ID</strong> - Found in console settings</li>
                <li><strong>API Key</strong> - Generated from API Keys section</li>
            </ul>
            <div class="info-box">
                ⚠️ Your API Key is securely stored locally and never shared.
            </div>
        </div>

        <div class="divider"></div>

        <div class="footer">
            <p>Need help? Check the <a onclick="openUrl('https://appwrite.io/docs')">Appwrite documentation</a></p>
            <p>Questions? Visit the <a onclick="openUrl('https://discord.gg/appwrite')">Appwrite Discord community</a></p>
        </div>
    </div>

    <script>
        function openUrl(url) {
            vscode.postMessage({ command: 'openUrl', url: url });
        }

        function copyCommand(text) {
            vscode.postMessage({ command: 'copyToClipboard', text: text, label: 'Command' });
        }

        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
  }

  public dispose(): void {
    SetupGuidePanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
