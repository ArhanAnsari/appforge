/**
 * Database Management Commands
 * Handles: List Documents, Create Document, Update Document, Delete Document, Refresh
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { ProjectStorageService } from "../services/projectStorageService";
import { ID, Query } from "node-appwrite";

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
      treeProvider.refresh();
      vscode.window.showInformationMessage("✓ Databases refreshed");
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

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Creating document...",
        cancellable: false,
      },
      async () => {
        try {
          const databases = appwriteClient.getDatabases();
          const doc = await databases.createDocument(
            databaseId,
            collectionId,
            ID.unique(),
            documentData,
          );

          treeProvider.refresh();
          vscode.window.showInformationMessage(
            `✓ Document created: ${doc.$id}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
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
          const databases = appwriteClient.getDatabases();
          await databases.deleteDocument(databaseId, collectionId, documentId);

          treeProvider.refresh();
          vscode.window.showInformationMessage("✓ Document deleted");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to delete document: ${message}`,
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
          const databases = appwriteClient.getDatabases();
          const docs = await databases.listDocuments(databaseId, collectionId, [
            Query.limit(100),
          ]);

          const channel = vscode.window.createOutputChannel(
            "AppForge - Documents",
          );
          channel.clear();
          channel.appendLine(`📋 Documents in Collection: ${collectionId}`);
          channel.appendLine(`Total: ${docs.total}\n`);

          if (docs.documents.length === 0) {
            channel.appendLine("No documents found.");
          } else {
            docs.documents.forEach((doc) => {
              channel.appendLine(`ID: ${doc.$id}`);
              channel.appendLine(`Created: ${doc.$createdAt}`);
              channel.appendLine(`Data: ${JSON.stringify(doc, null, 2)}`);
              channel.appendLine("---");
            });
          }

          channel.show(vscode.ViewColumn.Beside);
          vscode.window.showInformationMessage(
            `✓ Loaded ${docs.documents.length} documents`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
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
          const databases = appwriteClient.getDatabases();
          await databases.updateDocument(
            databaseId,
            collectionId,
            documentId,
            updatedData,
          );

          treeProvider.refresh();
          vscode.window.showInformationMessage(
            `✓ Document updated: ${documentId}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to update document: ${message}`,
          );
        }
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}
