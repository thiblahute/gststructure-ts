/**
 * All possible value kinds in GStreamer serialization format.
 *
 * Type inference order (when no explicit type is given):
 *   int → double → fraction → flags → boolean → string
 */
export type Value =
  | IntValue
  | DoubleValue
  | StringValue
  | BooleanValue
  | FractionValue
  | BitmaskValue
  | FlagsValue
  | ListValue
  | ArrayValue
  | RangeValue
  | StructureValue
  | CapsValue
  | TypedValue;

/** A GLib integer (gint, guint, gint64, etc.) */
export interface IntValue {
  kind: 'int';
  value: number;
}

/** A GLib floating-point number (gdouble, gfloat) */
export interface DoubleValue {
  kind: 'double';
  value: number;
}

/** A GLib string (gchararray) */
export interface StringValue {
  kind: 'string';
  value: string;
}

/** A GLib boolean (gboolean) */
export interface BooleanValue {
  kind: 'boolean';
  value: boolean;
}

/** A GstFraction value (numerator/denominator) */
export interface FractionValue {
  kind: 'fraction';
  numerator: number;
  denominator: number;
}

/** A GstBitmask value (64-bit bitmask, stored as BigInt) */
export interface BitmaskValue {
  kind: 'bitmask';
  value: bigint;
}

/** A flags value (flag1+flag2+flag3) */
export interface FlagsValue {
  kind: 'flags';
  flags: string[];
}

/** A GstValueList: { item1, item2, ... } */
export interface ListValue {
  kind: 'list';
  items: Value[];
}

/** A GstValueArray: < item1, item2, ... > */
export interface ArrayValue {
  kind: 'array';
  items: Value[];
}

/** A range value: [ min, max ] or [ min, max, step ] */
export interface RangeValue {
  kind: 'range';
  min: Value;
  max: Value;
  step?: Value;
}

/** A nested GstStructure */
export interface StructureValue {
  kind: 'structure';
  value: Structure;
}

/** A nested GstCaps */
export interface CapsValue {
  kind: 'caps';
  value: Caps;
}

/** A value with an explicit type name that wasn't fully interpreted */
export interface TypedValue {
  kind: 'typed';
  typeName: string;
  value: Value;
}

/**
 * A GstStructure: a named collection of key/value fields.
 *
 * The name starts with a letter and may contain letters, digits,
 * hyphens, underscores, dots, colons, and slashes (e.g. "video/x-raw").
 */
export interface Structure {
  name: string;
  fields: Map<string, Value>;
}

/** A single entry in a GstCaps: one structure with optional capability features */
export interface CapsEntry {
  structure: Structure;
  /** Capability features, e.g. ["memory:DMABuf"] */
  features: string[];
}

/**
 * GstCaps: describes the set of possible media types.
 *
 * - `any`        → matches anything (serialized as "ANY")
 * - `empty`      → matches nothing (serialized as "EMPTY")
 * - `structures` → one or more structures, each describing a media type
 */
export type Caps =
  | { kind: 'any' }
  | { kind: 'empty' }
  | { kind: 'structures'; entries: CapsEntry[] };
