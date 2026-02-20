import type { Structure, Value } from './types.js';
import { Parser, ParseError } from './_parser.js';
import { structureToString } from './serializer.js';

// ---------------------------------------------------------------------------
// Value unwrapping
// ---------------------------------------------------------------------------

/**
 * Unwrap a typed `Value` to its plain JavaScript primitive or object.
 *
 * | Value type  | Returns                                      |
 * |-------------|----------------------------------------------|
 * | int/double  | `number`                                     |
 * | string      | `string`                                     |
 * | boolean     | `boolean`                                    |
 * | bitmask     | `bigint`                                     |
 * | fraction    | `{ numerator: number; denominator: number }` |
 * | flags       | `string[]`                                   |
 * | list/array  | `unknown[]` (recursively unwrapped)          |
 * | range       | `{ min, max, step? }` (unwrapped)            |
 * | structure   | `GstStructure`                               |
 * | caps        | `Caps` (kept as-is)                          |
 * | typed       | unwrapped inner value                        |
 */
export function unwrapValue(v: Value): unknown {
  switch (v.type) {
    case 'int':     return v.value;
    case 'double':  return v.value;
    case 'string':  return v.value;
    case 'boolean': return v.value;
    case 'bitmask': return v.value;
    case 'fraction': return { numerator: v.numerator, denominator: v.denominator };
    case 'flags':   return v.flags.slice();
    case 'list':    return v.items.map(unwrapValue);
    case 'array':   return v.items.map(unwrapValue);
    case 'range':   return {
      min: unwrapValue(v.min),
      max: unwrapValue(v.max),
      ...(v.step != null && { step: unwrapValue(v.step) }),
    };
    case 'structure': return new GstStructure(v.value.name, v.value.fields);
    case 'caps':    return v.value;
    case 'typed':   return unwrapValue(v.value);
  }
}

// ---------------------------------------------------------------------------
// GstStructure class
// ---------------------------------------------------------------------------

/**
 * A GstStructure with dict-like and map-like field access.
 *
 * Fields can be accessed by name using bracket notation, returning plain
 * JavaScript values (numbers, strings, booleans, etc.) without the typed
 * wrapper.  For the full typed `Value` object use `getTyped()` instead.
 *
 * @example
 * ```ts
 * const s = GstStructure.fromString('video/x-raw, format=I420, width=1920');
 * s['width']   // → 1920  (number)
 * s['format']  // → 'I420' (string)
 * s.name       // → 'video/x-raw'
 *
 * // Safe access for any key, including those that clash with class properties
 * s.get('name')   // → value of the 'name' field, not the structure type name
 * s.get('width')  // → 1920
 *
 * // Enumerate and iterate fields
 * [...s.keys()]   // → ['format', 'width']
 * for (const [k, v] of s) console.log(k, v);
 *
 * // Typed access when you need the full value object
 * s.getTyped('width') // → { type: 'int', value: 1920 }
 * ```
 *
 * Field names that clash with class properties (`name`, `fields`, `get`,
 * `keys`, `getTyped`, `toString`) must be accessed via `get()` or `getTyped()`.
 */
export class GstStructure implements Structure {
  readonly name: string;
  readonly fields: Map<string, Value>;

  // Index signature so s['fieldName'] is valid TypeScript
  [key: string]: unknown;

  constructor(name: string, fields: Map<string, Value>) {
    this.name = name;
    this.fields = fields;

    return new Proxy(this, {
      get(target, prop, receiver) {
        // Own / inherited properties (name, fields, methods, …) take precedence
        if (typeof prop === 'string' && !(prop in target)) {
          const v = target.fields.get(prop);
          if (v !== undefined) return unwrapValue(v);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /**
   * Parse a GstStructure string, returning a GstStructure instance.
   * @throws {ParseError} if the string is invalid.
   */
  static fromString(s: string): GstStructure {
    const p = new Parser(s.trim());
    const { name, fields } = p.parseStructure();
    return new GstStructure(name, fields);
  }

  /**
   * Returns the unwrapped value for the given field, or `undefined` if not
   * present.  Unlike bracket notation, this always reads from `fields` and
   * therefore works correctly for field names that clash with class properties
   * (e.g. a field named `"name"`).
   */
  get(key: string): unknown {
    const v = this.fields.get(key);
    return v !== undefined ? unwrapValue(v) : undefined;
  }

  /**
   * Returns an iterator over the field names of this structure, in insertion
   * order — equivalent to `this.fields.keys()`.
   */
  keys(): IterableIterator<string> {
    return this.fields.keys();
  }

  /**
   * Returns an iterator over `[key, unwrappedValue]` pairs, in insertion
   * order — equivalent to iterating `this.fields.entries()` with each value
   * unwrapped.
   */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    const iter = this.fields.entries();
    return {
      next(): IteratorResult<[string, unknown]> {
        const { value, done } = iter.next();
        if (done) return { value: undefined as unknown as [string, unknown], done: true };
        return { value: [value[0], unwrapValue(value[1])], done: false };
      },
    };
  }

  /**
   * Returns the typed `Value` for the given field, or `undefined` if not present.
   * Use this when you need the full type information (e.g. distinguishing
   * an integer from a double).
   */
  getTyped(key: string): Value | undefined {
    return this.fields.get(key);
  }

  /** Serialize back to a GstStructure string. */
  toString(): string {
    return structureToString(this);
  }
}

export { ParseError };
