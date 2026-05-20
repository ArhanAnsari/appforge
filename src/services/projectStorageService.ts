/**
 * Project Storage Service
 * Manages persistent storage of Appwrite projects and their secure credentials
 */

import * as vscode from "vscode";
import { StoredProject, ExtensionState } from "../types";

/**
 * Service for managing project storage with secure API key handling
 */
export class ProjectStorageService {
  private static readonly PROJECTS_STORAGE_KEY = "appforge.projects";
  private static readonly ACTIVE_PROJECT_KEY = "appforge.activeProject";

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
    await this.context.workspaceState.update(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
      projects,
    );

    // Save API key securely to secret storage
    const secretKey = `appforge.apikey.${projectId}`;
    await this.secretStorage.store(secretKey, apiKey);
  }

  /**
   * Retrieve API key for a project from secure storage
   */
  public async getApiKey(projectId: string): Promise<string | undefined> {
    const secretKey = `appforge.apikey.${projectId}`;
    return this.secretStorage.get(secretKey);
  }

  /**
   * Get all stored projects
   */
  public getProjects(): StoredProject[] {
    const projects = this.context.workspaceState.get<StoredProject[]>(
      ProjectStorageService.PROJECTS_STORAGE_KEY,
    );
    return projects || [];
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

    // Remove API key from secret storage
    const secretKey = `appforge.apikey.${projectId}`;
    await this.secretStorage.delete(secretKey);

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
  }

  /**
   * Get the active project ID
   */
  public getActiveProjectId(): string | undefined {
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
}
