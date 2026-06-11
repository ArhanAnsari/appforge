/**
 * Output Channel Manager
 * Professional logging for AppForge operations
 *
 * Logs:
 * - Timestamps
 * - Operation durations
 * - Appwrite SDK requests
 * - Retries
 * - Refresh events
 * - Deployment progress
 * - Errors
 * - Project context
 */

import * as vscode from "vscode";
import { telemetryManager } from "../logs/logTelemetryManager";

interface LogEntry {
  level: "info" | "warn" | "error" | "success" | "debug";
  timestamp: Date;
  category: string;
  message: string;
  data?: any;
  duration?: number;
}

/**
 * Output channel manager for AppForge
 */
export class OutputChannelManager {
  private static instance: OutputChannelManager;
  private channel: vscode.OutputChannel | null = null;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 500;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): OutputChannelManager {
    if (!OutputChannelManager.instance) {
      OutputChannelManager.instance = new OutputChannelManager();
    }
    return OutputChannelManager.instance;
  }

  /**
   * Initialize the output channel
   */
  public initialize(): void {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel("AppForge");
      this.channel.show(true);
    }
  }

  /**
   * Get or create channel
   */
  private getChannel(): vscode.OutputChannel {
    if (!this.channel) {
      this.initialize();
    }
    return this.channel!;
  }

  /**
   * Log with category
   */
  public log(
    level: "info" | "warn" | "error" | "success" | "debug",
    category: string,
    message: string,
    data?: any,
    duration?: number,
  ): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      category,
      message,
      data,
      duration,
    };

    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    this.write(entry);

    // FIX: Stream logs into central telemetryManager instantly
    const mappedLevel = level === "warn" ? "warning" : level === "debug" ? "info" : level;
    telemetryManager.pushLog(mappedLevel, category, message);
  }

  /**
   * Info log
   */
  public info(category: string, message: string, data?: any): void {
    this.log("info", category, message, data);
  }

  /**
   * Success log
   */
  public success(
    category: string,
    message: string,
    data?: any,
    duration?: number,
  ): void {
    this.log("success", category, message, data, duration);
  }

  /**
   * Warning log
   */
  public warn(category: string, message: string, data?: any): void {
    this.log("warn", category, message, data);
  }

  /**
   * Error log
   */
  public error(
    category: string,
    message: string,
    error?: any,
    data?: any,
  ): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const fullMessage = errorMsg ? `${message}: ${errorMsg}` : message;
    this.log("error", category, fullMessage, data);
  }

  /**
   * Debug log
   */
  public debug(category: string, message: string, data?: any): void {
    this.log("debug", category, message, data);
  }

  /**
   * Operation tracking
   */
  public startOperation(
    category: string,
    operationName: string,
  ): (success?: boolean, error?: Error) => void {
    const startTime = Date.now();
    this.info(category, `Starting: ${operationName}`);

    return (success: boolean = true, error?: Error) => {
      const duration = Date.now() - startTime;
      if (error) {
        this.error(category, `Failed: ${operationName}`, error, { duration });
      } else if (success) {
        this.success(category, `Completed: ${operationName}`, {}, duration);
      }
    };
  }

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    const channel = this.getChannel();
    const timeStr = entry.timestamp.toLocaleTimeString();
    const levelIcon = this.getLevelIcon(entry.level);
    const durationStr = entry.duration ? ` (${entry.duration}ms)` : "";

    let line = `${levelIcon} [${timeStr}] [${entry.category}] ${entry.message}${durationStr}`;

    channel.appendLine(line);

    // Append data if present
    if (entry.data && typeof entry.data === "object") {
      const dataStr = JSON.stringify(entry.data, null, 2);
      channel.appendLine(dataStr);
    }

    // Add separator for errors
    if (entry.level === "error") {
      channel.appendLine("—".repeat(80));
    }
  }

  /**
   * Get icon for log level
   */
  private getLevelIcon(level: string): string {
    const icons: Record<string, string> = {
      info: "ℹ️ ",
      success: "✅",
      warn: "⚠️ ",
      error: "❌",
      debug: "🔍",
    };
    return icons[level] || "";
  }

  /**
   * Show output channel
   */
  public show(): void {
    this.getChannel().show(true);
  }

  /**
   * Clear output
   */
  public clear(): void {
    this.getChannel().clear();
    this.logs = [];
  }

  /**
   * Get recent logs
   */
  public getLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs by category
   */
  public getLogsByCategory(category: string, count: number = 50): LogEntry[] {
    return this.logs.filter((log) => log.category === category).slice(-count);
  }

  /**
   * Log table data
   */
  public table(category: string, title: string, data: any[]): void {
    this.info(category, title);
    if (data.length === 0) {
      this.info(category, "  (empty)");
      return;
    }

    // Print as formatted table
    const channel = this.getChannel();
    const jsonStr = JSON.stringify(data, null, 2);
    channel.appendLine(jsonStr);
  }

  /**
   * Log operation timeline
   */
  public timeline(
    category: string,
    events: Array<{ name: string; time: number }>,
  ): void {
    this.info(category, "Operation Timeline:");
    events.forEach((event, index) => {
      const prefix =
        index === 0 ? "├─" : index === events.length - 1 ? "└─" : "├─";
      this.info(category, `${prefix} ${event.name}: ${event.time}ms`);
    });
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.channel?.dispose();
    this.channel = null;
    this.logs = [];
  }
}

export const outputChannel = OutputChannelManager.getInstance();
