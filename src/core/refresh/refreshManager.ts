/**
 * Refresh Manager
 * Intelligent realtime refresh system
 * 
 * Features:
 * - Automatic refresh after operations
 * - Preserves tree expansion state
 * - Avoids duplicate refreshes (debouncing)
 * - Scoped refreshing
 * - Optimistic updates
 * - Loading indicators
 */

import { EventBus, EventType, EventPayload } from "../events/eventBus";

interface RefreshRequest {
  scope: "all" | "tree" | "databases" | "functions" | "logs" | "specific";
  nodeId?: string; // for scoped refreshes
  timestamp: number;
}

interface CachedNode {
  id: string;
  isStale: boolean;
  lastRefreshed: number;
  isLoading: boolean;
}

/**
 * Manages realtime refresh of tree and UI components
 */
export class RefreshManager {
  private static instance: RefreshManager;
  private eventBus: EventBus;
  private refreshQueue: RefreshRequest[] = [];
  private isProcessing = false;
  private cachedNodes: Map<string, CachedNode> = new Map();
  private refreshListeners: Array<(request: RefreshRequest) => void> = [];
  private loadingListeners: Array<(nodeId: string, isLoading: boolean) => void> = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_DELAY = 300;
  private readonly MAX_QUEUE_SIZE = 50;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RefreshManager {
    if (!RefreshManager.instance) {
      RefreshManager.instance = new RefreshManager();
    }
    return RefreshManager.instance;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Database operations
    this.eventBus.on("database.created", () => this.queueRefresh("databases"));
    this.eventBus.on("database.deleted", () => this.queueRefresh("databases"));

    // Collection operations
    this.eventBus.on("collection.created", (payload) =>
      this.queueRefresh("specific", payload.databaseId),
    );
    this.eventBus.on("collection.deleted", (payload) =>
      this.queueRefresh("specific", payload.databaseId),
    );

    // Document operations
    this.eventBus.on("document.created", (payload) =>
      this.queueRefresh("specific", payload.collectionId),
    );
    this.eventBus.on("document.updated", (payload) =>
      this.queueRefresh("specific", payload.collectionId),
    );
    this.eventBus.on("document.deleted", (payload) =>
      this.queueRefresh("specific", payload.collectionId),
    );

    // Function operations
    this.eventBus.on("function.deployed", () => this.queueRefresh("functions"));
    this.eventBus.on("function.executed", () => this.queueRefresh("logs"));

    // Project operations
    this.eventBus.on("project.switched", () => this.queueRefresh("all"));
  }

  /**
   * Queue a refresh request
   */
  public queueRefresh(
    scope: "all" | "tree" | "databases" | "functions" | "logs" | "specific" = "tree",
    nodeId?: string,
  ): void {
    // Don't overflow the queue
    if (this.refreshQueue.length >= this.MAX_QUEUE_SIZE) {
      this.refreshQueue.shift();
    }

    // Debounce same refresh requests
    const key = `${scope}:${nodeId || ""}`;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!);
    }

    // Schedule refresh with debounce
    const timer = setTimeout(() => {
      const request: RefreshRequest = {
        scope: scope as any,
        nodeId,
        timestamp: Date.now(),
      };

      this.refreshQueue.push(request);
      this.debounceTimers.delete(key);
      this.processQueue();
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Process refresh queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.refreshQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.refreshQueue.length > 0) {
        const request = this.refreshQueue.shift()!;

        // Mark nodes as stale
        this.markNodesStale(request.scope, request.nodeId);

        // Notify listeners
        this.notifyRefreshListeners(request);

        // Wait a bit to batch updates
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Mark nodes as stale
   */
  private markNodesStale(scope: string, nodeId?: string): void {
    if (scope === "all") {
      for (const node of this.cachedNodes.values()) {
        node.isStale = true;
      }
    } else if (scope === "specific" && nodeId) {
      const node = this.cachedNodes.get(nodeId);
      if (node) {
        node.isStale = true;
      }
    } else {
      // Mark nodes by scope (e.g., all database nodes)
      for (const [id, node] of this.cachedNodes.entries()) {
        if (this.nodeMatchesScope(id, scope)) {
          node.isStale = true;
        }
      }
    }
  }

  /**
   * Check if node matches scope
   */
  private nodeMatchesScope(nodeId: string, scope: string): boolean {
    if (scope === "databases") {
      return nodeId.startsWith("db:");
    }
    if (scope === "functions") {
      return nodeId.startsWith("fn:");
    }
    if (scope === "logs") {
      return nodeId.startsWith("log:");
    }
    return false;
  }

  /**
   * Register refresh listener
   */
  public onRefresh(callback: (request: RefreshRequest) => void): () => void {
    this.refreshListeners.push(callback);
    return () => {
      const index = this.refreshListeners.indexOf(callback);
      if (index > -1) {
        this.refreshListeners.splice(index, 1);
      }
    };
  }

  /**
   * Register loading state listener
   */
  public onLoadingChange(callback: (nodeId: string, isLoading: boolean) => void): () => void {
    this.loadingListeners.push(callback);
    return () => {
      const index = this.loadingListeners.indexOf(callback);
      if (index > -1) {
        this.loadingListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify refresh listeners
   */
  private notifyRefreshListeners(request: RefreshRequest): void {
    this.refreshListeners.forEach((listener) => {
      try {
        listener(request);
      } catch (error) {
        console.error("RefreshManager listener error:", error);
      }
    });
  }

  /**
   * Notify loading state listeners
   */
  public notifyLoadingChange(nodeId: string, isLoading: boolean): void {
    // Update cached node
    if (!this.cachedNodes.has(nodeId)) {
      this.cachedNodes.set(nodeId, {
        id: nodeId,
        isStale: false,
        lastRefreshed: Date.now(),
        isLoading: false,
      });
    }

    const node = this.cachedNodes.get(nodeId)!;
    node.isLoading = isLoading;

    this.loadingListeners.forEach((listener) => {
      try {
        listener(nodeId, isLoading);
      } catch (error) {
        console.error("RefreshManager loading listener error:", error);
      }
    });
  }

  /**
   * Mark node as refreshed
   */
  public markRefreshed(nodeId: string): void {
    if (!this.cachedNodes.has(nodeId)) {
      this.cachedNodes.set(nodeId, {
        id: nodeId,
        isStale: false,
        lastRefreshed: Date.now(),
        isLoading: false,
      });
    }

    const node = this.cachedNodes.get(nodeId)!;
    node.isStale = false;
    node.lastRefreshed = Date.now();
    node.isLoading = false;
  }

  /**
   * Check if node is stale
   */
  public isNodeStale(nodeId: string): boolean {
    return this.cachedNodes.get(nodeId)?.isStale ?? true;
  }

  /**
   * Check if node is loading
   */
  public isNodeLoading(nodeId: string): boolean {
    return this.cachedNodes.get(nodeId)?.isLoading ?? false;
  }

  /**
   * Invalidate all cache
   */
  public invalidateAll(): void {
    for (const node of this.cachedNodes.values()) {
      node.isStale = true;
    }
  }

  /**
   * Get node cache info
   */
  public getNodeInfo(nodeId: string): CachedNode | undefined {
    return this.cachedNodes.get(nodeId);
  }

  /**
   * Clear cache
   */
  public clear(): void {
    this.cachedNodes.clear();
    this.refreshListeners = [];
    this.loadingListeners = [];
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.refreshQueue = [];
  }
}

export const refreshManager = RefreshManager.getInstance();
