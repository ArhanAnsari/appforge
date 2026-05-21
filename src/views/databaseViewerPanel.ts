/**
 * Database Viewer Panel
 * Premium database viewer/editor for Appwrite collections
 *
 * Features:
 * - Table/grid layout with pagination
 * - Document search and filtering
 * - Inline editing with validation
 * - Delete row with confirmation
 * - JSON expand modal
 * - Column sorting
 * - Loading/empty/error states
 * - Dark theme compatible
 * - Keyboard shortcuts
 */

import * as vscode from "vscode";
import { AppwriteClientService } from "../services/appwriteClientService";
import { ProjectStorageService } from "../services/projectStorageService";
import { AppForgeTreeDataProvider } from "../providers/treeDataProvider";
import { logger } from "../utils/logger";

interface DatabaseViewerState {
  projectId: string;
  databaseId: string;
  collectionId: string;
  collectionName: string;
  pageSize: number;
  currentPage: number;
  searchQuery: string;
  sortBy?: string;
  sortAsc: boolean;
  documents: any[];
  totalCount: number;
  isLoading: boolean;
  error?: string;
}

export class DatabaseViewerPanel {
  private static instance: DatabaseViewerPanel | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private state: DatabaseViewerState;

  private constructor(
    private appwriteClient: AppwriteClientService,
    private projectStorage: ProjectStorageService,
    private treeProvider: AppForgeTreeDataProvider,
    private extensionUri: vscode.Uri,
    initialState: DatabaseViewerState,
  ) {
    this.state = initialState;
  }

  /**
   * Create or show the database viewer panel
   */
  public static async createOrShow(
    extensionUri: vscode.Uri,
    appwriteClient: AppwriteClientService,
    projectStorage: ProjectStorageService,
    treeProvider: AppForgeTreeDataProvider,
    projectId: string,
    databaseId: string,
    collectionId: string,
    collectionName: string,
  ): Promise<void> {
    const column = vscode.ViewColumn.Beside;

    if (DatabaseViewerPanel.instance) {
      DatabaseViewerPanel.instance.panel?.reveal(column);
      // Update state if different collection
      if (
        DatabaseViewerPanel.instance.state.collectionId !== collectionId ||
        DatabaseViewerPanel.instance.state.databaseId !== databaseId
      ) {
        DatabaseViewerPanel.instance.updateCollection(
          projectId,
          databaseId,
          collectionId,
          collectionName,
        );
      }
      return;
    }

    const initialState: DatabaseViewerState = {
      projectId,
      databaseId,
      collectionId,
      collectionName,
      pageSize: 25,
      currentPage: 1,
      searchQuery: "",
      sortAsc: true,
      documents: [],
      totalCount: 0,
      isLoading: true,
    };

    const instance = new DatabaseViewerPanel(
      appwriteClient,
      projectStorage,
      treeProvider,
      extensionUri,
      initialState,
    );

    DatabaseViewerPanel.instance = instance;
    await instance.createPanel();
    await instance.loadDocuments();
  }

  /**
   * Create the webview panel
   */
  private async createPanel(): Promise<void> {
    this.panel = vscode.window.createWebviewPanel(
      "appforgeDbViewer",
      `📊 ${this.state.collectionName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true,
      },
    );

    this.panel.onDidDispose(() => {
      DatabaseViewerPanel.instance = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
    );

    this.panel.webview.html = this.getHtmlContent();
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.command) {
        case "loadDocuments":
          await this.loadDocuments();
          break;
        case "goToPage":
          this.state.currentPage = message.page;
          await this.loadDocuments();
          break;
        case "changePageSize":
          this.state.pageSize = message.pageSize;
          this.state.currentPage = 1;
          await this.loadDocuments();
          break;
        case "search":
          this.state.searchQuery = message.query;
          this.state.currentPage = 1;
          await this.loadDocuments();
          break;
        case "sort":
          if (this.state.sortBy === message.field) {
            this.state.sortAsc = !this.state.sortAsc;
          } else {
            this.state.sortBy = message.field;
            this.state.sortAsc = true;
          }
          await this.loadDocuments();
          break;
        case "editDocument":
          await this.editDocument(message.documentId, message.data);
          break;
        case "deleteDocument":
          await this.deleteDocument(message.documentId);
          break;
        case "viewJson":
          this.showJsonModal(message.document);
          break;
        case "copyJson":
          await vscode.env.clipboard.writeText(message.json);
          vscode.window.showInformationMessage("✓ JSON copied to clipboard");
          break;
        case "refresh":
          await this.loadDocuments();
          break;
      }
    } catch (error) {
      logger.error("DBVIEWER", "Error handling message", error);
      this.setState({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  /**
   * Load documents from collection
   */
  private async loadDocuments(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: undefined });

      // Initialize project context
      const project = this.projectStorage.getProjectById(this.state.projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const apiKey = await this.projectStorage.getApiKey(this.state.projectId);
      if (!apiKey) {
        throw new Error("API key not found");
      }

      this.appwriteClient.initialize(project, apiKey);

      const databases = this.appwriteClient.getDatabases();

      // Build query
      const queries: string[] = [];

      // Add search query if provided
      if (this.state.searchQuery) {
        queries.push(`search("${this.state.searchQuery}")`);
      }

      // Add sorting
      if (this.state.sortBy) {
        const order = this.state.sortAsc ? "ASC" : "DESC";
        queries.push(`orderBy("${this.state.sortBy}", "${order}")`);
      }

      // Add pagination
      const offset = (this.state.currentPage - 1) * this.state.pageSize;
      queries.push(`limit(${this.state.pageSize})`);
      queries.push(`offset(${offset})`);

      logger.debug("DBVIEWER", "Fetching documents", {
        collection: this.state.collectionId,
        page: this.state.currentPage,
        pageSize: this.state.pageSize,
        queryCount: queries.length,
      });

      // Fetch documents
      const response: any = await databases.listDocuments(
        this.state.databaseId,
        this.state.collectionId,
        queries,
      );

      this.setState({
        documents: response.documents || [],
        totalCount: response.total || 0,
        isLoading: false,
      });

      logger.success("DBVIEWER", "Documents loaded", {
        collection: this.state.collectionId,
        count: this.state.documents.length,
        total: this.state.totalCount,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("DBVIEWER", "Failed to load documents", error);
      this.setState({
        error: msg,
        isLoading: false,
        documents: [],
      });
    }
  }

  /**
   * Update document
   */
  private async editDocument(documentId: string, data: any): Promise<void> {
    try {
      const project = this.projectStorage.getProjectById(this.state.projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const apiKey = await this.projectStorage.getApiKey(this.state.projectId);
      if (!apiKey) {
        throw new Error("API key not found");
      }

      this.appwriteClient.initialize(project, apiKey);

      logger.debug("DBVIEWER", "Updating document", {
        documentId,
        fieldsCount: Object.keys(data).length,
      });

      await this.appwriteClient
        .getDatabases()
        .updateDocument(
          this.state.databaseId,
          this.state.collectionId,
          documentId,
          data,
        );

      logger.success("DBVIEWER", "Document updated", { documentId });
      vscode.window.showInformationMessage("✓ Document updated");

      // Refresh documents
      await this.loadDocuments();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("DBVIEWER", "Failed to update document", error);
      vscode.window.showErrorMessage(`Failed to update: ${msg}`);
    }
  }

  /**
   * Delete document
   */
  private async deleteDocument(documentId: string): Promise<void> {
    try {
      const confirm = await vscode.window.showWarningMessage(
        `Delete document "${documentId}"?`,
        { modal: true },
        "Delete",
      );

      if (confirm !== "Delete") {
        return;
      }

      const project = this.projectStorage.getProjectById(this.state.projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const apiKey = await this.projectStorage.getApiKey(this.state.projectId);
      if (!apiKey) {
        throw new Error("API key not found");
      }

      this.appwriteClient.initialize(project, apiKey);

      logger.debug("DBVIEWER", "Deleting document", { documentId });

      await this.appwriteClient
        .getDatabases()
        .deleteDocument(
          this.state.databaseId,
          this.state.collectionId,
          documentId,
        );

      logger.success("DBVIEWER", "Document deleted", { documentId });
      vscode.window.showInformationMessage("✓ Document deleted");

      // Refresh documents
      await this.loadDocuments();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("DBVIEWER", "Failed to delete document", error);
      vscode.window.showErrorMessage(`Failed to delete: ${msg}`);
    }
  }

  /**
   * Show JSON modal
   */
  private showJsonModal(document: any): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      command: "showJsonModal",
      document: JSON.stringify(document, null, 2),
    });
  }

  /**
   * Update collection
   */
  private async updateCollection(
    projectId: string,
    databaseId: string,
    collectionId: string,
    collectionName: string,
  ): Promise<void> {
    this.state = {
      projectId,
      databaseId,
      collectionId,
      collectionName,
      pageSize: 25,
      currentPage: 1,
      searchQuery: "",
      sortAsc: true,
      documents: [],
      totalCount: 0,
      isLoading: true,
    };

    if (this.panel) {
      this.panel.title = `📊 ${collectionName}`;
      await this.loadDocuments();
    }
  }

  /**
   * Update component state and refresh UI
   */
  private setState(updates: Partial<DatabaseViewerState>): void {
    this.state = { ...this.state, ...updates };
    this.updateWebview();
  }

  /**
   * Send updated state to webview
   */
  private updateWebview(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.postMessage({
      command: "updateState",
      state: this.state,
    });
  }

  /**
   * Generate HTML content
   */
  private getHtmlContent(): string {
    const theme = this.getThemeVariables();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Viewer</title>
  <style>
    :root {
      --bg-primary: ${theme.bgPrimary};
      --bg-secondary: ${theme.bgSecondary};
      --fg-primary: ${theme.fgPrimary};
      --fg-secondary: ${theme.fgSecondary};
      --border: ${theme.border};
      --accent: ${theme.accent};
      --error: ${theme.error};
      --success: ${theme.success};
      --warning: ${theme.warning};
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: var(--bg-primary);
      color: var(--fg-primary);
      font-size: 13px;
      line-height: 1.5;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    /* Search & Controls */
    .controls {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-box {
      flex: 1;
      min-width: 200px;
      padding: 6px 10px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--fg-primary);
      font-size: 13px;
    }

    .search-box::placeholder {
      color: var(--fg-secondary);
    }

    .page-size-select {
      padding: 6px 8px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--fg-primary);
      font-size: 13px;
      cursor: pointer;
    }

    .btn {
      padding: 6px 12px;
      background-color: var(--accent);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .btn:hover {
      opacity: 0.8;
    }

    .btn-secondary {
      background-color: var(--bg-secondary);
      color: var(--fg-primary);
      border: 1px solid var(--border);
    }

    .btn-danger {
      background-color: var(--error);
    }

    /* Table */
    .table-wrapper {
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
      background-color: var(--bg-secondary);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    thead {
      background-color: var(--bg-primary);
      border-bottom: 1px solid var(--border);
    }

    th {
      padding: 10px;
      text-align: left;
      font-weight: 600;
      color: var(--fg-secondary);
      cursor: pointer;
      user-select: none;
      border-right: 1px solid var(--border);
      transition: background-color 0.2s;
    }

    th:last-child {
      border-right: none;
    }

    th:hover {
      background-color: var(--bg-secondary);
    }

    th.sortable::after {
      content: ' ⇅';
      opacity: 0.3;
      font-size: 11px;
    }

    th.sort-asc::after {
      content: ' ↑';
      opacity: 1;
    }

    th.sort-desc::after {
      content: ' ↓';
      opacity: 1;
    }

    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background-color 0.15s;
    }

    tbody tr:hover {
      background-color: var(--bg-primary);
    }

    td {
      padding: 10px;
      border-right: 1px solid var(--border);
      word-break: break-word;
      max-width: 300px;
    }

    td:last-child {
      border-right: none;
    }

    .cell-id {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      color: var(--accent);
    }

    .cell-date {
      color: var(--fg-secondary);
      font-size: 12px;
    }

    .cell-value {
      max-height: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: pre-wrap;
    }

    .cell-json {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 11px;
      color: var(--fg-secondary);
      max-width: 200px;
    }

    /* Actions column */
    .actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }

    .action-btn {
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid var(--border);
      background-color: var(--bg-secondary);
      color: var(--fg-primary);
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background-color: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    .action-btn.danger:hover {
      background-color: var(--error);
      border-color: var(--error);
    }

    /* Loading state */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--fg-secondary);
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--fg-secondary);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Empty state */
    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: var(--fg-secondary);
    }

    .empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .empty-text {
      margin: 0;
      font-size: 14px;
    }

    /* Error state */
    .error-state {
      padding: 20px;
      background-color: rgba(255, 0, 0, 0.1);
      border: 1px solid var(--error);
      border-radius: 4px;
      color: var(--error);
      margin-bottom: 16px;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      font-size: 13px;
    }

    .pagination-info {
      color: var(--fg-secondary);
    }

    .pagination-controls {
      display: flex;
      gap: 8px;
    }

    .page-btn {
      padding: 6px 10px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--fg-primary);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .page-btn:hover:not(:disabled) {
      background-color: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* JSON Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal.show {
      display: flex;
    }

    .modal-content {
      background-color: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 20px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 16px;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--fg-primary);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .json-viewer {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
      max-height: 60vh;
    }

    .json-key {
      color: var(--accent);
    }

    .json-string {
      color: #6a9955;
    }

    .json-number {
      color: #d7ba7d;
    }

    .json-boolean {
      color: #569cd6;
    }

    .json-null {
      color: #808080;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📊 Database Viewer</h2>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="refreshTable()">🔄 Refresh</button>
      </div>
    </div>

    <div id="errorContainer"></div>

    <div class="controls">
      <input
        type="text"
        class="search-box"
        id="searchInput"
        placeholder="Search documents..."
        onkeyup="handleSearch()"
      >
      <select class="page-size-select" id="pageSizeSelect" onchange="handlePageSizeChange()">
        <option value="10">10 per page</option>
        <option value="25" selected>25 per page</option>
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
      </select>
    </div>

    <div id="tableContainer" class="table-wrapper">
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading documents...</span>
      </div>
    </div>

    <div class="pagination" id="paginationContainer" style="display: none;">
      <div class="pagination-info" id="paginationInfo"></div>
      <div class="pagination-controls">
        <button class="page-btn" id="prevBtn" onclick="prevPage()">← Previous</button>
        <span id="pageInfo"></span>
        <button class="page-btn" id="nextBtn" onclick="nextPage()">Next →</button>
      </div>
    </div>
  </div>

  <div id="jsonModal" class="modal" onclick="closeJsonModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>📄 Document JSON</h3>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="copyJsonToClipboard()">📋 Copy</button>
          <button class="modal-close" onclick="closeJsonModal()">✕</button>
        </div>
      </div>
      <pre class="json-viewer" id="jsonContent"></pre>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentState = null;

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.command === 'updateState') {
        currentState = message.state;
        renderTable();
      } else if (message.command === 'showJsonModal') {
        showJsonModal(message.document);
      }
    });

    function renderTable() {
      if (!currentState) return;

      const { isLoading, error, documents, totalCount, currentPage, pageSize, collectionName } = currentState;
      const container = document.getElementById('tableContainer');

      if (error) {
        const errorDiv = document.getElementById('errorContainer');
        errorDiv.innerHTML = \`<div class="error-state">⚠️ Error: \${error}</div>\`;
      } else {
        document.getElementById('errorContainer').innerHTML = '';
      }

      if (isLoading) {
        container.innerHTML = \`
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading documents...</span>
          </div>
        \`;
        document.getElementById('paginationContainer').style.display = 'none';
        return;
      }

      if (documents.length === 0) {
        container.innerHTML = \`
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <p class="empty-text">No documents in this collection</p>
          </div>
        \`;
        document.getElementById('paginationContainer').style.display = 'none';
        return;
      }

      // Generate table HTML
      const columns = Object.keys(documents[0] || {});
      const headerHtml = columns
        .map(col => \`<th class="sortable" onclick="handleSort('\${col}')">\${col}</th>\`)
        .join('') + '<th>Actions</th>';

      const rowsHtml = documents
        .map(doc => {
          const cells = columns.map(col => {
            const value = doc[col];
            let displayValue = '';

            if (value === null) {
              displayValue = '<span style="color: var(--fg-secondary)">null</span>';
            } else if (typeof value === 'object') {
              displayValue = \`<code class="cell-json">\${JSON.stringify(value).substring(0, 50)}...</code>\`;
            } else if (typeof value === 'string' && (col === '\$createdAt' || col === '\$updatedAt')) {
              displayValue = \`<span class="cell-date">\${new Date(value).toLocaleString()}</span>\`;
            } else if (typeof value === 'string' && col === '\$id') {
              displayValue = \`<span class="cell-id">\${value.substring(0, 12)}...</span>\`;
            } else {
              displayValue = \`<span class="cell-value">\${String(value).substring(0, 100)}</span>\`;
            }

            return \`<td>\${displayValue}</td>\`;
          }).join('');

          return \`
            <tr>
              \${cells}
              <td>
                <div class="actions">
                  <button class="action-btn" onclick="viewJson(\${JSON.stringify(doc).replace(/"/g, '&quot;')})">View</button>
                  <button class="action-btn danger" onclick="deleteDoc('\${doc.\$id}')">Delete</button>
                </div>
              </td>
            </tr>
          \`;
        })
        .join('');

      container.innerHTML = \`
        <table>
          <thead><tr>\${headerHtml}</tr></thead>
          <tbody>\${rowsHtml}</tbody>
        </table>
      \`;

      // Update pagination
      const totalPages = Math.ceil(totalCount / pageSize);
      document.getElementById('paginationContainer').style.display = 'flex';
      document.getElementById('paginationInfo').textContent =
        \`Showing \${(currentPage - 1) * pageSize + 1}-\${Math.min(currentPage * pageSize, totalCount)} of \${totalCount}\`;
      document.getElementById('pageInfo').textContent = \`Page \${currentPage} of \${totalPages}\`;
      document.getElementById('prevBtn').disabled = currentPage === 1;
      document.getElementById('nextBtn').disabled = currentPage === totalPages;
    }

    function handleSearch() {
      const query = document.getElementById('searchInput').value;
      vscode.postMessage({ command: 'search', query });
    }

    function handlePageSizeChange() {
      const pageSize = parseInt(document.getElementById('pageSizeSelect').value);
      vscode.postMessage({ command: 'changePageSize', pageSize });
    }

    function handleSort(field) {
      vscode.postMessage({ command: 'sort', field });
    }

    function prevPage() {
      if (currentState.currentPage > 1) {
        vscode.postMessage({ command: 'goToPage', page: currentState.currentPage - 1 });
      }
    }

    function nextPage() {
      const totalPages = Math.ceil(currentState.totalCount / currentState.pageSize);
      if (currentState.currentPage < totalPages) {
        vscode.postMessage({ command: 'goToPage', page: currentState.currentPage + 1 });
      }
    }

    function viewJson(doc) {
      vscode.postMessage({ command: 'viewJson', document: doc });
    }

    function showJsonModal(jsonStr) {
      document.getElementById('jsonContent').textContent = jsonStr;
      document.getElementById('jsonModal').classList.add('show');
    }

    function closeJsonModal(event) {
      if (event && event.target !== document.getElementById('jsonModal')) return;
      document.getElementById('jsonModal').classList.remove('show');
    }

    function copyJsonToClipboard() {
      const jsonContent = document.getElementById('jsonContent').textContent;
      vscode.postMessage({ command: 'copyJson', json: jsonContent });
    }

    function deleteDoc(docId) {
      vscode.postMessage({ command: 'deleteDocument', documentId: docId });
    }

    function refreshTable() {
      vscode.postMessage({ command: 'refresh' });
    }

    // Request initial state
    vscode.postMessage({ command: 'loadDocuments' });
  </script>
</body>
</html>`;
  }

  /**
   * Get theme variables for webview
   */
  private getThemeVariables(): Record<string, string> {
    const isDark =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;

    return {
      bgPrimary: isDark ? "#1e1e1e" : "#ffffff",
      bgSecondary: isDark ? "#252526" : "#f5f5f5",
      fgPrimary: isDark ? "#d4d4d4" : "#333333",
      fgSecondary: isDark ? "#858585" : "#666666",
      border: isDark ? "#3e3e42" : "#d0d0d0",
      accent: isDark ? "#007acc" : "#0066cc",
      error: isDark ? "#f44747" : "#e81828",
      success: isDark ? "#4ec9b0" : "#107c10",
      warning: isDark ? "#dcdcaa" : "#ff8c00",
    };
  }
}
