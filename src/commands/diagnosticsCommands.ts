/**
 * Diagnostics Commands
 * Helps debug project and data retrieval issues
 */

import * as vscode from "vscode";
import { createRequire } from "module";
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
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.checkProjectStatus", async () => {
      await checkProjectStatusCommand(projectStorage, appwriteClient);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewConnectionInfo",
      async (projectId?: string) => {
        await viewConnectionInfoCommand(projectStorage, projectId);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.troubleshootEmptyDatabases",
      async () => {
        await troubleshootEmptyDatabasesCommand(projectStorage, appwriteClient);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.verifyAppwriteProjectEnvironment",
      async () => {
        await verifyAppwriteProjectEnvironmentCommand(
          projectStorage,
          appwriteClient,
        );
      },
    ),
  );
}

async function checkProjectStatusCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): Promise<void> {
  try {
    const channel = vscode.window.createOutputChannel("AppForge - Diagnostics");
    channel.clear();
    channel.show(vscode.ViewColumn.Beside);

    const projectWithKey = await projectStorage.getActiveProjectWithApiKey();
    channel.appendLine("=== AppForge Diagnostics ===\n");

    if (!projectWithKey) {
      channel.appendLine("❌ No active project loaded");
      channel.appendLine(
        "  → Use AppForge: Add Project to create a new project",
      );
      return;
    }

    channel.appendLine(`✓ Active Project: ${projectWithKey.projectName}`);
    channel.appendLine(`  Endpoint: ${projectWithKey.endpoint}`);
    channel.appendLine(`  Project ID: ${projectWithKey.projectId}`);
    channel.appendLine("");

    channel.appendLine("Attempting to fetch databases...\n");

    try {
      const databases = appwriteClient.createDatabasesService(
        projectWithKey,
        projectWithKey.apiKey,
      );
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

          try {
            const collections = appwriteClient.createDatabasesService(
              projectWithKey,
              projectWithKey.apiKey,
            );
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

async function viewConnectionInfoCommand(
  projectStorage: ProjectStorageService,
  projectId?: string,
): Promise<void> {
  try {
    let targetProjectId = projectId;

    if (!targetProjectId) {
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

        const response = await appwriteClient
          .createDatabasesService(project, apiKey)
          .list();
        const dbCount =
          (response as any)?.total ?? (response as any)?.databases?.length ?? 0;
        channel.appendLine(
          `   📊 API Response: { total: ${dbCount}, databases: [...] }`,
        );

        if (dbCount === 0) {
          channel.appendLine(`   ⚠️  ISSUE: 0 databases found`);
          channel.appendLine("");
          channel.appendLine(`   TROUBLESHOOTING STEPS:`);
          channel.appendLine(`   1. ✓ API key is working (no auth errors)`);
          channel.appendLine(`   2. ✓ Project context is correct`);
          channel.appendLine(
            `   3. ? Databases may not exist OR key lacks scopes`,
          );
          channel.appendLine("");
          channel.appendLine(`   NEXT STEPS:`);
          channel.appendLine(`   a) Verify in Appwrite console:`);
          channel.appendLine(`      - Login to https://console.appwrite.io`);
          channel.appendLine(`      - Select project: ${project.projectName}`);
          channel.appendLine(`      - Go to Databases section`);
          channel.appendLine(`      - Confirm databases actually exist`);
          channel.appendLine("");
          channel.appendLine(`   b) Check API key permissions:`);
          channel.appendLine(`      - In console, go to Settings → API Keys`);
          channel.appendLine(`      - Verify key has "databases.read" scope`);
          channel.appendLine(
            `      - Consider using an Admin key with full permissions`,
          );
          channel.appendLine("");
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

async function verifyAppwriteProjectEnvironmentCommand(
  projectStorage: ProjectStorageService,
  appwriteClient: AppwriteClientService,
): Promise<void> {
  try {
    const channel = vscode.window.createOutputChannel(
      "AppForge - Environment Verification",
    );
    channel.clear();
    channel.show(vscode.ViewColumn.Beside);

    channel.appendLine("=== APPWRITE PROJECT ENVIRONMENT VERIFICATION ===\n");
    channel.appendLine(`node-appwrite version: ${getNodeAppwriteVersion()}`);

    const projects = projectStorage.getProjects();
    if (projects.length === 0) {
      channel.appendLine("❌ No stored projects found.");
      return;
    }

    for (const project of projects) {
      const apiKey = await projectStorage.getApiKey(project.projectId);
      const activeProjectId = projectStorage.getActiveProjectId();
      const apiKeyPrefix = apiKey ? apiKey.substring(0, 6) : "<missing>";

      channel.appendLine(`\n📌 Stored project: ${project.projectName}`);
      channel.appendLine(`   Project ID: ${project.projectId}`);
      channel.appendLine(`   Endpoint: ${project.endpoint}`);
      channel.appendLine(`   Storage source: workspaceState + secretStorage`);
      channel.appendLine(
        `   Active project source: ${activeProjectId ?? "<none>"}`,
      );
      channel.appendLine(`   API key prefix: ${apiKeyPrefix}`);

      if (!apiKey) {
        channel.appendLine(`   ❌ No API key found for this project`);
        continue;
      }

      const sdkResponse = await appwriteClient
        .createDatabasesService(project, apiKey)
        .list();
      const rawDatabases = await fetchAppwriteJson(
        project.endpoint,
        project.projectId,
        apiKey,
        "/databases",
      );
      const rawProjects = await fetchAppwriteJson(
        project.endpoint,
        project.projectId,
        apiKey,
        "/projects",
      );

      channel.appendLine(
        `   SDK /databases => total: ${(sdkResponse as any)?.total ?? 0}, count: ${(sdkResponse as any)?.databases?.length ?? 0}`,
      );
      channel.appendLine(
        `   RAW /databases => status: ${rawDatabases.status}, body type: ${Array.isArray((rawDatabases.body as any)?.databases) ? "array" : typeof rawDatabases.body}`,
      );
      channel.appendLine(
        `   RAW /projects => status: ${rawProjects.status}, body type: ${Array.isArray((rawProjects.body as any)?.projects) ? "array" : typeof rawProjects.body}`,
      );

      const remoteProjects = extractProjectRows(rawProjects.body);
      if (remoteProjects.length > 0) {
        channel.appendLine("   Remote projects:");
        for (const remoteProject of remoteProjects) {
          channel.appendLine(
            `     • ${remoteProject.name} | ${remoteProject.id} | ${remoteProject.endpoint ?? "<no endpoint>"}`,
          );
        }
      } else {
        channel.appendLine(
          "   Remote projects: <none extracted from response>",
        );
      }

      const rawDatabasesList = extractProjectRows(rawDatabases.body);
      if (rawDatabasesList.length > 0) {
        channel.appendLine("   Raw databases parsed as project-like rows:");
        for (const row of rawDatabasesList) {
          channel.appendLine(`     • ${row.name} | ${row.id}`);
        }
      }
    }

    channel.appendLine("\n=== END VERIFICATION ===");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Environment verification error: ${msg}`);
  }
}

async function fetchAppwriteJson(
  endpoint: string,
  projectId: string,
  apiKey: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${endpoint}${path}`, {
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }

  return {
    status: response.status,
    body,
  };
}

function extractProjectRows(body: unknown): Array<{
  id: string;
  name: string;
  endpoint?: string;
}> {
  if (!body || typeof body !== "object") {
    return [];
  }

  const candidates = [
    (body as { projects?: unknown }).projects,
    (body as { databases?: unknown }).databases,
    (body as { projectsList?: unknown }).projectsList,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    const rows: Array<{
      id: string;
      name: string;
      endpoint?: string;
    }> = [];

    for (const item of candidate) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const typedItem = item as {
        $id?: string;
        id?: string;
        name?: string;
        endpoint?: string;
      };

      rows.push({
        id: typedItem.$id ?? typedItem.id ?? "<no id>",
        name: typedItem.name ?? "<no name>",
        endpoint: typedItem.endpoint,
      });
    }

    return rows;
  }

  return [];
}

function getNodeAppwriteVersion(): string {
  try {
    const require = createRequire(__filename);
    const packageJson = require("node-appwrite/package.json") as {
      version?: string;
    };
    return packageJson.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
