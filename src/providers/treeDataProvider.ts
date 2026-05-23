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
import { outputChannel } from "../core/output/outputChannel";
import { refreshManager } from "../core/refresh/refreshManager";
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

    this.id = data.treeId ?? AppForgeTreeItem.buildStableId(data);
    outputChannel.debug("TREE-ID", "TreeItem created", {
      type: data.type,
      id: this.id,
    });

    // Set icons based on type
    this.setIconAndCommand();
  }

  private static buildStableId(data: TreeItemData): string {
    switch (data.type) {
      case "project":
        return `project:${data.id ?? data.label}`;
      case "databases":
        return `databases:${data.projectId ?? data.label}`;
      case "database":
        return `database:${data.projectId ?? ""}:${data.id ?? data.label}`;
      case "collection":
        return `collection:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.id ?? data.label}`;
      case "functions":
        return data.id
          ? `function:${data.projectId ?? ""}:${data.id}`
          : `functions:${data.projectId ?? data.label}`;
      case "logs":
        return `logs:${data.projectId ?? data.label}`;
      case "root":
        return `root:${data.label}`;
      default:
        return `${data.type}:${data.projectId ?? ""}:${data.id ?? data.label}`;
    }
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

  private view?: vscode.TreeView<AppForgeTreeItem>;
  private expandedIds: Set<string> = new Set();
  private loadingNodes: Map<string, boolean> = new Map();

  /**
   * Attach the TreeView instance so we can listen to expand/collapse and
   * subscribe to refresh manager events for live updates.
   */
  public attachView(view: vscode.TreeView<AppForgeTreeItem>): void {
    this.view = view;

    // Track expansion state
    view.onDidExpandElement((e) => {
      const id = e.element?.id;
      if (id) {
        this.expandedIds.add(id);
      }
    });
    view.onDidCollapseElement((e) => {
      const id = e.element?.id;
      if (id) {
        this.expandedIds.delete(id);
      }
    });

    // Subscribe to refresh manager events
    refreshManager.onRefresh((request) => {
      // For now, trigger a refresh and mark a simple loading state
      try {
        // mark a generic loading indicator for the scope
        const key = `scope:${request.scope}:${request.nodeId || ""}`;
        this.loadingNodes.set(key, true);
        this._onDidChangeTreeData.fire(null);

        // clear loading after a short delay (RefreshManager will trigger real updates)
        setTimeout(() => {
          this.loadingNodes.delete(key);
          this._onDidChangeTreeData.fire(null);
        }, 800);
      } catch (e) {
        outputChannel.error(
          "TREE",
          "Error handling refreshManager event",
          e as Error,
        );
      }
    });

    refreshManager.onLoadingChange((nodeId, isLoading) => {
      // When loading state changes, re-render affected nodes
      try {
        if (isLoading) {
          this.loadingNodes.set(nodeId, true);
        } else {
          this.loadingNodes.delete(nodeId);
        }
        this._onDidChangeTreeData.fire(null);
      } catch (e) {
        outputChannel.error(
          "TREE",
          "Error handling loading change",
          e as Error,
        );
      }
    });
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  private isExpanded(nodeId: string): boolean {
    return this.expandedIds.has(nodeId);
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
      outputChannel.debug("TREE", "getChildren called", {
        elementType: element?.data.type ?? "root",
        elementId: element?.id,
        dataId: element?.data.id,
        projectId: element?.data.projectId,
      });

      // Root level - show Projects, Databases, Functions, Logs
      if (!element) {
        const rootChildren = this.getRootChildren();
        outputChannel.debug("TREE", "Returning root children", {
          count: rootChildren.length,
          childIds: rootChildren.map((child) => child.id),
        });
        return rootChildren;
      }

      // Project level
      if (element.data.type === "project") {
        const projectChildren = this.getProjectChildren(element);
        outputChannel.debug("TREE", "Returning project children", {
          projectId: element.data.id,
          count: projectChildren.length,
          childIds: projectChildren.map((child) => child.id),
        });
        return projectChildren;
      }

      // Databases section
      if (element.data.type === "databases") {
        const databaseChildren = await this.getDatabasesChildren(element);
        outputChannel.debug("TREE", "Returning database children", {
          projectId: element.data.projectId,
          count: databaseChildren.length,
          childIds: databaseChildren.map((child) => child.id),
        });
        return databaseChildren;
      }

      // Database children (collections)
      if (element.data.type === "database") {
        const collectionChildren =
          await this.getDatabaseCollectionsChildren(element);
        outputChannel.debug("TREE", "Returning collection children", {
          projectId: element.data.projectId,
          databaseId: element.data.id,
          count: collectionChildren.length,
          childIds: collectionChildren.map((child) => child.id),
        });
        return collectionChildren;
      }

      // Functions section
      if (element.data.type === "functions") {
        const functionChildren = await this.getFunctionsChildren(element);
        outputChannel.debug("TREE", "Returning function children", {
          projectId: element.data.projectId,
          count: functionChildren.length,
          childIds: functionChildren.map((child) => child.id),
        });
        return functionChildren;
      }

      return [];
    } catch (error) {
      outputChannel.error(
        "TREE",
        "Error getting tree children",
        error as Error,
      );
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
      treeId: "root:Add Project",
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
        treeId: "root:Projects",
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
        treeId: `project:${project.projectId}`,
      };
      const projectNodeId = `project:${project.projectId}`;
      // Show active project highlight
      const isActive =
        this.appwriteClient.getActiveProject()?.projectId === project.projectId;
      const label = isActive
        ? `📁 ${project.projectName} (active)`
        : `📁 ${project.projectName}`;
      const item = new AppForgeTreeItem(
        label,
        this.isExpanded(projectNodeId)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        projectData,
        this.extensionUri,
      );
      if (isActive) {
        item.description = "Active";
      }
      children.push(item);
    });

    return children;
  }

  private getProjectChildren(element: AppForgeTreeItem): AppForgeTreeItem[] {
    const children: AppForgeTreeItem[] = [];
    const projectId = element.data.id;

    // Databases section
    const databasesData: TreeItemData = {
      type: "databases",
      label: "Databases",
      projectId,
      treeId: `databases:${projectId}`,
    };
    const databasesNodeId = `databases:${projectId}`;
    children.push(
      new AppForgeTreeItem(
        "📦 Databases",
        this.isExpanded(databasesNodeId)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        databasesData,
        this.extensionUri,
      ),
    );

    // Functions section
    const functionsData: TreeItemData = {
      type: "functions",
      label: "Functions",
      projectId,
      treeId: `functions:${projectId}`,
    };
    const functionsNodeId = `functions:${projectId}`;
    children.push(
      new AppForgeTreeItem(
        "⚙️ Functions",
        this.isExpanded(functionsNodeId)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        functionsData,
        this.extensionUri,
      ),
    );

    // Logs section
    const logsData: TreeItemData = {
      type: "logs",
      label: "Logs",
      projectId,
      treeId: `logs:${projectId}`,
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

    outputChannel.debug("TREE", "Built project children", {
      projectId,
      count: children.length,
      childIds: children.map((child) => child.id),
    });

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

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) {
        outputChannel.error("DATABASES", "Missing API key for project", {
          projectId,
        });
        return [
          new AppForgeTreeItem(
            "❌ No API key configured",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "databases",
              label: "Failed to load",
              id: "api-key-missing",
              projectId,
              treeId: `databases:${projectId}:api-key-missing`,
            },
            this.extensionUri,
          ),
        ];
      }

      // Recreate the databases client for every requested project to avoid
      // any stale client reuse across project switches.
      this.appwriteClient.initialize(project, apiKey);

      // Auto-switch to this project if not already active
      let activeProject = this.appwriteClient.getActiveProject();
      if (!activeProject || activeProject.projectId !== projectId) {
        try {
          logger.debug("TREE", "Auto-switching project", { projectId });
          logger.debug("TREE", "API key retrieved, initializing client", {
            projectId,
          });
          // Client already initialized above for the requested project.
          activeProject = this.appwriteClient.getActiveProject();
          logger.success("TREE", "Project switched successfully", {
            projectId,
          });
        } catch (switchError) {
          logger.error("TREE", "Error switching project", switchError);
          const errorData: TreeItemData = {
            type: "databases",
            label: "Failed to load",
            id: "switch-error",
            projectId,
            treeId: `databases:${projectId}:switch-error`,
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
        outputChannel.debug("DATABASES", "Fetch starting", {
          requestedProjectId: projectId,
          activeProjectId: activeProject?.projectId,
          expectedEndpoint: project.endpoint,
        });
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
        const databasesClient = this.appwriteClient.getDatabases();
        outputChannel.debug("DATABASES", "Client config", {
          endpoint: project.endpoint,
          project: project.projectId,
        });

        let response: any;
        try {
          response = await Promise.race([
            databasesClient.list(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Database fetch timeout (30s)")),
                30000,
              ),
            ),
          ]);
        } catch (fetchError) {
          outputChannel.error("DATABASES", "Fetch failed", fetchError as Error);
          throw fetchError;
        }

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

        outputChannel.debug("DATABASES", "Raw response", {
          projectId,
          total: response?.total,
          databases: response?.databases?.map((db: any) => ({
            id: db.$id,
            name: db.name,
          })),
        });

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
            id: "empty",
            projectId,
            treeId: `database:${projectId}:empty`,
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
            treeId: `database:${projectId}:${id}`,
          };
          const nodeKey = `db:${projectId}:${id}`;
          const loading = this.loadingNodes.get(nodeKey) || false;
          const labelText = loading ? `📦 ${name} ⏳` : `📦 ${name}`;
          children.push(
            new AppForgeTreeItem(
              labelText,
              this.isExpanded(nodeKey)
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed,
              dbData,
              this.extensionUri,
            ),
          );
        });

        outputChannel.debug("DATABASES", "Final mapped nodes", {
          projectId,
          ids: children.map((item) => item.id),
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
          id: "load-error",
          projectId,
          treeId: `databases:${projectId}:load-error`,
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
      outputChannel.error(
        "TREE",
        "Error in getDatabasesChildren",
        error as Error,
      );
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
            outputChannel.error("TREE", "Error switching project", e as Error);
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
            id: "empty",
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
          const nodeKey = `col:${projectId}:${databaseId}:${id}`;
          const loading = this.loadingNodes.get(nodeKey) || false;
          const item = new AppForgeTreeItem(
            loading ? `${name} ⏳` : name,
            vscode.TreeItemCollapsibleState.None,
            colData,
            this.extensionUri,
          );
          // Make collections clickable to open database viewer
          item.command = {
            command: "appforge.viewDatabase",
            title: "View Collection",
            arguments: [item],
          };
          children.push(item);
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
          id: "load-error",
          projectId,
          treeId: `collection:${projectId}:${databaseId}:load-error`,
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
      outputChannel.error(
        "TREE",
        "Error in getDatabaseCollectionsChildren",
        error as Error,
      );
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
          outputChannel.error(
            "TREE",
            "Error switching project",
            switchError as Error,
          );
          const errorData: TreeItemData = {
            type: "functions",
            label: "Failed to load",
            id: "switch-error",
            projectId,
            treeId: `functions:${projectId}:switch-error`,
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
            id: "empty",
            projectId,
            treeId: `functions:${projectId}:empty`,
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
            treeId: `function:${projectId}:${fn.$id}`,
          };
          const nodeKey = `fn:${projectId}:${fn.$id}`;
          const loading = this.loadingNodes.get(nodeKey) || false;
          const statusIcon = fn.status === "enabled" ? "✓" : "✗";
          const item = new AppForgeTreeItem(
            `${fn.name} ${statusIcon} ${loading ? "⏳" : ""}`.trim(),
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
        outputChannel.error(
          "TREE",
          "Error listing functions",
          listError as Error,
        );
        const errorData: TreeItemData = {
          type: "functions",
          label: "Error",
          id: "load-error",
          projectId,
          treeId: `functions:${projectId}:load-error`,
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
      outputChannel.error(
        "TREE",
        "Error in getFunctionsChildren",
        error as Error,
      );
      return [];
    }
  }
}
