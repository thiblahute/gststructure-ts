/**
 * gststructure — Pure TypeScript parser and serializer for GStreamer Structure and Caps.
 *
 * @example Parse a GstStructure
 * ```ts
 * import { parseStructure } from 'gststructure';
 *
 * const s = parseStructure('video/x-raw, format=I420, width=1920, height=1080');
 * console.log(s?.name);                          // 'video/x-raw'
 * console.log(s?.fields.get('width'));           // { kind: 'int', value: 1920 }
 * console.log(s?.fields.get('format'));          // { kind: 'string', value: 'I420' }
 * ```
 *
 * @example Parse GstCaps
 * ```ts
 * import { parseCaps } from 'gststructure';
 *
 * const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
 * // caps.kind === 'structures'
 * // caps.entries[0].structure.name === 'video/x-raw'
 * ```
 *
 * @example Serialize back to string
 * ```ts
 * import { parseStructure, structureToString } from 'gststructure';
 *
 * const s = parseStructure('seek, start=5.0, stop=10.0')!;
 * console.log(structureToString(s));
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

export {
  ParseError,
  parseStructure,
  parseStructureOrThrow,
  parseCaps,
  parseCapsOrThrow,
} from './parser.js';

export {
  valueToString,
  valueToStringBare,
  structureToString,
  capsToString,
} from './serializer.js';
