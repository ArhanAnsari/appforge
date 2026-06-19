# AppForge v0.2.1-alpha

## 🚀 What's New

### Self-Hosted Appwrite Support

AppForge now properly supports self-hosted Appwrite instances alongside Appwrite Cloud.

#### Improvements

* Fixed database discovery issues on self-hosted Appwrite deployments
* Improved endpoint handling and validation
* Better compatibility across different Appwrite versions
* Enhanced project connection reliability

### Status Bar Improvements

* Added live active project display in the VS Code status bar
* Automatic updates when switching projects
* Improved project visibility across workspaces

### Intelligent Refresh System

* Introduced centralized Refresh Manager
* Debounced refresh requests to prevent excessive API calls
* Scoped resource refreshing
* Improved resource synchronization after operations

### Event-Driven Architecture

* Added lightweight Event Bus system
* Real-time communication between extension modules
* Improved extension responsiveness
* Better state management

### Professional Logging & Telemetry

* Added dedicated AppForge Output Channel
* Structured logging system
* Operation tracking and diagnostics
* Performance telemetry collection

### Function Logs Enhancements

* Improved function execution monitoring
* Better log retrieval and presentation
* Enhanced diagnostics for failed executions

---

## 🛠️ Fixes

### Fixed

* Fixed self-hosted Appwrite database loading issues
* Fixed project synchronization inconsistencies
* Fixed refresh reliability after resource operations
* Fixed status bar update inconsistencies
* Improved error handling across multiple commands
* Improved extension initialization stability

### Internal Improvements

* Added Refresh Manager architecture
* Added Event Bus infrastructure
* Added Output Channel manager
* Improved service separation and maintainability
* Enhanced debugging capabilities

---

## 📊 Technical Highlights

### New Core Systems

* Event Bus
* Refresh Manager
* Output Channel Manager
* Enhanced Telemetry Integration
* Improved Status Bar Service

### Performance

* Reduced redundant refresh operations
* Better resource loading workflow
* Improved command execution tracking
* More efficient state updates

---

## 🔄 Upgrade Notes

Existing users can safely upgrade from v0.2.0-alpha.

No project migration is required.

If you previously experienced issues with self-hosted Appwrite projects, reconnect your project after upgrading to ensure all resources are refreshed correctly.

---

## ❤️ Thanks

Special thanks to the Appwrite community members who reported issues related to self-hosted deployments and resource synchronization. Your feedback directly helped improve AppForge v0.2.1-alpha.
