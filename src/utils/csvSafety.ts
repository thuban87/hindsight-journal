/**
 * CSV Safety
 *
 * Sanitization utilities to prevent CSV formula injection (OWASP guidelines).
 * Two-step architecture:
 * - sanitizeValue(): steps 1-3 (coerce, numeric bypass, dangerous prefix)
 * - sanitizeCsvCell(): wraps sanitizeValue, handles arrays/objects, applies
 *   step 4 (quote-escape) exactly once on the final string.
 *
 * This is a centralized utility — all CSV generation must use it.
 */

/**
 * Dangerous leading characters that could trigger formula execution in
 * spreadsheet applications.
 */
const DANGEROUS_PREFIXES = new Set(['=', '+', '-', '@', '|', '\t', '\r', '\n']);

/**
 * Sanitize a single string value (steps 1-3 only).
 * Used for individual array elements before joining.
 *
 * Steps:
 * 1. (Caller handles coercion to string)
 * 2. Numeric bypass: if the string is a valid number, skip sanitization
 * 3. Dangerous prefix check + mid-cell tab/CR replacement
 */
function sanitizeValue(str: string): string {
    // Step 2: Numeric bypass — valid numbers can never be formulas
    if (str.trim() !== '' && !isNaN(Number(str))) {
        return str;
    }

    // Step 3: Dangerous character sanitization
    let result = str;
    const firstNonWhitespace = result.trimStart().charAt(0);
    if (DANGEROUS_PREFIXES.has(firstNonWhitespace)) {
        result = "'" + result;
    }

    // Step 3.5: Mid-cell sanitization — replace tabs with spaces,
    // carriage returns with empty string in ALL values
    result = result.replace(/\t/g, ' ').replace(/\r/g, '');

    return result;
}

/**
 * Sanitize a single CSV cell value to prevent formula injection.
 * Accepts `unknown` type — handles numbers, booleans, null/undefined, arrays,
 * and objects by converting to string internally before sanitization.
 *
 * @param value - Any value to be placed in a CSV cell
 * @returns Sanitized, double-quoted string safe for CSV output
 */
export function sanitizeCsvCell(value: unknown): string {
    let str: string;

    // Step 1: Coerce to string
    if (value === null || value === undefined) {
        str = '';
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        str = value.toString();
    } else if (Array.isArray(value)) {
        // Sanitize each element individually, then join
        str = value
            .map(element => {
                if (element === null || element === undefined) return '';
                const elementStr = typeof element === 'object'
                    ? JSON.stringify(element)
                    : String(element);
                return sanitizeValue(elementStr);
            })
            .join('; ');
    } else if (typeof value === 'object') {
        str = JSON.stringify(value);
    } else {
        str = String(value);
    }

    // For non-array values, apply sanitizeValue
    if (!Array.isArray(value)) {
        str = sanitizeValue(str);
    }

    // Step 4: Quote-escape — escape internal double quotes and wrap
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
}
