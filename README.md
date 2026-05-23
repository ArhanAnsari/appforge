# AppForge

Appwrite-native developer tooling inside VS Code.

[![Version](https://img.shields.io/badge/version-0.1.1--alpha-0ea5e9)](./CHANGELOG.md)
[![Alpha](https://img.shields.io/badge/status-alpha-f59e0b)](./CHANGELOG.md)
[![VS Code](https://img.shields.io/badge/VS%20Code-extension-007acc)](https://code.visualstudio.com/api)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](./tsconfig.json)
[![Appwrite](https://img.shields.io/badge/Appwrite-integrated-f02e65)](https://appwrite.io)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](#license)

AppForge is a VS Code extension for Appwrite developers who need multi-project backend workflows without leaving the editor. It combines project management, a TreeView resource explorer, diagnostics, structured logging, and secure credential storage into a single developer cockpit.

## Overview

AppForge removes the friction of bouncing between VS Code and the Appwrite console for everyday backend tasks. It is designed for developers who manage multiple Appwrite projects, need fast context switching, and want reliable visibility into what the extension is doing when data looks wrong.

It solves the problems that usually show up in real Appwrite workflows:

- Switching between tools just to inspect projects, databases, or functions
- Losing confidence in backend state when async refreshes race each other
- Debugging empty or inconsistent results without enough logging
- Managing multiple projects with unsafe shared client state
- Repeating setup work every time you return to the console

## Core Features

### Multi-Project Management

- Store multiple Appwrite projects securely in VS Code workspace state and SecretStorage
- Add, remove, and switch projects from the sidebar or command palette
- Keep project metadata isolated by project ID
- Auto-load the active project on extension activation

### TreeView Resource Explorer

- Browse projects, databases, collections, functions, and logs from the Activity Bar
- Expand resources lazily for responsive navigation
- Preserve expansion state across refreshes
- Use context menus for quick project actions

### Appwrite Integration

- Connect to Appwrite Cloud or self-hosted Appwrite instances
- Use Appwrite API keys for backend operations
- Validate connections before saving a project
- Run database and function workflows from within VS Code

### Project Switching

- Switch context instantly from the sidebar
- Avoid manual reconfiguration when moving between environments
- Keep each project node independent and deterministic
- Reduce stale state during fast project changes

### Diagnostics System

- Inspect stored project metadata and connection details
- Compare SDK responses with raw REST responses
- Troubleshoot empty database results with dedicated tooling
- Verify project and endpoint identity before chasing UI bugs

### Logging System

- Structured runtime logging through the Output Channel
- Success, warning, error, and debug events
- Timing-aware logging for async operations
- Diagnostics output designed for real support workflows

### Developer-Focused UX

- Validation-rich setup forms
- Loading indicators for long-running operations
- Confirmation dialogs for destructive actions
- Command palette integration for all major workflows
- Clear status feedback for project and backend actions

### Type-Safe Architecture

- Written in strict TypeScript
- Uses Zod for configuration and input validation
- Built on VS Code extension APIs with explicit service boundaries
- Keeps project state, backend state, and UI state separated

### Command Palette Integration

- `AppForge: Add Project`
- `AppForge: Remove Project`
- `AppForge: Switch Project`
- `AppForge: Refresh Projects`
- `AppForge: Refresh Databases`
- `AppForge: Create Document`
- `AppForge: Delete Document`
- `AppForge: List Documents`
- `AppForge: Update Document`
- `AppForge: Execute Function`
- `AppForge: Deploy Function`
- `AppForge: View Logs`
- `AppForge: Check Project Status`
- `AppForge: View Connection Info`
- `AppForge: Troubleshoot Empty Databases`
- `AppForge: Verify Appwrite Project Environment`

## ✨ What's New in v0.1.1-alpha

v0.1.1-alpha is a reliability and architecture hardening release.

- Stable TreeItem identity system for consistent TreeView reconciliation
- Fixed mixed-resource rendering and expansion behavior
- Deterministic refresh behavior with less UI drift
- Project-scoped Appwrite client architecture
- Cross-project isolation by design
- No shared mutable client state across async operations
- Better handling during rapid project switching
- Database fetch diagnostics with stored metadata logging
- Raw REST + SDK verification tooling
- More transparent endpoint, project ID, and API key context
- Reduced stale-state risk in database and function flows
- Stronger debugging infrastructure for multi-project support

This release intentionally moves away from unsafe shared mutable client state and toward explicit project-scoped service creation for every Appwrite operation.

## Architecture

AppForge is organized around explicit boundaries so project context never depends on hidden global state.

### Project-Scoped Services

Each Appwrite operation is created from project-specific inputs rather than a long-lived mutable client. That keeps database, function, and diagnostic calls tied to the project being acted on.

### Appwrite Client Lifecycle

The client layer now acts as a factory for isolated SDK instances. Services are created per project and per operation, then discarded after use. That removes cross-project contamination and async race conditions caused by shared state.

### Extension Structure

- `src/extension.ts` wires activation, services, and command registration
- `src/providers/treeDataProvider.ts` owns the sidebar resource explorer
- `src/commands/` contains project, database, function, and diagnostics workflows
- `src/views/` contains webviews and resource panels
- `src/services/` contains storage and Appwrite client factories
- `src/core/` contains refresh orchestration, events, and output logging
- `src/types/` contains shared type definitions
- `src/utils/` contains validation and parsing helpers

### Diagnostics Flow

Diagnostics are designed to answer a simple question quickly: is the problem local, configuration-related, or remote?

The current flow captures:

- Stored project metadata from workspace state
- Redacted API key context
- Endpoint and project ID identity
- SDK response payloads
- Raw REST response payloads

### Command System

Commands are exposed through the command palette and sidebar interactions. Each command resolves project context explicitly before creating its Appwrite service, which keeps behavior deterministic even when multiple projects are open or switching quickly.

## Screenshots

> Replace these placeholders with real captures before publishing.

### Project Explorer

![Project Explorer placeholder](./docs/images/project-explorer.png)

### Database Tree

![Database Tree placeholder](./docs/images/database-tree.png)

### Diagnostics Logs

![Diagnostics Logs placeholder](./docs/images/diagnostics-logs.png)

### Project Switching

![Project Switching placeholder](./docs/images/project-switching.png)

## Installation

### From Source

```bash
git clone https://github.com/ArhanAnsari/appforge.git
cd appforge
npm install
npm run build
```

### Run the Extension Host

```bash
npm run watch
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Development

### Common Commands

```bash
npm run check-types
npm run lint
npm run build
npm run watch
```

### Project Structure

For a deeper layout reference, see [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md).

```text
src/
├── commands/   # Project, database, function, and diagnostics commands
├── core/       # Event bus, refresh manager, and output channel
├── providers/  # TreeView data provider
├── services/   # Appwrite and storage services
├── types/      # Shared TypeScript definitions
├── utils/      # Validation and parsing helpers
└── views/      # Webview panels
```

### Quality Gates

- Strict TypeScript compilation
- ESLint validation
- Explicit service boundaries
- Structured runtime diagnostics
- Secure credential storage

## Roadmap

AppForge is intentionally scoped, but the roadmap is aimed at making it a complete Appwrite operations surface inside VS Code.

- Functions explorer with execution history
- Storage bucket explorer and file management
- Auth management tooling
- Deployment workflows for functions and resources
- Realtime monitoring for logs and backend events
- AI-assisted developer tooling and smart diagnostics
- Appwrite Cloud region and environment diagnostics
- Direct resource editing for supported Appwrite entities

## Contributing

Contributions are welcome.

Please keep changes focused, typed, and consistent with the existing architecture:

1. Fork the repository and create a feature branch.
2. Preserve strict TypeScript compatibility.
3. Prefer explicit project-scoped logic over shared mutable state.
4. Add or update diagnostics when fixing backend integration issues.
5. Run typecheck and lint before opening a pull request.
6. Keep the README and docs aligned with user-facing changes.

If you are proposing a larger workflow or architecture change, include the reasoning and validation path in the pull request description.

## Documentation

- Alpha architecture notes: [docs/v0.1.1-alpha.md](./docs/v0.1.1-alpha.md)
- Release history: [CHANGELOG.md](./CHANGELOG.md)
- Folder layout reference: [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)

## Troubleshooting

- Extension does not activate: confirm VS Code `^1.120.0` or newer and reload the window.
- Projects do not appear: verify the workspace contains saved AppForge project state.
- Connection test fails: check the endpoint, project ID, and API key.
- Databases appear empty: run `AppForge: Verify Appwrite Project Environment` and compare the raw REST output with the Appwrite console.
- Project switching looks inconsistent: confirm the project ID in the sidebar matches the project ID stored in AppForge.

## Requirements

- VS Code `^1.120.0`
- Node.js 18+ for development
- An Appwrite instance or Appwrite Cloud project

## License

MIT License.

---

AppForge is built for Appwrite developers who want stronger tooling, clearer diagnostics, and less context switching.
