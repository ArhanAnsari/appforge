import * as vscode from "vscode";

export interface TelemetryLogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  module: string;
  message: string;
}

export interface DiagnosticCheck {
  endpointReachable: { status: "pass" | "fail" | "pending"; details: string };
  projectLoaded: { status: "pass" | "fail" | "pending"; details: string };
  databasesAccessible: { status: "pass" | "fail" | "pending"; details: string };
  functionsAccessible: { status: "pass" | "fail" | "pending"; details: string };
  storageAccessible: { status: "pass" | "fail" | "pending"; details: string };
}

export interface PerformanceMetrics {
  databaseLoadDuration: number;
  functionLoadDuration: number;
  storageLoadDuration: number;
  apiLatencies: number[];
  failedRequestsCount: number;
}

export interface FunctionExecutionLog {
  id: string;
  status: "waiting" | "processing" | "completed" | "failed";
  duration: number;
  createdAt: string;
  errors: string;
}

class LogTelemetryManager {
  private static instance: LogTelemetryManager;
  private logs: TelemetryLogEntry[] = [];
  private currentProject: any = null;
  private currentApiKey: string = "";
  
  private metrics: PerformanceMetrics = {
    databaseLoadDuration: 0,
    functionLoadDuration: 0,
    storageLoadDuration: 0,
    apiLatencies: [],
    failedRequestsCount: 0,
  };

  private diagnostics: DiagnosticCheck = {
    endpointReachable: { status: "pending", details: "Awaiting execution sequence" },
    projectLoaded: { status: "pending", details: "Awaiting execution sequence" },
    databasesAccessible: { status: "pending", details: "Awaiting execution sequence" },
    functionsAccessible: { status: "pending", details: "Awaiting execution sequence" },
    storageAccessible: { status: "pending", details: "Awaiting execution sequence" },
  };

  private functionLogs: Map<string, FunctionExecutionLog[]> = new Map();
  private activeWebviews: Set<vscode.WebviewPanel> = new Set();

  private constructor() {}

  public static getInstance(): LogTelemetryManager {
    if (!LogTelemetryManager.instance) {
      LogTelemetryManager.instance = new LogTelemetryManager();
    }
    return LogTelemetryManager.instance;
  }

  public registerWebview(panel: vscode.WebviewPanel) {
    this.activeWebviews.add(panel);
    panel.onDidDispose(() => this.activeWebviews.delete(panel));
  }

  public pushLog(level: "info" | "success" | "warning" | "error", module: string, message: string) {
    const entry: TelemetryLogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      module: module.replace(/[\[\]]/g, "").trim(),
      message,
    };
    this.logs.push(entry);
    this.broadcast({ command: "appendTelemetryLog", log: entry });
  }

  public setMetric(key: keyof Omit<PerformanceMetrics, "apiLatencies" | "failedRequestsCount">, value: number) {
    this.metrics[key] = value;
    this.broadcast({ command: "updatePerformanceMetrics", metrics: this.getSnapshotMetrics() });
  }

  public addApiLatency(duration: number) {
    this.metrics.apiLatencies.push(duration);
    this.broadcast({ command: "updatePerformanceMetrics", metrics: this.getSnapshotMetrics() });
  }

  public incrementFailedRequests() {
    this.metrics.failedRequestsCount++;
    this.broadcast({ command: "updatePerformanceMetrics", metrics: this.getSnapshotMetrics() });
  }

  public updateDiagnostic(key: keyof DiagnosticCheck, status: "pass" | "fail" | "pending", details: string) {
    this.diagnostics[key] = { status, details };
    this.broadcast({ command: "updateDiagnosticTab", diagnostics: this.diagnostics });
  }

  public setFunctionExecutionLogs(functionId: string, logs: FunctionExecutionLog[]) {
    this.functionLogs.set(functionId, logs);
    this.broadcast({ command: "updateFunctionLogs", functionId, logs });
  }

  public getLogs(): TelemetryLogEntry[] { return this.logs; }
  public getDiagnostics(): DiagnosticCheck { return this.diagnostics; }
  
  public getSnapshotMetrics() {
    const avg = this.metrics.apiLatencies.length > 0 
      ? Math.round(this.metrics.apiLatencies.reduce((a, b) => a + b, 0) / this.metrics.apiLatencies.length)
      : 0;
    return {
      databaseLoadDuration: this.metrics.databaseLoadDuration,
      functionLoadDuration: this.metrics.functionLoadDuration,
      storageLoadDuration: this.metrics.storageLoadDuration,
      averageResponseTime: avg,
      failedRequestsCount: this.metrics.failedRequestsCount,
    };
  }

  public getFunctionExecutionLogs(functionId: string): FunctionExecutionLog[] {
    return this.functionLogs.get(functionId) || [];
  }

  public setContext(project: any, apiKey: string) {
    this.currentProject = project;
    this.currentApiKey = apiKey;
  }

  public getContext() {
    return { project: this.currentProject, apiKey: this.currentApiKey };
  }

  private broadcast(message: any) {
    for (const panel of this.activeWebviews) {
      panel.webview.postMessage(message);
    }
  }
}

export const telemetryManager = LogTelemetryManager.getInstance();