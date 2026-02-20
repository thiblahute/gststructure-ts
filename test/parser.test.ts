import { describe, it, expect } from 'vitest';
import {
  structureToString,
  capsToString,
  valueToString,
  GstStructure,
  GstCaps,
  unwrapValue,
  ParseError,
  type Value,
  type Structure,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function field(s: Structure, name: string): Value {
  const v = s.fields.get(name);
  if (!v) throw new Error(`Field '${name}' not found in structure`);
  return v;
}

// ---------------------------------------------------------------------------
// Structure: basic name parsing
// ---------------------------------------------------------------------------

describe('Structure – basic names', () => {
  it('parses a bare name with no fields', () => {
    const s = GstStructure.fromString('play');
    expect(s).not.toBeNull();
    expect(s!.name).toBe('play');
    expect(s!.fields.size).toBe(0);
  });

  it('parses a bare name followed by semicolon', () => {
    const s = GstStructure.fromString('play;');
    expect(s!.name).toBe('play');
    expect(s!.fields.size).toBe(0);
  });

  it('parses a caps-style media-type name (slash)', () => {
    const s = GstStructure.fromString('video/x-raw');
    expect(s!.name).toBe('video/x-raw');
  });

  it('parses a hyphenated name', () => {
    const s = GstStructure.fromString('set-property, name=foo, value=(int)42');
    expect(s!.name).toBe('set-property');
  });

  it('throws ParseError for an empty string', () => {
    expect(() => GstStructure.fromString('')).toThrow(ParseError);
    expect(() => GstStructure.fromString('   ')).toThrow(ParseError);
  });
});

// ---------------------------------------------------------------------------
// Structure: integer fields
// ---------------------------------------------------------------------------

describe('Structure – integer values', () => {
  it('parses a positive integer', () => {
    const s = GstStructure.fromString('seek, start=5');
    expect(field(s!, 'start')).toEqual({ type: 'int', value: 5 });
  });

  it('parses a negative integer', () => {
    const s = GstStructure.fromString('foo, x=-42');
    expect(field(s!, 'x')).toEqual({ type: 'int', value: -42 });
  });

  it('parses a hex number (0x prefix) as int', () => {
    const s = GstStructure.fromString('foo, v=0xFF');
    expect(field(s!, 'v')).toEqual({ type: 'int', value: 255 });
  });

  it('parses an explicitly typed int', () => {
    const s = GstStructure.fromString('foo, v=(int)42');
    expect(field(s!, 'v')).toEqual({ type: 'int', value: 42 });
  });

  it('parses an explicitly typed gint64', () => {
    const s = GstStructure.fromString('foo, n=(gint64)9000000000');
    expect(field(s!, 'n')).toEqual({ type: 'int', value: 9000000000 });
  });
});

// ---------------------------------------------------------------------------
// Structure: floating-point fields
// ---------------------------------------------------------------------------

describe('Structure – double values', () => {
  it('parses a positive float', () => {
    const s = GstStructure.fromString('seek, start=5.0');
    expect(field(s!, 'start')).toEqual({ type: 'double', value: 5.0 });
  });

  it('parses a float with only fractional part', () => {
    const s = GstStructure.fromString('foo, x=.5');
    expect(field(s!, 'x')).toEqual({ type: 'double', value: 0.5 });
  });

  it('parses a negative float', () => {
    const s = GstStructure.fromString('foo, x=-3.14');
    expect(field(s!, 'x')).toEqual({ type: 'double', value: -3.14 });
  });

  it('parses an explicitly typed float', () => {
    const s = GstStructure.fromString('set-property, value=(float)1.0');
    expect(field(s!, 'value')).toEqual({ type: 'double', value: 1.0 });
  });

  it('parses an explicitly typed double', () => {
    const s = GstStructure.fromString('foo, d=(double)2.718');
    expect(field(s!, 'd')).toEqual({ type: 'double', value: 2.718 });
  });

  it('coerces (double) from int token', () => {
    const s = GstStructure.fromString('foo, d=(double)3');
    expect(field(s!, 'd')).toEqual({ type: 'double', value: 3 });
  });
});

// ---------------------------------------------------------------------------
// Structure: boolean fields
// ---------------------------------------------------------------------------

describe('Structure – boolean values', () => {
  it('parses true', () => {
    const s = GstStructure.fromString('meta, handles-states=true');
    expect(field(s!, 'handles-states')).toEqual({ type: 'boolean', value: true });
  });

  it('parses false', () => {
    const s = GstStructure.fromString('meta, seek=false');
    expect(field(s!, 'seek')).toEqual({ type: 'boolean', value: false });
  });

  it('parses yes/no aliases', () => {
    const s = GstStructure.fromString('meta, a=yes, b=NO');
    expect(field(s!, 'a')).toEqual({ type: 'boolean', value: true });
    expect(field(s!, 'b')).toEqual({ type: 'boolean', value: false });
  });

  it('parses t/f aliases (case insensitive)', () => {
    const s = GstStructure.fromString('meta, c=t, d=F');
    expect(field(s!, 'c')).toEqual({ type: 'boolean', value: true });
    expect(field(s!, 'd')).toEqual({ type: 'boolean', value: false });
  });

  it('parses explicitly typed bool with numeric 1/0', () => {
    const s = GstStructure.fromString('meta, enabled=(bool)1, disabled=(bool)0');
    expect(field(s!, 'enabled')).toEqual({ type: 'boolean', value: true });
    expect(field(s!, 'disabled')).toEqual({ type: 'boolean', value: false });
  });
});

// ---------------------------------------------------------------------------
// Structure: string fields
// ---------------------------------------------------------------------------

describe('Structure – string values', () => {
  it('parses a quoted string', () => {
    const s = GstStructure.fromString('checkpoint, text="Hello World"');
    expect(field(s!, 'text')).toEqual({ type: 'string', value: 'Hello World' });
  });

  it('handles escape sequences in quoted strings', () => {
    const s = GstStructure.fromString('foo, s="line1\\nline2"');
    expect(field(s!, 's')).toEqual({ type: 'string', value: 'line1\nline2' });
  });

  it('handles escaped quotes inside quoted strings', () => {
    const s = GstStructure.fromString('foo, s="say \\"hi\\""');
    expect(field(s!, 's')).toEqual({ type: 'string', value: 'say "hi"' });
  });

  it('parses an unquoted string (fallback)', () => {
    const s = GstStructure.fromString('foo, format=I420');
    expect(field(s!, 'format')).toEqual({ type: 'string', value: 'I420' });
  });

  it('parses unquoted string with colon (e.g. pad reference)', () => {
    const s = GstStructure.fromString('config, sink=videosink:sink');
    expect(field(s!, 'sink')).toEqual({ type: 'string', value: 'videosink:sink' });
  });

  it('parses explicitly typed (string) coercion', () => {
    const s = GstStructure.fromString('foo, field-is-string=(string)true');
    expect(field(s!, 'field-is-string')).toEqual({ type: 'string', value: 'true' });
  });
});

// ---------------------------------------------------------------------------
// Structure: fraction fields
// ---------------------------------------------------------------------------

describe('Structure – fraction values', () => {
  it('parses a fraction', () => {
    const s = GstStructure.fromString('set-property, framerate=30/1');
    expect(field(s!, 'framerate')).toEqual({ type: 'fraction', numerator: 30, denominator: 1 });
  });

  it('parses an explicitly typed fraction', () => {
    const s = GstStructure.fromString('foo, f=(fraction)1/2');
    expect(field(s!, 'f')).toEqual({ type: 'fraction', numerator: 1, denominator: 2 });
  });
});

// ---------------------------------------------------------------------------
// Structure: bitmask fields
// ---------------------------------------------------------------------------

describe('Structure – bitmask values', () => {
  it('parses an explicitly typed bitmask', () => {
    const s = GstStructure.fromString('set-caps, mask=(bitmask)0x67');
    expect(field(s!, 'mask')).toEqual({ type: 'bitmask', value: 0x67n });
  });
});

// ---------------------------------------------------------------------------
// Structure: flags fields
// ---------------------------------------------------------------------------

describe('Structure – flags values', () => {
  it('parses a single-flag (bare identifier treated as string, not flag)', () => {
    const s = GstStructure.fromString('seek, flags=accurate');
    // A single word without '+' is a plain string
    expect(field(s!, 'flags')).toEqual({ type: 'string', value: 'accurate' });
  });

  it('parses multiple flags joined by +', () => {
    const s = GstStructure.fromString('seek, start=5.0, stop=10.0, flags=flush+accurate');
    expect(field(s!, 'flags')).toEqual({ type: 'flags', flags: ['flush', 'accurate'] });
  });

  it('parses three flags', () => {
    const s = GstStructure.fromString('foo, f=a+b+c');
    expect(field(s!, 'f')).toEqual({ type: 'flags', flags: ['a', 'b', 'c'] });
  });
});

// ---------------------------------------------------------------------------
// Structure: GstValueList { } and GstValueArray < >
// ---------------------------------------------------------------------------

describe('Structure – list and array values', () => {
  it('parses a GstValueList { }', () => {
    const s = GstStructure.fromString('foo, opts={1, 2, 3}');
    expect(field(s!, 'opts')).toEqual({
      type: 'list',
      items: [
        { type: 'int', value: 1 },
        { type: 'int', value: 2 },
        { type: 'int', value: 3 },
      ],
    });
  });

  it('parses a GstValueArray < >', () => {
    const s = GstStructure.fromString('foo, arr=<1, 2, 3>');
    expect(field(s!, 'arr')).toEqual({
      type: 'array',
      items: [
        { type: 'int', value: 1 },
        { type: 'int', value: 2 },
        { type: 'int', value: 3 },
      ],
    });
  });

  it('parses a list with mixed types', () => {
    const s = GstStructure.fromString('foo, v={"hello", 42, true}');
    expect(field(s!, 'v')).toEqual({
      type: 'list',
      items: [
        { type: 'string', value: 'hello' },
        { type: 'int', value: 42 },
        { type: 'boolean', value: true },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Structure: ranges [ ]
// ---------------------------------------------------------------------------

describe('Structure – range values', () => {
  it('parses an int range', () => {
    const s = GstStructure.fromString('foo, r=[1, 100]');
    expect(field(s!, 'r')).toEqual({
      type: 'range',
      min: { type: 'int', value: 1 },
      max: { type: 'int', value: 100 },
      step: undefined,
    });
  });

  it('parses a range with step', () => {
    const s = GstStructure.fromString('foo, r=[0, 255, 2]');
    expect(field(s!, 'r')).toEqual({
      type: 'range',
      min: { type: 'int', value: 0 },
      max: { type: 'int', value: 255 },
      step: { type: 'int', value: 2 },
    });
  });

  it('parses a fraction range', () => {
    const s = GstStructure.fromString('foo, fps=[15/1, 60/1]');
    expect(field(s!, 'fps')).toEqual({
      type: 'range',
      min: { type: 'fraction', numerator: 15, denominator: 1 },
      max: { type: 'fraction', numerator: 60, denominator: 1 },
      step: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// Structure: nested GstStructure and GstCaps
// ---------------------------------------------------------------------------

describe('Structure – nested structure and caps', () => {
  it('parses (GstStructure)"name, field=value;"', () => {
    const s = GstStructure.fromString('outer, inner=(GstStructure)"inner-struct, n=(int)1;"');
    const inner = field(s!, 'inner');
    expect(inner.type).toBe('structure');
    if (inner.type === 'structure') {
      expect(inner.value.name).toBe('inner-struct');
      expect(inner.value.fields.get('n')).toEqual({ type: 'int', value: 1 });
    }
  });

  it('parses (GstCaps)"video/x-raw" as caps value', () => {
    const s = GstStructure.fromString('seek, caps=(GstCaps)"video/x-raw"');
    const caps = field(s!, 'caps');
    expect(caps.type).toBe('caps');
    if (caps.type === 'caps') {
      expect(caps.value.type).toBe('structures');
    }
  });

  it('parses (caps)"audio/x-raw" (lowercase alias)', () => {
    const s = GstStructure.fromString('seek, caps=(caps)"audio/x-raw"');
    const caps = field(s!, 'caps');
    expect(caps.type).toBe('caps');
  });

  it('parses (GstCaps)[video/x-raw, format=I420] bracket syntax', () => {
    const s = GstStructure.fromString('set-caps, caps=(GstCaps)[video/x-raw, format=I420]');
    const caps = field(s!, 'caps');
    expect(caps.type).toBe('caps');
    if (caps.type === 'caps') {
      expect(caps.value.type).toBe('structures');
      if (caps.value.type === 'structures') {
        expect(caps.value.entries[0].structure.name).toBe('video/x-raw');
        expect(caps.value.entries[0].structure.fields.get('format')).toEqual({
          type: 'string',
          value: 'I420',
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Structure: field names with property paths
// ---------------------------------------------------------------------------

describe('Structure – field name syntax', () => {
  it('parses a field with :: path separator', () => {
    const s = GstStructure.fromString('set-properties, element::property=50');
    expect(field(s!, 'element::property')).toEqual({ type: 'int', value: 50 });
  });

  it('parses a field with element.pad::property path', () => {
    const s = GstStructure.fromString('check-properties, compositor.sink_0::xpos=100');
    expect(field(s!, 'compositor.sink_0::xpos')).toEqual({ type: 'int', value: 100 });
  });

  it('parses a hyphenated field name', () => {
    const s = GstStructure.fromString('meta, handles-states=true');
    expect(s!.fields.has('handles-states')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structure: whitespace and syntax edge cases
// ---------------------------------------------------------------------------

describe('Structure – whitespace and edge cases', () => {
  it('ignores leading/trailing whitespace', () => {
    const s = GstStructure.fromString('  seek , start = 5.0  ');
    expect(s!.name).toBe('seek');
    expect(field(s!, 'start')).toEqual({ type: 'double', value: 5.0 });
  });

  it('handles trailing comma in field list', () => {
    const s = GstStructure.fromString('seek, start=5.0,');
    expect(s!.fields.size).toBe(1);
  });

  it('handles multiple fields', () => {
    const s = GstStructure.fromString('seek, start=5.0, stop=10.0, flags=flush+accurate');
    expect(s!.fields.size).toBe(3);
    expect(field(s!, 'start')).toEqual({ type: 'double', value: 5.0 });
    expect(field(s!, 'stop')).toEqual({ type: 'double', value: 10.0 });
    expect(field(s!, 'flags')).toEqual({ type: 'flags', flags: ['flush', 'accurate'] });
  });
});

// ---------------------------------------------------------------------------
// GstCaps parsing
// ---------------------------------------------------------------------------

describe('Caps – special values', () => {
  it('fromString returns a GstCaps instance', () => {
    expect(GstCaps.fromString('ANY')).toBeInstanceOf(GstCaps);
  });

  it('ANY: isAny=true, isEmpty=false, length=0', () => {
    const caps = GstCaps.fromString('ANY')!;
    expect(caps.isAny).toBe(true);
    expect(caps.isEmpty).toBe(false);
    expect(caps.length).toBe(0);
  });

  it('EMPTY: isEmpty=true, isAny=false, length=0', () => {
    const caps = GstCaps.fromString('EMPTY')!;
    expect(caps.isEmpty).toBe(true);
    expect(caps.isAny).toBe(false);
    expect(caps.length).toBe(0);
  });

  it('NONE: isEmpty=true', () => {
    expect(GstCaps.fromString('NONE')!.isEmpty).toBe(true);
  });
});

describe('Caps – single structure', () => {
  it('parses a bare media type', () => {
    const caps = GstCaps.fromString('video/x-raw')!;
    expect(caps.length).toBe(1);
    expect(caps[0]).toBeInstanceOf(GstStructure);
    expect(caps[0]!.name).toBe('video/x-raw');
    expect(caps.getFeatures(0)).toEqual([]);
  });

  it('accesses fields via bracket notation', () => {
    const caps = GstCaps.fromString('video/x-raw, format=I420, width=1920, height=1080')!;
    expect(caps[0]!['format']).toBe('I420');
    expect(caps[0]!['width']).toBe(1920);
    expect(caps[0]!['height']).toBe(1080);
  });

  it('typed field access via getTyped', () => {
    const caps = GstCaps.fromString('video/x-raw, format=I420, width=1920')!;
    expect(caps[0]!.getTyped('width')).toEqual({ type: 'int', value: 1920 });
    expect(caps[0]!.getTyped('format')).toEqual({ type: 'string', value: 'I420' });
  });

  it('parses framerate as a fraction', () => {
    const caps = GstCaps.fromString('video/x-raw, framerate=30/1')!;
    expect(caps[0]!['framerate']).toEqual({ numerator: 30, denominator: 1 });
  });

  it('parses a framerate range', () => {
    const caps = GstCaps.fromString('video/x-raw, framerate=[15/1, 60/1]')!;
    const fr = caps[0]!['framerate'] as { min: unknown; max: unknown };
    expect(fr.min).toEqual({ numerator: 15, denominator: 1 });
    expect(fr.max).toEqual({ numerator: 60, denominator: 1 });
  });

  it('index out of bounds returns undefined', () => {
    const caps = GstCaps.fromString('video/x-raw')!;
    expect(caps[1]).toBeUndefined();
    expect(caps[99]).toBeUndefined();
  });
});

describe('Caps – capability features', () => {
  it('parses a single feature', () => {
    const caps = GstCaps.fromString('video/x-raw(memory:DMABuf), format=NV12')!;
    expect(caps[0]!.name).toBe('video/x-raw');
    expect(caps.getFeatures(0)).toEqual(['memory:DMABuf']);
    expect(caps[0]!['format']).toBe('NV12');
  });

  it('parses multiple features', () => {
    const caps = GstCaps.fromString('video/x-raw(memory:DMABuf, meta:VideoMeta)')!;
    expect(caps.getFeatures(0)).toEqual(['memory:DMABuf', 'meta:VideoMeta']);
  });
});

describe('Caps – multiple structures', () => {
  it('parses two structures separated by semicolon', () => {
    const caps = GstCaps.fromString('video/x-raw, format=I420; audio/x-raw, rate=44100')!;
    expect(caps.length).toBe(2);
    expect(caps[0]!.name).toBe('video/x-raw');
    expect(caps[1]!.name).toBe('audio/x-raw');
    expect(caps[0]!['format']).toBe('I420');
    expect(caps[1]!['rate']).toBe(44100);
  });

  it('parses three structures', () => {
    const caps = GstCaps.fromString('video/x-raw; audio/x-raw; application/x-rtp')!;
    expect(caps.length).toBe(3);
  });

  it('handles whitespace around semicolons', () => {
    const caps = GstCaps.fromString('video/x-raw ; audio/x-raw')!;
    expect(caps.length).toBe(2);
  });

  it('is iterable with for...of', () => {
    const caps = GstCaps.fromString('video/x-raw; audio/x-raw')!;
    const names: string[] = [];
    for (const s of caps) names.push(s.name);
    expect(names).toEqual(['video/x-raw', 'audio/x-raw']);
  });

  it('spread into array', () => {
    const caps = GstCaps.fromString('video/x-raw; audio/x-raw')!;
    const structs = [...caps];
    expect(structs).toHaveLength(2);
    expect(structs[0]).toBeInstanceOf(GstStructure);
  });
});

describe('GstCaps.fromString', () => {
  it('parses a caps string directly', () => {
    const caps = GstCaps.fromString('video/x-raw, format=I420');
    expect(caps).toBeInstanceOf(GstCaps);
    expect(caps[0]!['format']).toBe('I420');
  });
});

// ---------------------------------------------------------------------------
// Serialization – round-trip tests
// ---------------------------------------------------------------------------

describe('Serialization – valueToString', () => {
  it('serializes int', () => {
    expect(valueToString({ type: 'int', value: 42 })).toBe('(int)42');
  });

  it('serializes double with decimal', () => {
    expect(valueToString({ type: 'double', value: 5.0 })).toBe('(double)5.0');
  });

  it('serializes double with non-trivial value', () => {
    expect(valueToString({ type: 'double', value: 3.14 })).toBe('(double)3.14');
  });

  it('serializes string with quotes', () => {
    expect(valueToString({ type: 'string', value: 'hello' })).toBe('"hello"');
  });

  it('escapes special characters in strings', () => {
    expect(valueToString({ type: 'string', value: 'a"b\\c' })).toBe('"a\\"b\\\\c"');
  });

  it('serializes boolean true', () => {
    expect(valueToString({ type: 'boolean', value: true })).toBe('(boolean)true');
  });

  it('serializes fraction', () => {
    expect(valueToString({ type: 'fraction', numerator: 30, denominator: 1 })).toBe('(fraction)30/1');
  });

  it('serializes bitmask', () => {
    expect(valueToString({ type: 'bitmask', value: 0x67n })).toBe('(bitmask)0x67');
  });

  it('serializes flags', () => {
    expect(valueToString({ type: 'flags', flags: ['flush', 'accurate'] })).toBe('flush+accurate');
  });

  it('serializes a list', () => {
    expect(
      valueToString({
        type: 'list',
        items: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
        ],
      }),
    ).toBe('{ (int)1, (int)2 }');
  });

  it('serializes an array', () => {
    expect(
      valueToString({
        type: 'array',
        items: [{ type: 'string', value: 'a' }, { type: 'string', value: 'b' }],
      }),
    ).toBe('< "a", "b" >');
  });

  it('serializes a range without step', () => {
    expect(
      valueToString({
        type: 'range',
        min: { type: 'int', value: 0 },
        max: { type: 'int', value: 255 },
      }),
    ).toBe('[ (int)0, (int)255 ]');
  });
});

describe('Serialization – structureToString', () => {
  it('round-trips a simple structure', () => {
    const s = GstStructure.fromString('seek, start=5.0')!;
    const out = structureToString(s);
    expect(out).toContain('seek');
    expect(out).toContain('start=');

    // Re-parse the serialized form
    const s2 = GstStructure.fromString(out)!;
    expect(s2.name).toBe('seek');
    expect(s2.fields.get('start')).toEqual({ type: 'double', value: 5.0 });
  });

  it('round-trips a structure with multiple fields', () => {
    const s = GstStructure.fromString('video/x-raw, format=I420, width=1920, height=1080')!;
    const out = structureToString(s);
    const s2 = GstStructure.fromString(out)!;
    expect(s2.name).toBe('video/x-raw');
    expect(s2.fields.size).toBe(3);
  });
});

describe('Serialization – capsToString', () => {
  it('serializes ANY', () => {
    expect(GstCaps.fromString('ANY').toString()).toBe('ANY');
  });

  it('serializes EMPTY', () => {
    expect(GstCaps.fromString('EMPTY').toString()).toBe('EMPTY');
  });

  it('round-trips caps with one structure', () => {
    const caps = GstCaps.fromString('video/x-raw, format=I420')!;
    const caps2 = GstCaps.fromString(caps.toString())!;
    expect(caps2[0]!.name).toBe('video/x-raw');
  });

  it('round-trips caps with features', () => {
    const caps = GstCaps.fromString('video/x-raw(memory:DMABuf), format=NV12')!;
    const out = caps.toString();
    expect(out).toContain('memory:DMABuf');
    const caps2 = GstCaps.fromString(out)!;
    expect(caps2.getFeatures(0)).toEqual(['memory:DMABuf']);
  });

  it('round-trips caps with two structures', () => {
    const caps = GstCaps.fromString('video/x-raw, format=I420; audio/x-raw, rate=44100')!;
    const caps2 = GstCaps.fromString(caps.toString())!;
    expect(caps2.length).toBe(2);
    expect(caps2[0]!.name).toBe('video/x-raw');
    expect(caps2[1]!.name).toBe('audio/x-raw');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('throws ParseError for invalid structure', () => {
    expect(() => GstStructure.fromString('=invalid')).toThrow(ParseError);
    expect(() => GstStructure.fromString('foo, =bad')).toThrow(ParseError);
  });

  it('throws ParseError for empty structure string', () => {
    expect(() => GstStructure.fromString('')).toThrow(ParseError);
  });

  it('empty caps string yields a caps with no structures', () => {
    const caps = GstCaps.fromString('');
    expect(caps.length).toBe(0);
    expect(caps.isAny).toBe(false);
    expect(caps.isEmpty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GstStructure – dict-like access
// ---------------------------------------------------------------------------

describe('GstStructure – dict-like field access', () => {
  it('GstStructure.fromString returns a GstStructure instance', () => {
    const s = GstStructure.fromString('seek, start=5.0');
    expect(s).toBeInstanceOf(GstStructure);
    expect(s.name).toBe('seek');
  });

  it('accesses an int field as a number', () => {
    const s = GstStructure.fromString('foo, width=1920');
    expect(s['width']).toBe(1920);
  });

  it('accesses a double field as a number', () => {
    const s = GstStructure.fromString('seek, start=5.0');
    expect(s['start']).toBe(5.0);
  });

  it('accesses a string field as a string', () => {
    const s = GstStructure.fromString('foo, format=I420');
    expect(s['format']).toBe('I420');
  });

  it('accesses a quoted string field as a string', () => {
    const s = GstStructure.fromString('foo, text="hello world"');
    expect(s['text']).toBe('hello world');
  });

  it('accesses a boolean field as a boolean', () => {
    const s = GstStructure.fromString('meta, loop=true, seek=false');
    expect(s['loop']).toBe(true);
    expect(s['seek']).toBe(false);
  });

  it('accesses a fraction field as {numerator, denominator}', () => {
    const s = GstStructure.fromString('foo, framerate=30/1');
    expect(s['framerate']).toEqual({ numerator: 30, denominator: 1 });
  });

  it('accesses a bitmask field as a bigint', () => {
    const s = GstStructure.fromString('foo, mask=(bitmask)0xFF');
    expect(s['mask']).toBe(255n);
  });

  it('accesses a flags field as a string array', () => {
    const s = GstStructure.fromString('seek, flags=flush+accurate');
    expect(s['flags']).toEqual(['flush', 'accurate']);
  });

  it('accesses a list field as an array of unwrapped values', () => {
    const s = GstStructure.fromString('foo, opts={1, 2, 3}');
    expect(s['opts']).toEqual([1, 2, 3]);
  });

  it('accesses an array field as an array of unwrapped values', () => {
    const s = GstStructure.fromString('foo, arr=<"a", "b">');
    expect(s['arr']).toEqual(['a', 'b']);
  });

  it('accesses a range field as {min, max}', () => {
    const s = GstStructure.fromString('foo, r=[0, 255]');
    expect(s['r']).toEqual({ min: 0, max: 255 });
  });

  it('accesses a range field with step as {min, max, step}', () => {
    const s = GstStructure.fromString('foo, r=[0, 100, 2]');
    expect(s['r']).toEqual({ min: 0, max: 100, step: 2 });
  });

  it('returns undefined for a missing field', () => {
    const s = GstStructure.fromString('foo, x=1');
    expect(s['nonexistent']).toBeUndefined();
  });

  it('class properties take precedence over field names', () => {
    // 'name' is a class property; a field also called 'name' should not shadow it
    const s = GstStructure.fromString('mystruct, name=shadowed');
    expect(s.name).toBe('mystruct');
    // Access via getTyped to get the actual field
    expect(s.getTyped('name')).toEqual({ type: 'string', value: 'shadowed' });
  });

  it('getTyped returns the full typed Value', () => {
    const s = GstStructure.fromString('foo, width=1920');
    expect(s.getTyped('width')).toEqual({ type: 'int', value: 1920 });
  });

  it('toString serializes back to a GstStructure string', () => {
    const s = GstStructure.fromString('seek, start=5.0');
    const str = s.toString();
    expect(str).toContain('seek');
    expect(str).toContain('start=');
    // Re-parseable
    const s2 = GstStructure.fromString(str);
    expect(s2['start']).toBe(5.0);
  });

  it('nested structure field unwraps to a GstStructure', () => {
    const s = GstStructure.fromString('outer, inner=(GstStructure)"inner-struct, n=(int)1;"');
    const inner = s['inner'];
    expect(inner).toBeInstanceOf(GstStructure);
    if (inner instanceof GstStructure) {
      expect(inner.name).toBe('inner-struct');
      expect(inner['n']).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// unwrapValue
// ---------------------------------------------------------------------------

describe('unwrapValue', () => {
  it('unwraps int', () => expect(unwrapValue({ type: 'int', value: 7 })).toBe(7));
  it('unwraps double', () => expect(unwrapValue({ type: 'double', value: 3.14 })).toBe(3.14));
  it('unwraps string', () => expect(unwrapValue({ type: 'string', value: 'hi' })).toBe('hi'));
  it('unwraps boolean', () => expect(unwrapValue({ type: 'boolean', value: true })).toBe(true));
  it('unwraps bitmask', () => expect(unwrapValue({ type: 'bitmask', value: 5n })).toBe(5n));
  it('unwraps fraction', () => {
    expect(unwrapValue({ type: 'fraction', numerator: 1, denominator: 2 }))
      .toEqual({ numerator: 1, denominator: 2 });
  });
  it('unwraps flags', () => {
    expect(unwrapValue({ type: 'flags', flags: ['a', 'b'] })).toEqual(['a', 'b']);
  });
  it('unwraps typed by delegating to inner value', () => {
    expect(unwrapValue({ type: 'typed', typeName: 'MyType', value: { type: 'int', value: 99 } }))
      .toBe(99);
  });
});
