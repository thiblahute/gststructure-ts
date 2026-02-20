/**
 * gststructure — Pure TypeScript parser and serializer for GStreamer Structure and Caps.
 *
 * @example Parse a GstStructure with dict-like access
 * ```ts
 * import { GstStructure } from 'gststructure';
 *
 * const s = GstStructure.fromString('video/x-raw, format=I420, width=1920, height=1080');
 * s['width']   // → 1920
 * s['format']  // → 'I420'
 * s.name       // → 'video/x-raw'
 *
 * // Or via parseStructure
 * import { parseStructure } from 'gststructure';
 * const s2 = parseStructure('seek, start=5.0')!;
 * s2['start']  // → 5.0
 * ```
 *
 * @example Parse GstCaps
 * ```ts
 * import { parseCaps } from 'gststructure';
 *
 * const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
 * // caps.type === 'structures'
 * // caps.entries[0].structure.name === 'video/x-raw'
 * ```
 *
 * @example Serialize back to string
 * ```ts
 * import { GstStructure } from 'gststructure';
 *
 * const s = GstStructure.fromString('seek, start=5.0, stop=10.0');
 * console.log(s.toString());
 * // 'seek, start=(double)5.0, stop=(double)10.0'
 * ```
 *
 * @module
 */

export type {
  Caps,
  CapsEntry,
  Structure,
  Value,
  IntValue,
  DoubleValue,
  StringValue,
  BooleanValue,
  FractionValue,
  BitmaskValue,
  FlagsValue,
  ListValue,
  ArrayValue,
  RangeValue,
  StructureValue,
  CapsValue,
  TypedValue,
} from './types.js';

export { ParseError } from './parser.js';

export {
  parseCaps,
  parseCapsOrThrow,
} from './parser.js';

export {
  GstStructure,
  unwrapValue,
} from './structure.js';

export {
  valueToString,
  valueToStringBare,
  structureToString,
  capsToString,
} from './serializer.js';

// ---------------------------------------------------------------------------
// parseStructure / parseStructureOrThrow returning GstStructure
// ---------------------------------------------------------------------------

import {
  parseStructure as _parseStructure,
  parseStructureOrThrow as _parseStructureOrThrow,
} from './parser.js';
import { GstStructure } from './structure.js';

/**
 * Parse a GstStructure string, returning a `GstStructure` with dict-like field access.
 * Returns `null` if the string is invalid.
 *
 * @example
 * ```ts
 * const s = parseStructure('seek, start=5.0, flags=flush+accurate');
 * s!['start']  // → 5.0
 * s!['flags']  // → ['flush', 'accurate']
 * ```
 */
export function parseStructure(s: string): GstStructure | null {
  const result = _parseStructure(s);
  if (!result) return null;
  return new GstStructure(result.name, result.fields);
}

/**
 * Parse a GstStructure string, throwing `ParseError` on failure.
 */
export function parseStructureOrThrow(s: string): GstStructure {
  const result = _parseStructureOrThrow(s);
  return new GstStructure(result.name, result.fields);
}
