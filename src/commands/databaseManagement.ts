/**
 * Database Management Commands (Create, Delete, Modify)
 * Handles: Create Database, Delete Database
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { ProjectStorageService } from "../services/projectStorageService";
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
          const databases = appwriteClient.getDatabases();
          const db = await databases.create(databaseId, databaseName);

          treeProvider.refresh();
          vscode.window.showInformationMessage(
            `✓ Database created: ${databaseName}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to create database: ${message}`,
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
          const databases = appwriteClient.getDatabases();
          await databases.delete(databaseId);

          treeProvider.refresh();
          vscode.window.showInformationMessage(
            `✓ Database deleted: ${databaseId}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to delete database: ${message}`,
          );
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}
