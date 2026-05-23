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
import { EventBus } from "../core/events/eventBus";
import { outputChannel } from "../core/output/outputChannel";
import { FunctionLogsPanel } from "../views/functionLogsPanel";
import { ProjectStorageService } from "../services/projectStorageService";
import { ID } from "node-appwrite";
import { refreshManager } from "../core/refresh/refreshManager";

/**
 * Register function-related commands
 */
export function registerFunctionCommands(
  context: vscode.ExtensionContext,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
  projectStorage: ProjectStorageService,
): void {
  // Execute Function
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.executeFunction",
      async (arg: any, arg2?: any) => {
        let functionId: string, projectId: string;
        if (typeof arg === "string") {
          functionId = arg;
          projectId = arg2 || "";
        } else {
          functionId = arg?.data?.id || "";
          projectId = arg?.data?.projectId || "";
        }
        await executeFunctionCommand(
          appwriteClient,
          projectStorage,
          context,
          functionId,
          projectId,
        );
      },
    ),
  );

  // Deploy Function
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.deployFunction",
      async (functionId?: string) => {
        await deployFunctionCommand(
          appwriteClient,
          treeProvider,
          projectStorage,
          context,
        );
      },
    ),
  );

  // View Logs
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.viewLogs", async (arg: any) => {
      let projectId: string;
      if (typeof arg === "string") {
        projectId = arg;
      } else {
        projectId = arg?.data?.projectId || "";
      }
      await viewLogsCommand(appwriteClient, projectId);
    }),
  );
}

/**
 * Execute a function
 */
async function executeFunctionCommand(
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  context: vscode.ExtensionContext,
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

    const operationId = ID.unique();
    await EventBus.getInstance().emit("operation.started", {
      operationType: "function.execute",
      operationId,
      timestamp: Date.now(),
    });

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Executing function ${functionId}...`,
        cancellable: false,
      },
      async () => {
        try {
          const start = Date.now();
          const functions = appwriteClient.getFunctions();
          const execution = await functions.createExecution(functionId, data);

          outputChannel.success(
            "FUNCTION",
            `Execution completed: ${execution.$id}`,
            { functionId, executionId: execution.$id },
            Date.now() - start,
          );

          // Emit function executed event
          await EventBus.getInstance().emit("function.executed", {
            projectId:
              projectId || appwriteClient.getActiveProject()?.projectId || "",
            functionId,
            status: execution.status,
            timestamp: Date.now(),
          });

          // Auto-open logs panel
          try {
            FunctionLogsPanel.createOrShow(
              context.extensionUri,
              appwriteClient,
              projectStorage,
              projectId || appwriteClient.getActiveProject()?.projectId || "",
              functionId,
              functionId,
            );
          } catch (panelErr) {
            outputChannel.error(
              "FUNCTION",
              "Failed to open FunctionLogsPanel",
              panelErr as Error,
            );
          }

          vscode.window.showInformationMessage(
            `✓ Execution complete — status: ${execution.status}`,
          );
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "function.execute",
            operationId,
            success: true,
            duration: Date.now() - start,
            timestamp: Date.now(),
          });
        } catch (error) {
          outputChannel.error(
            "FUNCTION",
            "Failed to execute function",
            error as Error,
          );
          const message =
            error instanceof Error ? error.message : String(error);
          await EventBus.getInstance().emit("error.occurred", {
            projectId:
              projectId || appwriteClient.getActiveProject()?.projectId,
            operation: "function.execute",
            message,
            error,
            timestamp: Date.now(),
          });
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "function.execute",
            operationId,
            success: false,
            duration: 0,
            timestamp: Date.now(),
          });
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
  projectStorage: ProjectStorageService,
  context: vscode.ExtensionContext,
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

    const operationId = ID.unique();
    await EventBus.getInstance().emit("operation.started", {
      operationType: "function.deploy",
      operationId,
      timestamp: Date.now(),
    });

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
            const start = Date.now();
            functionObj = await functions.create(
              functionId,
              functionName,
              runtime.value as Runtime,
            );
            outputChannel.success(
              "FUNCTION",
              `Function created: ${functionId}`,
              { functionId },
              Date.now() - start,
            );
            await EventBus.getInstance().emit("function.deployed", {
              projectId: appwriteClient.getActiveProject()?.projectId || "",
              functionId,
              name: functionName,
              timestamp: Date.now(),
            });
            await EventBus.getInstance().emit("operation.completed", {
              operationType: "function.deploy",
              operationId,
              success: true,
              duration: Date.now() - start,
              timestamp: Date.now(),
            });
          } catch (createError) {
            // Function might already exist
            if (
              createError instanceof Error &&
              createError.message.includes("already exists")
            ) {
              outputChannel.info(
                "FUNCTION",
                `Function exists, updating: ${functionId}`,
              );
              vscode.window.showInformationMessage(
                `Function '${functionId}' already exists. Updating...`,
              );
            } else {
              throw createError;
            }
          }

          // Show deployment info
          outputChannel.info("FUNCTION", `Function ready: ${functionName}`);
          outputChannel.table("FUNCTION", `Function details: ${functionName}`, [
            { id: functionId, runtime: runtime.value, folder: folderPath },
          ]);

          refreshManager.queueRefresh("functions");
          refreshManager.queueRefresh("logs");

          // Emit logs.updated to trigger logs panel if listening
          await EventBus.getInstance().emit("logs.updated", {
            projectId: appwriteClient.getActiveProject()?.projectId || "",
            functionId,
            logs: [],
            timestamp: Date.now(),
          });

          // Auto-open logs panel after deploy
          try {
            FunctionLogsPanel.createOrShow(
              context.extensionUri,
              appwriteClient,
              projectStorage,
              appwriteClient.getActiveProject()?.projectId || "",
              functionId,
              functionName,
            );
          } catch (panelErr) {
            outputChannel.error(
              "FUNCTION",
              "Failed to open FunctionLogsPanel after deploy",
              panelErr as Error,
            );
          }

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
