export function extractObjectArrayWithId(obj: unknown): any[] {
  // Traverse recursively to find the first array of objects containing `$id` or `id` properties
  const visited = new Set<unknown>();

  function check(value: unknown): any[] | null {
    if (value === null || value === undefined) return null;
    if (visited.has(value)) return null;
    visited.add(value);

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "object") {
        // Check whether items look like database/collection objects
        const first = value[0] as any;
        if (first && (first.$id || first.id || first.name)) {
          return value as any[];
        }
      }
      // Try deeper inside array items
      for (const item of value) {
        const found = check(item);
        if (found) return found;
      }
      return null;
    }

    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        const found = check(o[k]);
        if (found) return found;
      }
    }

    return null;
  }

  return check(obj) || [];
}
