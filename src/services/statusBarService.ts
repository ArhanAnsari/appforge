/**
 * Status Bar Service
 * Displays active project in VS Code status bar
 */

import * as vscode from "vscode";
import { ProjectStorageService } from "./projectStorageService";

export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;
  private activeProjectSubscription?: vscode.Disposable;

  constructor(private projectStorage: ProjectStorageService) {
    // [STATUSBAR] Created with LEFT alignment and priority 1000
    console.log("[STATUSBAR] Creating status bar item", {
      alignment: "Left",
      priority: 1000,
    });

    // Use LEFT alignment and higher priority for visibility
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1000, // High priority to appear early
    );

    console.log("[STATUSBAR] Created: StatusBarAlignment.Left, priority 1000");

    this.statusBarItem.command = "appforge.switchProject";
    this.statusBarItem.tooltip = "Click to switch AppForge project";

    // Set initial text and ensure visibility
    this.statusBarItem.text = "$(cloud) AppForge: Loading...";
    console.log("[STATUSBAR] Initial text set to 'Loading...'");

    this.updateStatusBar();
    this.show(); // Explicitly show on creation

    // FIX: Listen for active project changes from the storage service
    this.activeProjectSubscription = this.projectStorage.onDidChangeActiveProject(
      (projectId) => {
        console.log("[STATUSBAR] Active project change event received!", {
          projectId,
        });
        this.updateStatusBar();
      },
    );

    console.log("[STATUSBAR] Show called on creation");
    console.log("[STATUSBAR] StatusBar item reference", {
      hasText: !!this.statusBarItem.text,
      text: this.statusBarItem.text,
      command: this.statusBarItem.command,
    });
  }

  /**
   * Update the status bar to show the active project
   */
  public updateStatusBar(): void {
    const activeProjectId = this.projectStorage.getActiveProjectId();

    if (!activeProjectId) {
      this.statusBarItem.text = "$(cloud) AppForge: No project";
      this.statusBarItem.show();
      console.log("[STATUSBAR] Updated text: No project selected");
      return;
    }

    const projects = this.projectStorage.getProjects();
    const activeProject = projects.find((p) => p.projectId === activeProjectId);

    if (activeProject) {
      this.statusBarItem.text = `$(cloud) AppForge: ${activeProject.projectName}`;
      this.statusBarItem.show();
      console.log("[STATUSBAR] Updated text", {
        projectName: activeProject.projectName,
        projectId: activeProjectId,
      });
    } else {
      this.statusBarItem.text = "$(cloud) AppForge: Unknown project";
      this.statusBarItem.show();
      console.log("[STATUSBAR] Updated text: Unknown project", {
        projectId: activeProjectId,
      });
    }
  }

  /**
   * Show the status bar
   */
  public show(): void {
    console.log("[STATUSBAR] Show called");
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
    this.activeProjectSubscription?.dispose();
    this.activeProjectSubscription = undefined;
    this.statusBarItem.dispose();
  }
}
