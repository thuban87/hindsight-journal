/**
 * Sanitize Utility
 *
 * Strips dangerous prototype pollution keys from deserialized objects.
 * Called from migrateSettings() and saved filter deserialization.
 */

/** Keys that enable prototype pollution attacks */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strip `__proto__`, `constructor`, and `prototype` keys
 * from any deserialized object. Also recurses into array elements.
 *
 * @param obj - Raw deserialized data (e.g., from JSON.parse or loadData)
 * @returns Cleaned copy with dangerous keys removed
 */
export function sanitizeLoadedData(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
        return obj.map(sanitizeLoadedData);
    }

    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (DANGEROUS_KEYS.has(key)) continue;
        clean[key] = sanitizeLoadedData((obj as Record<string, unknown>)[key]);
    }
    return clean;
}
