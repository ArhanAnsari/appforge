/**
 * Database Creation Commands
 * Handles database and collection creation commands
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { DatabaseService } from "../services/databaseService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { outputChannel } from "../core/output/outputChannel";
import { logger } from "../utils/logger";

/**
 * Register database creation commands
 */
export function registerDatabaseCreationCommands(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeDataProvider: AppForgeTreeDataProvider,
): void {
  // Create Collection command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.createCollection",
      async (databaseId?: string, projectId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "Create Collection command invoked");

          if (!projectId) {
            projectId = projectStorage.getActiveProjectId();
          }

          if (!projectId) {
            vscode.window.showErrorMessage(
              "No active project. Please select a project first.",
            );
            return;
          }

          const collectionName = await vscode.window.showInputBox({
            prompt: "Enter collection name",
            placeHolder: "users",
          });

          if (!collectionName) {
            return;
          }

          vscode.window.showInformationMessage(
            `✅ Collection Creation\n\nCollection "${collectionName}" creation initiated.\n\nThis feature is coming in v0.3.0-alpha.\n\nFor now, create collections in your Appwrite Console.`,
          );

          outputChannel.success(
            "[COMMANDS]",
            "Create Collection",
            `Collection: ${collectionName}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Create Collection error",
            error as Error,
          );
          vscode.window.showErrorMessage(`Error: ${message}`);
        }
      },
    ),
  );
}
