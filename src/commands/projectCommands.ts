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
import { EventBus } from "../core/events/eventBus";
import { outputChannel } from "../core/output/outputChannel";
import { refreshManager } from "../core/refresh/refreshManager";

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
      async (arg: any) => {
        // Handle both tree item context and direct projectId
        const projectId = typeof arg === "string" ? arg : arg?.data?.id;
        if (!projectId) {
          vscode.window.showErrorMessage("No project selected");
          return;
        }
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
      async (arg: any) => {
        // Handle both tree item context and direct projectId
        const projectId = typeof arg === "string" ? arg : arg?.data?.id;
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
      refreshManager.queueRefresh("all");
      outputChannel.success("PROJECTS", "Projects refreshed");
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
        const end = outputChannel.startOperation(
          "PROJECTS",
          `Remove project: ${project.projectName}`,
        );
        await projectStorage.removeProject(projectId);

        // If this was the active project, clear the stored selection
        if (projectStorage.getActiveProjectId() === projectId) {
          await projectStorage.setActiveProjectId(undefined);
        }

        refreshManager.queueRefresh("all");
        end(true);
      },
    );

    outputChannel.success(
      "PROJECTS",
      `Project removed: ${project.projectName}`,
    );
  } catch (error) {
    outputChannel.error("PROJECTS", "Failed to remove project", error);
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
  projectId?: string,
): Promise<void> {
  try {
    // If no projectId provided, show quick pick of all projects
    if (!projectId) {
      const projects = projectStorage.getProjects();

      if (projects.length === 0) {
        vscode.window.showInformationMessage(
          "No projects found. Please add a project first using 'AppForge: Add Project'.",
        );
        return;
      }

      const quickPickItems: (vscode.QuickPickItem & { projectId: string })[] =
        projects.map((project) => ({
          label: project.projectName,
          description: project.endpoint,
          projectId: project.projectId,
        }));

      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: "Select a project to switch to",
        matchOnDescription: true,
      });

      if (!selectedItem) {
        // User cancelled
        return;
      }

      projectId = selectedItem.projectId;
    }

    // Ensure projectId is defined (should always be true at this point)
    if (!projectId) {
      vscode.window.showErrorMessage("No project selected");
      return;
    }

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
        const end = outputChannel.startOperation(
          "PROJECTS",
          `Switch to project: ${project.projectName}`,
        );
        // Get API key
        const apiKey = await projectStorage.getApiKey(projectId!);
        if (!apiKey) {
          throw new Error("API key not found in secure storage");
        }

        const databases = appwriteClient.createDatabasesService(
          project,
          apiKey,
        );
        await databases.list();

        // Update active project
        await projectStorage.setActiveProjectId(projectId);

        refreshManager.queueRefresh("all");

        // Emit event (projectId is guaranteed to be string at this point)
        await EventBus.getInstance().emit("project.switched", {
          projectId: projectId as string,
          projectName: project.projectName,
        });

        end(true);
      },
    );

    outputChannel.success(
      "PROJECTS",
      `Switched to project: ${project.projectName}`,
    );
  } catch (error) {
    outputChannel.error("PROJECTS", "Failed to switch project", error);
    vscode.window.showErrorMessage(
      `Failed to switch project: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
