/**
 * Storage Commands
 * Handles storage-related commands: create bucket, upload, download, delete files
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { StorageService } from "../services/storageService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { outputChannel } from "../core/output/outputChannel";
import { logger } from "../utils/logger";

/**
 * Register storage-related commands
 */
export function registerStorageCommands(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeDataProvider: AppForgeTreeDataProvider,
): void {
  // Create Bucket command
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.createBucket", async () => {
      try {
        outputChannel.info("[COMMANDS]", "Create Bucket command invoked");

        vscode.window.showInformationMessage(
          "📦 Create Bucket\n\nThis feature is coming in v0.3.0-alpha.\n\nFor now, create buckets in your Appwrite Console.",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.error(
          "[COMMANDS]",
          "Create Bucket error",
          error as Error,
        );
        vscode.window.showErrorMessage(`Error: ${message}`);
      }
    }),
  );

  // Upload File command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.uploadFile",
      async (bucketId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "Upload File command invoked", {
            bucketId,
          });

          vscode.window.showInformationMessage(
            "📤 Upload File\n\nThis feature is coming in v0.3.0-alpha.\n\nFor now, upload files in your Appwrite Console.",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Upload File error",
            error as Error,
          );
          vscode.window.showErrorMessage(`Error: ${message}`);
        }
      },
    ),
  );

  // Download File command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.downloadFile",
      async (fileId?: string, bucketId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "Download File command invoked", {
            fileId,
            bucketId,
          });

          vscode.window.showInformationMessage(
            "📥 Download File\n\nThis feature is coming in v0.3.0-alpha.\n\nFor now, download files from your Appwrite Console.",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Download File error",
            error as Error,
          );
          vscode.window.showErrorMessage(`Error: ${message}`);
        }
      },
    ),
  );

  // Delete File command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.deleteFile",
      async (fileId?: string, bucketId?: string) => {
        try {
          outputChannel.info("[COMMANDS]", "Delete File command invoked", {
            fileId,
            bucketId,
          });

          const confirm = await vscode.window.showWarningMessage(
            "Are you sure you want to delete this file?",
            "Delete",
            "Cancel",
          );

          if (confirm === "Delete") {
            vscode.window.showInformationMessage(
              "🗑️ Delete File\n\nThis feature is coming in v0.3.0-alpha.\n\nFor now, delete files in your Appwrite Console.",
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.error(
            "[COMMANDS]",
            "Delete File error",
            error as Error,
          );
          vscode.window.showErrorMessage(`Error: ${message}`);
        }
      },
    ),
  );
}
