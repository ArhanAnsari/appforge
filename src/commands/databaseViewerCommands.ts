/**
 * Database Viewer Commands
 * Commands for opening and managing the database viewer panel
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { DatabaseViewerPanel } from "../views/databaseViewerPanel";

/**
 * Register database viewer commands
 */
export function registerDatabaseViewerCommands(
  context: vscode.ExtensionContext,
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
): void {
  // Open database viewer
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewDatabase",
      async (arg: any) => {
        // Handle both tree item context and direct parameters
        let projectId: string,
          databaseId: string,
          collectionId: string,
          collectionName: string;

        if (typeof arg === "object" && arg?.data?.type === "collection") {
          projectId = arg.data.projectId;
          databaseId = arg.data.databaseId;
          collectionId = arg.data.id;
          collectionName = arg.data.label;
        } else {
          vscode.window.showErrorMessage("Invalid collection context");
          return;
        }

        await DatabaseViewerPanel.createOrShow(
          context.extensionUri,
          appwriteClient,
          projectStorage,
          treeProvider,
          projectId,
          databaseId,
          collectionId,
          collectionName,
        );
      },
    ),
  );
}
