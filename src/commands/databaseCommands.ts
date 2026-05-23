/**
 * Database Management Commands
 * Handles: List Documents, Create Document, Update Document, Delete Document, Refresh
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { ProjectStorageService } from "../services/projectStorageService";
import { ID, Query } from "node-appwrite";
import { EventBus } from "../core/events/eventBus";
import { outputChannel } from "../core/output/outputChannel";
import { refreshManager } from "../core/refresh/refreshManager";

/**
 * Register database-related commands
 */
export function registerDatabaseCommands(
  context: vscode.ExtensionContext,
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
): void {
  // Refresh Databases
  context.subscriptions.push(
    vscode.commands.registerCommand("appforge.refreshDatabases", async () => {
      const active = appwriteClient.getActiveProject();
      const ts = Date.now();
      // Use RefreshManager to orchestrate a debounced scoped refresh
      refreshManager.queueRefresh("databases");
      outputChannel.success("DATABASE", "Databases refresh queued");
      await EventBus.getInstance().emit("refresh.requested", {
        scope: "databases",
      });
      await EventBus.getInstance().emit("refresh.completed", {
        projectId: active?.projectId,
        scope: "databases",
        duration: 0,
      });
    }),
  );

  // Create Document
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.createDocument",
      async (arg: any, arg2?: any) => {
        // Handle both tree item context and direct parameters
        let collectionId: string, databaseId: string;
        if (typeof arg === "string") {
          collectionId = arg;
          databaseId = arg2 || "";
        } else {
          collectionId = arg?.data?.id || "";
          databaseId = arg?.data?.databaseId || "";
        }
        await createDocumentCommand(
          appwriteClient,
          projectStorage,
          treeProvider,
          databaseId,
          collectionId,
        );
      },
    ),
  );

  // List Documents
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.listDocuments",
      async (arg: any, arg2?: any) => {
        // Handle both tree item context and direct parameters
        let collectionId: string, databaseId: string;
        if (typeof arg === "string") {
          collectionId = arg;
          databaseId = arg2 || "";
        } else {
          collectionId = arg?.data?.id || "";
          databaseId = arg?.data?.databaseId || "";
        }
        await listDocumentsCommand(
          appwriteClient,
          projectStorage,
          databaseId,
          collectionId,
        );
      },
    ),
  );

  // Update Document
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.updateDocument",
      async (arg: any, arg2?: any, arg3?: any) => {
        let documentId: string, collectionId: string, databaseId: string;
        if (typeof arg === "string") {
          documentId = arg;
          collectionId = arg2 || "";
          databaseId = arg3 || "";
        } else {
          documentId = arg?.data?.id || "";
          collectionId = arg?.data?.collectionId || "";
          databaseId = arg?.data?.databaseId || "";
        }
        await updateDocumentCommand(
          appwriteClient,
          projectStorage,
          treeProvider,
          databaseId,
          collectionId,
          documentId,
        );
      },
    ),
  );

  // Delete Document
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.deleteDocument",
      async (arg: any, arg2?: any, arg3?: any) => {
        let documentId: string, collectionId: string, databaseId: string;
        if (typeof arg === "string") {
          documentId = arg;
          collectionId = arg2 || "";
          databaseId = arg3 || "";
        } else {
          documentId = arg?.data?.id || "";
          collectionId = arg?.data?.collectionId || "";
          databaseId = arg?.data?.databaseId || "";
        }
        await deleteDocumentCommand(
          appwriteClient,
          projectStorage,
          treeProvider,
          databaseId,
          collectionId,
          documentId,
        );
      },
    ),
  );
}

/**
 * Create a new document in a collection
 */
async function createDocumentCommand(
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
  databaseId: string,
  collectionId: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    // Get JSON input from user
    const jsonInput = await vscode.window.showInputBox({
      placeHolder: '{ "field1": "value1", "field2": "value2" }',
      prompt: "Enter document data as JSON",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Document data cannot be empty";
        }
        try {
          JSON.parse(value);
          return "";
        } catch {
          return "Invalid JSON format";
        }
      },
    });

    if (!jsonInput) {
      return;
    }

    const documentData = JSON.parse(jsonInput);

    const operationId = ID.unique();
    await EventBus.getInstance().emit("operation.started", {
      operationType: "document.create",
      operationId,
    });
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Creating document...",
        cancellable: false,
      },
      async () => {
        try {
          const activeProject = appwriteClient.getActiveProject();
          const projectId = activeProject?.projectId || "";
          const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
          // optimistic loading indicator
          refreshManager.notifyLoadingChange(nodeKey, true);
          const start = Date.now();
          const databases = appwriteClient.getDatabases();
          const newId = ID.unique();
          const doc = await databases.createDocument(
            databaseId,
            collectionId,
            newId,
            documentData,
          );

          const active = appwriteClient.getActiveProject();
          await EventBus.getInstance().emit("document.created", {
            projectId: active?.projectId || "",
            databaseId,
            collectionId,
            documentId: doc.$id,
            timestamp: Date.now(),
          });

          // mark node refreshed and request a scoped refresh
          refreshManager.markRefreshed(nodeKey);
          refreshManager.notifyLoadingChange(nodeKey, false);
          refreshManager.queueRefresh("specific", nodeKey);
          outputChannel.success("DATABASE", `Document created: ${doc.$id}`);
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "document.create",
            operationId,
            success: true,
            duration: Date.now() - start,
          });
        } catch (error) {
          outputChannel.error(
            "DATABASE",
            "Failed to create document",
            error as Error,
          );
          const message =
            error instanceof Error ? error.message : String(error);
          await EventBus.getInstance().emit("error.occurred", {
            projectId: appwriteClient.getActiveProject()?.projectId,
            operation: "document.create",
            message,
            error,
          });
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "document.create",
            operationId,
            success: false,
            duration: 0,
          });
          // clear loading state on failure
          try {
            const activeProject = appwriteClient.getActiveProject();
            const projectId = activeProject?.projectId || "";
            const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
            refreshManager.notifyLoadingChange(nodeKey, false);
          } catch {}
          vscode.window.showErrorMessage(
            `Failed to create document: ${message}`,
          );
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

/**
 * Delete a document from a collection
 */
async function deleteDocumentCommand(
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
  databaseId: string,
  collectionId: string,
  documentId: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `Delete document "${documentId}"? This cannot be undone.`,
      { modal: true },
      "Delete",
    );

    if (confirmation !== "Delete") {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Deleting document...",
        cancellable: false,
      },
      async () => {
        try {
          const activeProject = appwriteClient.getActiveProject();
          const projectId = activeProject?.projectId || "";
          const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);

          const databases = appwriteClient.getDatabases();
          await databases.deleteDocument(databaseId, collectionId, documentId);

          const active = appwriteClient.getActiveProject();
          await EventBus.getInstance().emit("document.deleted", {
            projectId: active?.projectId || "",
            databaseId,
            collectionId,
            documentId,
            timestamp: Date.now(),
          });

          refreshManager.markRefreshed(nodeKey);
          refreshManager.notifyLoadingChange(nodeKey, false);
          refreshManager.queueRefresh("specific", nodeKey);
          outputChannel.success("DATABASE", `Document deleted: ${documentId}`);
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "document.delete",
            operationId: ID.unique(),
            success: true,
            duration: 0,
          });
        } catch (error) {
          outputChannel.error(
            "DATABASE",
            "Failed to delete document",
            error as Error,
          );
          const message =
            error instanceof Error ? error.message : String(error);
          await EventBus.getInstance().emit("error.occurred", {
            projectId: appwriteClient.getActiveProject()?.projectId,
            operation: "document.delete",
            message,
            error,
          });
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "document.delete",
            operationId: ID.unique(),
            success: false,
            duration: 0,
          });
          vscode.window.showErrorMessage(
            `Failed to delete document: ${message}`,
          );
          try {
            const activeProject = appwriteClient.getActiveProject();
            const projectId = activeProject?.projectId || "";
            const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
            refreshManager.notifyLoadingChange(nodeKey, false);
          } catch {}
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

/**
 * List all documents in a collection
 */
async function listDocumentsCommand(
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  databaseId: string,
  collectionId: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching documents...",
        cancellable: false,
      },
      async () => {
        try {
          const activeProject = appwriteClient.getActiveProject();
          const projectId = activeProject?.projectId || "";
          const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);

          const databases = appwriteClient.getDatabases();
          const start = Date.now();
          const docs = await databases.listDocuments(databaseId, collectionId, [
            Query.limit(100),
          ]);

          outputChannel.table(
            "DATABASE",
            `Documents in Collection: ${collectionId}`,
            docs.documents || [],
          );
          outputChannel.success(
            "DATABASE",
            `Loaded ${docs.documents.length} documents`,
            { collectionId },
            Date.now() - start,
          );
          // mark refreshed and clear loading
          refreshManager.markRefreshed(nodeKey);
          refreshManager.notifyLoadingChange(nodeKey, false);
          refreshManager.queueRefresh("specific", nodeKey);
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "documents.list",
            operationId: ID.unique(),
            success: true,
            duration: Date.now() - start,
          });
        } catch (error) {
          outputChannel.error(
            "DATABASE",
            "Failed to list documents",
            error as Error,
          );
          const message =
            error instanceof Error ? error.message : String(error);
          await EventBus.getInstance().emit("error.occurred", {
            projectId: appwriteClient.getActiveProject()?.projectId,
            operation: "documents.list",
            message,
            error,
          });
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "documents.list",
            operationId: ID.unique(),
            success: false,
            duration: 0,
          });
          vscode.window.showErrorMessage(
            `Failed to list documents: ${message}`,
          );
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

/**
 * Update an existing document
 */
async function updateDocumentCommand(
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: AppForgeTreeDataProvider,
  databaseId: string,
  collectionId: string,
  documentId: string,
): Promise<void> {
  try {
    if (!appwriteClient.isInitialized()) {
      vscode.window.showErrorMessage(
        "No active project. Switch to a project first.",
      );
      return;
    }

    // First fetch the current document
    let currentDoc: Record<string, unknown> | null = null;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching document...",
        cancellable: false,
      },
      async () => {
        try {
          const databases = appwriteClient.getDatabases();
          currentDoc = (await databases.getDocument(
            databaseId,
            collectionId,
            documentId,
          )) as Record<string, unknown>;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to fetch document: ${message}`,
          );
        }
      },
    );

    if (!currentDoc) {
      return;
    }

    // Show current data and get new data
    const currentJson = JSON.stringify(currentDoc, null, 2);
    const jsonInput = await vscode.window.showInputBox({
      value: currentJson,
      prompt: "Update document data (JSON)",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Document data cannot be empty";
        }
        try {
          JSON.parse(value);
          return "";
        } catch {
          return "Invalid JSON format";
        }
      },
    });

    if (!jsonInput) {
      return;
    }

    const updatedData = JSON.parse(jsonInput);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Updating document...",
        cancellable: false,
      },
      async () => {
        try {
          const activeProject = appwriteClient.getActiveProject();
          const projectId = activeProject?.projectId || "";
          const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);

          const databases = appwriteClient.getDatabases();
          const start = Date.now();
          await databases.updateDocument(
            databaseId,
            collectionId,
            documentId,
            updatedData,
          );

          const active = appwriteClient.getActiveProject();
          await EventBus.getInstance().emit("document.updated", {
            projectId: active?.projectId || "",
            databaseId,
            collectionId,
            documentId,
            timestamp: Date.now(),
          });

          refreshManager.markRefreshed(nodeKey);
          refreshManager.notifyLoadingChange(nodeKey, false);
          refreshManager.queueRefresh("specific", nodeKey);
          outputChannel.success("DATABASE", `Document updated: ${documentId}`);
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "document.update",
            operationId: ID.unique(),
            success: true,
            duration: Date.now() - start,
          });
        } catch (error) {
          outputChannel.error(
            "DATABASE",
            "Failed to update document",
            error as Error,
          );
          const message =
            error instanceof Error ? error.message : String(error);
          await EventBus.getInstance().emit("error.occurred", {
            projectId: appwriteClient.getActiveProject()?.projectId,
            operation: "document.update",
            message,
            error,
          });
          await EventBus.getInstance().emit("operation.completed", {
            operationType: "document.update",
            operationId: ID.unique(),
            success: false,
            duration: 0,
          });
          vscode.window.showErrorMessage(
            `Failed to update document: ${message}`,
          );
          try {
            const activeProject = appwriteClient.getActiveProject();
            const projectId = activeProject?.projectId || "";
            const nodeKey = `col:${projectId}:${databaseId}:${collectionId}`;
            refreshManager.notifyLoadingChange(nodeKey, false);
          } catch {}
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}
