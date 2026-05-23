/**
 * Project Setup Panel
 * Persistent webview for adding Appwrite projects
 * Maintains state while users switch to browser
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { refreshManager } from "../core/refresh/refreshManager";
import { ProjectConfigSchema, ApiKeySchema } from "../utils/validators";
import { ZodError } from "zod";

export class ProjectSetupPanel {
  public static currentPanel: ProjectSetupPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private projectStorage: ProjectStorageService,
    private appwriteClient: AppwriteClientService,
    private treeProvider: AppForgeTreeDataProvider,
  ) {
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

  public static createOrShow(
    extensionUri: vscode.Uri,
    projectStorage: ProjectStorageService,
    appwriteClient: AppwriteClientService,
    treeProvider: AppForgeTreeDataProvider,
  ): void {
    if (ProjectSetupPanel.currentPanel) {
      ProjectSetupPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "appforgeProjectSetup",
      "Add Appwrite Project",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "assets")],
      },
    );

    panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      "assets",
      "appforge.png",
    );

    ProjectSetupPanel.currentPanel = new ProjectSetupPanel(
      panel,
      extensionUri,
      projectStorage,
      appwriteClient,
      treeProvider,
    );
  }

  private async _handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case "openConsole":
        await vscode.env.openExternal(
          vscode.Uri.parse("https://appwrite.io/console"),
        );
        break;

      case "testConnection":
        await this._testConnection(
          message.endpoint,
          message.projectId,
          message.apiKey,
        );
        break;

      case "saveProject":
        await this._saveProject(
          message.projectName,
          message.endpoint,
          message.projectId,
          message.apiKey,
        );
        break;
    }
  }

  private async _testConnection(
    endpoint: string,
    projectId: string,
    apiKey: string,
  ): Promise<void> {
    try {
      this._panel.webview.postMessage({
        command: "testingConnection",
      });

      // Validate inputs before testing
      if (!endpoint.trim() || !projectId.trim() || !apiKey.trim()) {
        this._panel.webview.postMessage({
          command: "connectionFailed",
          error: "Please fill in all fields before testing",
        });
        return;
      }

      // Create temporary client to test
      const tempClient = AppwriteClientService.getInstance();
      tempClient.initialize(
        {
          projectName: "Test",
          endpoint,
          projectId,
        },
        apiKey,
      );

      // Lightweight test: try to list databases (safe read-only operation)
      // This doesn't require special scopes like account.get() does
      const databases = tempClient.getDatabases();
      await databases.list();

      this._panel.webview.postMessage({
        command: "connectionSuccess",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      this._panel.webview.postMessage({
        command: "connectionFailed",
        error: errorMessage,
      });
    }
  }

  private async _saveProject(
    projectName: string,
    endpoint: string,
    projectId: string,
    apiKey: string,
  ): Promise<void> {
    try {
      // Validate using Zod schemas
      ProjectConfigSchema.parse({ projectName, endpoint, projectId });
      ApiKeySchema.parse(apiKey);

      this._panel.webview.postMessage({
        command: "saving",
      });

      // Store project
      await this.projectStorage.addProject(
        projectName,
        endpoint,
        projectId,
        apiKey,
      );

      // Initialize client
      const projects = this.projectStorage.getProjects();
      if (projects.length === 1) {
        const projectWithKey =
          await this.projectStorage.getActiveProjectWithApiKey();
        if (projectWithKey) {
          this.appwriteClient.initialize(projectWithKey, projectWithKey.apiKey);
        }
      }

      // Refresh tree through the refresh manager so expansion state is preserved
      refreshManager.queueRefresh("all");

      // Show success and close
      this._panel.webview.postMessage({
        command: "saveSuccess",
      });

      vscode.window.showInformationMessage(
        `✓ Project "${projectName}" added successfully!`,
      );

      // Close panel after brief delay
      setTimeout(() => {
        if (ProjectSetupPanel.currentPanel) {
          ProjectSetupPanel.currentPanel.dispose();
        }
      }, 1500);
    } catch (error) {
      let errorMessage = "Failed to save project";

      if (error instanceof ZodError) {
        const messages = error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        errorMessage = messages;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this._panel.webview.postMessage({
        command: "saveFailed",
        error: errorMessage,
      });
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
    <title>Add Appwrite Project</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px;
            line-height: 1.6;
        }

        .container {
            max-width: 500px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 28px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-editorGroup-border);
        }

        .header img {
            width: 40px;
            height: 40px;
        }

        .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        label .required {
            color: #f48771;
            margin-left: 2px;
        }

        input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            transition: border-color 0.2s;
        }

        input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            line-height: 1.4;
        }

        .validation-error {
            font-size: 11px;
            color: #f48771;
            margin-top: 4px;
            display: none;
        }

        .validation-error.show {
            display: block;
        }

        .form-group.error input {
            border-color: #f48771;
        }

        .info-box {
            background-color: var(--vscode-inputValidation-infoBorder);
            border: 1px solid var(--vscode-inputValidation-infoForeground);
            border-radius: 3px;
            padding: 12px;
            margin-bottom: 20px;
            font-size: 12px;
            line-height: 1.5;
        }

        .info-box strong {
            display: block;
            margin-bottom: 4px;
        }

        .button-group {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }

        .button {
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            font-family: var(--vscode-font-family);
        }

        .button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .button.primary:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            flex: 0 0 auto;
        }

        .button.secondary:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .status-message {
            padding: 12px;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 20px;
            display: none;
        }

        .status-message.show {
            display: block;
        }

        .status-message.success {
            background-color: rgba(89, 193, 123, 0.1);
            border: 1px solid #59c17b;
            color: #59c17b;
        }

        .status-message.error {
            background-color: rgba(244, 135, 113, 0.1);
            border: 1px solid #f48771;
            color: #f48771;
        }

        .status-message.info {
            background-color: var(--vscode-inputValidation-infoBorder);
            border: 1px solid var(--vscode-inputValidation-infoForeground);
            color: var(--vscode-inputValidation-infoForeground);
        }

        .spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
            margin-right: 6px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .footer {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-editorGroup-border);
        }

        .footer a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        .divider {
            height: 1px;
            background-color: var(--vscode-editorGroup-border);
            margin: 16px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${appforgeIconUri}" alt="AppForge">
            <h1>Add Project</h1>
        </div>

        <div id="statusMessage" class="status-message"></div>

        <div class="info-box">
            <strong>ℹ️ Keep This Open</strong>
            You can safely switch to your Appwrite console to copy credentials. This form won't close.
        </div>

        <form id="setupForm">
            <div class="form-group">
                <label for="projectName">
                    Project Name
                    <span class="required">*</span>
                </label>
                <input
                    type="text"
                    id="projectName"
                    placeholder="e.g., My Awesome App"
                    required
                >
                <div class="help-text">Display name for your project</div>
                <div class="validation-error"></div>
            </div>

            <div class="form-group">
                <label for="endpoint">
                    Endpoint
                    <span class="required">*</span>
                </label>
                <input
                    type="text"
                    id="endpoint"
                    placeholder="https://appwrite.example.com/v1"
                    required
                >
                <div class="help-text">Your Appwrite server endpoint URL</div>
                <div class="validation-error"></div>
            </div>

            <div class="form-group">
                <label for="projectId">
                    Project ID
                    <span class="required">*</span>
                </label>
                <input
                    type="text"
                    id="projectId"
                    placeholder="e.g., 670a5f2f84c92"
                    required
                >
                <div class="help-text">Found in your Appwrite console settings</div>
                <div class="validation-error"></div>
            </div>

            <div class="form-group">
                <label for="apiKey">
                    API Key
                    <span class="required">*</span>
                </label>
                <input
                    type="password"
                    id="apiKey"
                    placeholder="••••••••••••••••"
                    required
                >
                <div class="help-text">API key with database and function access</div>
                <div class="validation-error"></div>
            </div>

            <div class="divider"></div>

            <div class="button-group">
                <button type="button" id="testBtn" class="button secondary">
                    Test Connection
                </button>
                <button type="submit" id="saveBtn" class="button primary">
                    Save Project
                </button>
            </div>

            <div class="button-group">
                <button type="button" id="consoleBtn" class="button secondary" style="flex: 1;">
                    Open Appwrite Console
                </button>
            </div>
        </form>

        <div class="footer">
            <p>
                Need help?
                <a href="#" onclick="openDocumentation(); return false;">
                    View documentation
                </a>
            </p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const form = document.getElementById('setupForm');
        const projectNameInput = document.getElementById('projectName');
        const endpointInput = document.getElementById('endpoint');
        const projectIdInput = document.getElementById('projectId');
        const apiKeyInput = document.getElementById('apiKey');
        const testBtn = document.getElementById('testBtn');
        const saveBtn = document.getElementById('saveBtn');
        const consoleBtn = document.getElementById('consoleBtn');
        const statusMessage = document.getElementById('statusMessage');

        // Store form data for persistence
        const formData = {
            projectName: localStorage.getItem('appforge_projectName') || '',
            endpoint: localStorage.getItem('appforge_endpoint') || '',
            projectId: localStorage.getItem('appforge_projectId') || '',
            apiKey: localStorage.getItem('appforge_apiKey') || '',
        };

        // Restore form data
        projectNameInput.value = formData.projectName;
        endpointInput.value = formData.endpoint;
        projectIdInput.value = formData.projectId;
        apiKeyInput.value = formData.apiKey;

        // Auto-save form data as user types
        [projectNameInput, endpointInput, projectIdInput, apiKeyInput].forEach(input => {
            input.addEventListener('input', (e) => {
                const key = 'appforge_' + e.target.id;
                localStorage.setItem(key, e.target.value);
            });
        });

        // Test connection
        testBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            clearValidationErrors();
            
            if (!validateFields()) {
                return;
            }

            testBtn.disabled = true;
            saveBtn.disabled = true;
            showStatus('Testing connection...', 'info');

            vscode.postMessage({
                command: 'testConnection',
                endpoint: endpointInput.value.trim(),
                projectId: projectIdInput.value.trim(),
                apiKey: apiKeyInput.value.trim(),
            });
        });

        // Save project
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearValidationErrors();
            
            if (!validateFields()) {
                return;
            }

            testBtn.disabled = true;
            saveBtn.disabled = true;
            showStatus('Saving project...', 'info');

            vscode.postMessage({
                command: 'saveProject',
                projectName: projectNameInput.value.trim(),
                endpoint: endpointInput.value.trim(),
                projectId: projectIdInput.value.trim(),
                apiKey: apiKeyInput.value.trim(),
            });
        });

        // Open console
        consoleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({
                command: 'openConsole',
            });
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
                case 'testingConnection':
                    showStatus('Testing connection...', 'info');
                    break;
                case 'connectionSuccess':
                    showStatus('✓ Connection successful!', 'success');
                    testBtn.disabled = false;
                    saveBtn.disabled = false;
                    break;
                case 'connectionFailed':
                    showStatus('✗ Connection failed: ' + message.error, 'error');
                    testBtn.disabled = false;
                    saveBtn.disabled = false;
                    break;
                case 'saving':
                    showStatus('Saving project...', 'info');
                    break;
                case 'saveSuccess':
                    showStatus('✓ Project saved successfully!', 'success');
                    testBtn.disabled = true;
                    saveBtn.disabled = true;
                    // Clear localStorage after success
                    localStorage.removeItem('appforge_projectName');
                    localStorage.removeItem('appforge_endpoint');
                    localStorage.removeItem('appforge_projectId');
                    localStorage.removeItem('appforge_apiKey');
                    break;
                case 'saveFailed':
                    showStatus('✗ Error: ' + message.error, 'error');
                    testBtn.disabled = false;
                    saveBtn.disabled = false;
                    break;
            }
        });

        function validateFields() {
            let isValid = true;

            // Validate project name
            if (!projectNameInput.value.trim()) {
                showError(projectNameInput, 'Project name required');
                isValid = false;
            } else if (projectNameInput.value.length > 100) {
                showError(projectNameInput, 'Max 100 characters');
                isValid = false;
            }

            // Validate endpoint
            if (!endpointInput.value.trim()) {
                showError(endpointInput, 'Endpoint required');
                isValid = false;
            } else {
                try {
                    new URL(endpointInput.value);
                    if (!endpointInput.value.includes('https://')) {
                        showError(endpointInput, 'Must use HTTPS');
                        isValid = false;
                    }
                } catch {
                    showError(endpointInput, 'Invalid URL format');
                    isValid = false;
                }
            }

            // Validate project ID
            if (!projectIdInput.value.trim()) {
                showError(projectIdInput, 'Project ID required');
                isValid = false;
            }

            // Validate API key
            if (!apiKeyInput.value.trim()) {
                showError(apiKeyInput, 'API key required');
                isValid = false;
            }

            return isValid;
        }

        function showError(input, message) {
            const group = input.closest('.form-group');
            const errorDiv = group.querySelector('.validation-error');
            group.classList.add('error');
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
        }

        function clearValidationErrors() {
            document.querySelectorAll('.form-group').forEach(group => {
                group.classList.remove('error');
                const errorDiv = group.querySelector('.validation-error');
                errorDiv.classList.remove('show');
                errorDiv.textContent = '';
            });
        }

        function showStatus(message, type) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message show ' + type;
        }

        function openDocumentation() {
            vscode.postMessage({
                command: 'openConsole',
            });
        }

        // Focus on first field
        projectNameInput.focus();
    </script>
</body>
</html>`;
  }

  public dispose(): void {
    ProjectSetupPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
