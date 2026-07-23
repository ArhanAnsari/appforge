/**
 * Database Management Commands
 * Handles: List Documents, Create Document, Update Document, Delete Document, Refresh
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider, AppForgeTreeItem } from "../providers/treeDataProvider";
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
      refreshManager.queueRefresh("databases");
      outputChannel.success("DATABASE", "Databases refresh queued");
      await EventBus.getInstance().emit("refresh.requested", {
        scope: "databases",
      });
      await EventBus.getInstance().emit("refresh.completed", {
        projectId: projectStorage.getActiveProjectId(),
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
          typeof arg === "string" ? undefined : arg?.data?.projectId,
        );
      },
    ),
  );

  // List Documents
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.listDocuments",
      async (arg: any, arg2?: any) => {
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
          typeof arg === "string" ? undefined : arg?.data?.projectId,
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
          typeof arg === "string" ? undefined : arg?.data?.projectId,
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
          typeof arg === "string" ? undefined : arg?.data?.projectId,
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
  projectId?: string,
): Promise<void> {
  try {
    const projectContext = await resolveProjectContext(
      projectStorage,
      projectId,
    );
    if (!projectContext) {
      return;
    }

    const { project, apiKey, projectId: resolvedProjectId } = projectContext;

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
          const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);
          const start = Date.now();
          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
          const newId = ID.unique();
          const doc = await databases.createDocument(
            databaseId,
            collectionId,
            newId,
            documentData,
          );

          await EventBus.getInstance().emit("document.created", {
            projectId: resolvedProjectId,
            databaseId,
            collectionId,
            documentId: doc.$id,
            timestamp: Date.now(),
          });

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
            projectId: resolvedProjectId,
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
          try {
            const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
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
  projectId?: string,
): Promise<void> {
  try {
    const projectContext = await resolveProjectContext(
      projectStorage,
      projectId,
    );
    if (!projectContext) {
      return;
    }

    const { project, apiKey, projectId: resolvedProjectId } = projectContext;

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
          const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);

          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
          await databases.deleteDocument(databaseId, collectionId, documentId);

          await EventBus.getInstance().emit("document.deleted", {
            projectId: resolvedProjectId,
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
            projectId: resolvedProjectId,
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
            const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
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
  projectId?: string,
): Promise<void> {
  try {
    const projectContext = await resolveProjectContext(
      projectStorage,
      projectId,
    );
    if (!projectContext) {
      return;
    }

    const { project, apiKey, projectId: resolvedProjectId } = projectContext;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching documents...",
        cancellable: false,
      },
      async () => {
        try {
          const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);

          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
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
            projectId: resolvedProjectId,
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
  projectId?: string,
): Promise<void> {
  try {
    const projectContext = await resolveProjectContext(
      projectStorage,
      projectId,
    );
    if (!projectContext) {
      return;
    }

    const { project, apiKey, projectId: resolvedProjectId } = projectContext;

    let currentDoc: Record<string, unknown> | null = null;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching document...",
        cancellable: false,
      },
      async () => {
        try {
          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
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
          const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
          refreshManager.notifyLoadingChange(nodeKey, true);

          const databases = appwriteClient.createDatabasesService(
            project,
            apiKey,
          );
          const start = Date.now();
          await databases.updateDocument(
            databaseId,
            collectionId,
            documentId,
            updatedData,
          );

          await EventBus.getInstance().emit("document.updated", {
            projectId: resolvedProjectId,
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
            projectId: resolvedProjectId,
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
            const nodeKey = `col:${resolvedProjectId}:${databaseId}:${collectionId}`;
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

async function resolveProjectContext(
  projectStorage: ProjectStorageService,
  explicitProjectId?: string,
): Promise<{
  project: NonNullable<ReturnType<ProjectStorageService["getProjectById"]>>;
  apiKey: string;
  projectId: string;
} | null> {
  const projectId = explicitProjectId ?? projectStorage.getActiveProjectId();
  if (!projectId) {
    vscode.window.showErrorMessage(
      "No project selected. Switch to a project first.",
    );
    return null;
  }

  const project = projectStorage.getProjectById(projectId);
  if (!project) {
    vscode.window.showErrorMessage("Project not found");
    return null;
  }

  const apiKey = await projectStorage.getApiKey(projectId);
  if (!apiKey) {
    vscode.window.showErrorMessage("API key not found in secure storage");
    return null;
  }

  return { project, apiKey, projectId };
}
