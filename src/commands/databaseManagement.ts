/**
 * Database Management Commands (Create, Delete, Modify)
 * Handles: Create Database, Delete Database
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { ProjectStorageService } from "../services/projectStorageService";
import { EventBus } from "../core/events/eventBus";
import { outputChannel } from "../core/output/outputChannel";
import { refreshManager } from "../core/refresh/refreshManager";
import { ID } from "node-appwrite";

/**
 * Register database management commands
 */
export function registerDatabaseManagementCommands(
  context: vscode.ExtensionContext,
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
): void {
  // Create Database
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.createDatabase",
      async (arg: any) => {
        // Handle both tree item context and direct projectId
        const projectId = typeof arg === "string" ? arg : arg?.data?.projectId;
        await createDatabaseCommand(
          projectStorage,
          appwriteClient,
          treeProvider,
          projectId,
        );
      },
    ),
  );

  // Delete Database
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.deleteDatabase",
      async (arg: any) => {
        // Handle both tree item context and direct databaseId
        const databaseId = typeof arg === "string" ? arg : arg?.data?.id;
        const projectId =
          typeof arg === "string" ? undefined : arg?.data?.projectId;
        await deleteDatabaseCommand(
          treeProvider,
          projectStorage,
          appwriteClient,
          databaseId,
          projectId,
        );
      },
    ),
  );
}

/**
 * Create a new database
 */
async function createDatabaseCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
  projectId?: string,
): Promise<void> {
  try {
    const resolvedProjectId = projectId ?? projectStorage.getActiveProjectId();
    if (!resolvedProjectId) {
      vscode.window.showErrorMessage(
        "No project selected. Switch to a project first.",
      );
      return;
    }

    const project = projectStorage.getProjectById(resolvedProjectId);
    if (!project) {
      vscode.window.showErrorMessage("Project not found");
      return;
    }

    const apiKey = await projectStorage.getApiKey(resolvedProjectId);
    if (!apiKey) {
      vscode.window.showErrorMessage("API key not found in secure storage");
      return;
    }

    const databaseId = await vscode.window.showInputBox({
      placeHolder: "my_database",
      prompt: "Enter database ID (lowercase, no spaces)",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Database ID cannot be empty";
        }
        if (!/^[a-z0-9_-]+$/.test(value)) {
          return "Only lowercase letters, numbers, underscores, and hyphens allowed";
        }
        return "";
      },
    });

    if (!databaseId) {
      return;
    }

    const databaseName = await vscode.window.showInputBox({
      placeHolder: "My Database",
      prompt: "Enter database name",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Database name cannot be empty";
        }
        return "";
      },
    });

    if (!databaseName) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Creating database...",
        cancellable: false,
      },
      async () => {
        let endOperation:
          | ((success?: boolean, error?: Error) => void)
          | undefined = undefined;
        try {
          endOperation = outputChannel.startOperation(
            "DATABASE",
            `Create database: ${databaseName}`,
          );
          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
          const db = await databases.create(databaseId, databaseName);

          await EventBus.getInstance().emit("database.created", {
            projectId: resolvedProjectId,
            databaseId,
            name: databaseName,
          });

          refreshManager.queueRefresh("databases");
          outputChannel.success(
            "DATABASE",
            `Database created: ${databaseName}`,
          );
          endOperation(true);
        } catch (error) {
          outputChannel.error("DATABASE", "Failed to create database", error);
          vscode.window.showErrorMessage(
            `Failed to create database: ${error instanceof Error ? error.message : String(error)}`,
          );
          endOperation?.(false, error as Error);
        }
      },
    );
  } catch (error) {
    outputChannel.error("DATABASE", "Create database error", error);
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

/**
 * Delete a database
 */
async function deleteDatabaseCommand(
  treeProvider: AppForgeTreeDataProvider,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  databaseId: string,
  _projectId?: string,
): Promise<void> {
  try {
    const resolvedProjectId = _projectId ?? projectStorage.getActiveProjectId();
    if (!resolvedProjectId) {
      vscode.window.showErrorMessage(
        "No project selected. Switch to a project first.",
      );
      return;
    }

    const project = projectStorage.getProjectById(resolvedProjectId);
    if (!project) {
      vscode.window.showErrorMessage("Project not found");
      return;
    }

    const apiKey = await projectStorage.getApiKey(resolvedProjectId);
    if (!apiKey) {
      vscode.window.showErrorMessage("API key not found in secure storage");
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `Delete database "${databaseId}"? This cannot be undone and will delete all data.`,
      { modal: true },
      "Delete",
    );

    if (confirmation !== "Delete") {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Deleting database...",
        cancellable: false,
      },
      async () => {
        let endOperation:
          | ((success?: boolean, error?: Error) => void)
          | undefined = undefined;
        try {
          endOperation = outputChannel.startOperation(
            "DATABASE",
            `Delete database: ${databaseId}`,
          );
          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
          await databases.delete(databaseId);

          await EventBus.getInstance().emit("database.deleted", {
            projectId: resolvedProjectId,
            databaseId,
          });

          refreshManager.queueRefresh("databases");
          outputChannel.success("DATABASE", `Database deleted: ${databaseId}`);
          endOperation(true);
        } catch (error) {
          outputChannel.error("DATABASE", "Failed to delete database", error);
          vscode.window.showErrorMessage(
            `Failed to delete database: ${error instanceof Error ? error.message : String(error)}`,
          );
          endOperation?.(false, error as Error);
        }
      },
    );
  } catch (error) {
    outputChannel.error("DATABASE", "Delete database error", error);
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}
