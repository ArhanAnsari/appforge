/**
 * AppForge Tree Data Provider
 * Manages the tree view in the sidebar for Projects, Databases, Functions, and Logs
 */

import * as vscode from "vscode";
import * as path from "path";
import { TreeItemData, StoredProject } from "../types";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { logger } from "../utils/logger";
import { extractObjectArrayWithId } from "../utils/responseParser";

/**
 * Tree item for the AppForge sidebar
 */
export class AppForgeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly data: TreeItemData,
    private extensionUri?: vscode.Uri,
  ) {
    super(label, collapsibleState);

    // Set icons based on type
    this.setIconAndCommand();
  }

  private setIconAndCommand(): void {
    // Use custom icon for root, theme icons for others
    if (this.data.type === "root" && this.extensionUri) {
      this.iconPath = vscode.Uri.joinPath(
        this.extensionUri,
        "assets",
        "appforge.png",
      );
    } else {
      const iconName = this.getIconName();
      this.iconPath = new vscode.ThemeIcon(iconName);
    }

    // Add context value for conditional menus
    this.contextValue = this.data.type;

    if (this.data.type === "project") {
      this.command = {
        command: "appforge.switchProject",
        title: "Switch Project",
        arguments: [this.data.id],
      };
    }
  }

  private getIconName(): string {
    switch (this.data.type) {
      case "root":
        return "folder-opened";
      case "project":
        return "package";
      case "databases":
        return "database";
      case "database":
        return "table";
      case "collection":
        return "list-unordered";
      case "functions":
        return "code";
      case "logs":
        return "list-flat";
      default:
        return "file";
    }
  }
}

/**
 * Tree data provider for AppForge sidebar
 */
export class AppForgeTreeDataProvider implements vscode.TreeDataProvider<AppForgeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    AppForgeTreeItem | undefined | null | void
  > = new vscode.EventEmitter<AppForgeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    AppForgeTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private projectStorage: ProjectStorageService,
    private appwriteClient: AppwriteClientService,
    private extensionUri: vscode.Uri,
  ) {}

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  /**
   * Get root children (projects section)
   */
  public getTreeItem(element: AppForgeTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for a tree item
   */
  public async getChildren(
    element?: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    try {
      // Root level - show Projects, Databases, Functions, Logs
      if (!element) {
        return this.getRootChildren();
      }

      // Project level
      if (element.data.type === "project") {
        return this.getProjectChildren(element);
      }

      // Databases section
      if (element.data.type === "databases") {
        return this.getDatabasesChildren(element);
      }

      // Database children (collections)
      if (element.data.type === "database") {
        return this.getDatabaseCollectionsChildren(element);
      }

      // Functions section
      if (element.data.type === "functions") {
        return this.getFunctionsChildren(element);
      }

      return [];
    } catch (error) {
      console.error("Error getting tree children:", error);
      return [];
    }
  }

  private getRootChildren(): AppForgeTreeItem[] {
    const projects = this.projectStorage.getProjects();
    const children: AppForgeTreeItem[] = [];

    // Add action item to add new project at the top
    const addProjectData: TreeItemData = {
      type: "root",
      label: "Add Project",
    };
    const addItem = new AppForgeTreeItem(
      "➕ Add New Project",
      vscode.TreeItemCollapsibleState.None,
      addProjectData,
      this.extensionUri,
    );
    addItem.command = {
      command: "appforge.addProject",
      title: "Add Project",
    };
    children.push(addItem);

    // Add separator
    if (projects.length > 0) {
      const separatorData: TreeItemData = {
        type: "root",
        label: "Projects",
      };
      children.push(
        new AppForgeTreeItem(
          "─────────────",
          vscode.TreeItemCollapsibleState.None,
          separatorData,
          this.extensionUri,
        ),
      );
    }

    // Add project items
    projects.forEach((project) => {
      const projectData: TreeItemData = {
        type: "project",
        label: project.projectName,
        id: project.projectId,
      };
      children.push(
        new AppForgeTreeItem(
          `📁 ${project.projectName}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          projectData,
          this.extensionUri,
        ),
      );
    });

    return children;
  }

  private getProjectChildren(element: AppForgeTreeItem): AppForgeTreeItem[] {
    const children: AppForgeTreeItem[] = [];

    // Databases section
    const databasesData: TreeItemData = {
      type: "databases",
      label: "Databases",
      projectId: element.data.id,
    };
    children.push(
      new AppForgeTreeItem(
        "📦 Databases",
        vscode.TreeItemCollapsibleState.Collapsed,
        databasesData,
        this.extensionUri,
      ),
    );

    // Functions section
    const functionsData: TreeItemData = {
      type: "functions",
      label: "Functions",
      projectId: element.data.id,
    };
    children.push(
      new AppForgeTreeItem(
        "⚙️ Functions",
        vscode.TreeItemCollapsibleState.Collapsed,
        functionsData,
        this.extensionUri,
      ),
    );

    // Logs section
    const logsData: TreeItemData = {
      type: "logs",
      label: "Logs",
      projectId: element.data.id,
    };
    const logsItem = new AppForgeTreeItem(
      "📋 Logs",
      vscode.TreeItemCollapsibleState.None,
      logsData,
      this.extensionUri,
    );
    logsItem.command = {
      command: "appforge.viewLogs",
      title: "View Logs",
      arguments: [element.data.id],
    };
    children.push(logsItem);

    return children;
  }

  private async getDatabasesChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    try {
      const projectId = element.data.projectId;
      if (!projectId) {
        return [];
      }

      const project = this.projectStorage.getProjectById(projectId);
      if (!project) {
        return [];
      }

      // Auto-switch to this project if not already active
      let activeProject = this.appwriteClient.getActiveProject();
      if (!activeProject || activeProject.projectId !== projectId) {
        try {
          logger.debug("TREE", "Auto-switching project", { projectId });
          const apiKey = await this.projectStorage.getApiKey(projectId);
          if (!apiKey) {
            logger.error("TREE", "No API key found for project", { projectId });
            const errorData: TreeItemData = {
              type: "databases",
              label: "Failed to load",
              projectId,
            };
            return [
              new AppForgeTreeItem(
                "❌ No API key configured",
                vscode.TreeItemCollapsibleState.None,
                errorData,
                this.extensionUri,
              ),
            ];
          }
          logger.debug("TREE", "API key retrieved, initializing client", {
            projectId,
          });
          this.appwriteClient.initialize(project, apiKey);
          activeProject = this.appwriteClient.getActiveProject();
          logger.success("TREE", "Project switched successfully", {
            projectId,
          });
        } catch (switchError) {
          logger.error("TREE", "Error switching project", switchError);
          const errorData: TreeItemData = {
            type: "databases",
            label: "Failed to load",
            projectId,
          };
          return [
            new AppForgeTreeItem(
              "❌ Failed to load databases",
              vscode.TreeItemCollapsibleState.None,
              errorData,
              this.extensionUri,
            ),
          ];
        }
      }

      // Now fetch databases (with robust diagnostics and timeout)
      try {
        const activeProject = this.appwriteClient.getActiveProject();
        logger.debug("TREE", "Fetching databases for project", {
          projectId,
          endpoint: project.endpoint,
          activeProjectId: activeProject?.projectId,
        });

        // Log the exact project context being used
        logger.info("TREE", "=== PROJECT CONTEXT ===", null);
        logger.info("TREE", "Target project ID", projectId);
        logger.info("TREE", "Target endpoint", project.endpoint);
        logger.info(
          "TREE",
          "Active project ID after init",
          activeProject?.projectId,
        );
        logger.info(
          "TREE",
          "Context matches",
          activeProject?.projectId === projectId,
        );
        logger.info("TREE", "=== END PROJECT CONTEXT ===", null);

        logger.info("TREE", "Starting API call to list databases...", null);

        // Fetch databases with timeout
        const response = await Promise.race([
          this.appwriteClient.getDatabases().list(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Database fetch timeout (30s)")),
              30000,
            ),
          ),
        ]);

        logger.success("TREE", "API call completed successfully", null);

        // Log full response for debugging - handle circular refs
        logger.info("TREE", "=== RAW API RESPONSE ===", null);
        logger.info("TREE", "Response type", typeof response);
        logger.info(
          "TREE",
          "Response instanceof Object",
          response instanceof Object,
        );
        logger.info(
          "TREE",
          "Response keys",
          response && typeof response === "object"
            ? Object.keys(response)
            : "N/A",
        );
        logger.info("TREE", "Response.total", (response as any)?.total);
        logger.info(
          "TREE",
          "Response.databases length",
          (response as any)?.databases?.length,
        );

        // Safely stringify with replacer to avoid circular refs
        try {
          const seen = new WeakSet();
          const jsonStr = JSON.stringify(
            response,
            (key, value) => {
              if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                  return "[Circular]";
                }
                seen.add(value);
              }
              return value;
            },
            2,
          );
          logger.info("TREE", "Response JSON", jsonStr);
        } catch (stringifyError) {
          logger.error("TREE", "Failed to stringify response", stringifyError);
          logger.info("TREE", "Response toString", response?.toString());
        }

        logger.info("TREE", "=== END RAW RESPONSE ===", null);

        const databases = extractObjectArrayWithId(response);
        logger.debug("TREE", "Extracted databases array", {
          length: databases.length,
          sample: databases.slice(0, 3),
        });

        const children: AppForgeTreeItem[] = [];

        if (databases.length === 0) {
          const emptyData: TreeItemData = {
            type: "databases",
            label: "No databases",
            projectId,
          };
          logger.info("TREE", "No databases found for project", { projectId });
          return [
            new AppForgeTreeItem(
              "📭 No databases yet",
              vscode.TreeItemCollapsibleState.None,
              emptyData,
              this.extensionUri,
            ),
          ];
        }

        databases.forEach((db: any) => {
          const id = db.$id || db.id || db.databaseId || db.name;
          const name = db.name || db.$id || db.id;
          const dbData: TreeItemData = {
            type: "database",
            label: name,
            id,
            projectId,
          };
          children.push(
            new AppForgeTreeItem(
              `📦 ${name}`,
              vscode.TreeItemCollapsibleState.Collapsed,
              dbData,
              this.extensionUri,
            ),
          );
        });

        logger.success("TREE", "Returning database items", {
          projectId,
          count: children.length,
        });
        return children;
      } catch (listError) {
        logger.error("TREE", "Error listing databases", listError);
        const errorData: TreeItemData = {
          type: "databases",
          label: "Error",
          projectId,
        };
        return [
          new AppForgeTreeItem(
            `❌ Error: ${listError instanceof Error ? listError.message : "Unknown error"}`,
            vscode.TreeItemCollapsibleState.None,
            errorData,
            this.extensionUri,
          ),
        ];
      }
    } catch (error) {
      console.error("Error in getDatabasesChildren:", error);
      return [];
    }
  }

  private async getDatabaseCollectionsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    try {
      const projectId = element.data.projectId;
      const databaseId = element.data.id;

      if (!projectId || !databaseId) {
        return [];
      }

      // Auto-switch to this project if needed
      let activeProject = this.appwriteClient.getActiveProject();
      if (!activeProject || activeProject.projectId !== projectId) {
        const project = this.projectStorage.getProjectById(projectId);
        if (project) {
          try {
            const apiKey = await this.projectStorage.getApiKey(projectId);
            if (apiKey) {
              this.appwriteClient.initialize(project, apiKey);
            }
          } catch (e) {
            console.error("Error switching project:", e);
          }
        }
      }

      try {
        logger.debug("TREE", "Fetching collections for database", {
          databaseId,
          projectId,
        });

        // Fetch collections with timeout
        const response = await Promise.race([
          this.appwriteClient.getDatabases().listCollections(databaseId),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Collections fetch timeout (30s)")),
              30000,
            ),
          ),
        ]);

        logger.success("TREE", "Collections API call completed", {
          databaseId,
        });

        const collections = extractObjectArrayWithId(response);
        logger.debug("TREE", "Extracted collections array", {
          length: collections.length,
          sample: collections.slice(0, 3),
        });

        const children: AppForgeTreeItem[] = [];

        if (collections.length === 0) {
          const emptyData: TreeItemData = {
            type: "collection",
            label: "No collections",
            projectId,
          };
          logger.info("TREE", "No collections found for database", {
            databaseId,
            projectId,
          });
          return [
            new AppForgeTreeItem(
              "No collections yet",
              vscode.TreeItemCollapsibleState.None,
              emptyData,
              this.extensionUri,
            ),
          ];
        }

        collections.forEach((col: any) => {
          const id = col.$id || col.id || col.collectionId || col.name;
          const name = col.name || col.$id || col.id;
          const colData: TreeItemData = {
            type: "collection",
            label: name,
            id,
            projectId,
            databaseId,
          };
          children.push(
            new AppForgeTreeItem(
              name,
              vscode.TreeItemCollapsibleState.None,
              colData,
              this.extensionUri,
            ),
          );
        });

        logger.success("TREE", "Returning collections items", {
          databaseId,
          projectId,
          count: children.length,
        });
        return children;
      } catch (listError) {
        logger.error("TREE", "Error listing collections", listError);
        const errorData: TreeItemData = {
          type: "collection",
          label: "Error",
          projectId,
        };
        return [
          new AppForgeTreeItem(
            `❌ Error: ${listError instanceof Error ? listError.message : "Unknown error"}`,
            vscode.TreeItemCollapsibleState.None,
            errorData,
            this.extensionUri,
          ),
        ];
      }
    } catch (error) {
      console.error("Error in getDatabaseCollectionsChildren:", error);
      return [];
    }
  }

  private async getFunctionsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    try {
      const projectId = element.data.projectId;
      if (!projectId) {
        return [];
      }

      const project = this.projectStorage.getProjectById(projectId);
      if (!project) {
        return [];
      }

      // Auto-switch to this project if not already active
      let activeProject = this.appwriteClient.getActiveProject();
      if (!activeProject || activeProject.projectId !== projectId) {
        try {
          const apiKey = await this.projectStorage.getApiKey(projectId);
          if (apiKey) {
            this.appwriteClient.initialize(project, apiKey);
            activeProject = this.appwriteClient.getActiveProject();
          }
        } catch (switchError) {
          console.error("Error switching project:", switchError);
          const errorData: TreeItemData = {
            type: "functions",
            label: "Failed to load",
            projectId,
          };
          return [
            new AppForgeTreeItem(
              "❌ Failed to load functions",
              vscode.TreeItemCollapsibleState.None,
              errorData,
              this.extensionUri,
            ),
          ];
        }
      }

      try {
        const response = await this.appwriteClient.getFunctions().list();
        const functions = response.functions || [];
        const children: AppForgeTreeItem[] = [];

        if (functions.length === 0) {
          const emptyData: TreeItemData = {
            type: "functions",
            label: "No functions",
            projectId,
          };
          return [
            new AppForgeTreeItem(
              "No functions yet",
              vscode.TreeItemCollapsibleState.None,
              emptyData,
              this.extensionUri,
            ),
          ];
        }

        functions.forEach((fn: any) => {
          const fnData: TreeItemData = {
            type: "functions",
            label: fn.name,
            id: fn.$id,
            projectId,
          };
          const item = new AppForgeTreeItem(
            `${fn.name} ${fn.status === "enabled" ? "✓" : "✗"}`,
            vscode.TreeItemCollapsibleState.None,
            fnData,
            this.extensionUri,
          );
          item.description = fn.status === "enabled" ? "Enabled" : "Disabled";
          item.command = {
            command: "appforge.executeFunction",
            title: "Execute Function",
            arguments: [fn.$id, projectId],
          };
          children.push(item);
        });

        return children;
      } catch (listError) {
        console.error("Error listing functions:", listError);
        const errorData: TreeItemData = {
          type: "functions",
          label: "Error",
          projectId,
        };
        return [
          new AppForgeTreeItem(
            `❌ Error: ${listError instanceof Error ? listError.message : "Unknown error"}`,
            vscode.TreeItemCollapsibleState.None,
            errorData,
            this.extensionUri,
          ),
        ];
      }
    } catch (error) {
      console.error("Error in getFunctionsChildren:", error);
      return [];
    }
  }
}
