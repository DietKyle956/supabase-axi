/**
 * Home view rendered when supabase-axi is invoked with no arguments.
 *
 * Per AXI §8: content-first, not a usage manual.
 * Shows the tool identity, registered commands as TOON tabular data,
 * and contextual help hints for what to do next.
 */

import { toon } from "../format/toon.js";
import type { CommandDef } from "../router.js";

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Generate the home view output.
 *
 * @param commands - Registered commands to list in the home view
 * @returns { exitCode, output } for stdout
 */
export function homeView(commands: CommandDef[]): {
  exitCode: number;
  output: string;
} {
  const lines: string[] = [];

  // Tool identity (AXI §10: bin path and description)
  lines.push(`bin: ${collapseHome(process.argv[1]!)}`);
  lines.push(
    "description: AXI-compliant CLI wrapper around the Supabase API for AI coding agents",
  );

  // Commands table (AXI §8: live content, TOON formatted)
  if (commands.length > 0) {
    lines.push("");
    const cmdRecords = commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
    }));
    lines.push(toon(cmdRecords));
  }

  // Contextual help hints (AXI §9)
  lines.push("");

  const hints: string[] = [];
  if (commands.some((c) => c.name === "init")) {
    hints.push("Run `supabase-axi init` to configure credentials");
  }
  hints.push("Run `supabase-axi <command> --help` for flag details");

  lines.push(`help[${hints.length}]:`);
  for (const hint of hints) {
    lines.push(`  ${hint}`);
  }

  return { exitCode: 0, output: lines.join("\n") };
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Collapse the user's home directory to ~ in a path string.
 */
function collapseHome(filePath: string): string {
  const home = process.env["HOME"];
  if (home && filePath.startsWith(home)) {
    return "~" + filePath.slice(home.length);
  }
  return filePath;
}
