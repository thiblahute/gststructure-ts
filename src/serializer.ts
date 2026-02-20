import type { Caps, Structure, Value } from './types.js';

// ---------------------------------------------------------------------------
// Value serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a Value back to its GStreamer string representation.
 * Mirrors gst_value_serialize() / gst_structure_to_string() output.
 */
export function valueToString(v: Value): string {
  switch (v.kind) {
    case 'int':
      return `(int)${v.value}`;

    case 'double': {
      // Always include a decimal point to distinguish from int
      const s = v.value.toString();
      return `(double)${s.includes('.') || s.includes('e') ? s : s + '.0'}`;
    }

    case 'string':
      return `"${escapeString(v.value)}"`;

    case 'boolean':
      return `(boolean)${v.value ? 'true' : 'false'}`;

    case 'fraction':
      return `(fraction)${v.numerator}/${v.denominator}`;

    case 'bitmask':
      return `(bitmask)0x${v.value.toString(16)}`;

    case 'flags':
      return v.flags.join('+');

    case 'list':
      return `{ ${v.items.map(valueToString).join(', ')} }`;

    case 'array':
      return `< ${v.items.map(valueToString).join(', ')} >`;

    case 'range':
      return v.step != null
        ? `[ ${valueToString(v.min)}, ${valueToString(v.max)}, ${valueToString(v.step)} ]`
        : `[ ${valueToString(v.min)}, ${valueToString(v.max)} ]`;

    case 'structure':
      return `(GstStructure)"${escapeString(structureToString(v.value))};"`;

    case 'caps':
      return `(GstCaps)"${escapeString(capsToString(v.value))}"`;

    case 'typed':
      return `(${v.typeName})${valueToString(v.value)}`;
  }
}

/**
 * Like valueToString but omits the explicit type prefix for simple scalar values
 * (int, double, boolean, fraction).  Useful when the type can be inferred from context.
 */
export function valueToStringBare(v: Value): string {
  switch (v.kind) {
    case 'int':     return String(v.value);
    case 'double': {
      const s = v.value.toString();
      return s.includes('.') || s.includes('e') ? s : s + '.0';
    }
    case 'boolean': return v.value ? 'true' : 'false';
    case 'fraction': return `${v.numerator}/${v.denominator}`;
    default:        return valueToString(v);
  }
}

// ---------------------------------------------------------------------------
// Structure serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a GstStructure to its canonical string form.
 *
 * @example
 * ```ts
 * structureToString({ name: 'video/x-raw', fields: new Map([['width', { kind: 'int', value: 1920 }]]) })
 * // → 'video/x-raw, width=(int)1920'
 * ```
 */
export function structureToString(s: Structure): string {
  const parts: string[] = [s.name];
  for (const [key, value] of s.fields) {
    parts.push(`${key}=${valueToString(value)}`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Caps serialization
// ---------------------------------------------------------------------------

/**
 * Serialize GstCaps to its string representation.
 *
 * @example
 * ```ts
 * capsToString({ kind: 'any' })               // → 'ANY'
 * capsToString({ kind: 'empty' })             // → 'EMPTY'
 * capsToString({ kind: 'structures', entries: [...] }) // → 'video/x-raw, ...'
 * ```
 */
export function capsToString(caps: Caps): string {
  if (caps.kind === 'any') return 'ANY';
  if (caps.kind === 'empty') return 'EMPTY';

  return caps.entries
    .map(({ structure, features }) => {
      let result = structure.name;
      if (features.length > 0) {
        result += `(${features.join(', ')})`;
      }
      for (const [key, value] of structure.fields) {
        result += `, ${key}=${valueToString(value)}`;
      }
      return result;
    })
    .join('; ');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}
