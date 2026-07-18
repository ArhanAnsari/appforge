/**
 * AppForge VS Code Extension
 * Appwrite-native developer cockpit inside VS Code
 *
 * Version: 0.2.2-alpha
 *
 * This extension provides a complete project management interface for Appwrite,
 * enabling developers to manage databases, functions, storage, and more without leaving VS Code.
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "./services/projectStorageService";
import { AppwriteClientService } from "./services/appwriteClientService";
import { StatusBarService } from "./services/statusBarService";
import { AppForgeTreeDataProvider } from "./providers/treeDataProvider";
import { registerProjectCommands } from "./commands/projectCommands";
import { registerDatabaseCommands } from "./commands/databaseCommands";
import { registerDatabaseManagementCommands } from "./commands/databaseManagement";
import { registerDatabaseViewerCommands } from "./commands/databaseViewerCommands";
import { registerFunctionCommands } from "./commands/functionCommands";
import { registerDiagnosticsCommands } from "./commands/diagnosticsCommands";
import { registerStorageCommands } from "./commands/storageCommands";
import { registerDatabaseCreationCommands } from "./commands/databaseCreationCommands";
import { registerResourceCommands } from "./commands/resourceCommands";
import { logger } from "./utils/logger";
import { outputChannel } from "./core/output/outputChannel";

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
  logger.initialize();
  logger.success(
    "EXTENSION",
    "🚀 AppForge extension is now active (v0.2.2-alpha)",
  );
  outputChannel.initialize();
  outputChannel.info(
    "EXTENSION",
    "AppForge extension is now active (v0.2.2-alpha)",
  );

  try {
    // Initialize core structural lifecycle services
    const projectStorage = new ProjectStorageService(context, context.secrets);
    const appwriteClient = AppwriteClientService.getInstance();
    const statusBar = new StatusBarService(projectStorage);

    statusBar.show();

    const treeDataProvider = new AppForgeTreeDataProvider(
      projectStorage,
      appwriteClient,
      context.extensionUri,
    );

    // Register primary View container safely
    const treeView = vscode.window.createTreeView("appforge.projectView", {
      treeDataProvider,
      showCollapseAll: true,
    });
    treeDataProvider.attachView(treeView);

    // CRITICAL SAFEGUARD: Push visual components into subscriptions array
    // IMMEDIATELY so VS Code can auto-dispose them if anything fails downstream
    context.subscriptions.push(statusBar);
    context.subscriptions.push(treeDataProvider);
    context.subscriptions.push(treeView);

    // Register each command block EXACTLY ONCE
    registerProjectCommands(
      context,
      projectStorage,
      appwriteClient,
      treeDataProvider,
      statusBar,
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
    registerStorageCommands(
      context,
      projectStorage,
      appwriteClient,
      treeDataProvider,
    );
    registerDatabaseCreationCommands(
      context,
      projectStorage,
      appwriteClient,
      treeDataProvider,
    );
    registerResourceCommands(
      context,
      projectStorage,
      appwriteClient,
      treeDataProvider,
    );

    // Auto-load active project sequence on startup execution
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
      return;
    }
    const projects = projectStorage.getProjects();
    if (projects.length > 0) {
      const fallbackProject = projects[0];
      await projectStorage.setActiveProjectId(fallbackProject.projectId);
      outputChannel.info(
        "EXTENSION",
        "Restored fallback active project from saved projects",
        {
          projectId: fallbackProject.projectId,
          projectName: fallbackProject.projectName,
        },
      );
      outputChannel.success(
        "EXTENSION",
        `Loaded active project: ${fallbackProject.projectName}`,
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
