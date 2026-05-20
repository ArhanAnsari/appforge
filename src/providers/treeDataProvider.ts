/**
 * AppForge Tree Data Provider
 * Manages the tree view in the sidebar for Projects, Databases, Functions, and Logs
 */

import * as vscode from "vscode";
import * as path from "path";
import { TreeItemData, StoredProject } from "../types";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppwriteClientService } from "../services/appwriteClientService";

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
          const apiKey = await this.projectStorage.getApiKey(projectId);
          if (apiKey) {
            this.appwriteClient.initialize(project, apiKey);
            activeProject = this.appwriteClient.getActiveProject();
          }
        } catch (switchError) {
          console.error("Error switching project:", switchError);
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

      // Now fetch databases
      try {
        const response = await this.appwriteClient.getDatabases().list();
        console.log("Databases response:", response);

        // Handle different response structures
        let databases = Array.isArray(response)
          ? response
          : response.databases || [];
        console.log("Parsed databases array:", databases);

        const children: AppForgeTreeItem[] = [];

        if (databases.length === 0) {
          const emptyData: TreeItemData = {
            type: "databases",
            label: "No databases",
            projectId,
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

        databases.forEach((db: any) => {
          const dbData: TreeItemData = {
            type: "database",
            label: db.name,
            id: db.$id,
            projectId,
          };
          children.push(
            new AppForgeTreeItem(
              `📦 ${db.name}`,
              vscode.TreeItemCollapsibleState.Collapsed,
              dbData,
              this.extensionUri,
            ),
          );
        });

        console.log("Returning database items:", children.length);
        return children;
      } catch (listError) {
        console.error("Error listing databases:", listError);
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
        const response = await this.appwriteClient
          .getDatabases()
          .listCollections(databaseId);
        const collections = response.collections || [];
        const children: AppForgeTreeItem[] = [];

        if (collections.length === 0) {
          const emptyData: TreeItemData = {
            type: "collection",
            label: "No collections",
            projectId,
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
          const colData: TreeItemData = {
            type: "collection",
            label: col.name,
            id: col.$id,
            projectId,
            databaseId,
          };
          children.push(
            new AppForgeTreeItem(
              col.name,
              vscode.TreeItemCollapsibleState.None,
              colData,
              this.extensionUri,
            ),
          );
        });

        return children;
      } catch (listError) {
        console.error("Error listing collections:", listError);
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
