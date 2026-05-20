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
import { AppwriteProject, StoredProject } from "../types";

/**
 * Singleton service for managing Appwrite client connections
 */
export class AppwriteClientService {
  private static instance: AppwriteClientService;
  private client: Client | null = null;
  private databases: Databases | null = null;
  private functions: Functions | null = null;
  private account: Account | null = null;
  private storage: Storage | null = null;
  private teams: Teams | null = null;
  private activeProject: AppwriteProject | null = null;

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
   * Initialize client with project configuration
   */
  public initialize(project: AppwriteProject, apiKey: string): void {
    this.client = new Client()
      .setEndpoint(project.endpoint)
      .setProject(project.projectId)
      .setKey(apiKey);

    // Initialize service clients
    this.databases = new Databases(this.client);
    this.functions = new Functions(this.client);
    this.account = new Account(this.client);
    this.storage = new Storage(this.client);
    this.teams = new Teams(this.client);

    this.activeProject = project;
  }

  /**
   * Switch to a different project
   */
  public switchProject(project: AppwriteProject, apiKey: string): void {
    this.initialize(project, apiKey);
  }

  /**
   * Get the active project
   */
  public getActiveProject(): AppwriteProject | null {
    return this.activeProject;
  }

  /**
   * Get Databases client
   */
  public getDatabases(): Databases {
    if (!this.databases) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return this.databases;
  }

  /**
   * Get Functions client
   */
  public getFunctions(): Functions {
    if (!this.functions) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return this.functions;
  }

  /**
   * Get Account client
   */
  public getAccount(): Account {
    if (!this.account) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return this.account;
  }

  /**
   * Get Storage client
   */
  public getStorage(): Storage {
    if (!this.storage) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return this.storage;
  }

  /**
   * Get Teams client
   */
  public getTeams(): Teams {
    if (!this.teams) {
      throw new Error("Client not initialized. Call initialize() first.");
    }
    return this.teams;
  }

  /**
   * Check if client is initialized
   */
  public isInitialized(): boolean {
    return this.client !== null && this.activeProject !== null;
  }

  /**
   * Reset client (for logout or project switch)
   */
  public reset(): void {
    this.client = null;
    this.databases = null;
    this.functions = null;
    this.account = null;
    this.storage = null;
    this.teams = null;
    this.activeProject = null;
  }
}

export const appwriteClientService = AppwriteClientService.getInstance();
