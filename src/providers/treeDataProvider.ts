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
      case "attributes":
        return `attributes:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.collectionId ?? ""}`;
      case "attribute":
        return `attribute:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.collectionId ?? ""}:${data.id ?? data.label}`;
      case "indexes":
        return `indexes:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.collectionId ?? ""}`;
      case "index":
        return `index:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.collectionId ?? ""}:${data.id ?? data.label}`;
      case "documents":
        return `documents:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.collectionId ?? ""}`;
      case "document":
        return `document:${data.projectId ?? ""}:${data.databaseId ?? ""}:${data.collectionId ?? ""}:${data.id ?? data.label}`;
      case "functions":
        return data.id
          ? `function:${data.projectId ?? ""}:${data.id}`
          : `functions:${data.projectId ?? data.label}`;
      case "function":
        return `function:${data.projectId ?? ""}:${data.id ?? data.label}`;
      case "deployments":
        return `deployments:${data.projectId ?? ""}:${data.functionId ?? ""}`;
      case "deployment":
        return `deployment:${data.projectId ?? ""}:${data.functionId ?? ""}:${data.id ?? data.label}`;
      case "executions":
        return `executions:${data.projectId ?? ""}:${data.functionId ?? ""}`;
      case "execution":
        return `execution:${data.projectId ?? ""}:${data.functionId ?? ""}:${data.id ?? data.label}`;
      case "variables":
        return `variables:${data.projectId ?? ""}:${data.functionId ?? ""}`;
      case "variable":
        return `variable:${data.projectId ?? ""}:${data.functionId ?? ""}:${data.id ?? data.label}`;
      case "storage":
        return `storage:${data.projectId ?? data.label}`;
      case "buckets":
        return `buckets:${data.projectId ?? data.label}`;
      case "bucket":
        return `bucket:${data.projectId ?? ""}:${data.id ?? data.label}`;
      case "files":
        return `files:${data.projectId ?? ""}:${data.bucketId ?? ""}`;
      case "file":
        return `file:${data.projectId ?? ""}:${data.bucketId ?? ""}:${data.id ?? data.label}`;
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
      case "attributes":
        return "symbol-field";
      case "attribute":
        return "symbol-field";
      case "indexes":
        return "symbol-key";
      case "index":
        return "symbol-key";
      case "documents":
        return "files";
      case "document":
        return "file";
      case "functions":
        return "code";
      case "function":
        return "symbol-function";
      case "deployments":
        return "rocket";
      case "deployment":
        return "rocket";
      case "executions":
        return "run";
      case "execution":
        return "run";
      case "variables":
        return "symbol-variable";
      case "variable":
        return "symbol-variable";
      case "storage":
        return "cloud";
      case "buckets":
        return "folder";
      case "bucket":
        return "folder";
      case "files":
        return "files";
      case "file":
        return "file";
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

      // Collection children (attributes, indexes, documents)
      if (element.data.type === "collection") {
        const collectionDetailsChildren =
          await this.getCollectionDetailsChildren(element);
        outputChannel.debug("TREE", "Returning collection details children", {
          projectId: element.data.projectId,
          collectionId: element.data.id,
          count: collectionDetailsChildren.length,
          childIds: collectionDetailsChildren.map((child) => child.id),
        });
        return collectionDetailsChildren;
      }

      // Attributes children
      if (element.data.type === "attributes") {
        const attributeChildren = await this.getAttributesChildren(element);
        return attributeChildren;
      }

      // Indexes children
      if (element.data.type === "indexes") {
        const indexChildren = await this.getIndexesChildren(element);
        return indexChildren;
      }

      // Documents children
      if (element.data.type === "documents") {
        const documentChildren = await this.getDocumentsChildren(element);
        return documentChildren;
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

      // Function children (deployments, executions, variables)
      if (element.data.type === "function") {
        const functionDetailsChildren =
          await this.getFunctionDetailsChildren(element);
        return functionDetailsChildren;
      }

      // Deployments children
      if (element.data.type === "deployments") {
        const deploymentChildren = await this.getDeploymentsChildren(element);
        return deploymentChildren;
      }

      // Executions children
      if (element.data.type === "executions") {
        const executionChildren = await this.getExecutionsChildren(element);
        return executionChildren;
      }

      // Variables children
      if (element.data.type === "variables") {
        const variableChildren = await this.getVariablesChildren(element);
        return variableChildren;
      }

      // Storage/Buckets section
      if (element.data.type === "buckets") {
        const bucketChildren = await this.getBucketsChildren(element);
        return bucketChildren;
      }

      // Bucket children (files)
      if (element.data.type === "bucket") {
        const fileChildren = await this.getFilesChildren(element);
        return fileChildren;
      }

      // Files children
      if (element.data.type === "files") {
        const fileChildren = await this.getFilesChildren(element);
        return fileChildren;
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
        this.projectStorage.getActiveProjectId() === project.projectId;
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

    // Storage section (NEW for v0.2.0)
    const storageData: TreeItemData = {
      type: "buckets",
      label: "Storage",
      projectId,
      treeId: `buckets:${projectId}`,
    };
    const storageNodeId = `buckets:${projectId}`;
    children.push(
      new AppForgeTreeItem(
        "☁️ Storage",
        this.isExpanded(storageNodeId)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        storageData,
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
      outputChannel.debug("[TREE]", "getDatabasesChildren() called", {
        projectId,
      });

      if (!projectId) {
        outputChannel.error("[TREE]", "No projectId provided");
        return [];
      }

      const project = this.projectStorage.getProjectById(projectId);
      if (!project) {
        outputChannel.error("[TREE]", "Project not found", { projectId });
        return [];
      }

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) {
        outputChannel.error("[TREE]", "Missing API key for project", {
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

      outputChannel.debug("DATABASES", "Stored project metadata", {
        storageSource: "ProjectStorageService.getProjectById",
        activeProjectSource: "ProjectStorageService.getActiveProjectId",
        requestedProjectId: projectId,
        storedProject: project,
        apiKeyPrefix: apiKey.substring(0, 6),
        apiKeyLength: apiKey.length,
      });

      // Now fetch databases (with robust diagnostics and timeout)
      try {
        console.log("[TREE] Expanding databases node", {
          projectId,
          endpoint: project.endpoint,
        });
        console.log("[DATABASES] Fetching databases", { projectId });

        outputChannel.debug("DATABASES", "Fetch starting", {
          requestedProjectId: projectId,
          activeProjectId: this.projectStorage.getActiveProjectId(),
          expectedEndpoint: project.endpoint,
        });
        logger.debug("TREE", "Fetching databases for project", {
          projectId,
          endpoint: project.endpoint,
          activeProjectId: this.projectStorage.getActiveProjectId(),
        });

        // Log the exact project context being used
        logger.info("TREE", "=== PROJECT CONTEXT ===", null);
        logger.info("TREE", "Target project ID", projectId);
        logger.info("TREE", "Target endpoint", project.endpoint);
        logger.info(
          "TREE",
          "Active project ID from storage",
          this.projectStorage.getActiveProjectId(),
        );
        logger.info(
          "TREE",
          "Context matches",
          this.projectStorage.getActiveProjectId() === projectId,
        );
        logger.info("TREE", "=== END PROJECT CONTEXT ===", null);

        logger.info("TREE", "Starting API call to list databases...", null);
        console.log("[DATABASES] API call starting", {
          endpoint: project.endpoint,
        });

        try {
          const rawRes = await fetch(`${project.endpoint}/databases`, {
            headers: {
              "X-Appwrite-Project": projectId,
              "X-Appwrite-Key": apiKey,
              "Content-Type": "application/json",
            },
          });

          let rawBody: unknown;
          try {
            rawBody = await rawRes.json();
          } catch {
            rawBody = await rawRes.text();
          }

          outputChannel.debug("DATABASES", "RAW REST RESPONSE", {
            projectId,
            status: rawRes.status,
            body: rawBody,
          });
        } catch (rawFetchError) {
          outputChannel.error(
            "DATABASES",
            "RAW REST fetch failed",
            rawFetchError as Error,
          );
        }

        // Fetch databases with timeout
        const databasesClient = this.appwriteClient.createDatabasesService(
          project,
          apiKey,
        );
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
          console.error("[DATABASES] API call failed", fetchError);
          outputChannel.error("DATABASES", "Fetch failed", fetchError as Error);
          throw fetchError;
        }

        logger.success("TREE", "API call completed successfully", null);

        const databases = extractObjectArrayWithId(response);
        console.log("[DATABASES] API call success", {
          responseType: typeof response,
          hasTotal: !!response?.total,
          hasDatabases: !!response?.databases,
          databaseCount: databases.length,
        });
        console.log("[DATABASES] Found X databases", {
          projectId,
          count: databases.length,
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

      const project = this.projectStorage.getProjectById(projectId);
      if (!project) {
        return [];
      }

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) {
        return [];
      }

      try {
        logger.debug("TREE", "Fetching collections for database", {
          databaseId,
          projectId,
        });

        // Fetch collections with timeout
        const databasesClient = this.appwriteClient.createDatabasesService(
          project,
          apiKey,
        );
        const response = await Promise.race([
          databasesClient.listCollections(databaseId),
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

      try {
        const apiKey = await this.projectStorage.getApiKey(projectId);
        if (!apiKey) {
          return [];
        }

        const functionsClient = this.appwriteClient.createFunctionsService(
          project,
          apiKey,
        );
        const response = await functionsClient.list();
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

  private async getCollectionDetailsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const children: AppForgeTreeItem[] = [];
    const projectId = element.data.projectId;
    const databaseId = element.data.databaseId;
    const collectionId = element.data.id;

    // Attributes section
    const attributesData: TreeItemData = {
      type: "attributes",
      label: "Attributes",
      projectId,
      collectionId,
      databaseId,
      treeId: `attributes:${projectId}:${databaseId ?? ""}:${collectionId}`,
    };
    children.push(
      new AppForgeTreeItem(
        "🏷️ Attributes",
        this.isExpanded(`attributes:${projectId}:${databaseId ?? ""}:${collectionId}`)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        attributesData,
        this.extensionUri,
      ),
    );

    // Indexes section
    const indexesData: TreeItemData = {
      type: "indexes",
      label: "Indexes",
      projectId,
      collectionId,
      databaseId,
      treeId: `indexes:${projectId}:${databaseId ?? ""}:${collectionId}`,
    };
    children.push(
      new AppForgeTreeItem(
        "🔑 Indexes",
        this.isExpanded(`indexes:${projectId}:${databaseId ?? ""}:${collectionId}`)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        indexesData,
        this.extensionUri,
      ),
    );

    // Documents section
    const documentsData: TreeItemData = {
      type: "documents",
      label: "Documents",
      projectId,
      collectionId,
      databaseId,
      treeId: `documents:${projectId}:${databaseId ?? ""}:${collectionId}`,
    };
    children.push(
      new AppForgeTreeItem(
        "📄 Documents",
        this.isExpanded(`documents:${projectId}:${databaseId ?? ""}:${collectionId}`)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        documentsData,
        this.extensionUri,
      ),
    );

    return children;
  }

  private async getAttributesChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const collectionId = element.data.collectionId;
    const databaseId = element.data.databaseId;

    if (!projectId || !collectionId || !databaseId) {
      return [];
    }

    try {
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { DatabaseService } =
        await import("../services/databaseService.js");
      const dbService = new DatabaseService(project, apiKey);
      const { attributes } = await dbService.getCollectionDetails(
        databaseId,
        collectionId,
      );

      if (attributes.length === 0) {
        return [
          new AppForgeTreeItem(
            "No attributes",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "attribute",
              label: "No attributes",
              projectId,
              collectionId,
              treeId: `attribute:${projectId}:${collectionId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return attributes.map(
        (attr: any) =>
          new AppForgeTreeItem(
            `${attr.key} (${attr.type})${attr.required ? " *" : ""}`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "attribute",
              label: attr.key,
              id: attr.key,
              projectId,
              collectionId,
              treeId: `attribute:${projectId}:${collectionId}:${attr.key}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error(
        "[TREE]",
        "Error fetching attributes",
        error as Error,
      );
      return [];
    }
  }

  private async getIndexesChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const collectionId = element.data.collectionId;
    const databaseId = element.data.databaseId;

    if (!projectId || !collectionId || !databaseId) {
      return [];
    }

    try {
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { DatabaseService } =
        await import("../services/databaseService.js");
      const dbService = new DatabaseService(project, apiKey);
      const { indexes } = await dbService.getCollectionDetails(
        databaseId,
        collectionId,
      );

      if (indexes.length === 0) {
        return [
          new AppForgeTreeItem(
            "No indexes",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "index",
              label: "No indexes",
              projectId,
              collectionId,
              treeId: `index:${projectId}:${collectionId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return indexes.map(
        (idx: any) =>
          new AppForgeTreeItem(
            `${idx.key} (${idx.type})`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "index",
              label: idx.key,
              id: idx.key,
              projectId,
              collectionId,
              treeId: `index:${projectId}:${collectionId}:${idx.key}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error("[TREE]", "Error fetching indexes", error as Error);
      return [];
    }
  }

  private async getDocumentsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const collectionId = element.data.collectionId;
    const databaseId = element.data.databaseId;

    if (!projectId || !collectionId || !databaseId) {
      return [];
    }

    try {
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { DatabaseService } =
        await import("../services/databaseService.js");
      const dbService = new DatabaseService(project, apiKey);
      const documents = await dbService.listDocuments(databaseId, collectionId);

      if (documents.length === 0) {
        return [
          new AppForgeTreeItem(
            "No documents",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "document",
              label: "No documents",
              projectId,
              collectionId,
              treeId: `document:${projectId}:${collectionId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return documents.slice(0, 100).map(
        (doc: any) =>
          new AppForgeTreeItem(
            `📄 ${doc.$id.substring(0, 8)}...`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "document",
              label: doc.$id,
              id: doc.$id,
              projectId,
              collectionId,
              treeId: `document:${projectId}:${collectionId}:${doc.$id}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error("[TREE]", "Error fetching documents", error as Error);
      return [];
    }
  }

  private async getFunctionDetailsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const children: AppForgeTreeItem[] = [];
    const projectId = element.data.projectId;
    const functionId = element.data.id;

    // Deployments
    const deploymentsData: TreeItemData = {
      type: "deployments",
      label: "Deployments",
      projectId,
      functionId,
      treeId: `deployments:${projectId}:${functionId}`,
    };
    children.push(
      new AppForgeTreeItem(
        "🚀 Deployments",
        this.isExpanded(`deployments:${projectId}:${functionId}`)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        deploymentsData,
        this.extensionUri,
      ),
    );

    // Executions
    const executionsData: TreeItemData = {
      type: "executions",
      label: "Executions",
      projectId,
      functionId,
      treeId: `executions:${projectId}:${functionId}`,
    };
    children.push(
      new AppForgeTreeItem(
        "⚡ Executions",
        this.isExpanded(`executions:${projectId}:${functionId}`)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        executionsData,
        this.extensionUri,
      ),
    );

    // Variables
    const variablesData: TreeItemData = {
      type: "variables",
      label: "Variables",
      projectId,
      functionId,
      treeId: `variables:${projectId}:${functionId}`,
    };
    children.push(
      new AppForgeTreeItem(
        "🔒 Variables",
        this.isExpanded(`variables:${projectId}:${functionId}`)
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        variablesData,
        this.extensionUri,
      ),
    );

    return children;
  }

  private async getDeploymentsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const functionId = element.data.functionId;

    if (!projectId || !functionId) {
      return [];
    }

    try {
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { FunctionsService } =
        await import("../services/functionsService.js");
      const fnService = new FunctionsService(project, apiKey);
      const deployments = await fnService.listDeployments(functionId);

      if (deployments.length === 0) {
        return [
          new AppForgeTreeItem(
            "No deployments",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "deployment",
              label: "No deployments",
              projectId,
              functionId,
              treeId: `deployment:${projectId}:${functionId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return deployments.map(
        (dep: any) =>
          new AppForgeTreeItem(
            `🚀 ${dep.status} (${dep.$id.substring(0, 8)}...)`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "deployment",
              label: dep.$id,
              id: dep.$id,
              projectId,
              functionId,
              treeId: `deployment:${projectId}:${functionId}:${dep.$id}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error(
        "[TREE]",
        "Error fetching deployments",
        error as Error,
      );
      return [];
    }
  }

  private async getExecutionsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const functionId = element.data.functionId;

    if (!projectId || !functionId) {
      return [];
    }

    try {
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { FunctionsService } =
        await import("../services/functionsService.js");
      const fnService = new FunctionsService(project, apiKey);
      const executions = await fnService.listExecutions(functionId);

      if (executions.length === 0) {
        return [
          new AppForgeTreeItem(
            "No executions",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "execution",
              label: "No executions",
              projectId,
              functionId,
              treeId: `execution:${projectId}:${functionId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return executions.slice(0, 50).map(
        (exec) =>
          new AppForgeTreeItem(
            `⚡ ${exec.status} (${exec.duration}ms)`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "execution",
              label: exec.$id,
              id: exec.$id,
              projectId,
              functionId,
              treeId: `execution:${projectId}:${functionId}:${exec.$id}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error(
        "[TREE]",
        "Error fetching executions",
        error as Error,
      );
      return [];
    }
  }

  private async getVariablesChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const functionId = element.data.functionId;

    if (!projectId || !functionId) {
      return [];
    }

    try {
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { FunctionsService } =
        await import("../services/functionsService.js");
      const fnService = new FunctionsService(project, apiKey);
      const variables = await fnService.listVariables(functionId);

      if (variables.length === 0) {
        return [
          new AppForgeTreeItem(
            "No variables",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "variable",
              label: "No variables",
              projectId,
              functionId,
              treeId: `variable:${projectId}:${functionId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return variables.map(
        (variable: any) =>
          new AppForgeTreeItem(
            `🔒 ${variable.key}`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "variable",
              label: variable.key,
              id: variable.key,
              projectId,
              functionId,
              treeId: `variable:${projectId}:${functionId}:${variable.key}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error("[TREE]", "Error fetching variables", error as Error);
      return [];
    }
  }

  private async getBucketsChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;

    if (!projectId) {
      return [];
    }

    try {
      console.log("[TREE] Expanding storage node", { projectId });
      console.log("[STORAGE] Fetching buckets", { projectId });

      const project = this.projectStorage.getProjectById(projectId);
      if (!project) {
        console.error("[STORAGE] Project not found", { projectId });
        return [];
      }

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) {
        console.error("[STORAGE] API key not found", { projectId });
        return [];
      }

      const { StorageService } = await import("../services/storageService.js");
      const storageService = new StorageService(project, apiKey);
      const buckets = await storageService.listBuckets();

      if (buckets.length === 0) {
        return [
          new AppForgeTreeItem(
            "No buckets",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "bucket",
              label: "No buckets",
              projectId,
              treeId: `bucket:${projectId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      // FIX: Dynamically fetch the real-time file count for each bucket using Promise.all
      // FIX: Safely read the length from the returned array
      const bucketNodes = await Promise.all(
        buckets.map(async (bucket: any) => {
          const nodeKey = `bucket:${projectId}:${bucket.$id}`;
          let realFileCount = 0;

          try {
            // Call your existing listFiles service to read the files
            const filesResponse = await storageService.listFiles(bucket.$id);
            
            // If it's a direct array, use .length. Otherwise, cast to any to read .total
            if (Array.isArray(filesResponse)) {
              realFileCount = filesResponse.length;
            } else if (filesResponse) {
              realFileCount = (filesResponse as any).total ?? (filesResponse as any).files?.length ?? 0;
            }
          } catch (fileFetchError) {
            console.error(`[STORAGE] Failed to fetch count for bucket ${bucket.$id}:`, fileFetchError);
          }

          return new AppForgeTreeItem(
            `📁 ${bucket.name} (${realFileCount} files)`,
            this.isExpanded(nodeKey)
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.Collapsed,
            {
              type: "bucket",
              label: bucket.name,
              id: bucket.$id,
              projectId,
              bucketId: bucket.$id,
              treeId: nodeKey,
            },
            this.extensionUri,
          );
        })
      );

      return bucketNodes;
    } catch (error) {
      outputChannel.error("[TREE]", "Error fetching buckets", error as Error);
      return [];
    }
  }

  private async getFilesChildren(
    element: AppForgeTreeItem,
  ): Promise<AppForgeTreeItem[]> {
    const projectId = element.data.projectId;
    const bucketId = element.data.bucketId || element.data.id;

    if (!projectId || !bucketId) {
      return [];
    }

    try {
      console.log("[TREE] Expanding files node", { projectId, bucketId });
      console.log("[STORAGE] Fetching files", { projectId, bucketId });

      const project = this.projectStorage.getProjectById(projectId);
      if (!project) {
        console.error("[STORAGE] Project not found", { projectId });
        return [];
      }

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) {
        console.error("[STORAGE] API key not found", { projectId });
        return [];
      }

      console.log("[STORAGE] API call starting", {
        endpoint: project.endpoint,
      });

      const { StorageService } = await import("../services/storageService.js");
      const storageService = new StorageService(project, apiKey);
      const files = await storageService.listFiles(bucketId);

      console.log("[STORAGE] API call success", { count: files.length });
      console.log("[STORAGE] Found X files", {
        projectId,
        bucketId,
        count: files.length,
      });

      if (files.length === 0) {
        return [
          new AppForgeTreeItem(
            "No files",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "file",
              label: "No files",
              projectId,
              bucketId,
              treeId: `file:${projectId}:${bucketId}:empty`,
            },
            this.extensionUri,
          ),
        ];
      }

      return files.map(
        (file: any) =>
          new AppForgeTreeItem(
            `📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
            vscode.TreeItemCollapsibleState.None,
            {
              type: "file",
              label: file.name,
              id: file.$id,
              projectId,
              bucketId,
              treeId: `file:${projectId}:${bucketId}:${file.$id}`,
            },
            this.extensionUri,
          ),
      );
    } catch (error) {
      outputChannel.error("[TREE]", "Error fetching files", error as Error);
      return [];
    }
  }
}
