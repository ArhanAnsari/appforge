# AppForge v0.2.2-alpha Release Report

**Version:** v0.2.2-alpha  
**Release Type:** Alpha  
**Release Date:** July 2026  
**Repository:** https://github.com/ArhanAnsari/appforge  

---

# Overview

Version **v0.2.2-alpha** is a major stability, architecture, and compatibility release for AppForge. This update primarily focuses on solving critical database loading anomalies, enforcing strict multi-project credential isolation, and providing direct interactive webview data management.

Through deep SDK integration audits and community testing across legacy and modern Appwrite instances (Appwrite 1.5.x, 1.7.x, 27.x+, and Cloud), **v0.2.2-alpha** guarantees seamless database and table discovery across all project environments.

---

# Release Goals

The key goals of this release were:

- **Solve Database Discovery Issues**: Resolve empty tree state ("No databases yet") across multi-project environments and legacy server setups.
- **Unified SDK Parity**: Leverage Appwrite's unified `TablesDB.list()` endpoint (`GET /tablesdb`) while retaining backward-compatible fallbacks for standard `Databases` APIs.
- **Isolated Multi-Project Clients**: Prevent API key and Project ID cross-contamination across multiple workspace nodes.
- **Interactive Database Viewer**: Enable full document browsing and inline manipulation inside an interactive VS Code editor tab.
- **Transparent Diagnostics**: Eliminate silent error swallowing and expose clear, actionable status messages on tree nodes.

---

# Major Features & Technical Fixes

## 1. Unified Database Discovery (`TablesDB.list`)
- **Root Cause Resolved**: Older or upgraded Appwrite projects (e.g., initialized around version 1.7.4) returned `0` records when queried via legacy `GET /databases` (`Databases.list()`).
- **Solution**: Modernized the `DatabaseService` discovery layer to query `tablesDB.list()` (`GET /tablesdb`) as the primary discovery mechanism. The `/tablesdb` endpoint acts as Appwrite's unified data layer, returning 100% of both legacy collections and modern tables.
- **Automatic Fallback**: If a self-hosted instance running an older SDK version does not expose `/tablesdb`, the query gracefully degrades to `Databases.list()` without throwing an extension crash.

## 2. Multi-Project Credential Isolation
- Introduced `AppwriteClientService.createForProject()`.
- Each project node in the tree sidebar dynamically instantiates its own isolated SDK client using its explicit `endpoint`, `projectId`, and `apiKey` stored in VS Code's `SecretStorage`.
- Prevents workspace singleton contamination where expanding secondary projects reused credentials from the active project.

## 3. Interactive Database Viewer Webview Panel
- Attached the `appforge.viewDatabase` command directly to collection and table tree items.
- Clicking any collection or table opens a full-screen, VS Code theme-aware **Database Viewer** webview panel.
- Features include:
  - Dynamic attribute column rendering.
  - System metadata fields (`$id`, `$createdAt`, `$updatedAt`, `$permissions`).
  - Real-time client-side search filtering.
  - Document JSON inspection and direct document deletion.
  - Panel lifecycle tracking (`activeViewerPanels`) to focus existing tabs instead of opening duplicates.

## 4. Actionable Diagnostic Tree Nodes
- Removed try/catch blocks that swallowed API errors into empty arrays `[]`.
- Permission or authorization failures now render descriptive diagnostic tree nodes (e.g., `🔑 No API key saved for this project` or `❌ AppwriteException: missing scope (databases.read)`).

---

# Compatibility Matrix

| Environment | Supported Version | Status |
| :--- | :--- | :--- |
| **Appwrite Cloud** | `cloud.appwrite.io` | ✅ Supported |
| **Self-Hosted Appwrite** | `v1.5.x`, `v1.7.x`, `v1.x`, `v27.x+` | ✅ Supported |
| **VS Code Engine** | `^1.120.0` | ✅ Supported |
| **Node Appwrite SDK** | `^13.0.0` | ✅ Supported |
| **Module Resolution** | Node16 / NodeNext | ✅ Supported |

---

# Upgrade Notes

- Existing users can safely upgrade from `v0.2.0-alpha` and `v0.2.1-alpha` without manual data migration.
- All saved projects and API keys stored in VS Code `SecretStorage` are preserved automatically.

---

# Summary

**AppForge v0.2.2-alpha** delivers an audit-proven, resilient foundation for Appwrite developers. By combining unified `TablesDB` discovery with project-isolated SDK clients and an interactive editor webview, AppForge eliminates context switching and provides complete visibility into your Appwrite backends directly inside Visual Studio Code.