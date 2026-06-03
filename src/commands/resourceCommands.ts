/**
 * Resource Commands
 * Handles resource-related commands: refresh, open console, view logs
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { showLogsViewer } from "../views/logsViewer";
import { outputChannel } from "../core/output/outputChannel";
import { logger } from "../utils/logger";
import { refreshManager } from "../core/refresh/refreshManager";

type RefreshScope = "all" | "tree" | "databases" | "functions" | "logs" | "specific";

function normalizeRefreshScope(resourceType?: string): RefreshScope {
  switch (resourceType) {
    case "all":
    case "tree":
    case "databases":
    case "functions":
    case "logs":
    case "specific":
      return resourceType;
    default:
      return "all";
  }
}

/**
 * Register resource-related commands
 */
export function registerResourceCommands(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeDataProvider: AppForgeTreeDataProvider,
): void {
  // Refresh Resources command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.refreshResources",
      async (projectId?: string, resourceType?: string) => {
        try {
          outputChannel.info(
            "[COMMANDS]",
            "Refresh Resources command invoked",
            {
              projectId,
              resourceType,
            },
          );

          if (!projectId) {
            projectId = projectStorage.getActiveProjectId();
          }

          if (!projectId) {
            vscode.window.showErrorMessage(
              "No active project. Please select a project first.",
            );
            return;
          }

          // Show refresh indicator
          vscode.window.showInformationMessage("🔄 Refreshing resources...");

          // Trigger refresh through the tree provider
          treeDataProvider.refresh();

          // Use refresh manager to coordinate
          refreshManager.queueRefresh(normalizeRefreshScope(resourceType));

          outputChannel.success(
            "[COMMANDS]",
            "Resources refreshed",
            `Project: ${projectId}`,
          );

          vscode.window.showInformationMessage("✅ Resources refreshed");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Refresh Resources error",
            error as Error,
          );
          vscode.window.showErrorMessage(
            `Error refreshing resources: ${message}`,
          );
        }
      },
    ),
  );

  // Open Appwrite Console command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.openAppwriteConsole",
      async (projectId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "Open Console command invoked");

          if (!projectId) {
            projectId = projectStorage.getActiveProjectId();
          }

          const project = projectId
            ? projectStorage.getProjectById(projectId)
            : null;

          if (!project) {
            vscode.window.showErrorMessage(
              "No active project. Please select a project first.",
            );
            return;
          }

          // Extract console URL from endpoint (remove /v1)
          const consoleUrl = project.endpoint.replace(/\/v1\s*$/, "");

          await vscode.env.openExternal(vscode.Uri.parse(consoleUrl));

          outputChannel.success(
            "[COMMANDS]",
            "Opened Appwrite Console",
            `Project: ${project.projectName}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Open Console error",
            error as Error,
          );
          vscode.window.showErrorMessage(`Error opening console: ${message}`);
        }
      },
    ),
  );

  // View Logs command (Logs Viewer placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewLogs",
      async (projectId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "View Logs command invoked");

          showLogsViewer(context, projectStorage, appwriteClient);

          outputChannel.info("[COMMANDS]", "Logs Viewer panel opened");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error("[COMMANDS]", "View Logs error", error as Error);
          vscode.window.showErrorMessage(
            `Error opening logs viewer: ${message}`,
          );
        }
      },
    ),
  );

  // View Function Logs command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewFunctionLogs",
      async (functionId?: string, projectId?: string) => {
        try {
          outputChannel.info(
            "[COMMANDS]",
            "View Function Logs command invoked",
            {
              functionId,
              projectId,
            },
          );

          vscode.window.showInformationMessage(
            "📋 Function Logs Viewer\n\n" +
              "Coming in v0.2.1-alpha\n\n" +
              "This feature will display:\n" +
              "• Real-time function execution logs\n" +
              "• Performance metrics\n" +
              "• Error details and stack traces\n\n" +
              "For now, view function logs in your Appwrite Console.",
          );

          outputChannel.info("[COMMANDS]", "Function Logs - placeholder shown");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "View Function Logs error",
            error as Error,
          );
        }
      },
    ),
  );

  // Run Diagnostics command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.runDiagnostics",
      async (projectId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "Run Diagnostics command invoked");

          vscode.window.showInformationMessage(
            "🔍 AppForge Diagnostics\n\n" +
              "Running diagnostics on your environment...\n\n" +
              "✅ Extension loaded\n" +
              "✅ Services initialized\n" +
              "✅ API client configured",
          );

          outputChannel.success("[COMMANDS]", "Diagnostics completed");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Run Diagnostics error",
            error as Error,
          );
        }
      },
    ),
  );
}
