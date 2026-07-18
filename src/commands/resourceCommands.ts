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
import { refreshManager } from "../core/refresh/refreshManager";
import { telemetryManager } from "../core/logs/logTelemetryManager";

type RefreshScope =
  | "all"
  | "tree"
  | "databases"
  | "functions"
  | "logs"
  | "specific";

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
        const startTime = Date.now();
        try {
          outputChannel.info(
            "[COMMANDS]",
            "Refresh Resources command invoked",
            { projectId, resourceType },
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

          vscode.window.showInformationMessage("🔄 Refreshing resources...");

          const currentProj = projectStorage.getProjectById(projectId);
          const currentKey = await projectStorage.getApiKey(projectId);
          if (currentProj && currentKey) {
            telemetryManager.setContext(currentProj, currentKey);
          }

          treeDataProvider.refresh();
          refreshManager.queueRefresh(normalizeRefreshScope(resourceType));

          const executionDuration = Date.now() - startTime;
          telemetryManager.addApiLatency(executionDuration);

          if (resourceType === "databases") {
            telemetryManager.setMetric(
              "databaseLoadDuration",
              executionDuration,
            );
          } else if (resourceType === "functions") {
            telemetryManager.setMetric(
              "functionLoadDuration",
              executionDuration,
            );
          } else {
            telemetryManager.setMetric(
              "storageLoadDuration",
              executionDuration,
            );
          }

          outputChannel.success(
            "[COMMANDS]",
            "Resources refreshed",
            `Project: ${projectId}`,
            executionDuration,
          );

          vscode.window.showInformationMessage("✅ Resources refreshed");
        } catch (error) {
          telemetryManager.incrementFailedRequests();
          outputChannel.error(
            "[COMMANDS]",
            "Refresh Resources error",
            error as Error,
          );
          vscode.window.showErrorMessage(
            `Error refreshing resources: ${error instanceof Error ? error.message : String(error)}`,
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

          const consoleUrl = project.endpoint.replace(/\/v1\s*$/, "");
          await vscode.env.openExternal(vscode.Uri.parse(consoleUrl));

          outputChannel.success(
            "[COMMANDS]",
            "Opened Appwrite Console",
            `Project: ${project.projectName}`,
          );
        } catch (error) {
          outputChannel.error(
            "[COMMANDS]",
            "Open Console error",
            error as Error,
          );
          vscode.window.showErrorMessage(
            `Error opening console: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    ),
  );

  // View Logs command - ONLY ONE DEFINITION REMAINS CLEANLY HERE
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewLogs",
      async (projectId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "View Logs command invoked");

          if (!projectId) {
            projectId = projectStorage.getActiveProjectId();
          }
          if (projectId) {
            const currentProj = projectStorage.getProjectById(projectId);
            const currentKey = await projectStorage.getApiKey(projectId);
            if (currentProj && currentKey) {
              telemetryManager.setContext(currentProj, currentKey);
            }
          }

          showLogsViewer(context, projectStorage, appwriteClient);
          outputChannel.info("[COMMANDS]", "Logs Viewer panel opened");
        } catch (error) {
          outputChannel.error("[COMMANDS]", "View Logs error", error as Error);
          vscode.window.showErrorMessage(
            `Error opening logs viewer: ${error instanceof Error ? error.message : String(error)}`,
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
            { functionId, projectId },
          );

          if (!projectId) {
            projectId = projectStorage.getActiveProjectId();
          }

          if (!projectId || !functionId) {
            vscode.window.showErrorMessage(
              "Missing function or project targeting context details.",
            );
            return;
          }

          const project = projectStorage.getProjectById(projectId);
          const apiKey = await projectStorage.getApiKey(projectId);

          if (!project || !apiKey) {
            vscode.window.showErrorMessage(
              "Target credentials are unavailable.",
            );
            return;
          }

          showLogsViewer(context, projectStorage, appwriteClient);
          await vscode.commands.executeCommand(
            "appforge.runDiagnostics",
            projectId,
          );

          const startTime = Date.now();
          const { FunctionsService } =
            await import("../services/functionsService.js");
          const fnService = new FunctionsService(project, apiKey);

          outputChannel.info(
            "[FUNCTIONS]",
            `Querying deployment logs traces for: ${functionId}`,
          );
          const executions = await fnService.listExecutions(functionId);
          telemetryManager.addApiLatency(Date.now() - startTime);

          const transformedLogs = executions.map((exec) => ({
            id: exec.$id,
            status: exec.status,
            duration: exec.duration,
            createdAt: exec.$createdAt,
            errors:
              exec.statusCode >= 400
                ? `Execution failed. Status code: ${exec.statusCode}`
                : "",
          }));

          telemetryManager.setFunctionExecutionLogs(
            functionId,
            transformedLogs,
          );
          outputChannel.success(
            "[FUNCTIONS]",
            `Successfully tracked and delivered ${transformedLogs.length} live execution records.`,
          );
        } catch (error) {
          telemetryManager.incrementFailedRequests();
          outputChannel.error(
            "[COMMANDS]",
            "View Function Logs error",
            error as Error,
          );
          vscode.window.showErrorMessage(
            `Failed to retrieve live execution metrics: ${error instanceof Error ? error.message : String(error)}`,
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
          await vscode.commands.executeCommand(
            "appforge.verifyAppwriteProjectEnvironment",
          );
          outputChannel.success("[COMMANDS]", "Diagnostics completed");
        } catch (error) {
          outputChannel.error(
            "[COMMANDS]",
            "Run Diagnostics error",
            error as Error,
          );
        }
      },
    ),
  );

  // Copy Resource ID command
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.copyResourceId", async (arg?: any) => {
      try {
        const resourceId = arg?.data?.id ?? arg?.id;
        const resourceType = arg?.data?.type ?? "resource";
        if (!resourceId) {
          vscode.window.showWarningMessage("No resource ID available to copy.");
          return;
        }
        await vscode.env.clipboard.writeText(String(resourceId));
        vscode.window.showInformationMessage(
          `✓ Copied ${formatResourceType(resourceType)} ID: ${resourceId}`,
        );
      } catch (error) {
        outputChannel.error(
          "COMMANDS",
          "Copy Resource ID command failed",
          error as Error,
        );
        vscode.window.showErrorMessage(
          `Failed to copy ID: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
}

function formatResourceType(type: string): string {
  switch (type) {
    case "project":
      return "Project";
    case "database":
      return "Database";
    case "collection":
      return "Collection";
    case "document":
      return "Document";
    case "function":
      return "Function";
    case "bucket":
      return "Bucket";
    case "file":
      return "File";
    default:
      return "Resource";
  }
}