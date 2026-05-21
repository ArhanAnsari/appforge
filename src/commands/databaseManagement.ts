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
          appwriteClient,
          projectStorage,
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
          appwriteClient,
          treeProvider,
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
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
  projectId?: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
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
        try {
          const end = outputChannel.startOperation(
            "DATABASE",
            `Create database: ${databaseName}`,
          );
          const databases = appwriteClient.getDatabases();
          const db = await databases.create(databaseId, databaseName);

          const activeProject = appwriteClient.getActiveProject();
          if (activeProject) {
            await EventBus.getInstance().emit("database.created", {
              projectId: activeProject.projectId,
              databaseId,
              name: databaseName,
            });
          }

          treeProvider.refresh();
          outputChannel.success(
            "DATABASE",
            `Database created: ${databaseName}`,
          );
          end(true);
        } catch (error) {
          outputChannel.error("DATABASE", "Failed to create database", error);
          vscode.window.showErrorMessage(
            `Failed to create database: ${error instanceof Error ? error.message : String(error)}`,
          );
          end(false, error as Error);
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
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
  databaseId: string,
  _projectId?: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
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
        try {
          const end = outputChannel.startOperation(
            "DATABASE",
            `Delete database: ${databaseId}`,
          );
          const databases = appwriteClient.getDatabases();
          await databases.delete(databaseId);

          const activeProject = appwriteClient.getActiveProject();
          if (activeProject) {
            await EventBus.getInstance().emit("database.deleted", {
              projectId: activeProject.projectId,
              databaseId,
            });
          }

          treeProvider.refresh();
          outputChannel.success("DATABASE", `Database deleted: ${databaseId}`);
          end(true);
        } catch (error) {
          outputChannel.error("DATABASE", "Failed to delete database", error);
          vscode.window.showErrorMessage(
            `Failed to delete database: ${error instanceof Error ? error.message : String(error)}`,
          );
          end(false, error as Error);
        }
      },
    );
  } catch (error) {
    outputChannel.error("DATABASE", "Delete database error", error);
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}
function end(arg0: boolean, arg1: Error) {
  throw new Error("Function not implemented.");
}

