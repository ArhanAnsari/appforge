# AppForge

**Appwrite-native developer cockpit inside VS Code**

[![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)

Remove the need to constantly switch to the Appwrite console. Manage your projects, databases, functions, and logs directly from VS Code.

## Overview

AppForge is a production-grade VS Code extension that brings Appwrite project management into your editor. Built with TypeScript, Appwrite SDK, and Zod validation, it provides a polished alpha experience with:

- 📦 Project management with secure credential storage
- 🌳 Intuitive sidebar tree view
- 🔄 Instant project switching
- 🚀 Foundation for database, function, and log management
- ✓ Strict TypeScript with zero `any` types
- 📝 Comprehensive error handling and validation

## Features (v0.1.0-alpha)

### Project Management

- ✅ **Persistent Setup Panel**: Professional webview form that stays open when you switch to your browser
- ✅ **Add Project**: Guided setup with validation, auto-save, and connection testing
- ✅ **Remove Project**: With confirmation dialog
- ✅ **Switch Project**: Instant context switching
- ✅ **Secure Storage**: API keys encrypted via VS Code SecretStorage

**NEW**: The setup panel auto-saves your input locally, so switching to your Appwrite console won't lose your progress. Never fill out the same form twice!

### Sidebar Tree View

- ✅ **Projects Section**: View all configured projects
- ✅ **Databases Section**: Expandable database list
- ✅ **Collections View**: Nested collection display
- ✅ **Functions Section**: Show functions with status indicators
- ✅ **Logs Access**: Quick navigation to function logs
- ✅ **Context Menus**: Right-click actions on projects

### Database Operations (NEW in v0.1.0)

- ✅ **List Databases**: View all databases in project
- ✅ **List Collections**: Expandable collections view
- ✅ **Create Document**: JSON input with validation
- ✅ **Delete Document**: With confirmation dialog
- ✅ **Auto-refresh**: Tree updates after mutations

### Function Operations (NEW in v0.1.0)

- ✅ **Execute Function**: Run functions with optional input data
- ✅ **Deploy Function**: Select folder and initiate deployment
- ✅ **View Logs**: Placeholder for Phase 2 full log viewer

### Code Snippets (NEW in v0.1.0)

- ✅ **25 Appwrite Snippets**: Production-ready code templates
  - Project initialization (awclient, awinit)
  - Database operations (awdb, awc, awattr, awindex, awdoc, etc.)
  - Authentication (awaccount, awsignup, awlogin, awlogout, awsession)
  - Functions (awfn, awexec, awdeploy)
  - Storage (awstorage, awupload, awdeletefile)
  - Teams (awteam)
  - Queries (awqueryeq, awquerylimit, awqueryorder)
  - Utilities (awid)

### Developer Experience

- ✅ Loading indicators for async operations
- ✅ Success, error, and warning notifications
- ✅ Input validation with inline feedback
- ✅ Command palette integration
- ✅ Intuitive UI with proper icons

## Installation

### From VS Code Marketplace (Coming Soon)

1. Open VS Code Extensions (`Ctrl+Shift+X`)
2. Search for "AppForge"
3. Click Install

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/appforge/appforge-vscode.git
cd appforge

# Install dependencies
npm install

# Build and run in development mode
npm run watch

# Package for publication
npm run package
```

## Quick Start

### Add Your First Project

1. Open the **AppForge** panel in the sidebar (Activity Bar)
2. Click **+ Add Project** or use Command Palette: `Cmd+Shift+P` → "AppForge: Add Project"
3. **Professional setup panel opens** (stays open when you switch to browser!)
4. Fill in your Appwrite project details:
   - **Project Name**: Display name for your project
   - **Endpoint**: Your Appwrite instance URL (e.g., `https://cloud.appwrite.io/v1`)
   - **Project ID**: Your Appwrite project ID
   - **API Key**: Your Appwrite API key (securely stored)
5. Click **"Test Connection"** to verify everything works
6. Click **"Save Project"** to add it
7. Your project appears in the sidebar instantly

**💡 Tip**: The setup panel auto-saves your input. Click "Open Appwrite Console" to retrieve credentials without losing your progress!

### Switch Between Projects

Click any project name in the sidebar to switch context instantly.

### Remove a Project

Right-click a project → **Remove Project** (this removes stored credentials locally, not your Appwrite project).

### Using Code Snippets

AppForge includes 25 production-ready Appwrite SDK snippets for JavaScript/TypeScript:

1. Open a `.ts` or `.js` file
2. Start typing a snippet prefix:
   - `awclient` → Create Appwrite client
   - `awdb` → Database operations
   - `awdoc` → Create document
   - `awlogin` → Email password login
   - `awfn` → Functions instance
   - See [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) for complete list

3. Select snippet from IntelliSense
4. Fill in placeholder values

Example:

```
awclient + Tab →
const client = new Client()
  .setEndpoint("${1:endpoint}")
  .setProject("${2:projectId}");
```

All snippets follow Appwrite SDK best practices and include proper error handling patterns.

## Architecture

### Core Services

#### AppwriteClientService

Singleton pattern for Appwrite client lifecycle:

- Initialize with project configuration
- Switch between projects
- Expose Databases, Functions, Account, Storage, Teams clients

#### ProjectStorageService

Secure project storage and credential management:

- Store projects in workspace state
- Store API keys in VS Code SecretStorage (encrypted)
- Auto-load active project on activation

### Data Providers

#### AppForgeTreeDataProvider

VS Code tree view integration:

- Dynamic tree structure based on project state
- Lazy-load data on expansion
- Refresh capability at any level

### Type System

- **AppwriteProject**: Full project configuration
- **StoredProject**: Persisted project metadata
- **TreeItemData**: Tree view item representation
- **CommandResult**: Standard async operation result

### Validation

All user inputs validated with Zod schemas:

- Project configuration (name, endpoint, projectId)
- API key format
- Database names

## Commands

### Project Management

- `AppForge: Add Project` - Add new Appwrite project
- `AppForge: Remove Project` - Remove project
- `AppForge: Switch Project` - Switch active project
- `AppForge: Refresh Projects` - Refresh project list

### Database Operations (Phase 2)

- `AppForge: Refresh Databases` - Reload database list
- `AppForge: Create Document` - Coming in v0.2.0
- `AppForge: Delete Document` - Coming in v0.2.0

### Function Operations (Phase 2)

- `AppForge: Execute Function` - Coming in v0.2.0
- `AppForge: Deploy Function` - Coming in v0.2.0
- `AppForge: View Logs` - Coming in v0.2.0

## Requirements

- **VS Code**: >= 1.120.0
- **Node.js**: >= 18.0.0 (for development)
- **Appwrite**: >= 1.4.0 instance

## Extension Settings

Future versions will support:

- Custom timeout configurations
- Project-specific API settings
- Theme preferences
- Automatic refresh intervals

## Known Limitations

- Document CRUD UI coming in Phase 2
- Function deployment coming in Phase 2
- Real-time log streaming coming in Phase 2

## Known Limitations (v0.1.0-alpha)

- Document preview panel coming in Phase 2
- Advanced log viewer coming in Phase 2
- Real-time log streaming coming in Phase 2
- Limited filter/search (coming in Phase 2)
- Batch operations (coming in Phase 3+)

## Roadmap

### ✅ Completed in v0.1.0

- Project management (add, remove, switch)
- Secure credential storage (SecretStorage + WorkspaceState)
- Tree view with projects, databases, functions, logs
- Database CRUD (create/delete documents)
- Function execution with input parameters
- Code snippet engine (25 production-ready snippets)
- Comprehensive documentation

### Phase 2 (v0.2.0)

- Document preview panel
- Advanced real-time function log viewer
- Function deployment workflow completion
- Settings panel
- Connection diagnostics
- Batch operations on documents

### Phase 3 (v0.3.0)

- Storage bucket management
- Team and permission management
- Workspace integration features
- Advanced search and filtering

### Future

- Collaboration features
- Extension marketplace integration
- Multi-user workspaces
- Custom extensions

## Architecture Documentation

For detailed architecture information, see [v0.1.0-alpha.md](./docs/v0.1.0-alpha.md)

Topics covered:

- Service layer design
- Data provider implementation
- Security and credential storage
- Type system and validation
- Error handling strategies

## Troubleshooting

### Extension won't activate

- Ensure VS Code version >= 1.120.0
- Check `Help → About` for your version
- Restart VS Code

### Projects not appearing in sidebar

- Check workspace state is readable
- Verify you added projects previously
- Reload VS Code window (`Cmd+R`)

### Credentials not saved

- Verify OS credential manager is available
- Check VS Code has permission to access credentials
- Try re-adding the project

### Connection errors when expanding sections

- Verify your Appwrite instance is accessible
- Check your API key is valid
- Review browser console for details

## Development

### Setup

```bash
npm install
npm run watch              # Development watch mode
npm run check-types        # Type checking
npm run lint              # ESLint
npm run test              # Run tests
npm run package           # Build for production
```

### Project Structure

```
src/
├── commands/              # Command handlers (project, database, function)
├── providers/             # Tree data provider for sidebar
├── services/              # Business logic (Appwrite client, storage)
├── types/                 # Type definitions
├── utils/                 # Validators (Zod schemas)
├── views/                 # Webviews (ready for Phase 2)
├── test/                  # Tests (ready for Phase 2)
└── extension.ts           # Main entry point

snippets/
└── appwrite.code-snippets # 25 production-ready code snippets
```

For detailed folder structure explanation, see [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)

### Code Quality

- ✓ Strict TypeScript (no `any`)
- ✓ Modular architecture
- ✓ Comprehensive error handling
- ✓ Full type safety
- ✓ Clear public interfaces
- ✓ Inline documentation

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript strict mode rules
4. Add comments for complex logic
5. Test thoroughly
6. Submit a pull request

## License

MIT License - See [LICENSE](LICENSE) file

## Support

- 📖 [Documentation](./docs/v0.1.0-alpha.md)
- 🐛 [Report Issues](https://github.com/appforge/appforge-vscode/issues)
- 💬 [Discussions](https://github.com/appforge/appforge-vscode/discussions)
- 📧 [Contact](mailto:team@appforge.dev)

---

**AppForge** - Built for developers by developers. Bringing Appwrite to your editor.

Made with ❤️ for the Appwrite community.

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
