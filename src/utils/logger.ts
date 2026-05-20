/**
 * AppForge Logger Service
 * Production-grade logging for debugging and diagnostics
 * Outputs to OutputChannel for user visibility
 */

import * as vscode from "vscode";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SUCCESS";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

export class AppForgeLogger {
  private static instance: AppForgeLogger;
  private outputChannel: vscode.OutputChannel | null = null;
  private logHistory: LogEntry[] = [];
  private readonly maxHistorySize = 500;

  private constructor() {}

  public static getInstance(): AppForgeLogger {
    if (!AppForgeLogger.instance) {
      AppForgeLogger.instance = new AppForgeLogger();
    }
    return AppForgeLogger.instance;
  }

  /**
   * Initialize the logger with output channel
   */
  public initialize(): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel("AppForge");
    }
  }

  /**
   * Log a message with optional data
   */
  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: unknown,
  ): void {
    this.initialize();

    const timestamp = new Date().toISOString().split("T")[1];
    const entry: LogEntry = {
      timestamp,
      level,
      component,
      message,
      data,
    };

    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    const prefix = this.getPrefix(level);
    const logLine = `${prefix} [${timestamp}] [${component}] ${message}`;

    if (this.outputChannel) {
      this.outputChannel.appendLine(logLine);
      if (data !== undefined) {
        try {
          const dataStr =
            typeof data === "string" ? data : JSON.stringify(data, null, 2);
          this.outputChannel.appendLine(`  ${dataStr}`);
        } catch (err) {
          this.outputChannel.appendLine(`  [Circular or unserializable data]`);
        }
      }
    }

    // Also log to console for DevTools
    const consoleLog = `${logLine}${data ? "\n" + JSON.stringify(data) : ""}`;
    switch (level) {
      case "ERROR":
        console.error(consoleLog);
        break;
      case "WARN":
        console.warn(consoleLog);
        break;
      case "DEBUG":
        console.debug(consoleLog);
        break;
      default:
        console.log(consoleLog);
    }
  }

  private getPrefix(level: LogLevel): string {
    switch (level) {
      case "DEBUG":
        return "🔍";
      case "INFO":
        return "ℹ️ ";
      case "WARN":
        return "⚠️ ";
      case "ERROR":
        return "❌";
      case "SUCCESS":
        return "✅";
    }
  }

  public debug(component: string, message: string, data?: unknown): void {
    this.log("DEBUG", component, message, data);
  }

  public info(component: string, message: string, data?: unknown): void {
    this.log("INFO", component, message, data);
  }

  public warn(component: string, message: string, data?: unknown): void {
    this.log("WARN", component, message, data);
  }

  public error(component: string, message: string, data?: unknown): void {
    this.log("ERROR", component, message, data);
  }

  public success(component: string, message: string, data?: unknown): void {
    this.log("SUCCESS", component, message, data);
  }

  /**
   * Show the output channel to the user
   */
  public show(): void {
    this.initialize();
    this.outputChannel?.show(vscode.ViewColumn.Beside);
  }

  /**
   * Clear logs
   */
  public clear(): void {
    this.outputChannel?.clear();
    this.logHistory = [];
  }

  /**
   * Get log history as formatted string
   */
  public getHistory(): string {
    return this.logHistory
      .map(
        (entry) =>
          `${entry.timestamp} [${entry.level}] [${entry.component}] ${entry.message}`,
      )
      .join("\n");
  }

  /**
   * Trace a function execution with timing
   */
  public async trace<T>(
    component: string,
    functionName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = performance.now();
    this.debug(component, `[TRACE START] ${functionName}`);

    try {
      const result = await fn();
      const duration = (performance.now() - startTime).toFixed(2);
      this.debug(
        component,
        `[TRACE END] ${functionName} (${duration}ms)`,
        result,
      );
      return result;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      this.error(
        component,
        `[TRACE ERROR] ${functionName} (${duration}ms)`,
        error,
      );
      throw error;
    }
  }
}

export const logger = AppForgeLogger.getInstance();
