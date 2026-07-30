import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import type { ResolvedConfig, ConfigSource } from "../../src/config/types.js";
import {
  validateProjectRef,
  validateAccessToken,
  formatConfigSummary,
  generateDotenvContent,
  initHelp,
  initCommand,
} from "../../src/commands/init.js";

// ── Helpers ────────────────────────────────────────────────────────────

function setupTempDir(options: {
  dotenvContent?: string;
  tomlContent?: string;
} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "supabase-axi-init-test-"));
  const resolvedDir = resolve(dir);

  if (options.dotenvContent !== undefined) {
    writeFileSync(join(resolvedDir, ".supabase.env"), options.dotenvContent);
  }

  if (options.tomlContent !== undefined) {
    const supabaseDir = join(resolvedDir, "supabase");
    mkdirSync(supabaseDir, { recursive: true });
    writeFileSync(join(supabaseDir, "config.toml"), options.tomlContent);
  }

  return resolvedDir;
}

function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function nf(): ConfigSource {
  return { type: "not-found" };
}

// ── Validation tests ───────────────────────────────────────────────────

describe("validateProjectRef", () => {
  it("should accept valid project refs", () => {
    expect(validateProjectRef("abc")).toBeNull();
    expect(validateProjectRef("mxxjaefcqgosyqbfyzxk")).toBeNull();
    expect(validateProjectRef("my_project_123")).toBeNull();
  });

  it("should reject empty ref", () => {
    expect(validateProjectRef("")).toContain("must not be empty");
  });

  it("should reject ref starting with number", () => {
    const err = validateProjectRef("123abc");
    expect(err).not.toBeNull();
    expect(err).toContain("lowercase alphanumeric");
  });

  it("should reject ref with uppercase", () => {
    const err = validateProjectRef("MyProject");
    expect(err).not.toBeNull();
    expect(err).toContain("lowercase alphanumeric");
  });

  it("should reject ref that is too short", () => {
    const err = validateProjectRef("ab");
    expect(err).not.toBeNull();
    expect(err).toContain("3-40 chars");
  });
});

describe("validateAccessToken", () => {
  it("should accept valid sbp_ tokens", () => {
    expect(
      validateAccessToken("sbp_oauth_f63401679d045d68fa38f204a40bc670f5927e81"),
    ).toBeNull();
  });

  it("should reject empty token", () => {
    expect(validateAccessToken("")).toContain("must not be empty");
  });

  it("should warn about non-sbp_ prefix", () => {
    const err = validateAccessToken("abc123");
    expect(err).not.toBeNull();
    expect(err).toContain("sbp_");
  });

  it("should warn about short tokens", () => {
    const err = validateAccessToken("sbp_short");
    expect(err).not.toBeNull();
    expect(err).toContain("too short");
  });
});

// ── Output helper tests ────────────────────────────────────────────────

describe("formatConfigSummary", () => {
  it("should produce TOON output", () => {
    const config: ResolvedConfig = {
      projectRef: "test-ref-123",
      accessToken: "sbp_test_token_abc123",
      serviceRoleKey: null,
      projectName: "test-project",
      sources: {
        projectRef: { type: ".supabase.env" },
        accessToken: { type: "environment" },
        serviceRoleKey: nf(),
        projectName: { type: "supabase/config.toml", path: "/tmp/config.toml" },
      },
    };

    const output = formatConfigSummary(config);
    expect(output).toContain("test-ref-123");
    expect(output).toContain("sbp_test...c123"); // masked
    expect(output).toContain("test-project");
    expect(output).toContain(".supabase.env");
    expect(output).toContain("env var");
    expect(output).toContain("config.toml");
  });

  it("should show (none) for not-found sources", () => {
    const config: ResolvedConfig = {
      projectRef: null,
      accessToken: null,
      serviceRoleKey: null,
      projectName: null,
      sources: {
        projectRef: nf(),
        accessToken: nf(),
        serviceRoleKey: nf(),
        projectName: nf(),
      },
    };

    const output = formatConfigSummary(config);
    expect(output).toContain("(none)");
  });
});

describe("generateDotenvContent", () => {
  it("should generate valid .env content with all fields", () => {
    const config: ResolvedConfig = {
      projectRef: "my-ref",
      accessToken: "sbp_my_token",
      serviceRoleKey: "eyJ_key",
      projectName: "my-project",
      sources: {
        projectRef: nf(),
        accessToken: nf(),
        serviceRoleKey: nf(),
        projectName: nf(),
      },
    };

    const content = generateDotenvContent(config);
    expect(content).toContain("SUPABASE_PROJECT_REF=my-ref");
    expect(content).toContain("SUPABASE_ACCESS_TOKEN=sbp_my_token");
    expect(content).toContain("SUPABASE_SERVICE_ROLE_KEY=eyJ_key");
    expect(content).toContain("# Generated by supabase-axi init");
  });

  it("should comment out missing fields", () => {
    const config: ResolvedConfig = {
      projectRef: "only-ref",
      accessToken: null,
      serviceRoleKey: null,
      projectName: null,
      sources: {
        projectRef: nf(),
        accessToken: nf(),
        serviceRoleKey: nf(),
        projectName: nf(),
      },
    };

    const content = generateDotenvContent(config);
    expect(content).toContain("SUPABASE_PROJECT_REF=only-ref");
    expect(content).toContain("# SUPABASE_ACCESS_TOKEN=");
    expect(content).toContain("# SUPABASE_SERVICE_ROLE_KEY=");
  });
});

// ── Help text tests ────────────────────────────────────────────────────

describe("initHelp", () => {
  it("should generate help text with all flags", () => {
    const help = initHelp();
    expect(help).toContain("supabase-axi init");
    expect(help).toContain("--non-interactive");
    expect(help).toContain("--project-ref");
    expect(help).toContain("--access-token");
    expect(help).toContain("--service-role-key");
    expect(help).toContain("--force");
    expect(help).toContain("Examples:");
  });
});

// ── Init command integration tests ─────────────────────────────────────

describe("initCommand", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  });

  it("should report no-op when already configured", async () => {
    tempDir = setupTempDir({
      dotenvContent: `
SUPABASE_PROJECT_REF=existing-ref
SUPABASE_ACCESS_TOKEN=sbp_existing_token
`,
    });

    const result = await initCommand({
      nonInteractive: true,
      force: false,
      projectDir: tempDir,
    });

    expect(result.exitCode).toBe(0); // no-op exit code
    expect(result.output).toContain("already configured");
  });

  it("should overwrite with --force", async () => {
    tempDir = setupTempDir({
      dotenvContent: `
SUPABASE_PROJECT_REF=old-ref
SUPABASE_ACCESS_TOKEN=sbp_old_token
`,
    });

    const result = await initCommand({
      nonInteractive: true,
      force: true,
      projectRef: "new-ref",
      accessToken: "sbp_new_token_long_enough_123",
      projectDir: tempDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("init complete");

    // Verify file was written with new values
    const written = readFileSync(join(tempDir, ".supabase.env"), "utf-8");
    expect(written).toContain("new-ref");
    expect(written).toContain("sbp_new_token_long_enough_123");
  });

  it("should error in non-interactive mode with missing values", async () => {
    tempDir = setupTempDir();
    let caught: unknown = null;

    try {
      await initCommand({
        nonInteractive: true,
        force: false,
        projectDir: tempDir,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    // Should be an AxError with exit code 2
    const err = caught as { exitCode: number; message: string };
    expect(err.exitCode).toBe(2);
    expect(err.message).toContain("Missing required");
  });

  it("should succeed in non-interactive mode with flag overrides", async () => {
    tempDir = setupTempDir();

    const result = await initCommand({
      nonInteractive: true,
      force: false,
      projectRef: "flag-provided-ref",
      accessToken: "sbp_flag_provided_token_ok",
      projectDir: tempDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("init complete");

    // Verify file was written
    const written = readFileSync(join(tempDir, ".supabase.env"), "utf-8");
    expect(written).toContain("flag-provided-ref");
    expect(written).toContain("sbp_flag_provided_token_ok");
  });

  it("should write .supabase.env file", async () => {
    tempDir = setupTempDir();

    await initCommand({
      nonInteractive: true,
      force: false,
      projectRef: "write-test-ref",
      accessToken: "sbp_write_test_token_here_ok",
      projectDir: tempDir,
    });

    const envPath = join(tempDir, ".supabase.env");
    expect(existsSync(envPath)).toBe(true);

    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("# Generated by supabase-axi init");
    expect(content).toContain("SUPABASE_PROJECT_REF=write-test-ref");
    expect(content).toContain("SUPABASE_ACCESS_TOKEN=sbp_write_test_token_here_ok");
  });

  it("should include summary in output", async () => {
    tempDir = setupTempDir();

    const result = await initCommand({
      nonInteractive: true,
      force: false,
      projectRef: "summary-ref",
      accessToken: "sbp_summary_token_here_ok_123",
      projectDir: tempDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("summary-ref");
    expect(result.output).toContain("config written to");
  });
});
