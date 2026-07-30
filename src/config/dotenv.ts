/**
 * Minimal .env file parser for reading .supabase.env.
 *
 * Handles the dotenv format used by Supabase CLI config files:
 * comments, empty lines, key=value pairs, quoted values.
 * This is not a general-purpose dotenv implementation — it only
 * handles the subset needed for .supabase.env files.
 */

import { existsSync, readFileSync } from "node:fs";

/**
 * Parse a .env-formatted string into key-value pairs.
 *
 * Rules:
 * - Lines starting with # are comments (full-line only, not inline)
 * - Empty lines and whitespace-only lines are ignored
 * - KEY=value assignments (strips optional `export ` prefix)
 * - Values may be single-quoted, double-quoted, or bare
 * - Bare values are trimmed of surrounding whitespace
 * - Quoted values have their quotes stripped and basic escapes processed
 * - Keys are uppercased (convention for env var names)
 *
 * Returns a plain object mapping keys to values.
 */
export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    // Strip optional `export ` prefix
    const normalized = line.startsWith("export ")
      ? line.slice(7).trimStart()
      : line;

    // Find the first = not inside a quoted value
    const eqIndex = findEqualsIndex(normalized);
    if (eqIndex === -1) {
      // Malformed line — skip
      continue;
    }

    const key = normalized.slice(0, eqIndex).trim();
    const rawValue = normalized.slice(eqIndex + 1).trim();

    if (key.length === 0) {
      continue;
    }

    const value = parseValue(rawValue);
    result[key.toUpperCase()] = value;
  }

  return result;
}

/**
 * Read a .env file from disk and parse it.
 * Returns null if the file does not exist.
 * Returns empty object if the file is empty.
 */
export function readDotenvFile(path: string): Record<string, string> | null {
  if (!existsSync(path)) {
    return null;
  }

  const content = readFileSync(path, "utf-8");
  return parseDotenv(content);
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Find the index of the first `=` that is not inside a quoted string.
 */
function findEqualsIndex(line: string): number {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      // Handle escaped double quotes inside double quotes
      if (inDouble && line[i + 1] === '"') {
        i++; // skip the escaped quote
      } else {
        inDouble = !inDouble;
      }
    } else if (ch === "=" && !inSingle && !inDouble) {
      return i;
    }
  }

  return -1;
}

/**
 * Parse a value from the right side of a KEY= assignment.
 * Handles quoted and bare values.
 */
function parseValue(raw: string): string {
  if (raw.length === 0) {
    return "";
  }

  const firstChar = raw[0]!;
  const lastChar = raw[raw.length - 1]!;

  if (firstChar === '"' && lastChar === '"' && raw.length >= 2) {
    // Double-quoted value: strip quotes, process escapes
    const inner = raw.slice(1, -1);
    return unescapeDoubleQuoted(inner);
  }

  if (firstChar === "'" && lastChar === "'" && raw.length >= 2) {
    // Single-quoted value: strip quotes, no escape processing
    return raw.slice(1, -1);
  }

  // Bare value
  return raw;
}

/**
 * Process escape sequences in double-quoted strings.
 * Handles: \\, \", \n, \r, \t
 */
function unescapeDoubleQuoted(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]!;
    if (ch === "\\" && i + 1 < str.length) {
      const next = str[i + 1]!;
      switch (next) {
        case "n":
          result += "\n";
          break;
        case "r":
          result += "\r";
          break;
        case "t":
          result += "\t";
          break;
        case "\\":
          result += "\\";
          break;
        case '"':
          result += '"';
          break;
        default:
          result += ch + next;
          break;
      }
      i++;
    } else {
      result += ch;
    }
  }
  return result;
}
