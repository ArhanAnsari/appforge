/**
 * Appwrite Client Service
 * Singleton service that manages the Appwrite client lifecycle and connections
 */

import {
  Client,
  Databases,
  Functions,
  Account,
  Storage,
  Teams,
} from "node-appwrite";
import { AppwriteProject } from "../types";

/**
 * Stateless factory for creating project-scoped Appwrite clients and services.
 */
export class AppwriteClientService {
  private static instance: AppwriteClientService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): AppwriteClientService {
    if (!AppwriteClientService.instance) {
      AppwriteClientService.instance = new AppwriteClientService();
    }
    return AppwriteClientService.instance;
  }

  /**
   * Create a new Appwrite client scoped to a single project.
   */
  public getProjectScopedClient(
    project: AppwriteProject,
    apiKey: string,
  ): Client {
    const endpoint = this.normalizeEndpoint(project.endpoint);
    return new Client()
      .setEndpoint(endpoint)
      .setProject(project.projectId)
      .setKey(apiKey);
  }

  /**
   * Create a project-scoped Databases service.
   */
  public createDatabasesService(
    project: AppwriteProject,
    apiKey: string,
  ): Databases {
    return new Databases(this.getProjectScopedClient(project, apiKey));
  }

  /**
   * Create a project-scoped Functions service.
   */
  public createFunctionsService(
    project: AppwriteProject,
    apiKey: string,
  ): Functions {
    return new Functions(this.getProjectScopedClient(project, apiKey));
  }

  /**
   * Create a project-scoped Account service.
   */
  public createAccountService(
    project: AppwriteProject,
    apiKey: string,
  ): Account {
    return new Account(this.getProjectScopedClient(project, apiKey));
  }

  /**
   * Create a project-scoped Storage service.
   */
  public createStorageService(
    project: AppwriteProject,
    apiKey: string,
  ): Storage {
    return new Storage(this.getProjectScopedClient(project, apiKey));
  }

  /**
   * Create a project-scoped Teams service.
   */
  public createTeamsService(project: AppwriteProject, apiKey: string): Teams {
    return new Teams(this.getProjectScopedClient(project, apiKey));
  }
  private normalizeEndpoint(endpoint: string): string {
    const trimmed = endpoint.trim().replace(/\/+$/, "");
    if (trimmed.endsWith("/v1")) {
      return trimmed;
    }
    return `${trimmed}/v1`;
  }
}

export const appwriteClientService = AppwriteClientService.getInstance();
