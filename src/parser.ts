import { Parser, ParseError } from './_parser.js';
import { GstStructure } from './structure.js';
import { GstCaps } from './caps.js';

export { ParseError };

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
  if (!s || !s.trim()) return null;
  try {
    return GstStructure.fromString(s);
  } catch {
    return null;
  }
}

/**
 * Parse a GstStructure string, throwing `ParseError` on failure.
 */
export function parseStructureOrThrow(s: string): GstStructure {
  return GstStructure.fromString(s);
}

/**
 * Parse a GstCaps string, returning a `GstCaps` with array-like access.
 * Returns `null` if the string is invalid.
 *
 * @example
 * ```ts
 * const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
 * caps![0]['format']  // → 'I420'
 * caps![1].name       // → 'audio/x-raw'
 * caps!.length        // → 2
 * ```
 */
export function parseCaps(s: string): GstCaps | null {
  if (!s || !s.trim()) return null;
  try {
    return GstCaps.fromString(s);
  } catch {
    return null;
  }
}

/**
 * Parse a GstCaps string, throwing `ParseError` on failure.
 */
export function parseCapsOrThrow(s: string): GstCaps {
  return GstCaps.fromString(s);
}
