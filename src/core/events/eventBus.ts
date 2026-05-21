/**
 * Event Bus
 * Lightweight pub/sub system for realtime event-driven architecture
 *
 * Supports:
 * - Strongly typed events
 * - Async-safe listeners
 * - Unsubscribe support
 * - Debounce support
 * - Error isolation (one listener error doesn't crash others)
 */

export type EventType =
  | "database.created"
  | "database.deleted"
  | "collection.created"
  | "collection.deleted"
  | "document.created"
  | "document.updated"
  | "document.deleted"
  | "function.deployed"
  | "function.executed"
  | "logs.updated"
  | "project.switched"
  | "refresh.requested"
  | "operation.started"
  | "operation.completed";

export interface EventPayload {
  "database.created": { projectId: string; databaseId: string; name: string };
  "database.deleted": { projectId: string; databaseId: string };
  "collection.created": {
    projectId: string;
    databaseId: string;
    collectionId: string;
    name: string;
  };
  "collection.deleted": {
    projectId: string;
    databaseId: string;
    collectionId: string;
  };
  "document.created": {
    projectId: string;
    databaseId: string;
    collectionId: string;
    documentId: string;
  };
  "document.updated": {
    projectId: string;
    databaseId: string;
    collectionId: string;
    documentId: string;
  };
  "document.deleted": {
    projectId: string;
    databaseId: string;
    collectionId: string;
    documentId: string;
  };
  "function.deployed": { projectId: string; functionId: string; name: string };
  "function.executed": {
    projectId: string;
    functionId: string;
    status: string;
  };
  "logs.updated": { projectId: string; functionId: string; logs: string[] };
  "project.switched": { projectId: string; projectName: string };
  "refresh.requested": {
    scope: "all" | "tree" | "databases" | "functions" | "logs";
  };
  "operation.started": { operationType: string; operationId: string };
  "operation.completed": {
    operationType: string;
    operationId: string;
    success: boolean;
    duration: number;
  };
}

type Listener<T extends EventType> = (
  payload: EventPayload[T],
) => void | Promise<void>;

interface DebounceConfig {
  wait: number;
  maxWait?: number;
}

interface ListenerEntry<T extends EventType> {
  listener: Listener<T>;
  debounce?: DebounceConfig;
  debounceTimer?: NodeJS.Timeout;
  debounceMaxTimer?: NodeJS.Timeout;
}

/**
 * Lightweight event bus for pub/sub
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<EventType, ListenerEntry<any>[]> = new Map();
  private eventHistory: Array<{
    type: EventType;
    payload: any;
    timestamp: number;
  }> = [];
  private maxHistorySize = 100;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to an event
   */
  public on<T extends EventType>(
    event: T,
    listener: Listener<T>,
    debounceConfig?: DebounceConfig,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const entry: ListenerEntry<T> = {
      listener,
      debounce: debounceConfig,
    };

    const listeners = this.listeners.get(event)!;
    listeners.push(entry);

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(entry);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      this.clearDebounceTimers(entry);
    };
  }

  /**
   * Subscribe once
   */
  public once<T extends EventType>(
    event: T,
    listener: Listener<T>,
  ): () => void {
    const unsubscribe = this.on(event, async (payload) => {
      await listener(payload);
      unsubscribe();
    });

    return unsubscribe;
  }

  /**
   * Emit an event
   */
  public async emit<T extends EventType>(
    event: T,
    payload: EventPayload[T],
  ): Promise<void> {
    // Record in history
    this.eventHistory.push({
      type: event,
      payload,
      timestamp: Date.now(),
    });

    // Keep history size bounded
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) {
      return;
    }

    // Execute listeners in parallel, but isolate errors
    const promises = listeners.map((entry) =>
      this.executeListener(entry, payload),
    );
    await Promise.all(promises.map((p) => p.catch(() => {})));
  }

  /**
   * Execute a single listener with error isolation
   */
  private async executeListener<T extends EventType>(
    entry: ListenerEntry<T>,
    payload: EventPayload[T],
  ): Promise<void> {
    try {
      if (entry.debounce) {
        this.executeDebounced(entry, payload);
      } else {
        await entry.listener(payload);
      }
    } catch (error) {
      // Error isolation: one listener error doesn't crash others
      console.error("EventBus listener error:", error);
    }
  }

  /**
   * Execute with debounce
   */
  private executeDebounced<T extends EventType>(
    entry: ListenerEntry<T>,
    payload: EventPayload[T],
  ): void {
    // Clear existing debounce timer
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }

    // Set debounce timer
    entry.debounceTimer = setTimeout(async () => {
      try {
        await entry.listener(payload);
      } catch (error) {
        console.error("EventBus debounced listener error:", error);
      }

      // Clear max wait timer
      if (entry.debounceMaxTimer) {
        clearTimeout(entry.debounceMaxTimer);
        entry.debounceMaxTimer = undefined;
      }
    }, entry.debounce!.wait);

    // Set max wait timer (if configured)
    if (entry.debounce!.maxWait && !entry.debounceMaxTimer) {
      entry.debounceMaxTimer = setTimeout(async () => {
        if (entry.debounceTimer) {
          clearTimeout(entry.debounceTimer);
          entry.debounceTimer = undefined;
        }

        try {
          await entry.listener(payload);
        } catch (error) {
          console.error("EventBus max-wait listener error:", error);
        }
      }, entry.debounce!.maxWait);
    }
  }

  /**
   * Clear debounce timers for a listener
   */
  private clearDebounceTimers(entry: ListenerEntry<any>): void {
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
      entry.debounceTimer = undefined;
    }
    if (entry.debounceMaxTimer) {
      clearTimeout(entry.debounceMaxTimer);
      entry.debounceMaxTimer = undefined;
    }
  }

  /**
   * Get recent event history
   */
  public getHistory(
    count: number = 20,
  ): Array<{ type: EventType; payload: any; timestamp: number }> {
    return this.eventHistory.slice(-count);
  }

  /**
   * Clear all listeners
   */
  public clear(): void {
    for (const entry of this.listeners.values()) {
      entry.forEach((e) => this.clearDebounceTimers(e));
    }
    this.listeners.clear();
    this.eventHistory = [];
  }

  /**
   * Get listener count
   */
  public getListenerCount(event?: EventType): number {
    if (event) {
      return this.listeners.get(event)?.length ?? 0;
    }
    return Array.from(this.listeners.values()).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
  }
}

export const eventBus = EventBus.getInstance();
