/**
 * CLI router: route registry, argument parsing, flag validation, and dispatch.
 *
 * Two-pass parsing:
 *   1. Lax pass to identify subcommand and scan flag names from raw argv
 *   2. Validate flag names against the command's known flags (+ --help, --version)
 *   3. Strict pass with parseArgs using the command's flag definitions
 *   4. Dispatch to handler with ParsedArgs
 *
 * AXI compliance:
 *   - §6: Reject unknown flags, --help always passes
 *   - §8: No-args shows home view (content-first, not usage manual)
 *   - §10: --help on any (sub)command
 */

import { parseArgs } from "node:util";
import type { FlagDef } from "./format/help.js";
import { formatHelp, formatFlagError } from "./format/help.js";
import { formatError, usageError } from "./format/error.js";
import { homeView } from "./commands/home.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ──────────────────────────────────────────────────────────────

export interface ParsedArgs {
  /** Flag values keyed by camelCase name (e.g. { projectRef: "abc", force: true }) */
  flags: Record<string, string | boolean | undefined>;
  /** Positional arguments after the subcommand name */
  positionals: string[];
}

export interface CommandResult {
  exitCode: number;
  output: string;
}

export type CommandHandler = (args: ParsedArgs) => Promise<CommandResult>;

export interface CommandDef {
  /** Subcommand name, e.g. "init" */
  name: string;
  /** One-sentence description for help and home view listing */
  description: string;
  /** Known flags for validation and --help output */
  flags?: FlagDef[];
  /** Usage examples for --help output */
  examples?: string[];
  /** The handler function */
  handler: CommandHandler;
}

export interface Router {
  /** All registered commands in insertion order */
  commands: CommandDef[];
  /** Register a command */
  register(cmd: CommandDef): void;
  /** Parse argv and dispatch to the appropriate handler */
  route(argv: string[]): Promise<CommandResult>;
}

// ── Globals ────────────────────────────────────────────────────────────

const GLOBAL_FLAGS = new Set(["--help", "--version"]);

// ── Factory ────────────────────────────────────────────────────────────

export function createRouter(): Router {
  const commands: CommandDef[] = [];

  const router: Router = {
    commands,

    register(cmd: CommandDef): void {
      commands.push(cmd);
    },

    async route(argv: string[]): Promise<CommandResult> {
      // No subcommand -> home view (AXI §8)
      if (argv.length === 0 || (argv.length === 1 && GLOBAL_FLAGS.has(argv[0]!))) {
        return handleTopLevel(argv, commands);
      }

      // Find the subcommand
      const subcommand = argv[0]!;

      // --help or --version at top level (before any subcommand position)
      if (GLOBAL_FLAGS.has(subcommand)) {
        return handleTopLevel(argv, commands);
      }

      // Check if subcommand exists but check for --help/--version as first flag
      // e.g. "supabase-axi --version" is already handled above
      // e.g. "supabase-axi --help init" -> this has --help as first arg

      const cmd = commands.find((c) => c.name === subcommand);
      if (!cmd) {
        // Unknown command
        const available = commands.map((c) => c.name).join(", ");
        const error = usageError(
          `unknown command: ${subcommand}`,
          `Available commands: ${available}. Run \`supabase-axi --help\` for details.`,
        );
        return { exitCode: error.exitCode, output: formatError(error) };
      }

      // Split remaining args
      const cmdArgs = argv.slice(1);

      // Scan for --help flag in the command's args
      const hasHelp = cmdArgs.some((a) => a === "--help" || a.startsWith("--help="));

      if (hasHelp) {
        return commandHelp(cmd);
      }

      // Validate flags
      const unknownFlagError = validateFlags(cmdArgs, cmd);
      if (unknownFlagError) {
        return unknownFlagError;
      }

      // Parse flags with command's flag definitions
      let parsedFlags: Record<string, string | boolean | undefined>;
      let parsedPositionals: string[];

      try {
        const opts = flagsToParseArgsOptions(cmd.flags);
        const result = parseArgs({
          args: cmdArgs,
          options: opts,
          strict: true,
          allowPositionals: true,
        });
        parsedFlags = result.values as Record<string, string | boolean | undefined>;
        parsedPositionals = result.positionals;
      } catch (err: unknown) {
        // parseArgs throws on strict violations - translate to AXI format
        const message =
          err instanceof Error ? err.message : "Failed to parse arguments";
        const error = usageError(message, `Run \`supabase-axi ${cmd.name} --help\` for usage.`);
        return { exitCode: error.exitCode, output: formatError(error) };
      }

      // Dispatch to handler
      try {
        return await cmd.handler({
          flags: parsedFlags,
          positionals: parsedPositionals,
        });
      } catch (err: unknown) {
        // Handler threw - extract structured error if possible
        if (
          typeof err === "object" &&
          err !== null &&
          "exitCode" in err &&
          "message" in err
        ) {
          const axErr = err as { exitCode: number; message: string; suggestion?: string };
          return {
            exitCode: axErr.exitCode,
            output: formatError({
              message: axErr.message,
              exitCode: axErr.exitCode,
              suggestion: axErr.suggestion,
            }),
          };
        }
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        return { exitCode: 1, output: `error: ${message}` };
      }
    },
  };

  return router;
}

// ── Top-level handlers ─────────────────────────────────────────────────

function handleTopLevel(argv: string[], commands: CommandDef[]): CommandResult {
  if (argv.includes("--version")) {
    return version();
  }
  if (argv.includes("--help")) {
    return topLevelHelp(commands);
  }
  return homeView(commands);
}

function version(): CommandResult {
  const pkgPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
  let version = "unknown";
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    version = pkg.version ?? "unknown";
  } catch {
    // Fallback: can't read package.json
  }
  return { exitCode: 0, output: version };
}

// ── Help ────────────────────────────────────────────────────────────────

function topLevelHelp(commands: CommandDef[]): CommandResult {
  const lines: string[] = [
    "supabase-axi - AXI-compliant Supabase API CLI",
    "",
  ];

  if (commands.length > 0) {
    lines.push("Commands:");
    for (const cmd of commands) {
      lines.push(`  ${cmd.name.padEnd(14)} ${cmd.description}`);
    }
    lines.push("");
  }

  lines.push(
    "Run `supabase-axi <command> --help` for command-specific help.",
  );

  return { exitCode: 0, output: lines.join("\n") };
}

function commandHelp(cmd: CommandDef): CommandResult {
  const section = {
    command: `supabase-axi ${cmd.name}`,
    description: cmd.description,
    flags: cmd.flags,
    examples: cmd.examples,
  };
  return { exitCode: 0, output: formatHelp(section) };
}

// ── Flag validation ─────────────────────────────────────────────────────

const HELP_FLAGS = new Set(["--help", "-h"]);

function validateFlags(
  argv: string[],
  cmd: CommandDef,
): CommandResult | null {
  const knownNames = new Set([
    ...(cmd.flags ?? []).map((f) => f.name),
    ...HELP_FLAGS,
  ]);

  for (const arg of argv) {
    if (arg === "-h") continue; // always allowed shorthand
    if (!arg.startsWith("--")) continue; // positional, skip

    const eqIdx = arg.indexOf("=");
    const flagName = eqIdx === -1 ? arg : arg.slice(0, eqIdx);

    if (!knownNames.has(flagName)) {
      const validFlags = [
        ...(cmd.flags ?? []).map((f) => f.name),
        "--help",
      ];
      const output = formatFlagError(
        `supabase-axi ${cmd.name}`,
        flagName,
        validFlags,
      );
      return { exitCode: 2, output };
    }
  }

  return null;
}

// ── Flag name conversion ────────────────────────────────────────────────

/**
 * Convert a kebab-case flag name to camelCase for parseArgs.
 *   --project-ref   -> projectRef
 *   --force         -> force
 *   --non-interactive -> nonInteractive
 */
export function flagNameToKey(flagName: string): string {
  // Strip leading --
  const name = flagName.startsWith("--") ? flagName.slice(2) : flagName;
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convert a FlagDef[] to parseArgs options format.
 */
function flagsToParseArgsOptions(
  flags: FlagDef[] | undefined,
): Record<string, { type: "string" | "boolean"; short?: string }> {
  const opts: Record<string, { type: "string" | "boolean"; short?: string }> = {};
  if (!flags) return opts;

  for (const flag of flags) {
    const key = flagNameToKey(flag.name);
    const type = flag.type === "boolean" ? "boolean" : "string";
    opts[key] = { type };
  }

  return opts;
}

// ── Stub handler ────────────────────────────────────────────────────────

/**
 * Create a stub handler for future commands.
 * Returns a message indicating the command is coming in a future ticket.
 */
export function stubHandler(
  name: string,
  _ticket: number,
): CommandHandler {
  return async () => ({
    exitCode: 0,
    output: `supabase-axi ${name} — coming soon`,
  });
}
