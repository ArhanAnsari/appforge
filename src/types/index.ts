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
    | "collection"
    | "attributes"
    | "attribute"
    | "indexes"
    | "index"
    | "documents"
    | "document"
    | "functions"
    | "function"
    | "deployments"
    | "deployment"
    | "executions"
    | "execution"
    | "variables"
    | "variable"
    | "storage"
    | "buckets"
    | "bucket"
    | "files"
    | "file"
    | "logs";
  label: string;
  id?: string;
  treeId?: string;
  projectId?: string;
  databaseId?: string;
  collectionId?: string;
  functionId?: string;
  bucketId?: string;
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
 * Attribute information from Appwrite
 */
export interface AttributeItem {
  key: string;
  type: string;
  status: string;
  required?: boolean;
  array?: boolean;
}

/**
 * Index information from Appwrite
 */
export interface IndexItem {
  key: string;
  type: string;
  attributes: string[];
  orders?: string[];
}

/**
 * Document information from Appwrite
 */
export interface DocumentItem {
  $id: string;
  $collectionId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  [key: string]: any;
}

/**
 * Function information from Appwrite
 */
export interface FunctionItem {
  $id: string;
  name: string;
  status: "disabled" | "enabled";
  runtime?: string;
  entrypoint?: string;
}

/**
 * Function deployment information from Appwrite
 */
export interface DeploymentItem {
  $id: string;
  resourceId: string;
  resourceType: string;
  status: "processing" | "ready" | "failed";
  $createdAt: string;
}

/**
 * Function execution information from Appwrite
 */
export interface ExecutionItem {
  $id: string;
  $functionId: string;
  status: "waiting" | "processing" | "completed" | "failed";
  statusCode: number;
  duration: number;
  $createdAt: string;
}

/**
 * Function variable information from Appwrite
 */
export interface VariableItem {
  key: string;
  value: string;
}

/**
 * Storage bucket information from Appwrite
 */
export interface BucketItem {
  $id: string;
  name: string;
  filesCount?: number;
  enabled: boolean;
}

/**
 * File information from Appwrite storage
 */
export interface FileItem {
  $id: string;
  bucketId: string;
  name: string;
  size: number;
  $createdAt: string;
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
