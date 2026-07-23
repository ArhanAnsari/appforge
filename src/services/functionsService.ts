/**
 * Functions Service
 * Handles all function operations: functions, deployments, executions, variables
 */

import { Functions } from "node-appwrite";
import {
  FunctionItem,
  DeploymentItem,
  ExecutionItem,
  VariableItem,
  AppwriteProject,
} from "../types";
import { AppwriteClientService } from "./appwriteClientService";
import { outputChannel } from "../core/output/outputChannel";
import { extractObjectArrayWithId } from "../utils/responseParser";

export class FunctionsService {
  constructor(
    private project: AppwriteProject,
    private apiKey: string,
  ) {}

  private getClient(): Functions {
    const instance = AppwriteClientService.getInstance();
    if (!instance) {
      throw new Error("Appwrite client instance is not initialized.");
    }
    return instance.createFunctionsService(this.project, this.apiKey);
  }

  /**
   * List all functions for the project
   */
  async listFunctions(): Promise<FunctionItem[]> {
    try {
      const fnClient = this.getClient();
      const response = await fnClient.list();
      const functions = extractObjectArrayWithId(response);

      return functions.map((fn: any) => ({
        $id: fn.$id,
        name: fn.name,
        status: "enabled",
        runtime: fn.runtime,
        entrypoint: fn.entrypoint,
      }));
    } catch (error) {
      outputChannel.error(
        "[FUNCTIONS]",
        "Failed to list functions",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get a specific function
   */
  async getFunction(functionId: string): Promise<FunctionItem> {
    try {
      const fnClient = this.getClient();
      const fn = await fnClient.get(functionId);

      return {
        $id: fn.$id,
        name: fn.name,
        status: "enabled",
        runtime: fn.runtime,
        entrypoint: fn.entrypoint,
      };
    } catch (error) {
      outputChannel.error(
        "[FUNCTIONS]",
        "Failed to get function",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * List deployments for a function
   */
  async listDeployments(functionId: string): Promise<DeploymentItem[]> {
    try {
      const fnClient = this.getClient();
      const response = await fnClient.listDeployments(functionId);
      const deployments = extractObjectArrayWithId(response);

      return deployments.map((dep: any) => ({
        $id: dep.$id,
        resourceId: dep.resourceId,
        resourceType: dep.resourceType,
        status: dep.status as "processing" | "ready" | "failed",
        $createdAt: dep.$createdAt,
      }));
    } catch (error) {
      outputChannel.error(
        "[FUNCTIONS]",
        "Failed to list deployments",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * List executions for a function
   */
  async listExecutions(functionId: string): Promise<ExecutionItem[]> {
    try {
      const fnClient = this.getClient();
      const response = await fnClient.listExecutions(functionId);
      const executions = extractObjectArrayWithId(response);

      return executions.map((exec: any) => ({
        $id: exec.$id,
        $functionId: exec.$functionId,
        status: exec.status as
          | "waiting"
          | "processing"
          | "completed"
          | "failed",
        statusCode: exec.statusCode,
        duration: exec.duration,
        $createdAt: exec.$createdAt,
      }));
    } catch (error) {
      outputChannel.error(
        "[FUNCTIONS]",
        "Failed to list executions",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get function variables
   */
  async listVariables(functionId: string): Promise<VariableItem[]> {
    try {
      const fnClient = this.getClient();
      const response = await fnClient.listVariables(functionId);
      const variables = extractObjectArrayWithId(response);

      return variables.map((variable: any) => ({
        key: variable.key,
        value: variable.value,
      }));
    } catch (error) {
      outputChannel.error(
        "[FUNCTIONS]",
        "Failed to list variables",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Execute a function
   */
  async executeFunction(
    functionId: string,
    data?: string,
    async?: boolean,
  ): Promise<ExecutionItem> {
    try {
      const fnClient = this.getClient();
      const execution = await fnClient.createExecution(functionId, data, async);

      outputChannel.success(
        "[FUNCTIONS]",
        "Function executed",
        `Execution ${execution.$id}`,
      );

      const exec = execution as any;
      return {
        $id: exec.$id,
        $functionId: exec.$functionId || exec.functionId || functionId,
        status: exec.status as
          | "waiting"
          | "processing"
          | "completed"
          | "failed",
        statusCode: exec.statusCode || exec.responseStatusCode || 0,
        duration: exec.duration || 0,
        $createdAt: exec.$createdAt,
      };
    } catch (error) {
      outputChannel.error(
        "[FUNCTIONS]",
        "Failed to execute function",
        error as Error,
      );
      throw error;
    }
  }
}