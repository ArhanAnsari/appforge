# AppForge Project Structure & Folder Guide

## Overview

AppForge v0.1.0-alpha has a clean, modular structure organized by function. This document explains each folder and its purpose.

---

## Directory Structure

```
appforge/
├── src/
│   ├── commands/              ✅ Command handlers (ACTIVE)
│   ├── providers/             ✅ Tree view provider (ACTIVE)
│   ├── services/              ✅ Business logic (ACTIVE)
│   ├── types/                 ✅ Type definitions (ACTIVE)
│   ├── utils/                 ✅ Validators (ACTIVE)
│   ├── views/                 ⏳ Webviews (READY FOR PHASE 2)
│   ├── snippets/              ✅ Code snippets (ACTIVE - v0.1.0)
│   ├── test/                  ⏳ Testing (READY FOR PHASE 2)
│   └── extension.ts           ✅ Entry point (ACTIVE)
├── dist/                      📦 Build output
├── docs/                      📖 Documentation
├── node_modules/              (npm dependencies)
├── snippets/                  ✅ VS Code snippet definitions (ACTIVE - v0.1.0)
├── package.json               ✅ Extension manifest
└── tsconfig.json              ✅ TypeScript config
```

---

## Folder Details

### ✅ ACTIVE FOLDERS (v0.1.0-alpha)

#### `src/commands/`

**Purpose**: Command handlers for VS Code extension API

**Files**:

- `projectCommands.ts` - Add, remove, switch projects
- `databaseCommands.ts` - Create, delete documents (newly implemented)
- `functionCommands.ts` - Execute functions, deploy, view logs (newly implemented)

**Status**: Production-ready
**Usage**: Each command is registered in `package.json` contributes section

---

#### `src/providers/`

**Purpose**: VS Code TreeDataProvider for sidebar view

**Files**:

- `treeDataProvider.ts` - Projects, Databases, Functions, Logs tree

**Status**: Production-ready
**Key Features**:

- Lazy-load tree items on expansion
- Context menus for right-click actions
- Refresh capability

---

#### `src/services/`

**Purpose**: Business logic and API integration

**Files**:

- `appwriteClientService.ts` - Singleton Appwrite client
- `projectStorageService.ts` - Project storage + secure credentials

**Status**: Production-ready
**Responsibility**:

- Manage Appwrite SDK lifecycle
- Handle project switching
- Secure API key storage (SecretStorage)

---

#### `src/types/`

**Purpose**: TypeScript type definitions

**Files**:

- `index.ts` - All core types (AppwriteProject, StoredProject, TreeItemData, etc.)

**Status**: Complete
**Note**: Single source of truth for types

---

#### `src/utils/`

**Purpose**: Utility functions and validators

**Files**:

- `validators.ts` - Zod schemas for input validation

**Status**: Production-ready
**Validates**:

- Project configuration
- API keys
- Database names

---

#### `snippets/` (root level)

**Purpose**: VS Code snippet definitions

**Files**:

- `appwrite.code-snippets` - 25 production-ready snippets

**Status**: NEW in v0.1.0 (complete)
**Snippets Included**:

- Project initialization (awclient, awinit)
- Database operations (awdb, awc, awattr, awindex, awdoc, awgetdoc, awlistdoc, awupdatedoc, awdeletedoc)
- Authentication (awaccount, awsignup, awlogin, awlogout, awsession)
- Functions (awfn, awexec, awdeploy)
- Storage (awstorage, awupload, awdeletefile)
- Teams (awteam)
- Queries (awqueryeq, awquerylimit, awqueryorder)
- Utilities (awid)

---

### ⏳ READY FOR PHASE 2 (Not needed for alpha)

#### `src/views/`

**Purpose**: Webview-based UI components

**Status**: Empty, ready for Phase 2+
**Future Usage**:

- Document preview panel
- Function log viewer
- Real-time execution logs
- Query builder UI

**Why Not Needed Now**:

- VS Code native APIs cover all alpha needs
- Webviews add complexity
- Simple input boxes + notifications sufficient for Phase 1

**When to Use**: Phase 2+ when advanced UX required

---

#### `src/test/`

**Purpose**: Unit and integration tests

**Status**: Stub only, ready for Phase 2+
**Current File**: `extension.test.ts` (placeholder)

**Why Not Needed Now**:

- Alpha focuses on manual QA
- Core architecture stable
- Feature set limited enough for manual testing

**When to Add**:

- Phase 2+ when feature complexity increases
- Automated CI/CD pipeline setup
- Pre-publication regression testing

**Testing Strategy for Alpha**:

1. Manual testing in VS Code
2. Press `F5` to launch extension host
3. Test each command via Command Palette
4. Test tree view interactions
5. Document findings

---

## File-by-File Breakdown

### Entry Point

```
src/extension.ts (60 lines)
├── Activate: Initialize services and commands
├── Auto-load: Restore active project
└── Deactivate: Cleanup on unload
```

### Commands (Implementation Breakdown)

```
src/commands/projectCommands.ts (170 lines)
├── registerProjectCommands()
├── addProjectCommand()        ✅ Fully implemented
├── removeProjectCommand()      ✅ Fully implemented
└── switchProjectCommand()      ✅ Fully implemented

src/commands/databaseCommands.ts (150 lines) - NEW
├── registerDatabaseCommands()
├── createDocumentCommand()    ✅ NEW - Full CRUD
└── deleteDocumentCommand()    ✅ NEW - With confirmation

src/commands/functionCommands.ts (220 lines) - ENHANCED
├── registerFunctionCommands()
├── executeFunctionCommand()   ✅ NEW - Execute with input
├── deployFunctionCommand()    ✅ NEW - Select folder workflow
└── viewLogsCommand()          ✅ NEW - Placeholder for Phase 2
```

### Services

```
src/services/appwriteClientService.ts (130 lines)
├── Singleton pattern
├── initialize()
├── switchProject()
├── getDatabases/Functions/Account/Storage/Teams
└── isInitialized()

src/services/projectStorageService.ts (120 lines)
├── addProject()          ✅ With encryption
├── removeProject()       ✅ Secure cleanup
├── getApiKey()           ✅ From SecretStorage
├── setActiveProjectId()
└── getActiveProjectWithApiKey()
```

### Provider

```
src/providers/treeDataProvider.ts (320 lines)
├── AppForgeTreeItem (TreeItem subclass)
├── AppForgeTreeDataProvider (TreeDataProvider)
├── Root: Projects list
├── Project: Databases, Functions, Logs
├── Database: Collections
├── Collection: (leaf node)
└── Functions: With status indicators
```

### Types

```
src/types/index.ts (65 lines)
├── AppwriteProject
├── StoredProject
├── TreeItemData
├── DatabaseItem
├── CollectionItem
├── FunctionItem
├── LogEntry
├── CommandResult<T>
└── ExtensionState
```

### Validators

```
src/utils/validators.ts (45 lines)
├── ProjectConfigSchema (Zod)
├── ApiKeySchema (Zod)
└── DatabaseNameSchema (Zod)
```

---

## Why This Structure?

### Modular Design

- **Easy to test**: Each service is independent
- **Easy to extend**: Add new commands without touching services
- **Easy to refactor**: Change implementation details in one place

### Command Pattern

- Each command → separate function
- Commands registered in `extension.ts`
- No cross-command dependencies

### Service Layer

- **AppwriteClientService**: SDK integration
- **ProjectStorageService**: Persistence layer
- Commands use both services

### Type Safety

- Single `types/index.ts` file
- All types exported from one place
- Prevents circular dependencies

### Validation

- Zod schemas validate all inputs
- Reusable across commands
- Better error messages for users

---

## Folder Q&A

### Q: Should I delete the `test/` folder?

**A**: No, keep it for future use. For alpha, the stub is fine. Automated tests will be added in Phase 2+ when the feature set grows more complex.

### Q: Should I delete the `views/` folder?

**A**: No, keep it empty and ready. The alpha doesn't need webviews (VS Code native APIs are better). Phase 2+ will use it for document preview and log viewers.

### Q: Can I add files to `views/` now?

**A**: Only if you're implementing a webview. For Phase 1, stick with native APIs (input boxes, notifications, tree view).

### Q: Do I need more folders?

**A**: No, the current structure is sufficient for Phase 1. Add folders as features grow:

- `src/webviews/` - When implementing document preview
- `src/panels/` - When implementing side panels
- `src/decorations/` - When adding editor decorations

---

## What's NOT in This Folder Structure?

### No `assets/` folder

- Not needed for alpha
- Would contain icons, images, etc.
- Can add in Phase 2 when branding needed

### No `config/` folder

- Settings are in `package.json` contributes
- No external config files for alpha

### No `middleware/` folder

- Commands are simple, no middleware needed
- Add only if you need shared logic between commands

### No `adapters/` folder

- Currently not using multiple SDK versions
- Keep architecture simple

---

## Build Output

### `dist/` folder

```
dist/
├── extension.js          ← Main bundle
└── extension.js.map      ← Source maps
```

Generated by esbuild, not modified manually.

---

## Dependencies File

### `snippets/appwrite.code-snippets`

- New in v0.1.0-alpha
- 25 production-ready snippets
- Registered in `package.json` contributes

---

## Summary

| Folder           | Status          | Purpose          | Keep?       |
| ---------------- | --------------- | ---------------- | ----------- |
| `src/commands/`  | ✅ Active       | Command handlers | YES         |
| `src/providers/` | ✅ Active       | Tree view        | YES         |
| `src/services/`  | ✅ Active       | Business logic   | YES         |
| `src/types/`     | ✅ Active       | Types            | YES         |
| `src/utils/`     | ✅ Active       | Validators       | YES         |
| `src/views/`     | ⏳ Ready        | Webviews         | YES (empty) |
| `src/test/`      | ⏳ Ready        | Tests            | YES (stub)  |
| `snippets/`      | ✅ Active (NEW) | VS Code snippets | YES         |
| `docs/`          | ✅ Active       | Documentation    | YES         |
| `dist/`          | 📦 Output       | Build output     | YES         |

---

**Bottom Line**: This is a production-ready structure for alpha. Keep empty folders for Phase 2+. Add new folders only when needed.
