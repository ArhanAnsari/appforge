# Changelog

All notable changes to the **AppForge** VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.2-alpha] - July 2026

### 🚀 Major Improvements & Features

* **Unified Database Discovery (`TablesDB.list`)**:
  * Upgraded primary database queries to `tablesDB.list()` (`GET /tablesdb`) with an automatic fallback to `Databases.list()` (`GET /databases`).
  * Resolves empty database list issues across older Appwrite instances (e.g., 1.7.4+) and modern Appwrite v27+ server deployments.

* **Multi-Project Credential Isolation**:
  * Introduced `AppwriteClientService.createForProject()` to instantiate project-isolated SDK client instances dynamically.
  * Eliminates cross-project API key and endpoint leakage when navigating multiple projects in the sidebar.

* **Interactive Database Viewer Panel**:
  * Bound the `appforge.viewDatabase` command directly to collection and table tree nodes.
  * Clicking any collection or table node now opens a dedicated webview tab showing document rows, dynamic attribute columns, system metadata (`$id`, `$createdAt`), and action controls.

* **Explicit Diagnostic Tree Items**:
  * Replaced silent empty array fallbacks with actionable diagnostic status nodes (e.g., `🔑 No API key saved`, `❌ Missing Scope: databases.read`) directly in the Tree View.

### 🛠️ Bug Fixes & Codebase Hardening

* **Type Safety & Node16/NodeNext Support**:
  * Appended explicit `.js` extensions to dynamic `import()` calls across service loaders, resolving ECMAScript module resolution warnings.
  * Removed implicit `any` usage in callbacks and functions across the database commands and tree provider layers.
* **Webview Lifecycle Management**:
  * Added panel key tracking (`activeViewerPanels`) to prevent duplicate Webview instances from opening when clicking the same collection repeatedly.

---

## [0.2.1-alpha] - June 2026

### 🚀 What's New

* **Self-Hosted Appwrite Support**:
  * Proper support for self-hosted Appwrite instances alongside Appwrite Cloud.
  * Improved endpoint validation and URL normalization (`/v1` path formatting).

* **Status Bar Improvements**:
  * Added live active project display in the VS Code status bar.
  * Instant automatic updates when switching active workspace context.

* **Intelligent Refresh System**:
  * Introduced centralized `RefreshManager` to queue and debounce tree refresh events.
  * Prevents duplicate execution requests and network race conditions during fast updates.

* **Event-Driven Architecture**:
  * Added lightweight `EventBus` infrastructure for decoupled module-to-module event broadcasting.

* **Professional Logging & Telemetry**:
  * Added dedicated `AppForge` Output Channel for structured operation tracing (`[TREE]`, `[DATABASES]`, `[STORAGE]`).

### 🛠️ Fixes

* Fixed database discovery failures on local Docker and custom domain deployments.
* Resolved project synchronization inconsistencies across VS Code window restarts.
* Improved error reporting for failed function log retrievals.

---

## [0.2.0-alpha] - May 2026

### 🚀 What's New

* **Multi-Project Management**:
  * Store and manage multiple Appwrite projects using VS Code `SecretStorage`.
  * Added project context switching capabilities from sidebar and command palette.

* **Functions Explorer**:
  * Browse functions, inspect deployment history, and view environment variables.
  * Execute functions directly from the VS Code sidebar.

* **Storage Explorer**:
  * Browse storage buckets, inspect file sizes, and view file details.

* **Copy ID Actions**:
  * Context menu action to quickly copy Project, Database, Collection, Document, Bucket, and Function IDs to clipboard.

---

## [0.1.0-alpha] - April 2026

### 🚀 Initial Alpha Release

* Initial prototype of the AppForge extension for VS Code.
* Basic connection support for Appwrite projects via API Key.
* Basic sidebar rendering for Databases, Collections, and Documents.