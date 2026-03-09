import { describe, it, expect } from 'vitest';
import { sanitizeLoadedData } from '../../src/utils/sanitize';

describe('sanitizeLoadedData', () => {
    it('returns primitives unchanged', () => {
        expect(sanitizeLoadedData('hello')).toBe('hello');
        expect(sanitizeLoadedData(42)).toBe(42);
        expect(sanitizeLoadedData(true)).toBe(true);
        expect(sanitizeLoadedData(null)).toBe(null);
        expect(sanitizeLoadedData(undefined)).toBe(undefined);
    });

    it('passes through clean objects', () => {
        const input = { name: 'test', value: 123, nested: { a: 1 } };
        expect(sanitizeLoadedData(input)).toEqual(input);
    });

    it('strips __proto__ key', () => {
        const input = JSON.parse('{"name":"test","__proto__":{"admin":true}}');
        const result = sanitizeLoadedData(input) as Record<string, unknown>;
        expect(result).toEqual({ name: 'test' });
        // Use hasOwnProperty — `in` operator always returns true for __proto__
        // because it checks the prototype chain
        expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    });

    it('strips constructor key', () => {
        const input = { name: 'test', constructor: { polluted: true } };
        const result = sanitizeLoadedData(input) as Record<string, unknown>;
        expect(result).toEqual({ name: 'test' });
        expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
    });

    it('strips prototype key', () => {
        const input = { name: 'test', prototype: { evil: true } };
        const result = sanitizeLoadedData(input) as Record<string, unknown>;
        expect(result).toEqual({ name: 'test' });
    });

    it('strips dangerous keys recursively in nested objects', () => {
        const input = {
            level1: {
                __proto__: { admin: true },
                safe: 'value',
                level2: {
                    constructor: { bad: true },
                    ok: 42,
                },
            },
        };
        // Need to build this carefully to avoid JS engine interference
        const raw = JSON.parse(
            '{"level1":{"__proto__":{"admin":true},"safe":"value","level2":{"constructor":{"bad":true},"ok":42}}}'
        );
        const result = sanitizeLoadedData(raw);
        expect(result).toEqual({
            level1: {
                safe: 'value',
                level2: {
                    ok: 42,
                },
            },
        });
    });

    it('handles arrays and recurses into array elements', () => {
        const raw = JSON.parse(
            '[{"name":"a","__proto__":{"evil":true}},{"name":"b","constructor":{"bad":true}},"plain string",42]'
        );
        const result = sanitizeLoadedData(raw);
        expect(result).toEqual([
            { name: 'a' },
            { name: 'b' },
            'plain string',
            42,
        ]);
    });

    it('handles empty objects and arrays', () => {
        expect(sanitizeLoadedData({})).toEqual({});
        expect(sanitizeLoadedData([])).toEqual([]);
    });

    it('handles deeply nested arrays of objects', () => {
        const raw = JSON.parse(
            '{"filters":[{"name":"f1","__proto__":{"x":1}},{"name":"f2"}]}'
        );
        const result = sanitizeLoadedData(raw);
        expect(result).toEqual({
            filters: [{ name: 'f1' }, { name: 'f2' }],
        });
    });
});
