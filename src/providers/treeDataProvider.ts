/**
 * AppForge Tree Data Provider
 * Manages the tree view in the sidebar for Projects, Databases, Functions, and Storage
 */

import * as vscode from "vscode";
import { TreeItemData } from "../types";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";
import { logger } from "../utils/logger";
import { outputChannel } from "../core/output/outputChannel";
import { refreshManager } from "../core/refresh/refreshManager";
import { DatabaseService } from "../services/databaseService";

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
export class AppForgeTreeDataProvider
  implements vscode.TreeDataProvider<AppForgeTreeItem>, vscode.Disposable
{
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
  private viewDisposables: vscode.Disposable[] = [];
  private refreshUnsubscribe?: () => void;
  private loadingUnsubscribe?: () => void;

  public attachView(view: vscode.TreeView<AppForgeTreeItem>): void {
    this.view = view;
    this.viewDisposables.forEach((disposable) => disposable.dispose());
    this.viewDisposables = [];
    this.refreshUnsubscribe?.();
    this.loadingUnsubscribe?.();
    this.refreshUnsubscribe = undefined;
    this.loadingUnsubscribe = undefined;

    this.viewDisposables.push(
      view.onDidExpandElement((e) => {
        const id = e.element?.id;
        if (id) {
          this.expandedIds.add(id);
        }
      }),
    );
    this.viewDisposables.push(
      view.onDidCollapseElement((e) => {
        const id = e.element?.id;
        if (id) {
          this.expandedIds.delete(id);
        }
      }),
    );

    this.refreshUnsubscribe = refreshManager.onRefresh((request) => {
      try {
        const key = `scope:${request.scope}:${request.nodeId || ""}`;
        this.loadingNodes.set(key, true);
        this._onDidChangeTreeData.fire(null);

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

    this.loadingUnsubscribe = refreshManager.onLoadingChange(
      (nodeId, isLoading) => {
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
      },
    );
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public dispose(): void {
    this.viewDisposables.forEach((disposable) => disposable.dispose());
    this.viewDisposables = [];
    this.refreshUnsubscribe?.();
    this.loadingUnsubscribe?.();
    this.refreshUnsubscribe = undefined;
    this.loadingUnsubscribe = undefined;
    this._onDidChangeTreeData.dispose();
  }

  private isExpanded(nodeId: string): boolean {
    return this.expandedIds.has(nodeId);
  }

  public getTreeItem(element: AppForgeTreeItem): vscode.TreeItem {
    return element;
  }

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

      if (!element) {
        return this.getRootChildren();
      }

      if (element.data.type === "project") {
        return this.getProjectChildren(element);
      }

      if (element.data.type === "databases") {
        return await this.getDatabasesChildren(element);
      }

      if (element.data.type === "database") {
        return await this.getDatabaseCollectionsChildren(element);
      }

      if (element.data.type === "collection") {
        return await this.getCollectionDetailsChildren(element);
      }

      if (element.data.type === "attributes") {
        return await this.getAttributesChildren(element);
      }

      if (element.data.type === "indexes") {
        return await this.getIndexesChildren(element);
      }

      if (element.data.type === "documents") {
        return await this.getDocumentsChildren(element);
      }

      if (element.data.type === "functions") {
        return await this.getFunctionsChildren(element);
      }

      if (element.data.type === "function") {
        return await this.getFunctionDetailsChildren(element);
      }

      if (element.data.type === "deployments") {
        return await this.getDeploymentsChildren(element);
      }

      if (element.data.type === "executions") {
        return await this.getExecutionsChildren(element);
      }

      if (element.data.type === "variables") {
        return await this.getVariablesChildren(element);
      }

      if (element.data.type === "buckets") {
        return await this.getBucketsChildren(element);
      }

      if (element.data.type === "bucket" || element.data.type === "files") {
        return await this.getFilesChildren(element);
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

    projects.forEach((project) => {
      const projectData: TreeItemData = {
        type: "project",
        label: project.projectName,
        id: project.projectId,
        treeId: `project:${project.projectId}`,
      };
      const projectNodeId = `project:${project.projectId}`;
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
        return [
          new AppForgeTreeItem(
            "❌ Project configuration not found",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "databases",
              label: "Project missing",
              id: "project-missing",
              projectId,
              treeId: `databases:${projectId}:missing`,
            },
            this.extensionUri,
          ),
        ];
      }

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) {
        outputChannel.warn("TREE", `Missing API Key for project: ${projectId}`);
        return [
          new AppForgeTreeItem(
            "🔑 No API key saved for this project",
            vscode.TreeItemCollapsibleState.None,
            {
              type: "databases",
              label: "API key missing",
              id: "api-key-missing",
              projectId,
              treeId: `databases:${projectId}:api-key-missing`,
            },
            this.extensionUri,
          ),
        ];
      }

      try {
        const databaseService = new DatabaseService(project, apiKey);
        const databases = await databaseService.listDatabases();
        const children: AppForgeTreeItem[] = [];

        if (databases.length === 0) {
          const emptyData: TreeItemData = {
            type: "databases",
            label: "No databases",
            id: "empty",
            projectId,
            treeId: `databases:${projectId}:empty`,
          };
          return [
            new AppForgeTreeItem(
              "📭 No databases yet",
              vscode.TreeItemCollapsibleState.None,
              emptyData,
              this.extensionUri,
            ),
          ];
        }

        databases.forEach((db) => {
          const id = db.$id;
          const name = db.name || db.$id;
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

        return children;
      } catch (listError) {
        const errorMessage =
          listError instanceof Error ? listError.message : String(listError);
        outputChannel.error(
          "TREE",
          `Error listing databases for project [${projectId}]: ${errorMessage}`,
        );

        const errorData: TreeItemData = {
          type: "databases",
          label: "Error",
          id: "load-error",
          projectId,
          treeId: `databases:${projectId}:load-error`,
        };

        return [
          new AppForgeTreeItem(
            `❌ ${errorMessage}`,
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
        const databaseService = new DatabaseService(project, apiKey);
        const collections = await databaseService.listCollections(databaseId);
        const children: AppForgeTreeItem[] = [];

        if (collections.length === 0) {
          const emptyData: TreeItemData = {
            type: "collection",
            label: "No collections",
            id: "empty",
            projectId,
            databaseId,
            treeId: `collection:${projectId}:${databaseId}:empty`,
          };
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
            treeId: `collection:${projectId}:${databaseId}:${id}`,
          };

          const nodeKey = `col:${projectId}:${databaseId}:${id}`;
          const loading = this.loadingNodes.get(nodeKey) || false;

          const item = new AppForgeTreeItem(
            loading ? `${name} ⏳` : name,
            vscode.TreeItemCollapsibleState.Collapsed,
            colData,
            this.extensionUri,
          );

          // ATTACH COMMAND TO OPEN DATABASE VIEWER ON CLICK
          item.command = {
            command: "appforge.viewDatabase",
            title: "View Database",
            arguments: [item],
          };

          children.push(item);
        });

        return children;
      } catch (listError) {
        const errorData: TreeItemData = {
          type: "collection",
          label: "Error",
          id: "load-error",
          projectId,
          databaseId,
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

        const { FunctionsService } =
          await import("../services/functionsService.js");
        const fnService = new FunctionsService(project, apiKey);
        const functions = (await fnService.listFunctions()) || [];
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
            type: "function",
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
            vscode.TreeItemCollapsibleState.Collapsed,
            fnData,
            this.extensionUri,
          );
          item.description = fn.status === "enabled" ? "Enabled" : "Disabled";
          children.push(item);
        });

        return children;
      } catch (listError) {
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
        this.isExpanded(
          `attributes:${projectId}:${databaseId ?? ""}:${collectionId}`,
        )
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        attributesData,
        this.extensionUri,
      ),
    );

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
        this.isExpanded(
          `indexes:${projectId}:${databaseId ?? ""}:${collectionId}`,
        )
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        indexesData,
        this.extensionUri,
      ),
    );

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
        this.isExpanded(
          `documents:${projectId}:${databaseId ?? ""}:${collectionId}`,
        )
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
        (exec: any) =>
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
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

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

      const bucketNodes = await Promise.all(
        buckets.map(async (bucket: any) => {
          const nodeKey = `bucket:${projectId}:${bucket.$id}`;
          let realFileCount = 0;

          try {
            const filesResponse = await storageService.listFiles(bucket.$id);
            if (Array.isArray(filesResponse)) {
              realFileCount = filesResponse.length;
            } else if (filesResponse) {
              realFileCount =
                (filesResponse as any).total ??
                (filesResponse as any).files?.length ??
                0;
            }
          } catch (fileFetchError) {
            outputChannel.error(
              "STORAGE",
              `Failed to fetch file count for bucket ${bucket.$id}`,
              fileFetchError as Error,
            );
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
        }),
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
      const project = this.projectStorage.getProjectById(projectId);
      if (!project) return [];

      const apiKey = await this.projectStorage.getApiKey(projectId);
      if (!apiKey) return [];

      const { StorageService } = await import("../services/storageService.js");
      const storageService = new StorageService(project, apiKey);
      const files = await storageService.listFiles(bucketId);

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