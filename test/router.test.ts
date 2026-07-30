import { describe, it, expect } from "vitest";
import { createRouter, type CommandDef } from "../src/router.js";

// ── Test helpers ────────────────────────────────────────────────────────

function makeTestRouter(extraCommands?: CommandDef[]) {
  const router = createRouter();

  router.register({
    name: "test-cmd",
    description: "A test command for unit tests",
    flags: [
      {
        name: "--name",
        type: "string",
        description: "Name parameter",
      },
      {
        name: "--verbose",
        type: "boolean",
        description: "Verbose output",
      },
    ],
    examples: ["supabase-axi test-cmd --name hello", "supabase-axi test-cmd --verbose"],
    handler: async (args) => ({
      exitCode: 0,
      output: `test-cmd ran with name=${args.flags["name"] ?? "(none)"} verbose=${args.flags["verbose"] ?? false}`,
    }),
  });

  if (extraCommands) {
    for (const cmd of extraCommands) {
      router.register(cmd);
    }
  }

  return router;
}

// ── Home view (no args) ───────────────────────────────────────────────

describe("router home view", () => {
  it("should return home view when given no args", async () => {
    const router = makeTestRouter();
    const result = await router.route([]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("bin:");
    expect(result.output).toContain("description:");
  });

  it("should list registered commands in home view", async () => {
    const router = makeTestRouter();
    const result = await router.route([]);
    expect(result.output).toContain("test-cmd");
    expect(result.output).toContain("A test command for unit tests");
  });

  it("should include help hints in home view", async () => {
    const router = makeTestRouter();
    const result = await router.route([]);
    expect(result.output).toContain("help[");
  });
});

// ── --help top-level ───────────────────────────────────────────────────

describe("router --help top-level", () => {
  it("should show top-level help with --help", async () => {
    const router = makeTestRouter();
    const result = await router.route(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("supabase-axi");
    expect(result.output).toContain("Commands:");
  });

  it("should list commands in --help output", async () => {
    const router = makeTestRouter();
    const result = await router.route(["--help"]);
    expect(result.output).toContain("test-cmd");
  });

  it("should suggest per-command help", async () => {
    const router = makeTestRouter();
    const result = await router.route(["--help"]);
    expect(result.output).toContain("<command> --help");
  });
});

// ── --version ──────────────────────────────────────────────────────────

describe("router --version", () => {
  it("should return version string", async () => {
    const router = makeTestRouter();
    const result = await router.route(["--version"]);
    expect(result.exitCode).toBe(0);
    // Version should be a non-empty string (reads from package.json)
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ── Unknown command ────────────────────────────────────────────────────

describe("router unknown command", () => {
  it("should error with exit code 2 for unknown command", async () => {
    const router = makeTestRouter();
    const result = await router.route(["bogus"]);
    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("error:");
    expect(result.output).toContain("unknown command");
    expect(result.output).toContain("bogus");
  });

  it("should list available commands in error", async () => {
    const router = makeTestRouter();
    const result = await router.route(["nope"]);
    expect(result.output).toContain("test-cmd");
    expect(result.output).toContain("help:");
  });
});

// ── Per-command --help ─────────────────────────────────────────────────

describe("router per-command --help", () => {
  it("should show command help when --help follows command name", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("supabase-axi test-cmd");
    expect(result.output).toContain("A test command for unit tests");
  });

  it("should list command flags in --help", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--help"]);
    expect(result.output).toContain("--name");
    expect(result.output).toContain("--verbose");
  });

  it("should include examples in --help", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--help"]);
    expect(result.output).toContain("Examples:");
    expect(result.output).toContain("supabase-axi test-cmd --name hello");
  });

  it("should skip flag validation when --help is present", async () => {
    const router = makeTestRouter();
    // --help should work even with an unknown flag present
    const result = await router.route(["test-cmd", "--help", "--fake-flag"]);
    expect(result.exitCode).toBe(0);
  });
});

// ── Flag validation ────────────────────────────────────────────────────

describe("router flag validation", () => {
  it("should reject unknown flags for a command", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--bogus-flag"]);
    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("error:");
    expect(result.output).toContain("unknown flag");
    expect(result.output).toContain("--bogus-flag");
  });

  it("should list valid flags in unknown flag error", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--wrong"]);
    expect(result.output).toContain("--name");
    expect(result.output).toContain("--verbose");
    expect(result.output).toContain("--help");
  });

  it("should reject unknown flag with =value syntax", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--bad=value"]);
    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("--bad");
  });

  it("should accept known flags", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--name", "world"]);
    expect(result.exitCode).toBe(0);
  });

  it("should reject unknown flags mixed with known flags", async () => {
    const router = makeTestRouter();
    const result = await router.route([
      "test-cmd",
      "--name",
      "hello",
      "--invalid",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("--invalid");
  });
});

// ── Command dispatch ───────────────────────────────────────────────────

describe("router command dispatch", () => {
  it("should dispatch to the correct handler", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--name", "hello"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("name=hello");
  });

  it("should handle boolean flags", async () => {
    const router = makeTestRouter();
    const result = await router.route(["test-cmd", "--verbose"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("verbose=true");
  });

  it("should handle combined flags", async () => {
    const router = makeTestRouter();
    const result = await router.route([
      "test-cmd",
      "--name",
      "test",
      "--verbose",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("name=test");
    expect(result.output).toContain("verbose=true");
  });
});

// ── Multiple commands ──────────────────────────────────────────────────

describe("router multi-command", () => {
  it("should dispatch to the correct command among multiple", async () => {
    const router = makeTestRouter([
      {
        name: "other",
        description: "Another command",
        flags: [{ name: "--count", type: "number" }],
        handler: async (args) => ({
          exitCode: 0,
          output: `other count=${args.flags["count"]}`,
        }),
      },
    ]);

    const result1 = await router.route(["test-cmd", "--verbose"]);
    expect(result1.output).toContain("test-cmd ran");

    const result2 = await router.route(["other", "--count", "42"]);
    expect(result2.output).toContain("other count=42");
  });
});

// ── Empty router ───────────────────────────────────────────────────────

describe("router with no commands", () => {
  it("should show home view even with no registered commands", async () => {
    const router = createRouter();
    const result = await router.route([]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("bin:");
  });
});
