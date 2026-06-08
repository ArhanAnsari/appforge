/**
 * Storage Service
 * Handles all storage operations: buckets, files
 */

import { Storage } from "node-appwrite";
import { BucketItem, FileItem, AppwriteProject } from "../types";
import { appwriteClientService } from "./appwriteClientService";
import { outputChannel } from "../core/output/outputChannel";
import { extractObjectArrayWithId } from "../utils/responseParser";

export class StorageService {
  constructor(
    private project: AppwriteProject,
    private apiKey: string,
  ) {}

  /**
   * List all storage buckets for the project
   */
  async listBuckets(): Promise<BucketItem[]> {
    try {
      const storageClient = appwriteClientService.createStorageService(
        this.project,
        this.apiKey,
      );
      const response = await storageClient.listBuckets();
      const buckets = extractObjectArrayWithId(response);

      return buckets.map((bucket: any) => ({
        $id: bucket.$id,
        name: bucket.name,
        // Appwrite returns a file count field depending on version; keep a safe fallback.
        filesCount: bucket.filesCount ?? bucket.filesTotal ?? bucket.files ?? 0,
        enabled: bucket.enabled,
      }));
    } catch (error) {
      outputChannel.error(
        "[STORAGE]",
        "Failed to list buckets",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get a specific bucket
   */
  async getBucket(bucketId: string): Promise<BucketItem> {
    try {
      const storageClient = appwriteClientService.createStorageService(
        this.project,
        this.apiKey,
      );
      const bucket = await storageClient.getBucket(bucketId);

      outputChannel.info("[STORAGE] Raw bucket sample data:", JSON.stringify(bucket, null, 2));

      return {
        $id: bucket.$id,
        name: bucket.name,
        enabled: bucket.enabled,
      };
    } catch (error) {
      outputChannel.error("[STORAGE]", "Failed to get bucket", error as Error);
      throw error;
    }
  }

  /**
   * List files in a bucket (max 100)
   */
  async listFiles(bucketId: string, limit: number = 100): Promise<FileItem[]> {
    try {
      const storageClient = appwriteClientService.createStorageService(
        this.project,
        this.apiKey,
      );
      // Note: Appwrite SDK v13 doesn't accept query strings, we'll limit in the response
      const response = await storageClient.listFiles(bucketId);
      const files = extractObjectArrayWithId(response);

      // Limit to specified number of files
      return files.slice(0, limit).map((file: any) => ({
        $id: file.$id,
        bucketId: bucketId,
        name: file.name,
        size: file.sizeOriginal || 0,
        $createdAt: file.$createdAt,
      }));
    } catch (error) {
      outputChannel.error("[STORAGE]", "Failed to list files", error as Error);
      throw error;
    }
  }

  /**
   * Get a specific file
   */
  async getFile(bucketId: string, fileId: string): Promise<FileItem> {
    try {
      const storageClient = appwriteClientService.createStorageService(
        this.project,
        this.apiKey,
      );
      const file = await storageClient.getFile(bucketId, fileId);

      return {
        $id: file.$id,
        bucketId: bucketId,
        name: file.name,
        size: file.sizeOriginal || 0,
        $createdAt: file.$createdAt,
      };
    } catch (error) {
      outputChannel.error("[STORAGE]", "Failed to get file", error as Error);
      throw error;
    }
  }

  /**
   * Create a new bucket
   */
  async createBucket(bucketName: string): Promise<BucketItem> {
    try {
      const storageClient = appwriteClientService.createStorageService(
        this.project,
        this.apiKey,
      );
      const bucket = await storageClient.createBucket(
        String(Math.random()),
        bucketName,
      );

      outputChannel.success(
        "[STORAGE]",
        "Bucket created",
        `${bucketName} (${bucket.$id})`,
      );

      return {
        $id: bucket.$id,
        name: bucket.name,
        filesCount: 0,
        enabled: bucket.enabled,
      };
    } catch (error) {
      outputChannel.error(
        "[STORAGE]",
        "Failed to create bucket",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    try {
      const storageClient = appwriteClientService.createStorageService(
        this.project,
        this.apiKey,
      );
      await storageClient.deleteFile(bucketId, fileId);

      outputChannel.success("[STORAGE]", "File deleted", `File ${fileId}`);
    } catch (error) {
      outputChannel.error("[STORAGE]", "Failed to delete file", error as Error);
      throw error;
    }
  }
}
