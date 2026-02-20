import type { Caps, CapsEntry } from './types.js';
import { Parser } from './_parser.js';
import { GstStructure } from './structure.js';
import { capsToString } from './serializer.js';

/**
 * GstCaps with array-like access to its structures.
 *
 * Each element is a `GstStructure`, accessible by numeric index.
 * The class is also iterable, so you can use `for...of`.
 *
 * @example
 * ```ts
 * const caps = GstCaps.fromString('video/x-raw, format=I420; audio/x-raw, rate=44100');
 *
 * caps.length     // → 2
 * caps[0].name    // → 'video/x-raw'
 * caps[0]['format'] // → 'I420'
 * caps[1]['rate']   // → 44100
 *
 * for (const s of caps) console.log(s.name);
 *
 * // Special caps
 * GstCaps.fromString('ANY').isAny    // → true
 * GstCaps.fromString('EMPTY').isEmpty // → true
 * ```
 */
export class GstCaps {
  /** True if this represents ANY caps (matches everything). */
  readonly isAny: boolean;
  /** True if this represents EMPTY / NONE caps (matches nothing). */
  readonly isEmpty: boolean;

  // Numeric index signature: caps[0], caps[1], …
  [index: number]: GstStructure | undefined;

  private readonly _entries: CapsEntry[];
  private readonly _raw: Caps;

  constructor(caps: Caps) {
    this._raw = caps;
    this.isAny   = caps.type === 'any';
    this.isEmpty = caps.type === 'empty';
    this._entries = caps.type === 'structures' ? caps.entries : [];

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          const n = Number(prop);
          if (Number.isInteger(n) && n >= 0 && String(n) === prop) {
            const entry = target._entries[n];
            return entry
              ? new GstStructure(entry.structure.name, entry.structure.fields)
              : undefined;
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /** Number of structures in this caps. */
  get length(): number {
    return this._entries.length;
  }

  /**
   * Returns the capability features for the structure at `index`,
   * e.g. `['memory:DMABuf']`.
   */
  getFeatures(index: number): string[] {
    return this._entries[index]?.features.slice() ?? [];
  }

  [Symbol.iterator](): Iterator<GstStructure> {
    const entries = this._entries;
    let i = 0;
    return {
      next(): IteratorResult<GstStructure> {
        if (i < entries.length) {
          const { structure } = entries[i++];
          return { value: new GstStructure(structure.name, structure.fields), done: false };
        }
        return { value: undefined as unknown as GstStructure, done: true };
      },
    };
  }

  /**
   * Parse a GstCaps string, returning a GstCaps instance.
   * @throws {ParseError} if the string is invalid.
   */
  static fromString(s: string): GstCaps {
    const caps = new Parser(s.trim()).parseCaps();
    return new GstCaps(caps);
  }

  /** Serialize back to a GstCaps string. */
  toString(): string {
    return capsToString(this._raw);
  }
}
