/**
 * Database Service
 * Handles all database operations: databases, collections, attributes, indexes, documents
 */
import {
  DatabaseItem,
  CollectionItem,
  AttributeItem,
  IndexItem,
  DocumentItem,
  AppwriteProject,
} from "../types";
import { appwriteClientService } from "./appwriteClientService";
import { outputChannel } from "../core/output/outputChannel";
import { extractObjectArrayWithId } from "../utils/responseParser";

export class DatabaseService {
  constructor(
    private project: AppwriteProject,
    private apiKey: string,
  ) {}

  /**
   * List all databases for the project
   */
  async listDatabases(): Promise<DatabaseItem[]> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );
      const listMethod = (dbClient as any).listDatabases?.bind(dbClient);
      const response = listMethod
        ? await listMethod()
        : await (dbClient as any).list();
      const databases = extractObjectArrayWithId(response);
      outputChannel.info("DATABASES", "Databases list response parsed", {
        projectId: this.project.projectId,
        total: (response as any)?.total,
        count: databases.length,
      });

      return databases.map((db: any) => ({
        $id: String(db.$id ?? db.id ?? db.databaseId ?? ""),
        name: String(db.name ?? db.$id ?? db.id ?? db.databaseId ?? "Unknown"),
      }));
    } catch (error) {
      outputChannel.error(
        "DATABASES",
        "Failed to list databases",
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get a specific database
   */
  async getDatabase(databaseId: string): Promise<DatabaseItem | null> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );
      const db = await dbClient.get(databaseId);

      return {
        $id: db.$id,
        name: db.name,
      };
    } catch (error) {
      outputChannel.error(
        "[DATABASES]",
        "Failed to get database",
        error as Error,
      );
      return null;
    }
  }

  /**
   * List collections in a database
   */
  async listCollections(databaseId: string): Promise<CollectionItem[]> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );
      const response = await dbClient.listCollections(databaseId);
      const collections = extractObjectArrayWithId(response);
       outputChannel.info("DATABASES", "Collections list response parsed", {
        projectId: this.project.projectId,
        databaseId,
        total: (response as any)?.total,
        count: collections.length,
      });

      return collections.map((col: any) => ({
         $id: String(col.$id ?? col.id ?? col.collectionId ?? ""),
        name: String(col.name ?? col.$id ?? col.id ?? col.collectionId ?? ""),
        $databaseId: String(col.$databaseId || databaseId),
      }));
    } catch (error) {
      outputChannel.error(
        "DATABASES",
        "Failed to list collections",
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get collection details including attributes and indexes
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
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );

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
      outputChannel.error(
        "DATABASES",
        "Failed to get collection details",
        error as Error,
      );
      return {
        collection: { $id: collectionId, name: "", $databaseId: databaseId },
        attributes: [],
        indexes: [],
      };
    }
  }

  /**
   * List documents in a collection (max 100)
   */
  async listDocuments(
    databaseId: string,
    collectionId: string,
    limit: number = 100,
  ): Promise<DocumentItem[]> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );

      // Fetch documents without query strings (Appwrite SDK v13 limitation)
      const response = await dbClient.listDocuments(databaseId, collectionId);

      const documents = extractObjectArrayWithId(response);
      // Limit to specified number of documents
      return documents.slice(0, limit);
    } catch (error) {
      outputChannel.error(
        "[DATABASES]",
        "Failed to list documents",
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get a specific document
   */
  async getDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
  ): Promise<DocumentItem | null> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );
      const doc = await dbClient.getDocument(
        databaseId,
        collectionId,
        documentId,
      );
      return doc as DocumentItem;
    } catch (error) {
      outputChannel.error(
        "[DATABASES]",
        "Failed to get document",
        error as Error,
      );
      return null;
    }
  }

  /**
   * Create a new database
   */
  async createDatabase(databaseName: string): Promise<DatabaseItem | null> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );
      const db = await dbClient.create(String(Math.random()), databaseName);

      outputChannel.success(
        "[DATABASES]",
        "Database created",
        `${databaseName} (${db.$id})`,
      );

      return {
        $id: db.$id,
        name: db.name,
      };
    } catch (error) {
      outputChannel.error(
        "[DATABASES]",
        "Failed to create database",
        error as Error,
      );
      return null;
    }
  }

  /**
   * Create a collection in a database
   */
  async createCollection(
    databaseId: string,
    collectionName: string,
  ): Promise<CollectionItem | null> {
    try {
      const dbClient = appwriteClientService.createDatabasesService(
        this.project,
        this.apiKey,
      );
      const col = await dbClient.createCollection(
        databaseId,
        String(Math.random()),
        collectionName,
      );

      outputChannel.success(
        "[DATABASES]",
        "Collection created",
        `${collectionName} (${col.$id})`,
      );

      return {
        $id: col.$id,
        name: col.name,
        $databaseId: databaseId,
      };
    } catch (error) {
      outputChannel.error(
        "[DATABASES]",
        "Failed to create collection",
        error as Error,
      );
      return null;
    }
  }
}
