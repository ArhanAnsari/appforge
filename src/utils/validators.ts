/**
 * Input validation using Zod
 * Ensures type-safe validation of project configurations and user inputs
 */

import { z } from "zod";

/**
 * Validates Appwrite project configuration
 */
export const ProjectConfigSchema = z.object({
  projectName: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be less than 100 characters"),
  endpoint: z
    .string()
    .url("Endpoint must be a valid URL")
    .startsWith("http", "Endpoint must start with http:// or https://"),
  projectId: z
    .string()
    .min(1, "Project ID is required")
    .max(255, "Project ID must be less than 255 characters"),
});

/**
 * Validates API key format
 */
export const ApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .max(1000, "API key seems invalid");

/**
 * Validates database name
 */
export const DatabaseNameSchema = z
  .string()
  .min(1, "Database name is required")
  .max(255, "Database name must be less than 255 characters");

/**
 * Type inference for validated project config
 */
export type ValidatedProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Type inference for validated API key
 */
export type ValidatedApiKey = z.infer<typeof ApiKeySchema>;
