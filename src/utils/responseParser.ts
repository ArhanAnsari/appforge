export function extractObjectArrayWithId(obj: unknown): any[] {
  // Traverse recursively to find the first array of objects containing `$id` or `id` properties
  // Logs the search process for debugging

  const visited = new Set<unknown>();
  const searchPath: string[] = [];

  function check(value: unknown, path: string): any[] | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (visited.has(value)) {
      return null;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "object") {
        // Check whether items look like database/collection objects
        const first = value[0] as any;
        if (first && (first.$id || first.id || first.name)) {
          // Found it!
          return value as any[];
        }
      }
      // Try deeper inside array items
      for (let i = 0; i < value.length; i++) {
        const found = check(value[i], `${path}[${i}]`);
        if (found) {
          return found;
        }
      }
      return null;
    }

    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        const found = check(o[k], `${path}.${k}`);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return check(obj, "root") || [];
}
