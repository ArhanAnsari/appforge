# AppForge v0.2.2-alpha Release Report

**Version:** v0.2.2-alpha  
**Release Type:** Alpha  
**Release Date:** July 2026  
**Repository:** https://github.com/ArhanAnsari/appforge

---

# Overview

Version **v0.2.2-alpha** is a major stability and reliability release focused on improving the overall developer experience for both **Appwrite Cloud** and **Self-Hosted** deployments.

This release primarily addresses issues reported by early adopters regarding database discovery, persistent authentication, resource synchronization, and diagnostics. Alongside numerous internal improvements, several productivity features have been introduced to streamline daily development workflows.

Unlike previous releases that focused on expanding functionality, **v0.2.2-alpha** emphasizes correctness, reliability, maintainability, and production readiness.

---

# Release Goals

The objectives of this release were:

- Improve compatibility with both Appwrite Cloud and Self-Hosted instances.
- Audit and stabilize the complete database loading pipeline.
- Improve diagnostics and developer visibility into extension operations.
- Fix credential persistence across VS Code restarts.
- Eliminate refresh synchronization issues.
- Improve overall architecture without introducing breaking changes.
- Add commonly requested productivity features.

---

# Major Improvements

## Cloud & Self-Hosted Compatibility

The entire connection pipeline has been reviewed to ensure consistent behavior regardless of deployment type.

Improvements include:

- Improved endpoint handling
- Better compatibility with custom Appwrite domains
- Support for local development instances
- Improved initialization flow
- Consistent API usage between Cloud and Self-Hosted environments

---

## Multi-Project Credential Isolation & Database Discovery

Fixed a critical issue where multi-project environments displayed `"No databases yet"` for secondary projects.

### Changes Included:
- **Project-Scoped SDK Clients**: Introduced `AppwriteClientService.createForProject()` to guarantee each tree request uses the specific project's endpoint, ID, and secret API Key instead of sharing a global singleton instance.
- **Appwrite v27 `TablesDB` & Legacy API Compatibility**: Added response parsing (`extractItems`) supporting both new `TablesDB` payloads (`databases`, `tables`, `rows`) and legacy `Databases` service structures.
- **Transparent Error Nodes**: Replaced silent error-swallowing in `databaseService.ts` with explicit diagnostic error tree items in `treeDataProvider.ts`.
- **Database Viewer Panel Integration**: Attached `appforge.viewDatabase` command handlers directly to collection tree items, enabling double-click or click navigation to open the interactive Database Viewer webview tab.

---

## Database Loading Pipeline Audit

The database discovery system has been thoroughly audited.

The following stages were reviewed and improved:

- Project loading
- Secret retrieval
- Client initialization
- Databases service creation
- SDK communication
- API response parsing
- Tree rendering
- Refresh lifecycle
- Event propagation
- Cache invalidation

Additional safeguards were added to prevent false "No databases" states when resources actually exist.

---

## Persistent Credential Storage

Authentication persistence has been significantly improved.

Projects and API keys now restore correctly after restarting VS Code.

Improvements include:

- Better SecretStorage usage
- Improved active project restoration
- Stable project lookup
- Reliable API key retrieval
- Automatic session restoration

Users no longer need to repeatedly enter credentials after reopening VS Code.

---

## Improved Refresh System

The refresh pipeline has been enhanced for improved responsiveness.

Enhancements include:

- Better synchronization
- Reduced duplicate refreshes
- Smarter cache invalidation
- Improved tree updates
- More reliable resource synchronization

RefreshManager now provides more predictable updates across the extension.

---

## Enhanced Diagnostics

Diagnostic logging has been significantly expanded.

Every major stage of resource loading now produces structured logs, including:

- Project initialization
- Secret restoration
- Client creation
- Database service initialization
- API requests
- API responses
- Tree rendering
- Refresh lifecycle
- Event handling

These improvements greatly simplify troubleshooting and debugging.

---

## Better Error Reporting

Error messages throughout the extension have been improved.

Instead of generic failures, AppForge now reports:

- Connection issues
- Authentication failures
- API request failures
- Empty resource responses
- Rendering problems
- Refresh failures

Additional context is included whenever possible.

---

# New Features

## Copy Resource ID

One of the most requested features has been added.

Context menu actions are now available for copying resource identifiers directly to the clipboard.

Supported resources include:

- Projects
- Databases
- Collections
- Documents
- Buckets
- Files
- Functions

Each action copies the resource ID and displays a confirmation notification.

---

## Improved Output Channel

The AppForge Output Channel now provides more detailed operational information.

Example logs include:

```
Initializing project...
Loading credentials...
Creating Appwrite client...
Creating Databases service...
Requesting databases...
Received 3 databases.
Rendering database tree...
Refresh completed.
```

This provides significantly better visibility into extension behavior.

---

# Internal Improvements

Several internal systems have been refined.

## EventBus

- Better event synchronization
- Improved listener stability
- Reduced redundant events
- Cleaner refresh propagation

---

## RefreshManager

- Smarter scoped refreshes
- Better debounce handling
- Improved cache invalidation
- More predictable UI updates

---

## TreeDataProvider

- Improved rendering flow
- Better handling of empty states
- Improved node synchronization
- More reliable refresh behavior

---

## Logging

Logging has been expanded across the extension.

Additional logging now covers:

- Extension activation
- Project switching
- Resource loading
- Database discovery
- Function loading
- Storage loading
- Refresh lifecycle
- Diagnostics

---

# Documentation Updates

Documentation has been updated throughout the project.

Updated files include:

- README.md
- CHANGELOG.md
- RELEASE_REPORT_v0.2.2-alpha.md
- FOLDER_STRUCTURE.md
- Additional documentation under the `docs/` directory

Documentation has been revised to improve clarity, consistency, and onboarding for new contributors.

---

# Compatibility

| Component | Status |
|-----------|--------|
| Appwrite Cloud | ✅ Supported |
| Self-Hosted Appwrite | ✅ Supported |
| VS Code 1.120+ | ✅ Supported |
| Node Appwrite SDK | ✅ Supported |
| TypeScript Strict Mode | ✅ Supported |

---

# Stability

This release focuses heavily on stability.

Key improvements include:

- Better resource synchronization
- More reliable project restoration
- Improved diagnostics
- Stronger error handling
- Better refresh behavior
- Improved compatibility
- Cleaner architecture

---

# Known Limitations

As an Alpha release, some areas are still under active development.

Future releases will continue improving:

- Collection management
- Storage management
- Function management
- Resource editing
- Additional context menu actions
- Performance optimizations

---

# Upgrade Notes

Existing users can safely upgrade from:

- v0.2.0-alpha
- v0.2.1-alpha

No manual migration is required.

Existing project configurations and stored credentials will continue to function.

---

# Contributors

**Author**

Arhan Ansari

GitHub: https://github.com/ArhanAnsari

---

# Acknowledgements

Special thanks to the Appwrite community members who tested early alpha releases, reported issues, suggested improvements, and helped improve AppForge through valuable feedback.

Community feedback directly contributed to several improvements included in this release, particularly around:

- Database discovery
- Self-Hosted compatibility
- Credential persistence
- Copy ID functionality
- Diagnostic improvements

Your feedback continues to shape the direction of AppForge.

---

# Summary

**AppForge v0.2.2-alpha** represents a significant step toward a production-ready VS Code experience for Appwrite developers.

This release prioritizes stability, diagnostics, compatibility, and usability while maintaining a clean, extensible architecture for future development.

Future releases will continue expanding AppForge into a complete Appwrite-native developer cockpit within Visual Studio Code.