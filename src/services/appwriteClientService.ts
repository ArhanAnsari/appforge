import { Client, TablesDB, Databases, Functions, Storage, Account } from 'node-appwrite';

export class AppwriteClientService {
    private static instance: AppwriteClientService | undefined;

    private client: Client;
    private tablesDB: TablesDB;
    private databases: Databases;
    private functions: Functions;
    private storage: Storage;
    private account: Account;

    constructor(endpoint: string, projectId: string, apiKey: string) {
        let cleanEndpoint = endpoint.trim();
        if (!cleanEndpoint.endsWith('/v1')) {
            cleanEndpoint = cleanEndpoint.replace(/\/+$/, '') + '/v1';
        }

        this.client = new Client()
            .setEndpoint(cleanEndpoint)
            .setProject(projectId)
            .setKey(apiKey);

        // Instantiate both TablesDB and standard Databases services
        this.tablesDB = new TablesDB(this.client);
        this.databases = new Databases(this.client);
        this.functions = new Functions(this.client);
        this.storage = new Storage(this.client);
        this.account = new Account(this.client);
    }

    public static createInstance(endpoint: string, projectId: string, apiKey: string): AppwriteClientService {
        AppwriteClientService.instance = new AppwriteClientService(endpoint, projectId, apiKey);
        return AppwriteClientService.instance;
    }

    public static getInstance(): AppwriteClientService | undefined {
        return AppwriteClientService.instance;
    }

    public static resetInstance(): void {
        AppwriteClientService.instance = undefined;
    }

    /**
     * Creates an isolated SDK client instance for a specific project context.
     */
    public static createForProject(project: { endpoint: string; projectId: string }, apiKey: string): AppwriteClientService {
        return new AppwriteClientService(project.endpoint, project.projectId, apiKey);
    }

    // Service Accessors & Legacy Signature Wrappers
    public getClient(): Client { return this.client; }
    public getTablesDBService(): TablesDB { return this.tablesDB; }
    public getDatabasesService(..._args: any[]): Databases { return this.databases; }

    public createDatabasesService(project?: any, apiKey?: string): Databases {
        if (project?.endpoint && project?.projectId && apiKey) {
            return new AppwriteClientService(project.endpoint, project.projectId, apiKey).getDatabasesService();
        }
        return this.databases;
    }

    public getFunctionsService(..._args: any[]): Functions { return this.functions; }
    public createFunctionsService(project?: any, apiKey?: string): Functions {
        if (project?.endpoint && project?.projectId && apiKey) {
            return new AppwriteClientService(project.endpoint, project.projectId, apiKey).getFunctionsService();
        }
        return this.functions;
    }

    public getStorageService(..._args: any[]): Storage { return this.storage; }
    public createStorageService(project?: any, apiKey?: string): Storage {
        if (project?.endpoint && project?.projectId && apiKey) {
            return new AppwriteClientService(project.endpoint, project.projectId, apiKey).getStorageService();
        }
        return this.storage;
    }

    public getAccountService(..._args: any[]): Account { return this.account; }
}