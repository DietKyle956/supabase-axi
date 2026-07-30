import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import type { ConfigSource } from "../../src/config/types.js";
import { resolveConfig } from "../../src/config/resolve.js";

/**
 * Helper: create a temp directory with optional .supabase.env and supabase/config.toml files.
 */
function setupTempDir(options: {
  dotenvContent?: string;
  tomlContent?: string;
} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "supabase-axi-test-"));
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

describe("resolveConfig", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  });

  // ── projectRef resolution ─────────────────────────────────────────

  describe("projectRef", () => {
    it("should resolve from .supabase.env (priority 1)", () => {
      tempDir = setupTempDir({
        dotenvContent: "SUPABASE_PROJECT_REF=from-env-file",
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("from-env-file");
      expect(config.sources.projectRef).toEqual({ type: ".supabase.env" });
    });

    it("should resolve from environment variable (priority 2)", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_PROJECT_REF: "from-env-var" },
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("from-env-var");
      expect(config.sources.projectRef).toEqual({ type: "environment" });
    });

    it("should prefer .supabase.env over env var", () => {
      tempDir = setupTempDir({
        dotenvContent: "SUPABASE_PROJECT_REF=from-file",
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_PROJECT_REF: "from-env" },
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("from-file");
      expect(config.sources.projectRef).toEqual({ type: ".supabase.env" });
    });

    it("should resolve from config.toml remotes (priority 3)", () => {
      tempDir = setupTempDir({
        tomlContent: `
project_id = "local-name"

[remotes.default]
project_id = "remote-ref-123"
`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("remote-ref-123");
      expect(config.sources.projectRef).toEqual({
        type: "supabase/config.toml",
        path: resolve(tempDir, "supabase", "config.toml"),
      });
    });

    it("should use root project_id when no remotes exist (priority 4)", () => {
      tempDir = setupTempDir({
        tomlContent: `project_id = "only-local"`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("only-local");
    });

    it("should return null when nothing is found", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectRef).toBeNull();
      expect(config.sources.projectRef).toEqual(nf());
    });
  });

  // ── accessToken resolution ───────────────────────────────────────

  describe("accessToken", () => {
    it("should resolve from .supabase.env", () => {
      tempDir = setupTempDir({
        dotenvContent: "SUPABASE_ACCESS_TOKEN=sbp_test_from_file",
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.accessToken).toBe("sbp_test_from_file");
      expect(config.sources.accessToken).toEqual({ type: ".supabase.env" });
    });

    it("should resolve from environment variable", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_ACCESS_TOKEN: "sbp_test_from_env" },
        skipKeychain: true,
      });

      expect(config.accessToken).toBe("sbp_test_from_env");
      expect(config.sources.accessToken).toEqual({ type: "environment" });
    });

    it("should skip keychain when skipKeychain is true", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.accessToken).toBeNull();
      expect(config.sources.accessToken).toEqual(nf());
    });
  });

  // ── serviceRoleKey resolution ────────────────────────────────────

  describe("serviceRoleKey", () => {
    it("should resolve from .supabase.env", () => {
      tempDir = setupTempDir({
        dotenvContent: "SUPABASE_SERVICE_ROLE_KEY=eyJ_test_from_file",
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.serviceRoleKey).toBe("eyJ_test_from_file");
      expect(config.sources.serviceRoleKey).toEqual({ type: ".supabase.env" });
    });

    it("should resolve from environment variable", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_SERVICE_ROLE_KEY: "eyJ_test_from_env" },
        skipKeychain: true,
      });

      expect(config.serviceRoleKey).toBe("eyJ_test_from_env");
      expect(config.sources.serviceRoleKey).toEqual({ type: "environment" });
    });

    it("should return null when not set", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.serviceRoleKey).toBeNull();
      expect(config.sources.serviceRoleKey).toEqual(nf());
    });
  });

  // ── projectName resolution ───────────────────────────────────────

  describe("projectName", () => {
    it("should resolve from config.toml root project_id", () => {
      tempDir = setupTempDir({
        tomlContent: `project_id = "supabase-axi"`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectName).toBe("supabase-axi");
      expect(config.sources.projectName).toEqual({
        type: "supabase/config.toml",
        path: resolve(tempDir, "supabase", "config.toml"),
      });
    });

    it("should return null when no config.toml exists", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectName).toBeNull();
      expect(config.sources.projectName).toEqual(nf());
    });
  });

  // ── Integrated scenarios ─────────────────────────────────────────

  describe("integrated scenarios", () => {
    it("should resolve all fields from .supabase.env", () => {
      tempDir = setupTempDir({
        dotenvContent: `
SUPABASE_PROJECT_REF=ref-from-dotenv
SUPABASE_ACCESS_TOKEN=sbp_token_from_dotenv
SUPABASE_SERVICE_ROLE_KEY=eyJ_key_from_dotenv
`,
        tomlContent: `project_id = "local-project"`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("ref-from-dotenv");
      expect(config.accessToken).toBe("sbp_token_from_dotenv");
      expect(config.serviceRoleKey).toBe("eyJ_key_from_dotenv");
      expect(config.projectName).toBe("local-project");

      // All three dotenv-sourced fields should trace to .supabase.env
      expect(config.sources.projectRef).toEqual({ type: ".supabase.env" });
      expect(config.sources.accessToken).toEqual({ type: ".supabase.env" });
      expect(config.sources.serviceRoleKey).toEqual({ type: ".supabase.env" });
    });

    it("should resolve fields from mixed sources", () => {
      tempDir = setupTempDir({
        dotenvContent: "SUPABASE_PROJECT_REF=from-file",
        tomlContent: `project_id = "mixed-project"`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_ACCESS_TOKEN: "sbp_from_env" },
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("from-file");
      expect(config.accessToken).toBe("sbp_from_env");
      expect(config.serviceRoleKey).toBeNull();
      expect(config.projectName).toBe("mixed-project");

      // Each field should trace to its actual source
      expect(config.sources.projectRef).toEqual({ type: ".supabase.env" });
      expect(config.sources.accessToken).toEqual({ type: "environment" });
      expect(config.sources.serviceRoleKey).toEqual(nf());
      expect(config.sources.projectName).toEqual({
        type: "supabase/config.toml",
        path: resolve(tempDir, "supabase", "config.toml"),
      });
    });

    it("should handle empty .supabase.env gracefully", () => {
      tempDir = setupTempDir({
        dotenvContent: "",
        tomlContent: `project_id = "empty-dotenv-project"`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_ACCESS_TOKEN: "sbp_env_token" },
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("empty-dotenv-project");
      expect(config.accessToken).toBe("sbp_env_token");
    });

    it("should fallback to config.toml root when no remotes exist", () => {
      tempDir = setupTempDir({
        tomlContent: `project_id = "standalone-project"`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      // projectRef falls through to config.toml root project_id
      expect(config.projectRef).toBe("standalone-project");
      expect(config.projectName).toBe("standalone-project");
    });

    it("should handle partial .supabase.env (some fields missing)", () => {
      tempDir = setupTempDir({
        dotenvContent: "SUPABASE_ACCESS_TOKEN=sbp_partial",
        tomlContent: `
project_id = "partial-project"

[remotes.default]
project_id = "partial-remote"
`,
      });

      const config = resolveConfig({
        projectDir: tempDir,
        env: { SUPABASE_SERVICE_ROLE_KEY: "eyJ_partial_env" },
        skipKeychain: true,
      });

      // projectRef: dotenv doesn't have it, env doesn't, falls to config.toml remote
      expect(config.projectRef).toBe("partial-remote");
      // accessToken: from dotenv
      expect(config.accessToken).toBe("sbp_partial");
      // serviceRoleKey: from env var
      expect(config.serviceRoleKey).toBe("eyJ_partial_env");
      // projectName: from config.toml root
      expect(config.projectName).toBe("partial-project");
    });
  });

  // ── Option handling ──────────────────────────────────────────────

  describe("options", () => {
    it("should use explicit envFilePath", () => {
      tempDir = setupTempDir();
      const customEnvPath = join(tempDir, "custom.env");
      writeFileSync(customEnvPath, "SUPABASE_PROJECT_REF=custom-path-ref");

      const config = resolveConfig({
        projectDir: tempDir,
        envFilePath: customEnvPath,
        env: {},
        skipKeychain: true,
      });

      expect(config.projectRef).toBe("custom-path-ref");
      expect(config.sources.projectRef).toEqual({ type: ".supabase.env" });
    });

    it("should respect skipKeychain (no keychain shell-out)", () => {
      tempDir = setupTempDir();

      const config = resolveConfig({
        projectDir: tempDir,
        env: {},
        skipKeychain: true,
      });

      expect(config.accessToken).toBeNull();
      // Should not attempt keychain lookup
    });
  });
});
