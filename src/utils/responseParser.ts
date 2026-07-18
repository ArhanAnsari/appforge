const APPWRITE_LIST_KEYS = [
  "databases",
  "collections",
  "documents",
  "functions",
  "deployments",
  "executions",
  "variables",
  "buckets",
  "files",
  "rows",
  "items",
] as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// FIX: Changed 'value is any[]' to a more specific check, 
// or simply returning boolean to avoid breaking control flow narrowing.
function isResourceArray(value: unknown[]): boolean {
  if (value.length === 0) {
    return true;
  }
  const first = value[0];
  if (!isObjectRecord(first)) {
    return false;
  }
  return Boolean(first.$id || first.id || first.name || first.key);
}

export function extractObjectArrayWithId(obj: unknown): any[] {
  if (!isObjectRecord(obj)) {
    return [];
  }

  for (const key of APPWRITE_LIST_KEYS) {
    const direct = obj[key];
    // Since 'direct' is unknown, we check Array.isArray first
    if (Array.isArray(direct) && isResourceArray(direct)) {
      return direct as any[];
    }
  }

  const visited = new Set<unknown>();

  function check(value: unknown): any[] | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (visited.has(value)) {
      return null;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      if (isResourceArray(value)) {
        return value as any[];
      }
      // TypeScript now safely knows 'value' is still an array here
      for (const item of value) {
        const found = check(item);
        if (found) {
          return found;
        }
      }
      return null;
    }

    if (isObjectRecord(value)) {
      for (const key of APPWRITE_LIST_KEYS) {
        const typedValue = value[key];
        if (Array.isArray(typedValue) && isResourceArray(typedValue)) {
          return typedValue as any[];
        }
      }

      for (const key of Object.keys(value)) {
        const found = check(value[key]);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return check(obj) || [];
}
