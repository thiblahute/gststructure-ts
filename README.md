# gststructure

Pure TypeScript parser and serializer for the [GStreamer](https://gstreamer.freedesktop.org/) Structure and Caps serialization format. No runtime dependencies.

## Installation

```bash
npm install gststructure
```

## Usage

### Parsing a GstStructure

```ts
import { GstStructure } from 'gststructure';

const s = GstStructure.fromString('video/x-raw, format=I420, width=1920, height=1080, framerate=30/1');

s.name        // → 'video/x-raw'
s['width']    // → 1920
s['format']   // → 'I420'
s['framerate']// → { numerator: 30, denominator: 1 }
s['loop']     // → undefined  (missing fields return undefined)
```

Field access via `s['fieldName']` returns plain JavaScript values — no type wrapper.
For the full typed `Value` object use `getTyped()`:

```ts
s.getTyped('width')    // → { type: 'int', value: 1920 }
s.getTyped('framerate')// → { type: 'fraction', numerator: 30, denominator: 1 }
```

`parseStructure()` is a convenient alternative that returns `null` on invalid input instead of throwing:

```ts
import { parseStructure } from 'gststructure';

const s = parseStructure('video/x-raw, format=I420')!;
s['format']  // → 'I420'
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
import { GstStructure, capsToString, parseCaps } from 'gststructure';

const s = GstStructure.fromString('seek, start=5.0, stop=10.0, flags=flush+accurate');
s.toString()
// → 'seek, start=(double)5.0, stop=(double)10.0, flags=flush+accurate'

const caps = parseCaps('video/x-raw, format=I420; audio/x-raw, rate=44100')!;
capsToString(caps)
// → 'video/x-raw, format="I420"; audio/x-raw, rate=(int)44100'
```

### Error handling

`parseStructure` and `parseCaps` return `null` on invalid input. Use the `OrThrow` variants to get a `ParseError` instead:

```ts
import { GstStructure, parseCapsOrThrow, ParseError } from 'gststructure';

try {
  GstStructure.fromString('=invalid');
} catch (e) {
  if (e instanceof ParseError) {
    console.error(e.message); // includes position info
  }
}
```

## Supported value types

| GStreamer type | Example | `s['field']` returns |
|---|---|---|
| Integer | `42`, `(int)42`, `0xFF` | `number` |
| Float | `3.14`, `(float)1.0` | `number` |
| Boolean | `true`, `yes`, `t`, `(bool)1` | `boolean` |
| String | `"hello"`, `(string)world` | `string` |
| Fraction | `30/1` | `{ numerator: number; denominator: number }` |
| Bitmask | `(bitmask)0x67` | `bigint` |
| Flags | `flush+accurate` | `string[]` |
| GstValueList | `{ 1, 2, 3 }` | `unknown[]` (recursively unwrapped) |
| GstValueArray | `< 1, 2, 3 >` | `unknown[]` (recursively unwrapped) |
| Range | `[ 0, 255 ]`, `[ 0, 255, 2 ]` | `{ min, max, step? }` (unwrapped) |
| Nested GstStructure | `(GstStructure)"name, field=val;"` | `GstStructure` |
| Nested GstCaps | `(GstCaps)"video/x-raw"` | `Caps` |

Type inference for unquoted values follows GStreamer's own order: `int → double → fraction → flags → boolean → string`.

## API

```ts
// Primary class
class GstStructure {
  static fromString(s: string): GstStructure  // throws ParseError on failure
  readonly name: string
  readonly fields: Map<string, Value>          // typed access
  [key: string]: unknown                       // dict-like access (unwrapped)
  getTyped(key: string): Value | undefined
  toString(): string
}

// Functional API
function parseStructure(s: string): GstStructure | null
function parseStructureOrThrow(s: string): GstStructure
function parseCaps(s: string): Caps | null
function parseCapsOrThrow(s: string): Caps

// Serialization
function structureToString(s: Structure): string
function capsToString(c: Caps): string
function valueToString(v: Value): string      // with explicit type prefix
function valueToStringBare(v: Value): string  // without prefix for scalars
function unwrapValue(v: Value): unknown       // unwrap to plain JS value
```

## License

MIT
