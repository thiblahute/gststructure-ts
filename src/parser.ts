import type {
  Caps,
  CapsEntry,
  Structure,
  Value,
} from './types.js';

// ---------------------------------------------------------------------------
// ParseError
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly pos: number,
    public readonly input: string,
  ) {
    const excerpt = input.slice(Math.max(0, pos - 10), pos + 20);
    super(`${message} at position ${pos}: ...${JSON.stringify(excerpt)}...`);
    this.name = 'ParseError';
  }
}

// ---------------------------------------------------------------------------
// Parser (low-level cursor)
// ---------------------------------------------------------------------------

class Parser {
  pos = 0;

  constructor(readonly input: string) {}

  get eof(): boolean {
    return this.pos >= this.input.length;
  }

  peek(offset = 0): string {
    return this.input[this.pos + offset] ?? '';
  }

  consume(): string {
    return this.input[this.pos++] ?? '';
  }

  /** Skip ASCII whitespace and backslash-newline line continuations. */
  skipWS(): void {
    while (!this.eof) {
      const c = this.input[this.pos];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        this.pos++;
      } else if (
        c === '\\' &&
        (this.input[this.pos + 1] === '\n' || this.input[this.pos + 1] === '\r')
      ) {
        this.pos += 2;
        // Handle \r\n
        if (this.input[this.pos] === '\n') this.pos++;
      } else {
        break;
      }
    }
  }

  tryConsume(s: string): boolean {
    if (this.input.startsWith(s, this.pos)) {
      this.pos += s.length;
      return true;
    }
    return false;
  }

  expect(s: string): void {
    if (!this.tryConsume(s)) {
      throw new ParseError(
        `Expected '${s}', got '${this.input.slice(this.pos, this.pos + 10)}'`,
        this.pos,
        this.input,
      );
    }
  }

  error(message: string): never {
    throw new ParseError(message, this.pos, this.input);
  }

  // --------------------------------------------------------------------------
  // Name parsing
  // --------------------------------------------------------------------------

  /**
   * Parse a GstStructure / GstCaps name.
   * Must start with a letter or underscore; may contain letters, digits,
   * hyphens, underscores, dots, colons, and slashes.
   */
  parseName(): string {
    const start = this.pos;
    const c = this.peek();
    if (!/[a-zA-Z_]/.test(c)) {
      this.error(`Expected name starting with a letter, got '${c}'`);
    }
    while (!this.eof && /[a-zA-Z0-9\-_.:/]/.test(this.input[this.pos])) {
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  /**
   * Parse a field name.
   * Allows letters, digits, hyphens, underscores, dots, and '::' path separators.
   */
  parseFieldName(): string {
    const start = this.pos;
    while (!this.eof) {
      const c = this.input[this.pos];
      if (/[a-zA-Z0-9\-_]/.test(c)) {
        this.pos++;
      } else if (c === ':' && this.input[this.pos + 1] === ':') {
        this.pos += 2;
      } else if (c === '.') {
        this.pos++;
      } else {
        break;
      }
    }
    const name = this.input.slice(start, this.pos);
    if (!name) this.error('Expected field name');
    return name;
  }

  /**
   * Parse a GType name (letters, digits, underscores only).
   */
  parseTypeName(): string {
    const start = this.pos;
    while (!this.eof && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  // --------------------------------------------------------------------------
  // Value parsing
  // --------------------------------------------------------------------------

  parseValue(): Value {
    const c = this.peek();
    if (c === '(') return this.parseTypedValue();
    if (c === '[') return this.parseRange();
    if (c === '{') return this.parseList();
    if (c === '<') return this.parseGstArray();
    if (c === '"') return { type: 'string', value: this.parseQuotedString() };
    return this.parseUnquoted();
  }

  parseTypedValue(): Value {
    this.expect('(');
    this.skipWS();
    const typeName = this.parseTypeName();
    if (!typeName) this.error('Expected type name inside (...)');
    this.skipWS();
    this.expect(')');
    this.skipWS();

    const lowerType = typeName.toLowerCase();

    // (GstCaps)[ ... ] – bracket syntax for inline caps (GStreamer 1.20+)
    if ((lowerType === 'gstcaps' || lowerType === 'caps') && this.peek() === '[') {
      const inner = this.extractBalanced('[', ']');
      const caps = parseCapsInner(inner);
      if (!caps) this.error(`Failed to parse caps: ${inner}`);
      return { type: 'caps', value: caps };
    }

    // Parse the raw value according to the next delimiter
    let raw: Value;
    if (this.peek() === '"') {
      raw = { type: 'string', value: this.parseQuotedString() };
    } else if (this.peek() === '[') {
      raw = this.parseRange();
    } else if (this.peek() === '{') {
      raw = this.parseList();
    } else if (this.peek() === '<') {
      raw = this.parseGstArray();
    } else {
      raw = this.parseUnquoted();
    }

    return interpretTyped(typeName, raw);
  }

  /**
   * Extract the inner content of a balanced bracket pair, consuming both delimiters.
   */
  extractBalanced(open: string, close: string): string {
    this.expect(open);
    let depth = 1;
    const start = this.pos;
    while (!this.eof && depth > 0) {
      const c = this.input[this.pos];
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) break;
      }
      this.pos++;
    }
    const content = this.input.slice(start, this.pos);
    this.expect(close);
    return content;
  }

  /** Parse a range: [ min, max ] or [ min, max, step ] */
  parseRange(): Value {
    this.expect('[');
    this.skipWS();
    const min = this.parseValue();
    this.skipWS();
    this.expect(',');
    this.skipWS();
    const max = this.parseValue();
    this.skipWS();

    let step: Value | undefined;
    if (this.peek() === ',') {
      this.pos++;
      this.skipWS();
      step = this.parseValue();
      this.skipWS();
    }

    this.expect(']');
    return { type: 'range', min, max, step };
  }

  /** Parse a GstValueList: { item, item, ... } */
  parseList(): Value {
    this.expect('{');
    const items: Value[] = [];
    this.skipWS();
    while (!this.eof && this.peek() !== '}') {
      items.push(this.parseValue());
      this.skipWS();
      if (this.peek() === ',') {
        this.pos++;
        this.skipWS();
      }
    }
    this.expect('}');
    return { type: 'list', items };
  }

  /** Parse a GstValueArray: < item, item, ... > */
  parseGstArray(): Value {
    this.expect('<');
    const items: Value[] = [];
    this.skipWS();
    while (!this.eof && this.peek() !== '>') {
      items.push(this.parseValue());
      this.skipWS();
      if (this.peek() === ',') {
        this.pos++;
        this.skipWS();
      }
    }
    this.expect('>');
    return { type: 'array', items };
  }

  /** Parse a double-quoted string, handling backslash escape sequences. */
  parseQuotedString(): string {
    this.expect('"');
    let result = '';
    while (!this.eof && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.pos++;
        const esc = this.consume();
        switch (esc) {
          case 'n':  result += '\n'; break;
          case 't':  result += '\t'; break;
          case 'r':  result += '\r'; break;
          case '"':  result += '"';  break;
          case '\\': result += '\\'; break;
          default:   result += '\\' + esc;
        }
      } else {
        result += this.consume();
      }
    }
    this.expect('"');
    return result;
  }

  /**
   * Parse an unquoted value token.
   * Terminates at comma, semicolon, closing bracket/brace/angle, or whitespace.
   * The resulting string is then type-inferred.
   */
  parseUnquoted(): Value {
    const start = this.pos;
    while (!this.eof) {
      const c = this.input[this.pos];
      if (
        c === ',' ||
        c === ';' ||
        c === ']' ||
        c === '}' ||
        c === '>' ||
        c === ' ' ||
        c === '\t' ||
        c === '\r' ||
        c === '\n'
      ) {
        break;
      }
      this.pos++;
    }
    const raw = this.input.slice(start, this.pos);
    if (!raw) this.error('Expected a value');
    return inferType(raw);
  }

  // --------------------------------------------------------------------------
  // Structure parsing
  // --------------------------------------------------------------------------

  /**
   * Parse a single GstStructure from the current position.
   * Format: name, field1=value1, field2=value2, ...[;]
   */
  parseStructure(): Structure {
    this.skipWS();
    const name = this.parseName();
    const fields = new Map<string, Value>();

    while (!this.eof) {
      this.skipWS();
      const c = this.peek();

      if (c === ';') {
        this.pos++;
        break;
      }
      if (c !== ',') break;

      this.pos++; // consume comma
      this.skipWS();

      // Trailing comma before end or semicolon
      if (this.eof) break;
      if (this.peek() === ';') {
        this.pos++;
        break;
      }

      const [fname, fvalue] = this.parseField();
      fields.set(fname, fvalue);
    }

    return { name, fields };
  }

  parseField(): [string, Value] {
    const name = this.parseFieldName();
    this.skipWS();
    this.expect('=');
    this.skipWS();
    const value = this.parseValue();
    return [name, value];
  }

  // --------------------------------------------------------------------------
  // Caps parsing
  // --------------------------------------------------------------------------

  /**
   * Parse GstCaps from the current position.
   * Format: structure1; structure2; ...
   * Each structure may have optional features: name(feature1,feature2), fields...
   */
  parseCaps(): Caps {
    this.skipWS();

    if (this.tryConsume('ANY')) {
      this.skipWS();
      return { type: 'any' };
    }
    if (this.tryConsume('EMPTY') || this.tryConsume('NONE')) {
      this.skipWS();
      return { type: 'empty' };
    }

    const entries: CapsEntry[] = [];

    while (!this.eof) {
      this.skipWS();
      if (this.eof) break;

      const name = this.parseName();
      const fields = new Map<string, Value>();
      this.skipWS();

      // Optional capability features: (feature1, feature2)
      const features: string[] = [];
      if (this.peek() === '(') {
        this.pos++;
        this.skipWS();
        while (!this.eof && this.peek() !== ')') {
          const feat = this.parseCapsFeatureName();
          if (feat) features.push(feat);
          this.skipWS();
          if (this.peek() === ',') {
            this.pos++;
            this.skipWS();
          }
        }
        this.expect(')');
        this.skipWS();
      }

      // Fields
      while (!this.eof) {
        this.skipWS();
        const c = this.peek();
        if (c === ';' || c === '') break;
        if (c !== ',') break;

        this.pos++; // consume comma
        this.skipWS();
        if (this.eof || this.peek() === ';') break;

        const [fname, fvalue] = this.parseField();
        fields.set(fname, fvalue);
      }

      entries.push({ structure: { name, fields }, features });

      this.skipWS();
      if (this.peek() === ';') {
        this.pos++;
      } else {
        break;
      }
    }

    return { type: 'structures', entries };
  }

  parseCapsFeatureName(): string {
    const start = this.pos;
    // Feature names look like "memory:DMABuf" or "GL_TEXTURE_2D"
    while (!this.eof && /[a-zA-Z0-9:_-]/.test(this.input[this.pos])) {
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

/**
 * Infer the GStreamer value type from an unquoted raw string token.
 * Mirrors GStreamer's C type-inference order: int → double → fraction → flags → boolean → string.
 */
function inferType(raw: string): Value {
  // Hexadecimal integer
  if (/^0x[0-9a-fA-F]+$/i.test(raw)) {
    return { type: 'int', value: Number(raw) };
  }

  // Integer (no decimal point or exponent)
  if (/^[+-]?[0-9]+$/.test(raw)) {
    return { type: 'int', value: parseInt(raw, 10) };
  }

  // Floating-point
  if (
    /^[+-]?(?:[0-9]+\.[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(raw) ||
    /^[+-]?[0-9]+[eE][+-]?[0-9]+$/.test(raw)
  ) {
    return { type: 'double', value: parseFloat(raw) };
  }

  // Fraction: non-negative numerator/denominator
  const fracMatch = raw.match(/^([0-9]+)\/([0-9]+)$/);
  if (fracMatch) {
    return {
      type: 'fraction',
      numerator: parseInt(fracMatch[1], 10),
      denominator: parseInt(fracMatch[2], 10),
    };
  }

  // Flags: two or more identifiers joined by '+'
  if (
    raw.includes('+') &&
    /^[a-zA-Z_][a-zA-Z0-9_-]*(\+[a-zA-Z_][a-zA-Z0-9_-]*)+$/.test(raw)
  ) {
    return { type: 'flags', flags: raw.split('+') };
  }

  // Boolean keywords (case-insensitive)
  if (/^(true|false|yes|no|t|f)$/i.test(raw)) {
    const low = raw.toLowerCase();
    return {
      type: 'boolean',
      value: low === 'true' || low === 'yes' || low === 't',
    };
  }

  // Fallback: unquoted string
  return { type: 'string', value: raw };
}

// ---------------------------------------------------------------------------
// Typed-value interpretation
// ---------------------------------------------------------------------------

/**
 * Re-interpret a raw parsed value given an explicit GType name.
 * Handles all common GStreamer type aliases.
 */
function interpretTyped(typeName: string, raw: Value): Value {
  const n = typeName.toLowerCase();

  if (
    [
      'int', 'gint', 'uint', 'guint',
      'gint8', 'gint16', 'gint32', 'gint64',
      'guint8', 'guint16', 'guint32', 'guint64',
      'int64', 'uint64',
    ].includes(n)
  ) {
    return coerceInt(raw);
  }

  if (['double', 'gdouble', 'float', 'gfloat'].includes(n)) {
    return coerceDouble(raw);
  }

  if (['boolean', 'gboolean', 'bool'].includes(n)) {
    return coerceBool(raw);
  }

  if (['string', 'gchararray'].includes(n)) {
    return coerceString(raw);
  }

  if (['bitmask', 'gstbitmask'].includes(n)) {
    return coerceBitmask(raw);
  }

  if (['fraction', 'gstfraction'].includes(n)) {
    // Already parsed as fraction if correctly formed
    return raw;
  }

  if (['gstcaps', 'caps'].includes(n)) {
    return coerceCaps(raw);
  }

  if (n === 'gststructure') {
    return coerceStructure(raw);
  }

  // Unknown/unrecognised type – preserve the type name for the caller
  return { type: 'typed', typeName, value: raw };
}

function coerceInt(v: Value): Value {
  if (v.type === 'int') return v;
  if (v.type === 'double') return { type: 'int', value: Math.trunc(v.value) };
  if (v.type === 'boolean') return { type: 'int', value: v.value ? 1 : 0 };
  if (v.type === 'string') {
    const s = v.value;
    const n = s.startsWith('0x') || s.startsWith('0X')
      ? parseInt(s, 16)
      : parseInt(s, 10);
    return { type: 'int', value: n };
  }
  return v;
}

function coerceDouble(v: Value): Value {
  if (v.type === 'double') return v;
  if (v.type === 'int') return { type: 'double', value: v.value };
  if (v.type === 'string') return { type: 'double', value: parseFloat(v.value) };
  return v;
}

function coerceBool(v: Value): Value {
  if (v.type === 'boolean') return v;
  if (v.type === 'int') return { type: 'boolean', value: v.value !== 0 };
  if (v.type === 'string') {
    const low = v.value.toLowerCase();
    return {
      type: 'boolean',
      value: low === 'true' || low === 'yes' || low === 't' || low === '1',
    };
  }
  return v;
}

function coerceString(v: Value): Value {
  if (v.type === 'string') return v;
  if (v.type === 'int') return { type: 'string', value: String(v.value) };
  if (v.type === 'double') return { type: 'string', value: String(v.value) };
  if (v.type === 'boolean') return { type: 'string', value: String(v.value) };
  return v;
}

function coerceBitmask(v: Value): Value {
  if (v.type === 'bitmask') return v;
  if (v.type === 'int') return { type: 'bitmask', value: BigInt(v.value) };
  if (v.type === 'string') {
    try {
      const s = v.value;
      const n = s.startsWith('0x') || s.startsWith('0X')
        ? BigInt(s)
        : BigInt(s);
      return { type: 'bitmask', value: n };
    } catch {
      return v;
    }
  }
  return v;
}

function coerceCaps(v: Value): Value {
  if (v.type === 'caps') return v;
  if (v.type === 'string') {
    const caps = parseCapsInner(v.value);
    if (caps) return { type: 'caps', value: caps };
  }
  return v;
}

function coerceStructure(v: Value): Value {
  if (v.type === 'structure') return v;
  if (v.type === 'string') {
    const s = parseStructureInner(v.value);
    if (s) return { type: 'structure', value: s };
  }
  return v;
}

// ---------------------------------------------------------------------------
// Internal helpers (used by coerce functions above)
// ---------------------------------------------------------------------------

function parseStructureInner(s: string): Structure | null {
  try {
    const p = new Parser(s);
    const result = p.parseStructure();
    return result;
  } catch {
    return null;
  }
}

function parseCapsInner(s: string): Caps | null {
  try {
    const p = new Parser(s);
    const result = p.parseCaps();
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a GstStructure string.
 *
 * @example
 * ```ts
 * const s = parseStructure('video/x-raw, format=I420, width=1920, height=1080');
 * // s?.name === 'video/x-raw'
 * // s?.fields.get('width') → { type: 'int', value: 1920 }
 * ```
 *
 * @returns The parsed Structure, or `null` if the string is invalid.
 */
export function parseStructure(s: string): Structure | null {
  if (!s || !s.trim()) return null;
  try {
    const p = new Parser(s.trim());
    const result = p.parseStructure();
    // Warn if there is unconsumed input
    p.skipWS();
    if (!p.eof) {
      // Not an error, but there is trailing data (could be multiple structures)
    }
    return result;
  } catch {
    return null;
  }
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
    const p = new Parser(s.trim());
    return p.parseCaps();
  } catch {
    return null;
  }
}

/**
 * Parse a GstStructure string, throwing on failure.
 *
 * @throws {ParseError} if the string cannot be parsed.
 */
export function parseStructureOrThrow(s: string): Structure {
  const p = new Parser(s.trim());
  return p.parseStructure();
}

/**
 * Parse a GstCaps string, throwing on failure.
 *
 * @throws {ParseError} if the string cannot be parsed.
 */
export function parseCapsOrThrow(s: string): Caps {
  const p = new Parser(s.trim());
  return p.parseCaps();
}
