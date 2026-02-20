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
 * ```
 *
 * @example Parse GstCaps
 * ```ts
 * import { parseCaps } from 'gststructure';
 *
 * const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
 * // caps.type === 'structures'
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

export {
  ParseError,
  parseStructure,
  parseStructureOrThrow,
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
