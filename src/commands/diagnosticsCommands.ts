/**
 * Diagnostics Commands
 * Helps debug project and data retrieval issues
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";

/**
 * Register diagnostics commands
 */
export function registerDiagnosticsCommands(
  context: vscode.ExtensionContext,
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): void {
  // Check Project Status
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.checkProjectStatus", async () => {
      await checkProjectStatusCommand(projectStorage, appwriteClient);
    }),
  );

  // View Project Connection Info
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewConnectionInfo",
      async (projectId?: string) => {
        await viewConnectionInfoCommand(
          projectStorage,
          appwriteClient,
          projectId,
        );
      },
    ),
  );
}

/**
 * Check the current project status and database accessibility
 */
async function checkProjectStatusCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): Promise<void> {
  try {
    const channel = vscode.window.createOutputChannel("AppForge - Diagnostics");
    channel.clear();
    channel.show(vscode.ViewColumn.Beside);

    const activeProject = appwriteClient.getActiveProject();
    const projectWithKey = await projectStorage.getActiveProjectWithApiKey();

    channel.appendLine("=== AppForge Diagnostics ===\n");

    if (!activeProject) {
      channel.appendLine("❌ No active project loaded");
      channel.appendLine(
        "  → Use AppForge: Add Project to create a new project",
      );
      return;
    }

    channel.appendLine(`✓ Active Project: ${activeProject.projectName}`);
    channel.appendLine(`  Endpoint: ${activeProject.endpoint}`);
    channel.appendLine(`  Project ID: ${activeProject.projectId}`);
    channel.appendLine("");

    if (!projectWithKey || !projectWithKey.apiKey) {
      channel.appendLine("❌ API Key not found");
      return;
    }

    channel.appendLine("Attempting to fetch databases...\n");

    try {
      const databases = appwriteClient.getDatabases();
      const response = await databases.list();
      const dbList = response.databases || [];

      if (dbList.length === 0) {
        channel.appendLine("📭 No databases found in this project");
        channel.appendLine("  → Create a database in Appwrite console");
      } else {
        channel.appendLine(`✓ Found ${dbList.length} database(s):\n`);

        for (const db of dbList) {
          channel.appendLine(`  📦 ${db.name}`);
          channel.appendLine(`     ID: ${db.$id}`);

          // Try to fetch collections for each database
          try {
            const collections = appwriteClient.getDatabases();
            const colResponse = await collections.listCollections(db.$id);
            const colList = colResponse.collections || [];
            channel.appendLine(`     Collections: ${colList.length}`);

            if (colList.length > 0) {
              for (const col of colList) {
                channel.appendLine(`       📋 ${col.name} (${col.$id})`);
              }
            }
          } catch (colError) {
            const msg =
              colError instanceof Error ? colError.message : String(colError);
            channel.appendLine(`     ⚠️  Could not fetch collections: ${msg}`);
          }

          channel.appendLine("");
        }

        channel.appendLine("✓ Successfully retrieved database information!");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      channel.appendLine(`❌ Error fetching databases: ${msg}`);
      channel.appendLine("");
      channel.appendLine("Troubleshooting:");
      channel.appendLine("  1. Verify API key has database read permissions");
      channel.appendLine("  2. Check endpoint URL is correct");
      channel.appendLine("  3. Ensure project ID matches Appwrite console");
      channel.appendLine("  4. Verify network connectivity to Appwrite server");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Diagnostics error: ${msg}`);
  }
}

/**
 * View detailed connection information for a project
 */
async function viewConnectionInfoCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
  projectId?: string,
): Promise<void> {
  try {
    let targetProjectId = projectId;

    if (!targetProjectId) {
      // Show quick pick of all projects
      const projects = projectStorage.getProjects();
      if (projects.length === 0) {
        vscode.window.showInformationMessage("No projects found");
        return;
      }

      const projectOptions = projects.map((p) => ({
        label: p.projectName,
        value: p.projectId,
      }));

      const selected = await vscode.window.showQuickPick(projectOptions, {
        placeHolder: "Select project to view info",
      });

      if (!selected) {
        return;
      }

      targetProjectId = selected.value;
    }

    const project = projectStorage.getProjectById(targetProjectId);
    if (!project) {
      vscode.window.showErrorMessage("Project not found");
      return;
    }

    const channel = vscode.window.createOutputChannel(
      "AppForge - Connection Info",
    );
    channel.clear();
    channel.show(vscode.ViewColumn.Beside);

    channel.appendLine(`=== Connection Info: ${project.projectName} ===\n`);
    channel.appendLine(`Project Name: ${project.projectName}`);
    channel.appendLine(`Project ID: ${project.projectId}`);
    channel.appendLine(`Endpoint: ${project.endpoint}`);

    const apiKey = await projectStorage.getApiKey(targetProjectId);
    if (apiKey) {
      channel.appendLine(`API Key: [SET]`);
      channel.appendLine(`API Key Length: ${apiKey.length} characters`);
      channel.appendLine(`API Key Prefix: ${apiKey.substring(0, 10)}...`);
    } else {
      channel.appendLine(`API Key: [NOT SET]`);
    }

    channel.appendLine("");
    channel.appendLine("To test connection:");
    channel.appendLine('  1. Run "AppForge: Check Project Status"');
    channel.appendLine("  2. Check the output for database list");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${msg}`);
  }
}
