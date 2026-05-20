/**
 * Function Management Commands
 * Handles: Execute Function, Deploy Function, View Logs
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import type { Runtime } from "node-appwrite";

/**
 * Register function-related commands
 */
export function registerFunctionCommands(
  context: vscode.ExtensionContext,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
): void {
  // Execute Function
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.executeFunction",
      async (functionId: string, projectId: string) => {
        await executeFunctionCommand(appwriteClient, functionId, projectId);
      },
    ),
  );

  // Deploy Function
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.deployFunction",
      async (functionId?: string) => {
        await deployFunctionCommand(appwriteClient, treeProvider);
      },
    ),
  );

  // View Logs
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewLogs",
      async (projectId: string) => {
        await viewLogsCommand(appwriteClient, projectId);
      },
    ),
  );
}

/**
 * Execute a function
 */
async function executeFunctionCommand(
  appwriteClient: AppwriteClientService,
  functionId: string,
  projectId: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    // Get execution data from user (optional JSON)
    const dataInput = await vscode.window.showInputBox({
      placeHolder: '{ "key": "value" } (optional)',
      prompt: "Enter function input as JSON (leave empty for no input)",
      validateInput: (value) => {
        if (!value.trim()) {
          return "";
        }
        try {
          JSON.parse(value);
          return "";
        } catch {
          return "Invalid JSON format";
        }
      },
    });

    let data = "";
    if (dataInput && dataInput.trim()) {
      data = dataInput;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Executing function ${functionId}...`,
        cancellable: false,
      },
      async () => {
        try {
          const functions = appwriteClient.getFunctions();
          const execution = await functions.createExecution(functionId, data);

          // Show execution result
          const resultMessage = `✓ Execution complete\n\nStatus: ${execution.status}\nOutput: ${execution.responseBody || "(no output)"}`;
          vscode.window.showInformationMessage(resultMessage);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to execute function: ${message}`,
          );
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

/**
 * Deploy a function from local folder
 */
async function deployFunctionCommand(
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    // Step 1: Get function details
    const functionId = await vscode.window.showInputBox({
      placeHolder: "my-function",
      prompt: "Enter function ID (lowercase, no spaces)",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Function ID cannot be empty";
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Only lowercase letters, numbers, and hyphens allowed";
        }
        return "";
      },
    });

    if (!functionId) {
      return;
    }

    const functionName = await vscode.window.showInputBox({
      placeHolder: "My Function",
      prompt: "Enter function name",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Function name cannot be empty";
        }
        return "";
      },
    });

    if (!functionName) {
      return;
    }

    // Step 2: Select runtime
    const runtime = await vscode.window.showQuickPick(
      [
        { label: "Node.js 21", value: "node-21.0" },
        { label: "Node.js 20", value: "node-20.0" },
        { label: "Node.js 19", value: "node-19.0" },
        { label: "Python 3.11", value: "python-3.11" },
        { label: "Python 3.10", value: "python-3.10" },
        { label: "Deno 1.40", value: "deno-1.40" },
      ],
      { placeHolder: "Select runtime environment" },
    );

    if (!runtime) {
      return;
    }

    // Step 3: Select folder
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: "Select folder with function code",
    });

    if (!folders || folders.length === 0) {
      return;
    }

    const folderPath = folders[0].fsPath;

    // Verify folder has code
    const hasCode =
      fs.existsSync(path.join(folderPath, "index.js")) ||
      fs.existsSync(path.join(folderPath, "index.ts")) ||
      fs.existsSync(path.join(folderPath, "index.py")) ||
      fs.existsSync(path.join(folderPath, "src"));

    if (!hasCode) {
      vscode.window.showErrorMessage(
        "No code found. Ensure folder contains index.js/ts/py or src/ directory.",
      );
      return;
    }

    // Step 4: Get environment variables (optional)
    const envInput = await vscode.window.showInputBox({
      placeHolder: "KEY1=value1,KEY2=value2",
      prompt:
        "Enter environment variables (comma-separated KEY=value pairs, optional)",
    });

    const envVars: Record<string, string> = {};
    if (envInput && envInput.trim()) {
      envInput.split(",").forEach((pair) => {
        const [key, value] = pair.trim().split("=");
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      });
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Creating and deploying function...",
        cancellable: false,
      },
      async () => {
        try {
          const functions = appwriteClient.getFunctions();

          // Create the function
          let functionObj;
          try {
            functionObj = await functions.create(
              functionId,
              functionName,
              runtime.value as Runtime,
            );
          } catch (createError) {
            // Function might already exist
            if (
              createError instanceof Error &&
              createError.message.includes("already exists")
            ) {
              vscode.window.showInformationMessage(
                `Function '${functionId}' already exists. Updating...`,
              );
            } else {
              throw createError;
            }
          }

          // Show deployment info
          const channel = vscode.window.createOutputChannel(
            "AppForge - Function Deploy",
          );
          channel.clear();
          channel.appendLine(`✓ Function Created/Updated: ${functionName}`);
          channel.appendLine(`ID: ${functionId}`);
          channel.appendLine(`Runtime: ${runtime.value}`);
          channel.appendLine(`Folder: ${folderPath}\n`);

          if (Object.keys(envVars).length > 0) {
            channel.appendLine("Environment Variables:");
            Object.entries(envVars).forEach(([key, value]) => {
              channel.appendLine(`  ${key}=${value}`);
            });
            channel.appendLine("");
          }

          channel.appendLine("Next steps:");
          channel.appendLine("1. Install dependencies in your function folder");
          channel.appendLine("2. Use Appwrite CLI to deploy: appwrite deploy");
          channel.appendLine("3. Or use Appwrite console to upload code");
          channel.appendLine("");
          channel.appendLine(
            "For more info: https://appwrite.io/docs/functions",
          );

          channel.show(vscode.ViewColumn.Beside);
          treeProvider.refresh();

          vscode.window.showInformationMessage(
            `✓ Function '${functionName}' is ready to deploy!`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to deploy function: ${message}`,
          );
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

/**
 * View function execution logs
 */
async function viewLogsCommand(
  appwriteClient: AppwriteClientService,
  projectId: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    // For alpha, show placeholder
    const message = `Logs View
    
This feature will show:
- Function execution history
- Real-time log streams
- Performance metrics
- Error details

Coming in v0.2.0 with full log viewer UI.

For now, view logs in your Appwrite console.`;

    vscode.window.showInformationMessage(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}
