/**
 * TOON (Token-Oriented Object Notation) encoder per spec v4.1.
 *
 * Line-oriented, indentation-based format encoding the JSON data model.
 * Reduces token count by declaring array shapes once and using indentation
 * instead of braces.
 *
 * @see https://toonformat.dev/reference/spec.html
 * @see https://github.com/toon-format/spec/blob/main/SPEC.md
 */

// ── Types ──────────────────────────────────────────────────────────

export interface ToonOptions {
  /** Spaces per indentation level. Default: 2. */
  indentSize?: number;
  /**
   * Document-level delimiter for inline arrays and tabular cells.
   * Must be comma (default), tab, or pipe.
   */
  delimiter?: "," | "\t" | "|";
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_INDENT = 2;
const DEFAULT_DELIM: "," | "\t" | "|" = ",";

// ── Public API ─────────────────────────────────────────────────────

/**
 * Encode a JSON-compatible value as a TOON string.
 */
export function toon(value: unknown, options: ToonOptions = {}): string {
  const indent = options.indentSize ?? DEFAULT_INDENT;
  const delim = options.delimiter ?? DEFAULT_DELIM;
  const lines = serializeRoot(normalize(value), indent, delim);
  return lines.join("\n");
}

// ── Normalization ──────────────────────────────────────────────────

function normalize(value: unknown): JsonValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "number") {
    if (!isFinite(value)) return null; // NaN, Infinity -> null
    if (Object.is(value, -0)) return 0;
    return value;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const obj: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = normalize(v);
    }
    return obj;
  }
  return null;
}

// ── Root Serialization ─────────────────────────────────────────────

function serializeRoot(value: JsonValue, indent: number, delim: string): string[] {
  if (isPrimitive(value)) {
    return [encodePrimitive(value, delim)];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return ["[]"];
    return serializeArrayRoot(value, 0, indent, delim);
  }

  // Object
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return [];

    // Check for keyed tabular at root
    if (canKeyedTabular(value)) {
      return serializeKeyedTabular(value, keys, 0, indent, delim, true);
    }

    return serializeObjectFields(value, keys, 0, indent, delim);
  }

  return [encodePrimitive(value, delim)];
}

// ── Serialization Helpers ──────────────────────────────────────────

function serializeObjectFields(
  obj: Record<string, JsonValue>,
  keys: string[],
  depth: number,
  indent: number,
  delim: string,
): string[] {
  const lines: string[] = [];
  const pad = " ".repeat(depth * indent);

  for (const key of keys) {
    const val = obj[key];
    if (val === undefined) continue;
    if (isPrimitive(val)) {
      lines.push(`${pad}${encodeKey(key)}: ${encodePrimitive(val, delim)}`);
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${pad}${encodeKey(key)}: []`);
      } else {
        lines.push(...serializeArrayField(key, val, depth, indent, delim));
      }
    } else if (isPlainObject(val)) {
      const valKeys = Object.keys(val);
      if (valKeys.length === 0) {
        lines.push(`${pad}${encodeKey(key)}:`);
      } else if (canKeyedTabular(val)) {
        lines.push(
          ...serializeKeyedTabular(val, valKeys, depth, indent, delim, false, key),
        );
      } else {
        lines.push(`${pad}${encodeKey(key)}:`);
        lines.push(...serializeObjectFields(val, valKeys, depth + 1, indent, delim));
      }
    } else {
      lines.push(`${pad}${encodeKey(key)}: ${encodePrimitive(val, delim)}`);
    }
  }

  return lines;
}

function serializeArrayField(
  key: string,
  arr: JsonValue[],
  depth: number,
  indent: number,
  delim: string,
): string[] {
  return serializeArrayContent(arr, depth, indent, delim, key, false);
}

function serializeArrayRoot(
  arr: JsonValue[],
  depth: number,
  indent: number,
  delim: string,
): string[] {
  return serializeArrayContent(arr, depth, indent, delim, undefined, true);
}

function serializeArrayContent(
  arr: JsonValue[],
  depth: number,
  indent: number,
  delim: string,
  key?: string,
  isRoot?: boolean,
): string[] {
  const n = arr.length;
  const pad = " ".repeat(depth * indent);

  // Try tabular form (array of uniform objects)
  if (canTabular(arr)) {
    return serializeTabular(arr, depth, indent, delim, key, isRoot);
  }

  // Try inline form (all primitives)
  if (allPrimitive(arr)) {
    const header = makeHeader(key, n, false, delim, undefined, isRoot);
    const cells = arr.map((v) => encodePrimitive(v, delim)).join(delim);
    return [`${pad}${header} ${cells}`];
  }

  // List form (mixed or non-uniform)
  const header = makeHeader(key, n, false, delim, undefined, isRoot);
  const lines: string[] = [`${pad}${header}`];
  const itemPad = " ".repeat((depth + 1) * indent);
  const innerPad = " ".repeat((depth + 2) * indent);

  for (const item of arr) {
    lines.push(...serializeListItem(item, depth + 1, indent, delim, itemPad, innerPad));
  }

  return lines;
}

function serializeListItem(
  item: JsonValue,
  depth: number,
  indent: number,
  delim: string,
  itemPad: string,
  innerPad: string,
): string[] {
  if (isPrimitive(item)) {
    return [`${itemPad}- ${encodePrimitive(item, delim)}`];
  }

  if (Array.isArray(item)) {
    if (item.length === 0) {
      return [`${itemPad}- []`];
    }
    if (allPrimitive(item)) {
      const cells = item.map((v) => encodePrimitive(v, delim)).join(delim);
      return [`${itemPad}- [${item.length}]: ${cells}`];
    }
    // Nested array within list — recurse
    const header = `[${item.length}]:`;
    const lines: string[] = [`${itemPad}- ${header}`];
    for (const sub of item) {
      lines.push(
        ...serializeListItem(sub, depth + 1, indent, delim, innerPad, innerPad + " ".repeat(indent)),
      );
    }
    return lines;
  }

  if (isPlainObject(item)) {
    const keys = Object.keys(item);
    if (keys.length === 0) {
      return [`${itemPad}-`];
    }
    // First field goes on hyphen line per §10
    const firstKey = keys[0]!;
    const firstVal = item[firstKey]!;
    const restKeys = keys.slice(1);

    const lines: string[] = [];

    if (isPrimitive(firstVal)) {
      lines.push(
        `${itemPad}- ${encodeKey(firstKey)}: ${encodePrimitive(firstVal, delim)}`,
      );
    } else if (Array.isArray(firstVal)) {
      if (firstVal.length === 0) {
        lines.push(`${itemPad}- ${encodeKey(firstKey)}: []`);
      } else if (allPrimitive(firstVal)) {
        const cells = firstVal
          .map((v) => encodePrimitive(v, delim))
          .join(delim);
        lines.push(
          `${itemPad}- ${encodeKey(firstKey)}[${firstVal.length}]: ${cells}`,
        );
      } else if (canTabular(firstVal)) {
        // Tabular array on hyphen line: header on hyphen line, rows at depth+2
        const header = `${encodeKey(firstKey)}[${firstVal.length}]{${fieldList(firstVal[0] as Record<string, JsonValue>)}:`;
        lines.push(`${itemPad}- ${header}`);
        lines.push(...serializeTabularRows(firstVal, depth + 2, indent, delim));
      } else {
        // Non-inline, non-tabular array - header on hyphen line
        const header = `${encodeKey(firstKey)}[${firstVal.length}]:`;
        lines.push(`${itemPad}- ${header}`);
        for (const sub of firstVal) {
          lines.push(
            ...serializeListItem(sub, depth + 2, indent, delim, innerPad, innerPad + "  "),
          );
        }
      }
    } else if (isPlainObject(firstVal)) {
      const firstValKeys = Object.keys(firstVal);
      if (firstValKeys.length === 0) {
        lines.push(`${itemPad}- ${encodeKey(firstKey)}:`);
      } else if (canKeyedTabular(firstVal)) {
        const hdr = `${encodeKey(firstKey)}[${firstValKeys.length}:]{${keyedFieldList(firstVal)}}:`;
        lines.push(`${itemPad}- ${hdr}`);
        for (const ek of firstValKeys) {
          const ev = firstVal[ek];
          if (!isPlainObject(ev)) continue;
          const cells = keyedRowCells(ev, firstVal, delim);
          lines.push(`${innerPad}${encodeKey(ek)}: ${cells.join(delim)}`);
        }
      } else {
        lines.push(`${itemPad}- ${encodeKey(firstKey)}:`);
        lines.push(
          ...serializeObjectFields(firstVal, firstValKeys, depth + 2, indent, delim),
        );
      }
    } else {
      lines.push(
        `${itemPad}- ${encodeKey(firstKey)}: ${encodePrimitive(firstVal, delim)}`,
      );
    }

    // Remaining fields at depth+1
    if (restKeys.length > 0) {
      const restObj: Record<string, JsonValue> = {};
      for (const k of restKeys) {
        const v = item[k];
        if (v !== undefined) restObj[k] = v;
      }
      lines.push(
        ...serializeObjectFields(restObj, restKeys, depth + 1, indent, delim),
      );
    }

    return lines;
  }

  return [`${itemPad}- ${encodePrimitive(item, delim)}`];
}

// ── Tabular Form ───────────────────────────────────────────────────

function canTabular(arr: JsonValue[]): boolean {
  if (arr.length === 0) return false;

  const first = arr[0];
  if (!isPlainObject(first)) return false;

  const firstKeys = Object.keys(first);
  if (firstKeys.length === 0) return false;

  // Check all elements are plain objects with same keys in same order
  for (let i = 1; i < arr.length; i++) {
    const elem = arr[i];
    if (!isPlainObject(elem)) return false;
    const elemKeys = Object.keys(elem);
    if (elemKeys.length === 0) return false;
    if (!keysEqual(firstKeys, elemKeys)) return false;
  }

  // Check column uniformity
  for (const key of firstKeys) {
    if (!isColumnUniform(arr, key)) return false;
  }

  return true;
}

function isColumnUniform(arr: JsonValue[], key: string): boolean {
  let primitiveType: string | null = null;
  let firstObjKeys: string[] | null = null;

  for (const elem of arr) {
    const val = (elem as Record<string, JsonValue>)[key];
    if (val === undefined) return false;

    if (isPrimitive(val)) {
      // All must be primitives of the SAME type
      const pType = typeof val;
      if (primitiveType === null) {
        primitiveType = pType;
      } else if (primitiveType !== pType) {
        return false; // mixed primitive types (string + number, etc.)
      }
    } else if (isPlainObject(val)) {
      // If we already saw primitives, column is mixed - not uniform
      if (primitiveType !== null) return false;
      const valKeys = Object.keys(val);
      if (valKeys.length === 0) return false;
      if (firstObjKeys === null) {
        firstObjKeys = valKeys;
      } else if (!keysEqual(firstObjKeys, valKeys)) {
        return false;
      }
    } else {
      return false; // arrays or other within column - not uniform
    }
  }

  // If uniform objects, check nested columns recursively
  if (firstObjKeys !== null) {
    for (const subKey of firstObjKeys) {
      const subCol: JsonValue[] = [];
      for (const e of arr) {
        const parent = (e as Record<string, JsonValue>)[key];
        if (parent === undefined) return false;
        const subVal = (parent as Record<string, JsonValue>)[subKey];
        if (subVal === undefined) return false;
        subCol.push(subVal);
      }
      if (!areValuesUniform(subCol)) return false;
    }
  }

  return true;
}

/**
 * Check if an array of values forms a uniform column.
 * All must be primitives of the same type, or all must be uniform objects
 * with the same keys and uniform sub-columns.
 */
function areValuesUniform(vals: JsonValue[]): boolean {
  if (vals.length === 0) return true;

  const first = vals[0];
  if (first === undefined) return false;

  if (isPrimitive(first)) {
    const primType = typeof first;
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      if (!isPrimitive(v)) return false;
      if (typeof v !== primType) return false;
    }
    return true;
  }

  if (isPlainObject(first)) {
    const firstKeys = Object.keys(first);
    if (firstKeys.length === 0) return false;

    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      if (!isPlainObject(v)) return false;
      if (!keysEqual(firstKeys, Object.keys(v))) return false;
    }

    // Check sub-columns
    for (const sk of firstKeys) {
      const subVals: JsonValue[] = [];
      for (const v of vals) {
        const sv = (v as Record<string, JsonValue>)[sk];
        if (sv === undefined) return false;
        subVals.push(sv);
      }
      if (!areValuesUniform(subVals)) return false;
    }
    return true;
  }

  return false; // arrays not allowed in columns
}

function allPrimitive(arr: JsonValue[]): boolean {
  return arr.every(isPrimitive);
}

function serializeTabular(
  arr: JsonValue[],
  depth: number,
  indent: number,
  delim: string,
  key?: string,
  isRoot?: boolean,
): string[] {
  const first = arr[0] as Record<string, JsonValue>;
  const fields = fieldList(first);
  const header = makeHeader(key, arr.length, false, delim, fields, isRoot);
  const pad = " ".repeat(depth * indent);
  const lines: string[] = [`${pad}${header}`];

  lines.push(...serializeTabularRows(arr, depth + 1, indent, delim));

  return lines;
}

function serializeTabularRows(
  arr: JsonValue[],
  depth: number,
  indent: number,
  delim: string,
): string[] {
  const first = arr[0] as Record<string, JsonValue>;
  const firstKeys = Object.keys(first);
  const pad = " ".repeat(depth * indent);
  const lines: string[] = [];

  for (const elem of arr) {
    const obj = elem as Record<string, JsonValue>;
    const cells: string[] = [];
    collectLeafCells(obj, firstKeys, cells, delim);
    lines.push(`${pad}${cells.join(delim)}`);
  }

  return lines;
}

function collectLeafCells(
  obj: Record<string, JsonValue>,
  keys: string[],
  out: string[],
  delim: string,
): void {
  for (const key of keys) {
    const val: JsonValue | undefined = obj[key];
    if (val === undefined || val === null) {
      out.push(encodePrimitive(null, delim));
    } else if (isPlainObject(val)) {
      collectLeafCells(val, Object.keys(val), out, delim);
    } else if (Array.isArray(val)) {
      // Array within tabular - encode as JSON string
      out.push(encodePrimitive(JSON.stringify(val), delim));
    } else {
      out.push(encodePrimitive(val, delim));
    }
  }
}

function fieldList(first: Record<string, JsonValue>): string {
  const parts: string[] = [];
  const keys = Object.keys(first);
  for (const key of keys) {
    const val: JsonValue | undefined = first[key];
    if (val !== undefined && isPlainObject(val)) {
      parts.push(`${encodeKey(key)}{${fieldList(val)}}`);
    } else {
      parts.push(encodeKey(key));
    }
  }
  return parts.join(",");
}

// ── Keyed Tabular Form ─────────────────────────────────────────────

function canKeyedTabular(obj: Record<string, JsonValue>): boolean {
  const entryKeys = Object.keys(obj);
  if (entryKeys.length < 2) return false;

  let firstValKeys: string[] | null = null;

  for (const key of entryKeys) {
    const val = obj[key];
    if (!isPlainObject(val)) return false;
    const valKeys = Object.keys(val);
    if (valKeys.length === 0) return false;

    if (firstValKeys === null) {
      firstValKeys = valKeys;
    } else if (!keysEqual(firstValKeys, valKeys)) {
      return false;
    }
  }

  // Check column uniformity across all entry values
  if (firstValKeys === null) return false;
  const allVals: JsonValue[] = [];
  for (const k of entryKeys) {
    const v = obj[k];
    if (v !== undefined) allVals.push(v);
  }
  for (const fk of firstValKeys) {
    if (!isColumnUniform(allVals, fk)) return false;
  }

  return true;
}

function keyedFieldList(firstVal: Record<string, JsonValue>): string {
  return fieldList(firstVal);
}

function keyedRowCells(
  entryVal: Record<string, JsonValue>,
  firstVal: Record<string, JsonValue>,
  delim: string,
): string[] {
  const keys = Object.keys(firstVal);
  const cells: string[] = [];
  collectLeafCells(entryVal, keys, cells, delim);
  return cells;
}

function serializeKeyedTabular(
  obj: Record<string, JsonValue>,
  entryKeys: string[],
  depth: number,
  indent: number,
  delim: string,
  isRoot: boolean,
  fieldKey?: string,
): string[] {
  const firstKey = entryKeys[0];
  if (firstKey === undefined) return [];
  const firstVal = obj[firstKey];
  if (!isPlainObject(firstVal)) return [];
  const fields = keyedFieldList(firstVal);
  const n = entryKeys.length;
  const header = makeHeader(fieldKey, n, true, delim, fields, isRoot);
  const pad = " ".repeat(depth * indent);
  const lines: string[] = [`${pad}${header}`];
  const rowPad = " ".repeat((depth + 1) * indent);

  for (const ek of entryKeys) {
    const entryVal = obj[ek];
    if (!isPlainObject(entryVal)) continue;
    const cells = keyedRowCells(entryVal, firstVal, delim);
    lines.push(`${rowPad}${encodeKey(ek)}: ${cells.join(delim)}`);
  }

  return lines;
}

// ── Header Construction ────────────────────────────────────────────

function makeHeader(
  key: string | undefined,
  n: number,
  isKeyed: boolean,
  delim: string,
  fields?: string,
  isRoot?: boolean,
): string {
  const delimSym = delim === "," ? "" : delim;
  const keyedMarker = isKeyed ? ":" : "";

  let header = "";
  if (key !== undefined && !isRoot) {
    header += `${encodeKey(key)}`;
  }
  header += `[${n}${keyedMarker}${delimSym}]`;
  if (fields !== undefined) {
    header += `{${fields}}`;
  }
  header += ":";
  return header;
}

// ── Primitive Encoding ─────────────────────────────────────────────

function isPrimitive(value: JsonValue | undefined): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPlainObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function encodePrimitive(value: JsonValue, delim: string): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return encodeNumber(value);

  // String
  const str = value as string;
  if (needsQuoting(str, delim)) return quoteString(str);
  return str;
}

function encodeNumber(n: number): string {
  // Canonical form per §2
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e-6 && abs < 1e21) {
    // Use canonical decimal
    let s = n.toString();
    // If toString gives exponential, convert
    if (s.includes("e") || s.includes("E")) {
      s = n.toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: 20,
      });
    }
    // Remove trailing zeros after decimal
    if (s.includes(".")) {
      s = s.replace(/\.?0+$/, "");
    }
    return s;
  }
  // Outside range, use exponential with lowercase e
  return n.toExponential().replace("e+", "e").replace(/e(\d)/, (_, d) => `e${d}`);
}

// ── Quoting ────────────────────────────────────────────────────────

/**
 * Determine if a string value must be quoted per TOON §7.2.
 */
function needsQuoting(s: string, delim: string): boolean {
  if (s.length === 0) return true;

  // Leading/trailing whitespace
  if (s[0] === " " || s[0] === "\t" || s[s.length - 1] === " " || s[s.length - 1] === "\t") {
    return true;
  }

  // Reserved words
  if (s === "true" || s === "false" || s === "null") return true;

  // Numeric-like
  if (/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) return true;

  // Special characters
  if (/[:"[\]{}]/.test(s)) return true;

  // Control characters
  if (/[\x00-\x1F]/.test(s)) return true;

  // Active delimiter (for the enclosing context)
  if (delim !== "," && s.includes(delim)) return true;
  // Comma is always a potential delimiter in inline arrays
  if (delim === "," && s.includes(",")) return true;

  // Starts with dash or hash
  if (s[0] === "-" || s[0] === "#") return true;

  return false;
}

function quoteString(s: string): string {
  let escaped = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const code = ch.charCodeAt(0);
    if (ch === "\\") escaped += "\\\\";
    else if (ch === '"') escaped += '\\"';
    else if (ch === "\n") escaped += "\\n";
    else if (ch === "\r") escaped += "\\r";
    else if (ch === "\t") escaped += "\\t";
    else if (code < 0x20) {
      escaped += `\\u${code.toString(16).padStart(4, "0")}`;
    } else {
      escaped += ch;
    }
  }
  return `"${escaped}"`;
}

function encodeKey(key: string): string {
  // §7.3: unquoted only if matching pattern
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) return key;
  return quoteString(key);
}

// ── Utilities ──────────────────────────────────────────────────────

function keysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
