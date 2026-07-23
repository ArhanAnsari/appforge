/**
 * Database Service
 * Handles database & collection/table discovery via TablesDB unified endpoints
 */
import {
  DatabaseItem,
  CollectionItem,
  AttributeItem,
  IndexItem,
  DocumentItem,
  AppwriteProject,
} from "../types";
import { AppwriteClientService } from "./appwriteClientService";
import { outputChannel } from "../core/output/outputChannel";

export class DatabaseService {
  private clientService: AppwriteClientService;

  constructor(
    private project: AppwriteProject,
    private apiKey: string,
  ) {
    this.clientService = AppwriteClientService.createForProject(this.project, this.apiKey);
  }

  /**
   * Universal response parser for TablesDB (/tablesdb) and Databases (/databases) payloads
   */
  private extractItems(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.databases)) return response.databases;
    if (Array.isArray(response.tables)) return response.tables;
    if (Array.isArray(response.collections)) return response.collections;
    if (Array.isArray(response.documents)) return response.documents;
    if (Array.isArray(response.rows)) return response.rows;
    return [];
  }

  /**
   * List all databases for the project using TablesDB primary endpoint (GET /tablesdb via tablesDB.list())
   */
  async listDatabases(): Promise<DatabaseItem[]> {
    try {
      const tablesDB = this.clientService.getTablesDBService();
      const dbClient = this.clientService.getDatabasesService();

      let response: any;

      // 1. Primary: Use tablesDB.list() -> Hits GET /tablesdb which returns ALL databases
      if (tablesDB && typeof tablesDB.list === "function") {
        try {
          response = await tablesDB.list();
        } catch (tablesDbError) {
          outputChannel.warn(
            "DATABASES",
            `TablesDB list failed, falling back to legacy Databases API for project [${this.project.projectId}]`
          );
          response = await dbClient.list();
        }
      } else {
        response = await dbClient.list();
      }

      const databases = this.extractItems(response);

      outputChannel.info(
        "DATABASES",
        `Fetched ${databases.length} database(s) for project [${this.project.projectId}]`,
        {
          projectId: this.project.projectId,
          total: response?.total ?? databases.length,
        }
      );

      return databases.map((db: any) => ({
        $id: String(db.$id ?? db.id ?? db.databaseId ?? ""),
        name: String(db.name ?? db.$id ?? db.id ?? "Unnamed Database"),
      }));
    } catch (error) {
      outputChannel.error(
        "DATABASES",
        `Failed to list databases for project [${this.project.projectId}]`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * List collections / tables inside a database
   */
  async listCollections(databaseId: string): Promise<CollectionItem[]> {
    try {
      const tablesDB = this.clientService.getTablesDBService();
      const dbClient = this.clientService.getDatabasesService();

      let response: any;

      // Primary: query TablesDB listTables (GET /tablesdb/{databaseId}/tables)
      if (tablesDB && typeof tablesDB.listTables === "function") {
        try {
          // Supports positional databaseId or object parameter signature
          response = await (tablesDB as any).listTables(databaseId);
        } catch {
          try {
            response = await (tablesDB as any).listTables({ databaseId });
          } catch {
            response = await dbClient.listCollections(databaseId);
          }
        }
      } else {
        response = await dbClient.listCollections(databaseId);
      }

      const collections = this.extractItems(response);

      return collections.map((col: any) => ({
        $id: String(col.$id ?? col.id ?? col.tableId ?? col.collectionId ?? ""),
        name: String(col.name ?? col.$id ?? col.id ?? "Unnamed Collection"),
        $databaseId: String(col.$databaseId || databaseId),
      }));
    } catch (error) {
      outputChannel.error(
        "DATABASES",
        `Failed to list collections/tables for Database ID: ${databaseId}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get collection / table details including attributes and indexes
   */
  async getCollectionDetails(
    databaseId: string,
    collectionId: string,
  ): Promise<{
    collection: CollectionItem;
    attributes: AttributeItem[];
    indexes: IndexItem[];
  }> {
    try {
      const dbClient = this.clientService.getDatabasesService();
      const collection = await dbClient.getCollection(databaseId, collectionId);

      return {
        collection: {
          $id: collection.$id,
          name: collection.name,
          $databaseId: databaseId,
        },
        attributes: (collection.attributes || []).map((attr: any) => ({
          key: attr.key,
          type: attr.type,
          status: attr.status,
          required: attr.required,
          array: attr.array,
        })),
        indexes: (collection.indexes || []).map((idx: any) => ({
          key: idx.key,
          type: idx.type,
          attributes: idx.attributes,
          orders: idx.orders,
        })),
      };
    } catch (error) {
      outputChannel.error("DATABASES", "Failed to get collection details", error as Error);
      return {
        collection: { $id: collectionId, name: "", $databaseId: databaseId },
        attributes: [],
        indexes: [],
      };
    }
  }

  /**
   * List documents / rows
   */
  async listDocuments(
    databaseId: string,
    collectionId: string,
    limit: number = 100,
  ): Promise<DocumentItem[]> {
    try {
      const dbClient = this.clientService.getDatabasesService();
      const response = await dbClient.listDocuments(databaseId, collectionId);
      const documents = this.extractItems(response);
      return documents.slice(0, limit);
    } catch (error) {
      outputChannel.error("DATABASES", "Failed to list documents", error as Error);
      return [];
    }
  }

  async getDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
  ): Promise<DocumentItem | null> {
    try {
      const dbClient = this.clientService.getDatabasesService();
      const doc = await dbClient.getDocument(databaseId, collectionId, documentId);
      return doc as DocumentItem;
    } catch (error) {
      outputChannel.error("DATABASES", "Failed to get document", error as Error);
      return null;
    }
  }

  async createDatabase(databaseName: string): Promise<DatabaseItem | null> {
    try {
      const dbClient = this.clientService.getDatabasesService();
      const db = await dbClient.create("unique()", databaseName);
      return { $id: db.$id, name: db.name };
    } catch (error) {
      outputChannel.error("DATABASES", "Failed to create database", error as Error);
      return null;
    }
  }

  async createCollection(
    databaseId: string,
    collectionName: string,
  ): Promise<CollectionItem | null> {
    try {
      const dbClient = this.clientService.getDatabasesService();
      const col = await dbClient.createCollection(databaseId, "unique()", collectionName);
      return { $id: col.$id, name: col.name, $databaseId: databaseId };
    } catch (error) {
      outputChannel.error("DATABASES", "Failed to create collection", error as Error);
      return null;
    }
  }
}