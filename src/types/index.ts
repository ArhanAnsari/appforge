/**
 * AppForge Core Type Definitions
 * Central location for all TypeScript interfaces and types
 */

/**
 * Represents an Appwrite project configuration stored in the extension
 */
export interface AppwriteProject {
  projectName: string;
  endpoint: string;
  projectId: string;
  apiKey?: string;
}

/**
 * Represents a stored project with encrypted API key
 */
export interface StoredProject {
  projectName: string;
  endpoint: string;
  projectId: string;
}

/**
 * Tree item data for the sidebar view
 */
export interface TreeItemData {
  type:
    | "root"
    | "project"
    | "databases"
    | "database"
    | "functions"
    | "logs"
    | "collection";
  label: string;
  id?: string;
  projectId?: string;
  databaseId?: string;
  parent?: TreeItemData;
}

/**
 * Database information from Appwrite
 */
export interface DatabaseItem {
  $id: string;
  name: string;
  collections?: CollectionItem[];
}

/**
 * Collection information from Appwrite
 */
export interface CollectionItem {
  $id: string;
  $databaseId: string;
  name: string;
  documentCount?: number;
}

/**
 * Function information from Appwrite
 */
export interface FunctionItem {
  $id: string;
  name: string;
  status: "disabled" | "enabled";
  entrypoint?: string;
}

/**
 * Log entry from Appwrite function execution
 */
export interface LogEntry {
  timestamp: number;
  level: "error" | "info" | "warning";
  message: string;
  functionId?: string;
}

/**
 * Result of a command execution
 */
export interface CommandResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * State of the extension
 */
export interface ExtensionState {
  projects: StoredProject[];
  activeProjectId?: string;
}
