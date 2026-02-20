import type { Caps } from './types.js';
import { Parser, ParseError } from './_parser.js';
import { GstStructure } from './structure.js';

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
 * Parse a GstCaps string.
 *
 * Handles the special strings "ANY", "EMPTY", and "NONE", as well as
 * one or more structures separated by semicolons.
 *
 * @example
 * ```ts
 * const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
 * // caps?.type === 'structures'
 * // caps?.entries[0].structure.name === 'video/x-raw'
 * ```
 *
 * @returns The parsed Caps, or `null` if the string is invalid.
 */
export function parseCaps(s: string): Caps | null {
  if (!s || !s.trim()) return null;
  try {
    return new Parser(s.trim()).parseCaps();
  } catch {
    return null;
  }
}

/**
 * Parse a GstCaps string, throwing `ParseError` on failure.
 */
export function parseCapsOrThrow(s: string): Caps {
  return new Parser(s.trim()).parseCaps();
}
