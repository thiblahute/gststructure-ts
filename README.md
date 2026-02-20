# gststructure

Pure TypeScript parser and serializer for the [GStreamer](https://gstreamer.freedesktop.org/) Structure and Caps serialization format. No runtime dependencies.

## Installation

```bash
npm install gststructure
```

## Usage

### Parsing a GstStructure

```ts
import { parseStructure } from 'gststructure';

const s = parseStructure('video/x-raw, format=I420, width=1920, height=1080, framerate=30/1');

console.log(s.name);                   // 'video/x-raw'
console.log(s.fields.get('width'));    // { type: 'int', value: 1920 }
console.log(s.fields.get('format'));   // { type: 'string', value: 'I420' }
console.log(s.fields.get('framerate'));// { type: 'fraction', numerator: 30, denominator: 1 }
```

### Parsing GstCaps

```ts
import { parseCaps } from 'gststructure';

// Special caps
parseCaps('ANY');    // { type: 'any' }
parseCaps('EMPTY');  // { type: 'empty' }

// One or more structures separated by ';'
const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100');
// caps.type === 'structures'
// caps.entries[0].structure.name === 'video/x-raw'
// caps.entries[1].structure.name === 'audio/x-raw'

// With capability features
const dmabuf = parseCaps('video/x-raw(memory:DMABuf), format=NV12');
// dmabuf.entries[0].features === ['memory:DMABuf']
```

### Serializing back to string

```ts
import { parseStructure, parseCaps, structureToString, capsToString } from 'gststructure';

const s = parseStructure('seek, start=5.0, stop=10.0, flags=flush+accurate')!;
console.log(structureToString(s));
// 'seek, start=(double)5.0, stop=(double)10.0, flags=flush+accurate'

const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100')!;
console.log(capsToString(caps));
// 'video/x-raw, format="I420"; audio/x-raw, rate=(int)44100'
```

### Error handling

`parseStructure` and `parseCaps` return `null` on invalid input. Use the `OrThrow` variants to get a `ParseError` instead:

```ts
import { parseStructureOrThrow, parseCapsOrThrow, ParseError } from 'gststructure';

try {
  const s = parseStructureOrThrow('=invalid');
} catch (e) {
  if (e instanceof ParseError) {
    console.error(e.message); // includes position info
  }
}
```

## Supported value types

| GStreamer type | Example | Parsed as |
|---|---|---|
| Integer | `42`, `(int)42`, `0xFF` | `{ type: 'int', value: 42 }` |
| Float | `3.14`, `(float)1.0` | `{ type: 'double', value: 3.14 }` |
| Boolean | `true`, `yes`, `t`, `(bool)1` | `{ type: 'boolean', value: true }` |
| String | `"hello"`, `(string)world` | `{ type: 'string', value: 'hello' }` |
| Fraction | `30/1` | `{ type: 'fraction', numerator: 30, denominator: 1 }` |
| Bitmask | `(bitmask)0x67` | `{ type: 'bitmask', value: 103n }` |
| Flags | `flush+accurate` | `{ type: 'flags', flags: ['flush', 'accurate'] }` |
| GstValueList | `{ 1, 2, 3 }` | `{ type: 'list', items: [...] }` |
| GstValueArray | `< 1, 2, 3 >` | `{ type: 'array', items: [...] }` |
| Range | `[ 0, 255 ]`, `[ 0, 255, 2 ]` | `{ type: 'range', min, max, step? }` |
| Nested GstStructure | `(GstStructure)"name, field=val;"` | `{ type: 'structure', value: Structure }` |
| Nested GstCaps | `(GstCaps)"video/x-raw"`, `(GstCaps)[video/x-raw]` | `{ type: 'caps', value: Caps }` |

Type inference for unquoted values follows GStreamer's own order: `int → double → fraction → flags → boolean → string`.

## API

```ts
// Parsing
function parseStructure(s: string): Structure | null
function parseCaps(s: string): Caps | null
function parseStructureOrThrow(s: string): Structure   // throws ParseError
function parseCapsOrThrow(s: string): Caps             // throws ParseError

// Serialization
function structureToString(s: Structure): string
function capsToString(c: Caps): string
function valueToString(v: Value): string      // with explicit type prefix
function valueToStringBare(v: Value): string  // without prefix for scalars
```

## License

MIT
