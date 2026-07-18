/**
 * Project Storage Service
 * Manages persistent storage of Appwrite projects and their secure credentials
 */

import * as vscode from "vscode";
import { StoredProject, ExtensionState } from "../types";
import { outputChannel } from "../core/output/outputChannel";

/**
 * Service for managing project storage with secure API key handling
 */
export class ProjectStorageService {
  private static readonly PROJECTS_STORAGE_KEY = "appforge.projects";
  private static readonly ACTIVE_PROJECT_KEY = "appforge.activeProject";
  private static readonly API_KEY_PREFIX = "appforge.apikey.";
  private static readonly LEGACY_API_KEY_PREFIX = "appforge.apiKey.";

  // FIX: Added Event Emitter to notify other components when active project changes
  private _onDidChangeActiveProject = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeActiveProject = this._onDidChangeActiveProject.event;

  constructor(
    private context: vscode.ExtensionContext,
    private secretStorage: vscode.SecretStorage,
  ) {}

  /**
   * Add a new project and securely store its API key
   */
  public async addProject(
    projectName: string,
    endpoint: string,
    projectId: string,
    apiKey: string,
  ): Promise<void> {
    // Store project metadata
    const projects = this.getProjects();
    const project: StoredProject = { projectName, endpoint, projectId };

    const existingIndex = projects.findIndex((p) => p.projectId === projectId);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    // Save projects metadata to workspace storage
    await this.context.globalState.update(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
      projects,
    );
    await this.context.workspaceState.update(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
      projects,
    );
    // Save API key securely to secret storage
    const secretKey = this.getPrimarySecretKey(projectId);
    await this.secretStorage.store(secretKey, apiKey);
    // Ensure active project always points to a valid saved project.
    await this.setActiveProjectId(projectId);
    outputChannel.info("PROJECTS", "Project saved to persistent storage", {
      projectId,
      endpoint,
      activeProjectId: this.getActiveProjectId(),
    });
  }

  /**
   * Retrieve API key for a project from secure storage
   */
  public async getApiKey(projectId: string): Promise<string | undefined> {
    const primary = this.getPrimarySecretKey(projectId);
    const legacy = this.getLegacySecretKey(projectId);
    const existing = await this.secretStorage.get(primary);
    if (existing) {
      return existing;
    }
    const legacyValue = await this.secretStorage.get(legacy);
    if (legacyValue) {
      await this.secretStorage.store(primary, legacyValue);
      await this.secretStorage.delete(legacy);
      outputChannel.info("PROJECTS", "Migrated legacy API key secret", {
        projectId,
      });
      return legacyValue;
    }
    return undefined;
  }

  /**
   * Get all stored projects
   */
  public getProjects(): StoredProject[] {
    const projectsFromGlobal = this.context.globalState.get<StoredProject[]>(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
    );
    if (projectsFromGlobal && projectsFromGlobal.length > 0) {
      return projectsFromGlobal;
    }
    const projectsFromWorkspace = this.context.workspaceState.get<StoredProject[]>(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
    );
    return projectsFromWorkspace || [];
  }

  /**
   * Get a specific project by ID
   */
  public getProjectById(projectId: string): StoredProject | undefined {
    const projects = this.getProjects();
    return projects.find((p) => p.projectId === projectId);
  }

  /**
   * Remove a project and its stored credentials
   */
  public async removeProject(projectId: string): Promise<void> {
    const projects = this.getProjects();
    const filtered = projects.filter((p) => p.projectId !== projectId);

    await this.context.workspaceState.update(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
      filtered,
    );
    await this.context.globalState.update(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
      filtered,
    );

    // Remove API key from secret storage
    await this.secretStorage.delete(this.getPrimarySecretKey(projectId));
    await this.secretStorage.delete(this.getLegacySecretKey(projectId));

    // Clear active project if it was the removed one
    if (this.getActiveProjectId() === projectId) {
      await this.setActiveProjectId(undefined);
    }
  }

  /**
   * Set the active project
   */
  public async setActiveProjectId(
    projectId: string | undefined,
  ): Promise<void> {
    await this.context.workspaceState.update(
      ProjectStorageService.ACTIVE_PROJECT_KEY,
      projectId,
    );
    await this.context.globalState.update(
      ProjectStorageService.ACTIVE_PROJECT_KEY,
      projectId,
    );

    // FIX: Fire the change event so the Status Bar catches it instantly!
    this._onDidChangeActiveProject.fire(projectId);
  }

  /**
   * Get the active project ID
   */
  public getActiveProjectId(): string | undefined {
    const globalActive = this.context.globalState.get<string>(
      ProjectStorageService.ACTIVE_PROJECT_KEY,
    );
    if (globalActive) {
      return globalActive;
    }
    return this.context.workspaceState.get<string>(
      ProjectStorageService.ACTIVE_PROJECT_KEY,
    );
  }

  /**
   * Get the active project with API key
   */
  public async getActiveProjectWithApiKey(): Promise<
    (StoredProject & { apiKey: string }) | null
  > {
    const projectId = this.getActiveProjectId();
    if (!projectId) {
      return null;
    }

    const project = this.getProjectById(projectId);
    if (!project) {
      return null;
    }

    const apiKey = await this.getApiKey(projectId);
    if (!apiKey) {
      outputChannel.warn("PROJECTS", "Active project is missing API key", {
        projectId,
      });
      return null;
    }

    return { ...project, apiKey };
  }

  /**
   * Get extension state
   */
  public async getState(): Promise<ExtensionState> {
    return {
      projects: this.getProjects(),
      activeProjectId: this.getActiveProjectId(),
    };
  }
  private getPrimarySecretKey(projectId: string): string {
    return `${ProjectStorageService.API_KEY_PREFIX}${projectId}`;
  }
  private getLegacySecretKey(projectId: string): string {
    return `${ProjectStorageService.LEGACY_API_KEY_PREFIX}${projectId}`;
  }
}
