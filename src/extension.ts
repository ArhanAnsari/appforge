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
import { registerFunctionCommands } from "./commands/functionCommands";
import { registerDiagnosticsCommands } from "./commands/diagnosticsCommands";
import { logger } from "./utils/logger";

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
  logger.initialize();
  logger.success(
    "EXTENSION",
    "🚀 AppForge extension is now active (v1.0-alpha)",
  );
  console.log("🚀 AppForge extension is now active (v1.0-alpha)");

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

    // Register the tree view
    vscode.window.registerTreeDataProvider(
      "appforge.projectView",
      treeDataProvider,
    );

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
    registerFunctionCommands(context, appwriteClient, treeDataProvider);
    registerDiagnosticsCommands(context, projectStorage, appwriteClient);

    // Auto-load active project on activation
    loadActiveProjectOnActivation(projectStorage, appwriteClient);

    logger.success("EXTENSION", "✓ AppForge initialized successfully");
    console.log("✓ AppForge initialized successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("EXTENSION", "✗ Error initializing AppForge", message);
    console.error("✗ Error initializing AppForge:", message);
    vscode.window.showErrorMessage(`AppForge initialization error: ${message}`);
  }
}

/**
 * Load the active project when extension activates
 */
async function loadActiveProjectOnActivation(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): Promise<void> {
  try {
    const projectWithKey = await projectStorage.getActiveProjectWithApiKey();
    if (projectWithKey) {
      appwriteClient.initialize(projectWithKey, projectWithKey.apiKey);
      logger.success(
        "EXTENSION",
        `✓ Loaded active project: ${projectWithKey.projectName}`,
      );
      console.log(`✓ Loaded active project: ${projectWithKey.projectName}`);
    }
  } catch (error) {
    logger.warn("EXTENSION", "Failed to load active project", error);
    console.error("Failed to load active project:", error);
  }
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  AppwriteClientService.getInstance().reset();
  console.log("AppForge extension deactivated");
}
