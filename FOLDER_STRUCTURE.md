# AppForge Folder Structure

This document describes the current AppForge project architecture as of **v0.2.2-alpha**.

```text
appforge/
│
├── assets/
│   ├── appforge.png
│   └── appforge.svg
│
├── snippets/
│   └── appwrite.code-snippets
│
├── src/
│   │
│   ├── commands/
│   │   ├── projectCommands.ts
│   │   ├── databaseCommands.ts
│   │   ├── databaseManagement.ts
│   │   ├── databaseViewerCommands.ts
│   │   ├── databaseCreationCommands.ts
│   │   ├── functionCommands.ts
│   │   ├── storageCommands.ts
│   │   ├── diagnosticsCommands.ts
│   │   └── resourceCommands.ts
│   │
│   ├── core/
│   │   │
│   │   ├── events/
│   │   │   └── eventBus.ts
│   │   │
│   │   ├── refresh/
│   │   │   └── refreshManager.ts
│   │   │
│   │   ├── output/
│   │   │   └── outputChannel.ts
│   │   │
│   │   └── logs/
│   │       └── logTelemetryManager.ts
│   │
│   ├── providers/
│   │   └── treeDataProvider.ts
│   │
│   ├── services/
│   │   ├── appwriteClientService.ts
│   │   ├── projectStorageService.ts
│   │   ├── statusBarService.ts
│   │   ├── databaseService.ts
│   │   ├── functionsService.ts
│   │   └── storageService.ts
│   │
│   ├── views/
│   │   └── logsViewer.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── utils/
│   │   └── logger.ts
│   │
│   └── extension.ts
│
├── docs/
│   ├── CHANGELOG.md
│   ├── RELEASE_REPORT_v0.2.1-alpha.md
│   ├── RELEASE_REPORT_v0.2.2-alpha.md
│   └── FOLDER_STRUCTURE.md
│
├── package.json
├── tsconfig.json
├── esbuild.js
├── eslint.config.js
├── LICENSE
└── README.md
```

---

# Architecture Overview

## Commands Layer

Responsible for registering VS Code commands and handling user interactions.

Examples:

* Project Management
* Database Operations
* Function Management
* Storage Operations
* Diagnostics

---

## Services Layer

Responsible for Appwrite communication and business logic.

Examples:

* Project Storage
* Appwrite Client
* Database Services
* Functions Services
* Storage Services

---

## Providers Layer

Responsible for supplying data to VS Code views.

Examples:

* Tree View Provider

---

## Core Layer

Contains internal infrastructure systems.

### Event Bus

Lightweight event-driven communication system.

### Refresh Manager

Handles resource refresh orchestration.

### Output Channel

Professional logging and diagnostics.

### Telemetry

Performance and operational metrics.

---

## Views Layer

Custom VS Code webviews and panels.

Examples:

* Logs Viewer

---

## Types Layer

Shared TypeScript interfaces and type definitions.

---

# Design Principles

AppForge follows several architectural principles:

* Modular Design
* Service-Oriented Architecture
* Event-Driven Communication
* Strong Type Safety
* Separation of Concerns
* Extensibility
* Maintainability

---

# Future Expansion

The architecture is designed to support future additions including:

* Authentication Management
* Teams Management
* Sites Management
* Realtime Monitoring
* Query Builder
* Visual Schema Designer
* AI Diagnostics

---

**Version:** v0.2.2-alpha
