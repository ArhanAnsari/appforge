# Change Log

All notable changes to the AppForge extension will be documented in this file.

## [0.1.0-alpha] - 2026-05-20

### Added

#### Core Infrastructure

- Complete TypeScript extension with strict type checking
- Modular service architecture (AppwriteClientService, ProjectStorageService)
- Tree data provider for sidebar view management
- Zod-based validation for all user inputs
- Secure credential storage using VS Code SecretStorage

#### Project Management

- Add Project command with guided setup
  - Project name validation (1-100 characters)
  - Endpoint URL validation (HTTPS required)
  - Project ID input
  - API key secure storage
- Remove Project command with confirmation dialog
- Switch Project command with instant context switch
- Active project auto-load on extension activation

#### Sidebar Tree View

- AppForge activity bar icon
- Projects section with expandable items
- Databases section (expandable per project)
- Collections section (nested under databases)
- Functions section with status indicators
- Logs quick access
- Context menu for destructive actions (remove)
- Refresh button for projects

#### Commands

- appforge.addProject
- appforge.removeProject
- appforge.switchProject
- appforge.refreshProjects
- appforge.refreshDatabases
- appforge.createDocument (stub for v0.2.0)
- appforge.deleteDocument (stub for v0.2.0)
- appforge.executeFunction (stub for v0.2.0)
- appforge.deployFunction (stub for v0.2.0)
- appforge.viewLogs (stub for v0.2.0)

#### User Experience

- Loading progress indicators for async operations
- Success notifications
- Error notifications with context
- Input validation with inline feedback
- Command palette integration
- Intuitive tree labels with icons

#### Documentation

- Comprehensive v0.1.0-alpha.md
- Architecture documentation
- Code comments on all public interfaces
- Troubleshooting section

### Technical Details

- Language: TypeScript with strict mode
- Build: esbuild with watch support
- Runtime: VS Code Extension API (vscode ^1.120.0)
- Dependencies:
  - node-appwrite ^13.0.0
  - zod ^3.22.4
- No `any` types: Full type safety throughout

### Known Limitations

- Document management UI not included (Phase 2)
- Function deployment not included (Phase 2)
- Real-time log streaming not included (Phase 2)
- Code snippet engine not included (Phase 2)

---

**Version**: 0.1.0-alpha  
**Status**: Production-grade alpha  
**Release Date**: May 20, 2026
