import { describe, it, expect } from 'vitest';
import {
  parseStructure,
  parseCaps,
  structureToString,
  capsToString,
  valueToString,
  type Value,
  type Structure,
  type Caps,
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
    const s = parseStructure('play');
    expect(s).not.toBeNull();
    expect(s!.name).toBe('play');
    expect(s!.fields.size).toBe(0);
  });

  it('parses a bare name followed by semicolon', () => {
    const s = parseStructure('play;');
    expect(s!.name).toBe('play');
    expect(s!.fields.size).toBe(0);
  });

  it('parses a caps-style media-type name (slash)', () => {
    const s = parseStructure('video/x-raw');
    expect(s!.name).toBe('video/x-raw');
  });

  it('parses a hyphenated name', () => {
    const s = parseStructure('set-property, name=foo, value=(int)42');
    expect(s!.name).toBe('set-property');
  });

  it('returns null for an empty string', () => {
    expect(parseStructure('')).toBeNull();
    expect(parseStructure('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Structure: integer fields
// ---------------------------------------------------------------------------

describe('Structure – integer values', () => {
  it('parses a positive integer', () => {
    const s = parseStructure('seek, start=5');
    expect(field(s!, 'start')).toEqual({ kind: 'int', value: 5 });
  });

  it('parses a negative integer', () => {
    const s = parseStructure('foo, x=-42');
    expect(field(s!, 'x')).toEqual({ kind: 'int', value: -42 });
  });

  it('parses a hex number (0x prefix) as int', () => {
    const s = parseStructure('foo, v=0xFF');
    expect(field(s!, 'v')).toEqual({ kind: 'int', value: 255 });
  });

  it('parses an explicitly typed int', () => {
    const s = parseStructure('foo, v=(int)42');
    expect(field(s!, 'v')).toEqual({ kind: 'int', value: 42 });
  });

  it('parses an explicitly typed gint64', () => {
    const s = parseStructure('foo, n=(gint64)9000000000');
    expect(field(s!, 'n')).toEqual({ kind: 'int', value: 9000000000 });
  });
});

// ---------------------------------------------------------------------------
// Structure: floating-point fields
// ---------------------------------------------------------------------------

describe('Structure – double values', () => {
  it('parses a positive float', () => {
    const s = parseStructure('seek, start=5.0');
    expect(field(s!, 'start')).toEqual({ kind: 'double', value: 5.0 });
  });

  it('parses a float with only fractional part', () => {
    const s = parseStructure('foo, x=.5');
    expect(field(s!, 'x')).toEqual({ kind: 'double', value: 0.5 });
  });

  it('parses a negative float', () => {
    const s = parseStructure('foo, x=-3.14');
    expect(field(s!, 'x')).toEqual({ kind: 'double', value: -3.14 });
  });

  it('parses an explicitly typed float', () => {
    const s = parseStructure('set-property, value=(float)1.0');
    expect(field(s!, 'value')).toEqual({ kind: 'double', value: 1.0 });
  });

  it('parses an explicitly typed double', () => {
    const s = parseStructure('foo, d=(double)2.718');
    expect(field(s!, 'd')).toEqual({ kind: 'double', value: 2.718 });
  });

  it('coerces (double) from int token', () => {
    const s = parseStructure('foo, d=(double)3');
    expect(field(s!, 'd')).toEqual({ kind: 'double', value: 3 });
  });
});

// ---------------------------------------------------------------------------
// Structure: boolean fields
// ---------------------------------------------------------------------------

describe('Structure – boolean values', () => {
  it('parses true', () => {
    const s = parseStructure('meta, handles-states=true');
    expect(field(s!, 'handles-states')).toEqual({ kind: 'boolean', value: true });
  });

  it('parses false', () => {
    const s = parseStructure('meta, seek=false');
    expect(field(s!, 'seek')).toEqual({ kind: 'boolean', value: false });
  });

  it('parses yes/no aliases', () => {
    const s = parseStructure('meta, a=yes, b=NO');
    expect(field(s!, 'a')).toEqual({ kind: 'boolean', value: true });
    expect(field(s!, 'b')).toEqual({ kind: 'boolean', value: false });
  });

  it('parses t/f aliases (case insensitive)', () => {
    const s = parseStructure('meta, c=t, d=F');
    expect(field(s!, 'c')).toEqual({ kind: 'boolean', value: true });
    expect(field(s!, 'd')).toEqual({ kind: 'boolean', value: false });
  });

  it('parses explicitly typed bool with numeric 1/0', () => {
    const s = parseStructure('meta, enabled=(bool)1, disabled=(bool)0');
    expect(field(s!, 'enabled')).toEqual({ kind: 'boolean', value: true });
    expect(field(s!, 'disabled')).toEqual({ kind: 'boolean', value: false });
  });
});

// ---------------------------------------------------------------------------
// Structure: string fields
// ---------------------------------------------------------------------------

describe('Structure – string values', () => {
  it('parses a quoted string', () => {
    const s = parseStructure('checkpoint, text="Hello World"');
    expect(field(s!, 'text')).toEqual({ kind: 'string', value: 'Hello World' });
  });

  it('handles escape sequences in quoted strings', () => {
    const s = parseStructure('foo, s="line1\\nline2"');
    expect(field(s!, 's')).toEqual({ kind: 'string', value: 'line1\nline2' });
  });

  it('handles escaped quotes inside quoted strings', () => {
    const s = parseStructure('foo, s="say \\"hi\\""');
    expect(field(s!, 's')).toEqual({ kind: 'string', value: 'say "hi"' });
  });

  it('parses an unquoted string (fallback)', () => {
    const s = parseStructure('foo, format=I420');
    expect(field(s!, 'format')).toEqual({ kind: 'string', value: 'I420' });
  });

  it('parses unquoted string with colon (e.g. pad reference)', () => {
    const s = parseStructure('config, sink=videosink:sink');
    expect(field(s!, 'sink')).toEqual({ kind: 'string', value: 'videosink:sink' });
  });

  it('parses explicitly typed (string) coercion', () => {
    const s = parseStructure('foo, field-is-string=(string)true');
    expect(field(s!, 'field-is-string')).toEqual({ kind: 'string', value: 'true' });
  });
});

// ---------------------------------------------------------------------------
// Structure: fraction fields
// ---------------------------------------------------------------------------

describe('Structure – fraction values', () => {
  it('parses a fraction', () => {
    const s = parseStructure('set-property, framerate=30/1');
    expect(field(s!, 'framerate')).toEqual({ kind: 'fraction', numerator: 30, denominator: 1 });
  });

  it('parses an explicitly typed fraction', () => {
    const s = parseStructure('foo, f=(fraction)1/2');
    expect(field(s!, 'f')).toEqual({ kind: 'fraction', numerator: 1, denominator: 2 });
  });
});

// ---------------------------------------------------------------------------
// Structure: bitmask fields
// ---------------------------------------------------------------------------

describe('Structure – bitmask values', () => {
  it('parses an explicitly typed bitmask', () => {
    const s = parseStructure('set-caps, mask=(bitmask)0x67');
    expect(field(s!, 'mask')).toEqual({ kind: 'bitmask', value: 0x67n });
  });
});

// ---------------------------------------------------------------------------
// Structure: flags fields
// ---------------------------------------------------------------------------

describe('Structure – flags values', () => {
  it('parses a single-flag (bare identifier treated as string, not flag)', () => {
    const s = parseStructure('seek, flags=accurate');
    // A single word without '+' is a plain string
    expect(field(s!, 'flags')).toEqual({ kind: 'string', value: 'accurate' });
  });

  it('parses multiple flags joined by +', () => {
    const s = parseStructure('seek, start=5.0, stop=10.0, flags=flush+accurate');
    expect(field(s!, 'flags')).toEqual({ kind: 'flags', flags: ['flush', 'accurate'] });
  });

  it('parses three flags', () => {
    const s = parseStructure('foo, f=a+b+c');
    expect(field(s!, 'f')).toEqual({ kind: 'flags', flags: ['a', 'b', 'c'] });
  });
});

// ---------------------------------------------------------------------------
// Structure: GstValueList { } and GstValueArray < >
// ---------------------------------------------------------------------------

describe('Structure – list and array values', () => {
  it('parses a GstValueList { }', () => {
    const s = parseStructure('foo, opts={1, 2, 3}');
    expect(field(s!, 'opts')).toEqual({
      kind: 'list',
      items: [
        { kind: 'int', value: 1 },
        { kind: 'int', value: 2 },
        { kind: 'int', value: 3 },
      ],
    });
  });

  it('parses a GstValueArray < >', () => {
    const s = parseStructure('foo, arr=<1, 2, 3>');
    expect(field(s!, 'arr')).toEqual({
      kind: 'array',
      items: [
        { kind: 'int', value: 1 },
        { kind: 'int', value: 2 },
        { kind: 'int', value: 3 },
      ],
    });
  });

  it('parses a list with mixed types', () => {
    const s = parseStructure('foo, v={"hello", 42, true}');
    expect(field(s!, 'v')).toEqual({
      kind: 'list',
      items: [
        { kind: 'string', value: 'hello' },
        { kind: 'int', value: 42 },
        { kind: 'boolean', value: true },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Structure: ranges [ ]
// ---------------------------------------------------------------------------

describe('Structure – range values', () => {
  it('parses an int range', () => {
    const s = parseStructure('foo, r=[1, 100]');
    expect(field(s!, 'r')).toEqual({
      kind: 'range',
      min: { kind: 'int', value: 1 },
      max: { kind: 'int', value: 100 },
      step: undefined,
    });
  });

  it('parses a range with step', () => {
    const s = parseStructure('foo, r=[0, 255, 2]');
    expect(field(s!, 'r')).toEqual({
      kind: 'range',
      min: { kind: 'int', value: 0 },
      max: { kind: 'int', value: 255 },
      step: { kind: 'int', value: 2 },
    });
  });

  it('parses a fraction range', () => {
    const s = parseStructure('foo, fps=[15/1, 60/1]');
    expect(field(s!, 'fps')).toEqual({
      kind: 'range',
      min: { kind: 'fraction', numerator: 15, denominator: 1 },
      max: { kind: 'fraction', numerator: 60, denominator: 1 },
      step: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// Structure: nested GstStructure and GstCaps
// ---------------------------------------------------------------------------

describe('Structure – nested structure and caps', () => {
  it('parses (GstStructure)"name, field=value;"', () => {
    const s = parseStructure('outer, inner=(GstStructure)"inner-struct, n=(int)1;"');
    const inner = field(s!, 'inner');
    expect(inner.kind).toBe('structure');
    if (inner.kind === 'structure') {
      expect(inner.value.name).toBe('inner-struct');
      expect(inner.value.fields.get('n')).toEqual({ kind: 'int', value: 1 });
    }
  });

  it('parses (GstCaps)"video/x-raw" as caps value', () => {
    const s = parseStructure('seek, caps=(GstCaps)"video/x-raw"');
    const caps = field(s!, 'caps');
    expect(caps.kind).toBe('caps');
    if (caps.kind === 'caps') {
      expect(caps.value.kind).toBe('structures');
    }
  });

  it('parses (caps)"audio/x-raw" (lowercase alias)', () => {
    const s = parseStructure('seek, caps=(caps)"audio/x-raw"');
    const caps = field(s!, 'caps');
    expect(caps.kind).toBe('caps');
  });

  it('parses (GstCaps)[video/x-raw, format=I420] bracket syntax', () => {
    const s = parseStructure('set-caps, caps=(GstCaps)[video/x-raw, format=I420]');
    const caps = field(s!, 'caps');
    expect(caps.kind).toBe('caps');
    if (caps.kind === 'caps') {
      expect(caps.value.kind).toBe('structures');
      if (caps.value.kind === 'structures') {
        expect(caps.value.entries[0].structure.name).toBe('video/x-raw');
        expect(caps.value.entries[0].structure.fields.get('format')).toEqual({
          kind: 'string',
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
    const s = parseStructure('set-properties, element::property=50');
    expect(field(s!, 'element::property')).toEqual({ kind: 'int', value: 50 });
  });

  it('parses a field with element.pad::property path', () => {
    const s = parseStructure('check-properties, compositor.sink_0::xpos=100');
    expect(field(s!, 'compositor.sink_0::xpos')).toEqual({ kind: 'int', value: 100 });
  });

  it('parses a hyphenated field name', () => {
    const s = parseStructure('meta, handles-states=true');
    expect(s!.fields.has('handles-states')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structure: whitespace and syntax edge cases
// ---------------------------------------------------------------------------

describe('Structure – whitespace and edge cases', () => {
  it('ignores leading/trailing whitespace', () => {
    const s = parseStructure('  seek , start = 5.0  ');
    expect(s!.name).toBe('seek');
    expect(field(s!, 'start')).toEqual({ kind: 'double', value: 5.0 });
  });

  it('handles trailing comma in field list', () => {
    const s = parseStructure('seek, start=5.0,');
    expect(s!.fields.size).toBe(1);
  });

  it('handles multiple fields', () => {
    const s = parseStructure('seek, start=5.0, stop=10.0, flags=flush+accurate');
    expect(s!.fields.size).toBe(3);
    expect(field(s!, 'start')).toEqual({ kind: 'double', value: 5.0 });
    expect(field(s!, 'stop')).toEqual({ kind: 'double', value: 10.0 });
    expect(field(s!, 'flags')).toEqual({ kind: 'flags', flags: ['flush', 'accurate'] });
  });
});

// ---------------------------------------------------------------------------
// GstCaps parsing
// ---------------------------------------------------------------------------

describe('Caps – special values', () => {
  it('parses ANY', () => {
    expect(parseCaps('ANY')).toEqual({ kind: 'any' });
  });

  it('parses EMPTY', () => {
    expect(parseCaps('EMPTY')).toEqual({ kind: 'empty' });
  });

  it('parses NONE', () => {
    expect(parseCaps('NONE')).toEqual({ kind: 'empty' });
  });
});

describe('Caps – single structure', () => {
  it('parses a bare media type', () => {
    const caps = parseCaps('video/x-raw');
    expect(caps!.kind).toBe('structures');
    if (caps!.kind === 'structures') {
      expect(caps!.entries.length).toBe(1);
      expect(caps!.entries[0].structure.name).toBe('video/x-raw');
      expect(caps!.entries[0].features).toEqual([]);
    }
  });

  it('parses a structure with fields', () => {
    const caps = parseCaps('video/x-raw, format=I420, width=1920, height=1080');
    expect(caps!.kind).toBe('structures');
    if (caps!.kind === 'structures') {
      const s = caps!.entries[0].structure;
      expect(s.name).toBe('video/x-raw');
      expect(s.fields.get('format')).toEqual({ kind: 'string', value: 'I420' });
      expect(s.fields.get('width')).toEqual({ kind: 'int', value: 1920 });
      expect(s.fields.get('height')).toEqual({ kind: 'int', value: 1080 });
    }
  });

  it('parses framerate as a fraction', () => {
    const caps = parseCaps('video/x-raw, framerate=30/1');
    if (caps!.kind === 'structures') {
      expect(caps!.entries[0].structure.fields.get('framerate')).toEqual({
        kind: 'fraction',
        numerator: 30,
        denominator: 1,
      });
    }
  });

  it('parses a framerate range', () => {
    const caps = parseCaps('video/x-raw, framerate=[15/1, 60/1]');
    if (caps!.kind === 'structures') {
      const fr = caps!.entries[0].structure.fields.get('framerate');
      expect(fr?.kind).toBe('range');
    }
  });
});

describe('Caps – capability features', () => {
  it('parses a single feature', () => {
    const caps = parseCaps('video/x-raw(memory:DMABuf), format=NV12');
    expect(caps!.kind).toBe('structures');
    if (caps!.kind === 'structures') {
      expect(caps!.entries[0].features).toEqual(['memory:DMABuf']);
      expect(caps!.entries[0].structure.name).toBe('video/x-raw');
    }
  });

  it('parses multiple features', () => {
    const caps = parseCaps('video/x-raw(memory:DMABuf, meta:VideoMeta)');
    if (caps!.kind === 'structures') {
      expect(caps!.entries[0].features).toEqual(['memory:DMABuf', 'meta:VideoMeta']);
    }
  });
});

describe('Caps – multiple structures', () => {
  it('parses two structures separated by semicolon', () => {
    const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
    expect(caps!.kind).toBe('structures');
    if (caps!.kind === 'structures') {
      expect(caps!.entries.length).toBe(2);
      expect(caps!.entries[0].structure.name).toBe('video/x-raw');
      expect(caps!.entries[1].structure.name).toBe('audio/x-raw');
    }
  });

  it('parses three structures', () => {
    const caps = parseCaps('video/x-raw; audio/x-raw; application/x-rtp');
    if (caps!.kind === 'structures') {
      expect(caps!.entries.length).toBe(3);
    }
  });

  it('handles whitespace around semicolons', () => {
    const caps = parseCaps('video/x-raw ; audio/x-raw');
    if (caps!.kind === 'structures') {
      expect(caps!.entries.length).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Serialization – round-trip tests
// ---------------------------------------------------------------------------

describe('Serialization – valueToString', () => {
  it('serializes int', () => {
    expect(valueToString({ kind: 'int', value: 42 })).toBe('(int)42');
  });

  it('serializes double with decimal', () => {
    expect(valueToString({ kind: 'double', value: 5.0 })).toBe('(double)5.0');
  });

  it('serializes double with non-trivial value', () => {
    expect(valueToString({ kind: 'double', value: 3.14 })).toBe('(double)3.14');
  });

  it('serializes string with quotes', () => {
    expect(valueToString({ kind: 'string', value: 'hello' })).toBe('"hello"');
  });

  it('escapes special characters in strings', () => {
    expect(valueToString({ kind: 'string', value: 'a"b\\c' })).toBe('"a\\"b\\\\c"');
  });

  it('serializes boolean true', () => {
    expect(valueToString({ kind: 'boolean', value: true })).toBe('(boolean)true');
  });

  it('serializes fraction', () => {
    expect(valueToString({ kind: 'fraction', numerator: 30, denominator: 1 })).toBe('(fraction)30/1');
  });

  it('serializes bitmask', () => {
    expect(valueToString({ kind: 'bitmask', value: 0x67n })).toBe('(bitmask)0x67');
  });

  it('serializes flags', () => {
    expect(valueToString({ kind: 'flags', flags: ['flush', 'accurate'] })).toBe('flush+accurate');
  });

  it('serializes a list', () => {
    expect(
      valueToString({
        kind: 'list',
        items: [
          { kind: 'int', value: 1 },
          { kind: 'int', value: 2 },
        ],
      }),
    ).toBe('{ (int)1, (int)2 }');
  });

  it('serializes an array', () => {
    expect(
      valueToString({
        kind: 'array',
        items: [{ kind: 'string', value: 'a' }, { kind: 'string', value: 'b' }],
      }),
    ).toBe('< "a", "b" >');
  });

  it('serializes a range without step', () => {
    expect(
      valueToString({
        kind: 'range',
        min: { kind: 'int', value: 0 },
        max: { kind: 'int', value: 255 },
      }),
    ).toBe('[ (int)0, (int)255 ]');
  });
});

describe('Serialization – structureToString', () => {
  it('round-trips a simple structure', () => {
    const s = parseStructure('seek, start=5.0')!;
    const out = structureToString(s);
    expect(out).toContain('seek');
    expect(out).toContain('start=');

    // Re-parse the serialized form
    const s2 = parseStructure(out)!;
    expect(s2.name).toBe('seek');
    expect(s2.fields.get('start')).toEqual({ kind: 'double', value: 5.0 });
  });

  it('round-trips a structure with multiple fields', () => {
    const s = parseStructure('video/x-raw, format=I420, width=1920, height=1080')!;
    const out = structureToString(s);
    const s2 = parseStructure(out)!;
    expect(s2.name).toBe('video/x-raw');
    expect(s2.fields.size).toBe(3);
  });
});

describe('Serialization – capsToString', () => {
  it('serializes ANY', () => {
    expect(capsToString({ kind: 'any' })).toBe('ANY');
  });

  it('serializes EMPTY', () => {
    expect(capsToString({ kind: 'empty' })).toBe('EMPTY');
  });

  it('round-trips caps with one structure', () => {
    const caps = parseCaps('video/x-raw, format=I420')!;
    const out = capsToString(caps);
    const caps2 = parseCaps(out)!;
    expect(caps2.kind).toBe('structures');
    if (caps2.kind === 'structures') {
      expect(caps2.entries[0].structure.name).toBe('video/x-raw');
    }
  });

  it('round-trips caps with features', () => {
    const caps = parseCaps('video/x-raw(memory:DMABuf), format=NV12')!;
    const out = capsToString(caps);
    expect(out).toContain('memory:DMABuf');
    const caps2 = parseCaps(out)!;
    if (caps2.kind === 'structures') {
      expect(caps2.entries[0].features).toEqual(['memory:DMABuf']);
    }
  });

  it('round-trips caps with two structures', () => {
    const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100')!;
    const out = capsToString(caps);
    const caps2 = parseCaps(out)!;
    if (caps2.kind === 'structures') {
      expect(caps2.entries.length).toBe(2);
      expect(caps2.entries[0].structure.name).toBe('video/x-raw');
      expect(caps2.entries[1].structure.name).toBe('audio/x-raw');
    }
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('returns null for invalid structure', () => {
    expect(parseStructure('=invalid')).toBeNull();
    expect(parseStructure('foo, =bad')).toBeNull();
  });

  it('returns null for null/undefined-like empty input', () => {
    expect(parseStructure('')).toBeNull();
  });

  it('returns null for invalid caps', () => {
    expect(parseCaps('')).toBeNull();
  });
});
