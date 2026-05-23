/**
 * AppForge VS Code Extension
 * Appwrite-native developer cockpit inside VS Code
 *
 * Version: 0.1.0-alpha
 *
 * This extension provides a complete project management interface for Appwrite,
 * enabling developers to manage databases, functions, and more without leaving VS Code.
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "./services/projectStorageService";
import { AppwriteClientService } from "./services/appwriteClientService";
import { AppForgeTreeDataProvider } from "./providers/treeDataProvider";
import { registerProjectCommands } from "./commands/projectCommands";
import { registerDatabaseCommands } from "./commands/databaseCommands";
import { registerDatabaseManagementCommands } from "./commands/databaseManagement";
import { registerDatabaseViewerCommands } from "./commands/databaseViewerCommands";
import { registerFunctionCommands } from "./commands/functionCommands";
import { registerDiagnosticsCommands } from "./commands/diagnosticsCommands";
import { logger } from "./utils/logger";
import { outputChannel } from "./core/output/outputChannel";

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
  logger.initialize();
  logger.success(
    "EXTENSION",
    "🚀 AppForge extension is now active (v0.1.1-alpha)",
  );
  outputChannel.initialize();
  outputChannel.info(
    "EXTENSION",
    "AppForge extension is now active (v0.1.1-alpha)",
  );

  try {
    // Initialize services
    const projectStorage = new ProjectStorageService(context, context.secrets);
    const appwriteClient = AppwriteClientService.getInstance();

    // Initialize tree data provider for sidebar
    const treeDataProvider = new AppForgeTreeDataProvider(
      projectStorage,
      appwriteClient,
      context.extensionUri,
    );

    // Create the TreeView so we can track expansion and provide live UX
    const treeView = vscode.window.createTreeView("appforge.projectView", {
      treeDataProvider,
      showCollapseAll: true,
    });
    treeDataProvider.attachView(treeView);

    // Register all commands
    registerProjectCommands(
      context,
      projectStorage,
      appwriteClient,
      treeDataProvider,
    );
    registerDatabaseCommands(
      context,
      appwriteClient,
      projectStorage,
      treeDataProvider,
    );
    registerDatabaseManagementCommands(
      context,
      appwriteClient,
      projectStorage,
      treeDataProvider,
    );
    registerDatabaseViewerCommands(
      context,
      appwriteClient,
      projectStorage,
      treeDataProvider,
    );
    registerFunctionCommands(
      context,
      appwriteClient,
      treeDataProvider,
      projectStorage,
    );
    registerDiagnosticsCommands(context, projectStorage, appwriteClient);

    // Auto-load active project on activation
    loadActiveProjectOnActivation(projectStorage);

    logger.success("EXTENSION", "✓ AppForge initialized successfully");
    outputChannel.success("EXTENSION", "AppForge initialized successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("EXTENSION", "✗ Error initializing AppForge", message);
    outputChannel.error(
      "EXTENSION",
      "Error initializing AppForge",
      new Error(message),
    );
    vscode.window.showErrorMessage(`AppForge initialization error: ${message}`);
  }
}

/**
 * Load the active project when extension activates
 */
async function loadActiveProjectOnActivation(
  projectStorage: ProjectStorageService,
): Promise<void> {
  try {
    const projectWithKey = await projectStorage.getActiveProjectWithApiKey();
    if (projectWithKey) {
      logger.success(
        "EXTENSION",
        `✓ Loaded active project: ${projectWithKey.projectName}`,
      );
      outputChannel.success(
        "EXTENSION",
        `Loaded active project: ${projectWithKey.projectName}`,
      );
    }
  } catch (error) {
    logger.warn("EXTENSION", "Failed to load active project", error);
    outputChannel.error(
      "EXTENSION",
      "Failed to load active project",
      error as Error,
    );
  }
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  outputChannel.info("EXTENSION", "AppForge extension deactivated");
}
