/**
 * Minimal TOML parser for supabase/config.toml.
 *
 * Extracts only the fields needed for config resolution:
 * - project_id at root level
 * - project_id within [remotes.<name>] sections
 *
 * This is NOT a general-purpose TOML parser. It handles only the subset
 * of TOML syntax used by supabase/config.toml for these specific fields:
 * bare keys, quoted string values (double-quoted), section headers,
 * and full-line comments. TOML features like arrays, inline tables,
 * integers, booleans, dates are intentionally unsupported.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * Parsed representation of supabase/config.toml fields used by supabase-axi.
 */
export interface SupabaseTomlConfig {
  /** The root-level project_id value. */
  projectId: string | null;
  /** Map of remote name to its project_id. Key is the remote name (e.g. "default", "production"). */
  remotes: Record<string, { projectId: string | null }>;
}

/**
 * Parse a supabase/config.toml string into its relevant fields.
 *
 * Handles:
 * - Root-level `project_id = "value"` assignments
 * - Section headers `[remotes.<name>]` followed by `project_id = "value"`
 * - Full-line comments starting with `#`
 * - Double-quoted string values with basic escape sequences
 */
export function parseSupabaseToml(content: string): SupabaseTomlConfig {
  const result: SupabaseTomlConfig = {
    projectId: null,
    remotes: {},
  };

  const lines = content.split("\n");
  let currentSection: string[] = []; // e.g. ["remotes", "production"]

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and full-line comments
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    // Section header: [section] or [section.subsection]
    if (line.startsWith("[")) {
      const closeIndex = line.indexOf("]");
      if (closeIndex === -1) {
        continue; // malformed
      }
      const sectionPath = line.slice(1, closeIndex);
      currentSection = sectionPath.split(".").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    // Key = value assignment
    const eqIndex = findTomlEqualsIndex(line);
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();

    // We only care about project_id
    if (key !== "project_id") {
      continue;
    }

    const value = parseTomlValue(rawValue);

    if (currentSection.length === 0) {
      // Root-level project_id
      result.projectId = value;
    } else if (currentSection[0] === "remotes" && currentSection[1]) {
      // [remotes.<name>] section
      const remoteName = currentSection[1];
      if (!result.remotes[remoteName]) {
        result.remotes[remoteName] = { projectId: null };
      }
      result.remotes[remoteName]!.projectId = value;
    }
  }

  return result;
}

/**
 * Read a supabase/config.toml file from disk.
 *
 * Searches upward from `dir` for a `supabase/config.toml` file,
 * stopping at the filesystem root. Returns null if not found.
 */
export function readSupabaseToml(dir?: string): { config: SupabaseTomlConfig; path: string } | null {
  const startDir = resolve(dir ?? process.cwd());
  let currentDir: string = startDir;

  while (true) {
    const candidatePath = resolve(currentDir, "supabase", "config.toml");
    if (existsSync(candidatePath)) {
      const content = readFileSync(candidatePath, "utf-8");
      return { config: parseSupabaseToml(content), path: candidatePath };
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parent;
  }

  return null;
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Find the index of the first `=` outside of a quoted value.
 */
function findTomlEqualsIndex(line: string): number {
  let inString = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (ch === '"' && !inString) {
      inString = true;
    } else if (ch === '"' && inString) {
      // Check for escaped quote
      if (line[i - 1] === "\\") {
        // escaped quote inside string, stay in string
      } else {
        inString = false;
      }
    } else if (ch === "=" && !inString) {
      return i;
    }
  }

  return -1;
}

/**
 * Parse a TOML value string. We only handle double-quoted strings
 * and bare unquoted values. Returns the value as a string or null.
 */
function parseTomlValue(raw: string): string | null {
  if (raw.length === 0) {
    return null;
  }

  // Check for double-quoted string
  if (raw.startsWith('"')) {
    // Find the closing quote (handles escapes)
    let result = "";
    for (let i = 1; i < raw.length; i++) {
      const ch = raw[i]!;
      if (ch === "\\" && i + 1 < raw.length) {
        const next = raw[i + 1]!;
        switch (next) {
          case "n":
            result += "\n";
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
            // Unknown escape — keep literal
            result += next;
            break;
        }
        i++;
      } else if (ch === '"') {
        // End of string
        return result;
      } else {
        result += ch;
      }
    }
    // Unclosed string — return what we got
    return result;
  }

  // Bare value (unquoted). Trim trailing comment (#) if outside of string.
  // TOML allows inline comments after values, e.g. `enabled = true # comment`
  const commentIndex = raw.indexOf("#");
  const value = commentIndex >= 0 ? raw.slice(0, commentIndex).trim() : raw;

  return value || null;
}
