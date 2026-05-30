/**
 * Status Bar Service
 * Displays active project in VS Code status bar
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "./projectStorageService";

export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private projectStorage: ProjectStorageService) {
    // Use LEFT alignment and higher priority for visibility
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1000, // High priority to appear early
    );
    this.statusBarItem.command = "appforge.switchProject";
    this.statusBarItem.tooltip = "Click to switch AppForge project";
    this.updateStatusBar();
    this.show(); // Explicitly show on creation
  }

  /**
   * Update the status bar to show the active project
   */
  public updateStatusBar(): void {
    const activeProjectId = this.projectStorage.getActiveProjectId();

    if (!activeProjectId) {
      this.statusBarItem.text = "$(cloud) Appwrite: No project";
      this.statusBarItem.show();
      return;
    }

    const projects = this.projectStorage.getProjects();
    const activeProject = projects.find((p) => p.projectId === activeProjectId);

    if (activeProject) {
      this.statusBarItem.text = `$(cloud) Appwrite: ${activeProject.projectName}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = "$(cloud) Appwrite: Unknown project";
      this.statusBarItem.show();
    }
  }

  /**
   * Show the status bar
   */
  public show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar
   */
  public hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Dispose of the status bar
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
