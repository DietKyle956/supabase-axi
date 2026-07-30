/**
 * Init command: configure supabase-axi with Supabase project credentials.
 *
 * Flow:
 *   1. Auto-discover existing config via resolveConfig()
 *   2. If already configured and not forced, report no-op
 *   3. Interactive: prompt for missing values with defaults
 *   4. Non-interactive: require values from flags or discovery
 *   5. Write .supabase.env
 *   6. Output TOON-formatted summary
 *
 * AXI compliance:
 *   - Errors go to stdout in structured format (AXI §6)
 *   - --help provides concise reference (AXI §10)
 *   - No-args home view is the primary setup path (AXI §8)
 */

import { createInterface } from "node:readline";
import { existsSync, writeFileSync } from "node:fs";
import type { ResolvedConfig, ConfigSource } from "../config/types.js";
import { resolveConfig } from "../config/resolve.js";
import { toon } from "../format/toon.js";
import { usageError, runtimeError, noopError, formatError } from "../format/error.js";
import { formatHelp, type HelpSection, type FlagDef } from "../format/help.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface InitOptions {
  /** Run without interactive prompts. Requires all values via flags or discovery. */
  nonInteractive: boolean;
  /** Override for project ref. */
  projectRef?: string;
  /** Override for access token. */
  accessToken?: string;
  /** Override for service role key. */
  serviceRoleKey?: string;
  /** Overwrite existing .supabase.env even if already configured. */
  force: boolean;
  /** Directory to write .supabase.env into. Default: cwd. */
  projectDir?: string;
  /** Path to read supabase/config.toml from (for auto-discovery). */
  configPath?: string;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Run the init command.
 * Returns the exit code and formatted output for stdout.
 */
export async function initCommand(options: InitOptions): Promise<{
  exitCode: number;
  output: string;
}> {
  const projectDir = options.projectDir ?? process.cwd();
  const envFilePath = `${projectDir}/.supabase.env`;

  // Step 1: Auto-discover existing config
  const discovered = resolveConfig({
    projectDir: options.configPath ?? projectDir,
    envFilePath,
    skipKeychain: false,
  });

  // Merge flag overrides into discovered values
  const merged: ResolvedConfig = {
    projectRef: options.projectRef ?? discovered.projectRef,
    accessToken: options.accessToken ?? discovered.accessToken,
    serviceRoleKey: options.serviceRoleKey ?? discovered.serviceRoleKey,
    projectName: discovered.projectName,
    sources: {
      projectRef: options.projectRef
        ? { type: "environment" }
        : discovered.sources.projectRef,
      accessToken: options.accessToken
        ? { type: "environment" }
        : discovered.sources.accessToken,
      serviceRoleKey: options.serviceRoleKey
        ? { type: "environment" }
        : discovered.sources.serviceRoleKey,
      projectName: discovered.sources.projectName,
    },
  };

  // Step 2: Check if already configured
  const hasRequired = merged.projectRef && merged.accessToken;
  const envFileExists = existsSync(envFilePath);

  if (hasRequired && envFileExists && !options.force) {
    const err = noopError(
      "supabase-axi is already configured. Run with --force to reconfigure.",
    );
    const summaryLines: string[] = [formatError(err), "", formatConfigSummary(merged)];
    return { exitCode: err.exitCode, output: summaryLines.join("\n") };
  }

  // Step 3/4: Gather missing values
  let finalConfig: ResolvedConfig;

  if (options.nonInteractive) {
    finalConfig = validateNonInteractive(merged);
  } else {
    finalConfig = await promptInteractive(merged, discovered);
  }

  // Step 5: Write .supabase.env
  try {
    writeFileSync(envFilePath, generateDotenvContent(finalConfig), "utf-8");
  } catch (err: unknown) {
    const error = runtimeError(
      `Failed to write ${envFilePath}`,
      err instanceof Error ? err.message : "Check filesystem permissions",
    );
    return { exitCode: error.exitCode, output: formatError(error) };
  }

  // Step 6: Output summary
  const summaryLines = [
    "# supabase-axi init complete",
    "",
    formatConfigSummary(finalConfig),
    "",
    `config written to: ${envFilePath}`,
  ];

  return { exitCode: 0, output: summaryLines.join("\n") };
}

// ── Built-in help ──────────────────────────────────────────────────────

export function initHelp(): string {
  const flags: FlagDef[] = [
    {
      name: "--non-interactive",
      type: "boolean",
      description: "Run without prompts. Requires all values via flags or discovery.",
    },
    {
      name: "--project-ref",
      type: "string",
      description: "Supabase project reference ID.",
    },
    {
      name: "--access-token",
      type: "string",
      description: "Supabase personal access token (sbp_...).",
    },
    {
      name: "--service-role-key",
      type: "string",
      description: "Supabase service role key (optional admin access).",
    },
    {
      name: "--force",
      type: "boolean",
      description: "Overwrite existing .supabase.env.",
    },
  ];

  const section: HelpSection = {
    command: "supabase-axi init",
    description:
      "Configure supabase-axi with your Supabase project credentials. Auto-discovers from local Supabase CLI config and OS keychain.",
    flags,
    examples: [
      "supabase-axi init",
      "supabase-axi init --non-interactive --project-ref abcdef --access-token sbp_xxx",
      "supabase-axi init --force",
    ],
  };

  return formatHelp(section);
}

// ── Validation ─────────────────────────────────────────────────────────

/**
 * Validate a project reference string.
 * Returns an error message string if invalid, null if valid.
 */
export function validateProjectRef(ref: string): string | null {
  if (ref.length === 0) {
    return "project reference must not be empty";
  }
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(ref)) {
    return "project reference must be lowercase alphanumeric, 3-40 chars, starting with a letter";
  }
  return null;
}

/**
 * Validate an access token string.
 * Returns an error message string if invalid, null if valid.
 */
export function validateAccessToken(token: string): string | null {
  if (token.length === 0) {
    return "access token must not be empty";
  }
  if (!token.startsWith("sbp_")) {
    return "access token should start with sbp_ (personal access token format)";
  }
  if (token.length < 20) {
    return "access token appears too short (should be 60+ characters)";
  }
  return null;
}

// ── Output helpers ─────────────────────────────────────────────────────

/**
 * Generate the .supabase.env file content from a resolved config.
 */
export function generateDotenvContent(config: ResolvedConfig): string {
  const lines: string[] = [
    "# Generated by supabase-axi init",
    `# ${new Date().toISOString()}`,
    "",
  ];

  if (config.projectRef) {
    lines.push(`SUPABASE_PROJECT_REF=${config.projectRef}`);
  } else {
    lines.push(`# SUPABASE_PROJECT_REF=your_project_ref_here`);
  }

  if (config.accessToken) {
    lines.push(`SUPABASE_ACCESS_TOKEN=${config.accessToken}`);
  } else {
    lines.push(`# SUPABASE_ACCESS_TOKEN=your_personal_access_token_here`);
  }

  if (config.serviceRoleKey) {
    lines.push(`SUPABASE_SERVICE_ROLE_KEY=${config.serviceRoleKey}`);
  } else {
    lines.push(`# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format a config summary in TOON format.
 */
export function formatConfigSummary(config: ResolvedConfig): string {
  const record: Record<string, Record<string, string | null>> = {};

  record["projectRef"] = {
    value: config.projectRef,
    source: sourceLabel(config.sources.projectRef),
  };

  record["accessToken"] = {
    value: maskToken(config.accessToken),
    source: sourceLabel(config.sources.accessToken),
  };

  record["serviceRoleKey"] = {
    value: config.serviceRoleKey ? maskToken(config.serviceRoleKey) : null,
    source: sourceLabel(config.sources.serviceRoleKey),
  };

  record["projectName"] = {
    value: config.projectName,
    source: sourceLabel(config.sources.projectName),
  };

  return toon(record);
}

// ── Internal helpers ───────────────────────────────────────────────────

function sourceLabel(source: ConfigSource): string {
  switch (source.type) {
    case ".supabase.env":
      return ".supabase.env";
    case "environment":
      return "env var";
    case "supabase/config.toml":
      return `config.toml`;
    case "keychain":
      return "OS keychain";
    case "~/.supabase/access-token":
      return "~/.supabase/access-token";
    case "not-found":
      return "(none)";
    default:
      return "(unknown)";
  }
}

function maskToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return token.slice(0, 4) + "...";
  return token.slice(0, 8) + "..." + token.slice(-4);
}

/**
 * Validate that all required fields are present for non-interactive mode.
 * Returns a validated config or throws usageError output.
 */
function validateNonInteractive(config: ResolvedConfig): ResolvedConfig {
  const missing: string[] = [];

  if (!config.projectRef) {
    missing.push("project ref (use --project-ref or set SUPABASE_PROJECT_REF)");
  }
  if (!config.accessToken) {
    missing.push("access token (use --access-token or set SUPABASE_ACCESS_TOKEN)");
  }

  if (missing.length > 0) {
    const error = usageError(
      "Missing required configuration",
      `Provide: ${missing.join("; ")}. Or run without --non-interactive for guided setup.`,
    );
    // Throw special marker — caught by caller
    throw error;
  }

  return config;
}

/**
 * Interactive prompting loop. Shows discovered values as defaults,
 * prompts for any missing or overridable fields.
 */
async function promptInteractive(
  merged: ResolvedConfig,
  discovered: ResolvedConfig,
): Promise<ResolvedConfig> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });

  try {
    console.log("# supabase-axi init");
    console.log("");
    console.log("Press Enter to accept the discovered default (shown in brackets).");
    console.log("");

    // Project ref
    let projectRef: string | null = null;
    {
      const defaultRef = merged.projectRef ?? discovered.projectRef;
      const defaultHint = defaultRef ? ` [${defaultRef}]` : "";
      const prompt = `Project reference${defaultHint}: `;

      const answer = await ask(prompt);
      if (answer.length > 0) {
        projectRef = answer;
      } else if (defaultRef) {
        projectRef = defaultRef;
      } else {
        console.log("  (skipped — required)");
      }

      // Validate if provided
      if (projectRef) {
        const err = validateProjectRef(projectRef);
        if (err) {
          console.log(`  warning: ${err}`);
        }
      }
    }

    // Access token
    let accessToken: string | null = null;
    {
      const defaultToken = merged.accessToken ?? discovered.accessToken;
      const defaultHint = defaultToken ? ` [${maskToken(defaultToken)}]` : "";
      const prompt = `Access token (sbp_...)${defaultHint}: `;

      const answer = await ask(prompt);
      if (answer.length > 0) {
        accessToken = answer;
      } else if (defaultToken) {
        accessToken = defaultToken;
      } else {
        console.log("  (skipped — required)");
        console.log(
          "  Create a token at: https://supabase.com/dashboard/account/tokens",
        );
      }

      // Validate if provided
      if (accessToken) {
        const err = validateAccessToken(accessToken);
        if (err) {
          console.log(`  warning: ${err}`);
        }
      }
    }

    // Service role key (optional)
    let serviceRoleKey: string | null = null;
    {
      const defaultKey = merged.serviceRoleKey ?? discovered.serviceRoleKey;
      const defaultHint = defaultKey ? ` [${maskToken(defaultKey)}]` : " [optional]";
      const prompt = `Service role key${defaultHint}: `;

      const answer = await ask(prompt);
      if (answer.length > 0) {
        serviceRoleKey = answer;
      } else if (defaultKey) {
        serviceRoleKey = defaultKey;
      }
      // Service role key is optional, no warning if skipped
    }

    console.log("");

    return {
      projectRef,
      accessToken,
      serviceRoleKey,
      projectName: merged.projectName ?? discovered.projectName,
      sources: {
        projectRef: projectRef
          ? { type: "environment" }
          : discovered.sources.projectRef,
        accessToken: accessToken
          ? { type: "environment" }
          : discovered.sources.accessToken,
        serviceRoleKey: serviceRoleKey
          ? { type: "environment" }
          : discovered.sources.serviceRoleKey,
        projectName: discovered.sources.projectName,
      },
    };
  } finally {
    rl.close();
  }
}
