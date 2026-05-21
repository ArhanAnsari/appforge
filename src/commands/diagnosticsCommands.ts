/**
 * Diagnostics Commands
 * Helps debug project and data retrieval issues
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { logger } from "../utils/logger";

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

  // Troubleshoot Empty Databases
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.troubleshootEmptyDatabases",
      async () => {
        await troubleshootEmptyDatabasesCommand(projectStorage, appwriteClient);
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

/**
 * Troubleshoot why databases are showing as empty
 */
async function troubleshootEmptyDatabasesCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): Promise<void> {
  try {
    const channel = vscode.window.createOutputChannel(
      "AppForge - Database Troubleshoot",
    );
    channel.clear();
    channel.show(vscode.ViewColumn.Beside);

    channel.appendLine("=== DATABASE TROUBLESHOOTING ===\n");

    const projects = projectStorage.getProjects();
    if (projects.length === 0) {
      channel.appendLine("❌ No projects found. Add a project first.");
      return;
    }

    for (const project of projects) {
      channel.appendLine(`\n📌 Testing: ${project.projectName}`);
      channel.appendLine(`   Project ID: ${project.projectId}`);
      channel.appendLine(`   Endpoint: ${project.endpoint}`);

      try {
        const apiKey = await projectStorage.getApiKey(project.projectId);
        if (!apiKey) {
          channel.appendLine(`   ❌ No API key found`);
          continue;
        }

        channel.appendLine(`   ✅ API key found (${apiKey.length} chars)`);

        // Initialize client for this project
        appwriteClient.initialize(project, apiKey);
        const activeProject = appwriteClient.getActiveProject();
        channel.appendLine(
          `   ✅ Client initialized for ${activeProject?.projectId}`,
        );

        // Try to fetch databases
        const response = await appwriteClient.getDatabases().list();
        const dbCount =
          (response as any)?.total ?? (response as any)?.databases?.length ?? 0;
        channel.appendLine(
          `   📊 API Response: { total: ${dbCount}, databases: [...] }`,
        );

        if (dbCount === 0) {
          channel.appendLine(`   ⚠️  ISSUE: 0 databases found`);
          channel.appendLine(``);
          channel.appendLine(`   TROUBLESHOOTING STEPS:`);
          channel.appendLine(`   1. ✓ API key is working (no auth errors)`);
          channel.appendLine(`   2. ✓ Project context is correct`);
          channel.appendLine(
            `   3. ? Databases may not exist OR key lacks scopes`,
          );
          channel.appendLine(``);
          channel.appendLine(`   NEXT STEPS:`);
          channel.appendLine(`   a) Verify in Appwrite console:`);
          channel.appendLine(`      - Login to https://console.appwrite.io`);
          channel.appendLine(`      - Select project: ${project.projectName}`);
          channel.appendLine(`      - Go to Databases section`);
          channel.appendLine(`      - Confirm databases actually exist`);
          channel.appendLine(``);
          channel.appendLine(`   b) Check API key permissions:`);
          channel.appendLine(`      - In console, go to Settings → API Keys`);
          channel.appendLine(`      - Verify key has "databases.read" scope`);
          channel.appendLine(
            `      - Consider using an Admin key with full permissions`,
          );
          channel.appendLine(``);
          channel.appendLine(`   c) Try with a new API key:`);
          channel.appendLine(
            `      - Create a new API key with all database scopes`,
          );
          channel.appendLine(
            `      - Run "AppForge: Add Project" to configure it`,
          );
        } else {
          channel.appendLine(`   ✅ Found ${dbCount} database(s)`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        channel.appendLine(`   ❌ Error: ${msg}`);
      }
    }

    channel.appendLine("\n=== END TROUBLESHOOTING ===");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Troubleshooting error: ${msg}`);
  }
}
