import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { ProjectStorageService } from "../services/projectStorageService";
import { DatabaseService } from "../services/databaseService";
import { StoredProject, AttributeItem, DocumentItem } from "../types";

const activeViewerPanels = new Map<string, vscode.WebviewPanel>();

export function registerDatabaseViewerCommands(
  context: vscode.ExtensionContext,
  appwriteClient: AppwriteClientService,
  projectStorage: ProjectStorageService,
  treeProvider: any
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "appforge.viewDatabase",
      async (item?: any) => {
        try {
          const collectionId = item?.data?.id || item?.id;
          const databaseId = item?.data?.databaseId;
          const projectId = item?.data?.projectId || projectStorage.getActiveProjectId();

          if (!collectionId || !databaseId || !projectId) {
            vscode.window.showErrorMessage(
              "AppForge Viewer: Missing collection or database context."
            );
            return;
          }

          const project = projectStorage.getProjectById(projectId);
          const apiKey = await projectStorage.getApiKey(projectId);

          if (!project || !apiKey) {
            vscode.window.showErrorMessage("AppForge Viewer: Missing project credentials.");
            return;
          }

          const dbService = new DatabaseService(project, apiKey);
          const [details, documents] = await Promise.all([
            dbService.getCollectionDetails(databaseId, collectionId),
            dbService.listDocuments(databaseId, collectionId, 100),
          ]);

          openDatabaseViewerPanel(
            context,
            project,
            databaseId,
            collectionId,
            details.collection.name || collectionId,
            details.attributes || [],
            documents || []
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to open Database Viewer: ${msg}`);
        }
      }
    )
  );
}

function openDatabaseViewerPanel(
  context: vscode.ExtensionContext,
  project: StoredProject,
  databaseId: string,
  collectionId: string,
  collectionName: string,
  attributes: AttributeItem[],
  documents: DocumentItem[]
): void {
  const panelKey = `${project.projectId}:${databaseId}:${collectionId}`;

  if (activeViewerPanels.has(panelKey)) {
    const existingPanel = activeViewerPanels.get(panelKey);
    existingPanel?.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "appforgeDatabaseViewer",
    `Database Viewer: ${collectionName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  activeViewerPanels.set(panelKey, panel);

  panel.onDidDispose(() => {
    activeViewerPanels.delete(panelKey);
  });

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "refresh": {
        try {
          const apiKey = await new ProjectStorageService(context, context.secrets).getApiKey(project.projectId);
          if (apiKey) {
            const dbService = new DatabaseService(project, apiKey);
            const updatedDocs = await dbService.listDocuments(databaseId, collectionId, 100);
            panel.webview.postMessage({ command: "updateDocuments", documents: updatedDocs });
            vscode.window.showInformationMessage(`Refreshed ${collectionName}`);
          }
        } catch {
          vscode.window.showErrorMessage("Failed to refresh documents.");
        }
        break;
      }
      case "deleteDocument": {
        const docId = message.documentId;
        const confirm = await vscode.window.showWarningMessage(
          `Delete document "${docId}"? This action cannot be undone.`,
          { modal: true },
          "Delete"
        );
        if (confirm === "Delete") {
          try {
            const apiKey = await new ProjectStorageService(context, context.secrets).getApiKey(project.projectId);
            if (apiKey) {
              const dbService = new DatabaseService(project, apiKey);
              const clientService = AppwriteClientService.createForProject(project, apiKey);
              await clientService.getDatabasesService().deleteDocument(databaseId, collectionId, docId);
              
              const updatedDocs = await dbService.listDocuments(databaseId, collectionId, 100);
              panel.webview.postMessage({ command: "updateDocuments", documents: updatedDocs });
              vscode.window.showInformationMessage(`Deleted document ${docId}`);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to delete document: ${errorMsg}`);
          }
        }
        break;
      }
      case "viewDocument": {
        const doc = message.document;
        const docView = await vscode.workspace.openTextDocument({
          content: JSON.stringify(doc, null, 2),
          language: "json",
        });
        await vscode.window.showTextDocument(docView, { preview: true });
        break;
      }
    }
  });

  panel.webview.html = getDatabaseViewerHtml(collectionName, attributes, documents);
}

function getDatabaseViewerHtml(
  collectionName: string,
  attributes: AttributeItem[],
  documents: DocumentItem[]
): string {
  const customColumns = attributes.map((attr) => attr.key);
  const systemColumns = ["$id", "$createdAt", "$updatedAt", "$permissions", "$databaseId", "$collectionId"];
  const allColumns = Array.from(new Set([...customColumns, ...systemColumns]));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Viewer: ${collectionName}</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); margin: 0; padding: 16px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
    .search-input { flex: 1; padding: 6px 12px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; font-family: inherit; }
    .btn { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; border-radius: 3px; cursor: pointer; font-size: 12px; }
    .btn:hover { background-color: var(--vscode-button-hoverBackground); }
    .table-container { overflow-x: auto; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; text-align: left; white-space: nowrap; }
    th, td { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); border-right: 1px solid var(--vscode-panel-border); max-width: 250px; overflow: hidden; text-overflow: ellipsis; }
    th { background-color: var(--vscode-editorHeader-background, rgba(255, 255, 255, 0.05)); font-weight: 600; position: sticky; top: 0; }
    tr:hover { background-color: var(--vscode-list-hoverBackground); }
    .btn-action { background: none; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; padding: 2px 6px; font-size: 11px; }
    .btn-action:hover { text-decoration: underline; }
    .btn-danger { color: var(--vscode-errorForeground, #f48771); }
  </style>
</head>
<body>
  <div class="toolbar">
    <input type="text" id="searchInput" class="search-input" placeholder="Search documents..." onkeyup="filterTable()">
    <button class="btn" onclick="refreshData()">🔄 Refresh</button>
  </div>

  <div class="table-container">
    <table id="docTable">
      <thead>
        <tr>
          ${allColumns.map((col) => `<th>${col}</th>`).join("")}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="tableBody">
        ${renderTableRows(allColumns, documents)}
      </tbody>
    </table>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let documentsData = ${JSON.stringify(documents)};
    const columns = ${JSON.stringify(allColumns)};

    function refreshData() { vscode.postMessage({ command: 'refresh' }); }
    function viewDoc(index) { vscode.postMessage({ command: 'viewDocument', document: documentsData[index] }); }
    function deleteDoc(docId) { vscode.postMessage({ command: 'deleteDocument', documentId: docId }); }

    function filterTable() {
      const q = document.getElementById('searchInput').value.toLowerCase();
      const rows = document.querySelectorAll('#tableBody tr');
      rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
      });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'updateDocuments') {
        documentsData = message.documents;
        document.getElementById('tableBody').innerHTML = renderRowsJS(documentsData);
      }
    });

    function renderRowsJS(docs) {
      if (!docs || docs.length === 0) {
        return \`<tr><td colspan="\${columns.length + 1}" style="text-align:center;">No documents found</td></tr>\`;
      }
      return docs.map((doc, idx) => {
        const cells = columns.map(col => {
          let val = doc[col];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          return \`<td title="\${val !== undefined ? String(val) : ''}">\${val !== undefined ? String(val) : '-'}</td>\`;
        }).join('');

        return \`<tr>
          \${cells}
          <td>
            <button class="btn-action" onclick="viewDoc(\${idx})">View</button>
            <button class="btn-action btn-danger" onclick="deleteDoc('\${doc.$id}')">Delete</button>
          </td>
        </tr>\`;
      }).join('');
    }
  </script>
</body>
</html>`;
}

function renderTableRows(columns: string[], documents: DocumentItem[]): string {
  if (!documents || documents.length === 0) {
    return `<tr><td colspan="${columns.length + 1}" style="text-align:center;">No documents found in this collection</td></tr>`;
  }

  return documents
    .map((doc: any, idx: number) => {
      const cells = columns
        .map((col) => {
          let val = doc[col];
          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          const displayVal = val !== undefined ? String(val) : "-";
          return `<td title="${displayVal}">${displayVal}</td>`;
        })
        .join("");

      return `<tr>
        ${cells}
        <td>
          <button class="btn-action" onclick="viewDoc(${idx})">View</button>
          <button class="btn-action btn-danger" onclick="deleteDoc('${doc.$id}')">Delete</button>
        </td>
      </tr>`;
    })
    .join("");
}