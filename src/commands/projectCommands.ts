/**
 * Project Management Commands
 * Handles: Add Project, Remove Project, Switch Project, List Projects
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { SetupGuidePanel } from "../views/setupGuidePanel";
import { ProjectSetupPanel } from "../views/projectSetupPanel";

/**
 * Register project management commands
 */
export function registerProjectCommands(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
): void {
  // Add Project
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.addProject", async () => {
      await addProjectCommand(
        context,
        projectStorage,
        appwriteClient,
        treeProvider,
      );
    }),
  );

  // Remove Project
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.removeProject",
      async (projectId: string) => {
        await removeProjectCommand(
          projectStorage,
          appwriteClient,
          treeProvider,
          projectId,
        );
      },
    ),
  );

  // Switch Project
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.switchProject",
      async (projectId: string) => {
        await switchProjectCommand(
          projectStorage,
          appwriteClient,
          treeProvider,
          projectId,
        );
      },
    ),
  );

  // Refresh Projects
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.refreshProjects", async () => {
      treeProvider.refresh();
      vscode.window.showInformationMessage("Projects refreshed");
    }),
  );

  // Show Setup Guide
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.showSetupGuide", async () => {
      SetupGuidePanel.createOrShow(context.extensionUri, context);
    }),
  );
}

/**
 * Add a new Appwrite project
 */
async function addProjectCommand(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
): Promise<void> {
  ProjectSetupPanel.createOrShow(
    context.extensionUri,
    projectStorage,
    appwriteClient,
    treeProvider,
  );
}

/**
 * Remove a project from storage
 */
async function removeProjectCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
  projectId: string,
): Promise<void> {
  try {
    const project = projectStorage.getProjectById(projectId);
    if (!project) {
      vscode.window.showErrorMessage("Project not found");
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to remove "${project.projectName}"?`,
      { modal: true },
      "Remove",
    );

    if (confirmation !== "Remove") {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Removing project...",
        cancellable: false,
      },
      async () => {
        await projectStorage.removeProject(projectId);

        // If this was the active project, reset client
        if (appwriteClient.getActiveProject()?.projectId === projectId) {
          appwriteClient.reset();
        }

        treeProvider.refresh();
      },
    );

    vscode.window.showInformationMessage(
      `✓ Project "${project.projectName}" removed`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to remove project: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Switch to a different project
 */
async function switchProjectCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  treeProvider: AppForgeTreeDataProvider,
  projectId: string,
): Promise<void> {
  try {
    const project = projectStorage.getProjectById(projectId);
    if (!project) {
      vscode.window.showErrorMessage("Project not found");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Switching to "${project.projectName}"...`,
        cancellable: false,
      },
      async () => {
        // Get API key
        const apiKey = await projectStorage.getApiKey(projectId);
        if (!apiKey) {
          throw new Error("API key not found in secure storage");
        }

        // Update active project
        await projectStorage.setActiveProjectId(projectId);

        // Initialize client
        appwriteClient.initialize(project, apiKey);

        treeProvider.refresh();
      },
    );

    vscode.window.showInformationMessage(
      `✓ Switched to "${project.projectName}"`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to switch project: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
