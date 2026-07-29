/**
 * Help text generation per AXI §10.
 *
 * Every subcommand supports --help with a concise, complete reference:
 * available flags with defaults, required arguments, and usage examples.
 *
 * Flag validation per AXI §6:
 * Reject unknown flags with actionable errors listing valid flags.
 * --help always passes through.
 */

export interface FlagDef {
  name: string;
  description?: string;
  type?: "string" | "number" | "boolean";
  default?: string;
  required?: boolean;
}

export interface HelpSection {
  /** The command/subcommand name, e.g. "tasks list" */
  command: string;
  /** One-sentence description of what the command does */
  description: string;
  /** Available flags for this command */
  flags?: FlagDef[];
  /** 2-3 usage examples */
  examples?: string[];
}

/**
 * Format a help section as structured text for --help output.
 *
 * Output pattern:
 *   <command> - <description>
 *   Flags:
 *     --flag1 (type)  Description. default: X
 *     --flag2 (type)  Description.
 *   Examples:
 *     $ command example1
 *     $ command example2
 */
export function formatHelp(section: HelpSection): string {
  const lines: string[] = [];

  // Header
  lines.push(`${section.command} - ${section.description}`);

  // Flags
  if (section.flags && section.flags.length > 0) {
    lines.push("");
    lines.push("Flags:");

    for (const flag of section.flags) {
      let flagLine = `  ${flag.name}`;

      if (flag.type) {
        flagLine += ` (${flag.type})`;
      }

      if (flag.description) {
        flagLine += `  ${flag.description}`;
      }

      if (flag.default !== undefined) {
        flagLine += `  default: ${flag.default}`;
      }

      if (flag.required) {
        flagLine += "  [required]";
      }

      lines.push(flagLine);
    }
  }

  // Examples
  if (section.examples && section.examples.length > 0) {
    lines.push("");
    lines.push("Examples:");

    for (const example of section.examples) {
      lines.push(`  $ ${example}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format an "unknown flag" error per AXI §6.
 *
 * The agent's deterministic next move after an unknown-flag error is to run --help,
 * so we fold that lookup into the error: list the valid flags inline.
 *
 * Output pattern:
 *   error: unknown flag <flag> for <command>
 *   help: valid flags for <command>: <flags...> (--help always allowed)
 */
export function formatFlagError(
  command: string,
  unknownFlag: string,
  validFlags: string[],
): string {
  const flagList = validFlags.join(", ");
  return [
    `error: unknown flag ${unknownFlag} for ${command}`,
    `help: valid flags for ${command}: ${flagList} (--help always allowed)`,
  ].join("\n");
}

/**
 * Format a "renamed flag" error with a targeted hint.
 *
 * Per AXI §6: renamed or removed flags get a targeted hint pointing at the
 * replacement, so the agent can self-correct in one step.
 *
 * Output pattern:
 *   error: <oldFlag> was renamed; use <newFlag> instead
 */
export function formatFlagRemovedError(
  command: string,
  oldFlag: string,
  newFlag: string,
): string {
  return `error: ${oldFlag} was renamed; use ${newFlag} instead for ${command}`;
}
