import { describe, it, expect } from "vitest";
import { homeView } from "../../src/commands/home.js";
import type { CommandDef } from "../../src/router.js";

// ── Test fixtures ──────────────────────────────────────────────────────

const sampleCommands: CommandDef[] = [
  {
    name: "init",
    description: "Configure supabase-axi with Supabase project credentials",
    handler: async () => ({ exitCode: 0, output: "" }),
  },
  {
    name: "tables",
    description: "List database tables",
    handler: async () => ({ exitCode: 0, output: "" }),
  },
];

// ── Tests ──────────────────────────────────────────────────────────────

describe("homeView", () => {
  it("should include bin path", () => {
    const result = homeView(sampleCommands);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("bin:");
  });

  it("should include description", () => {
    const result = homeView(sampleCommands);
    expect(result.output).toContain("description:");
    expect(result.output).toContain("AXI-compliant");
  });

  it("should list all registered commands", () => {
    const result = homeView(sampleCommands);
    expect(result.output).toContain("init");
    expect(result.output).toContain("Configure supabase-axi");
    expect(result.output).toContain("tables");
    expect(result.output).toContain("List database tables");
  });

  it("should include help hints section", () => {
    const result = homeView(sampleCommands);
    expect(result.output).toContain("help[");
  });

  it("should include init hint when init command is registered", () => {
    const result = homeView(sampleCommands);
    expect(result.output).toContain("supabase-axi init");
  });

  it("should include generic help hint", () => {
    const result = homeView(sampleCommands);
    expect(result.output).toContain("<command> --help");
  });

  it("should handle empty commands list", () => {
    const result = homeView([]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("bin:");
    expect(result.output).toContain("description:");
  });

  it("should use TOON format for commands table", () => {
    const result = homeView(sampleCommands);
    // TOON tabular format: array header with field list
    expect(result.output).toMatch(/\[2\]\{name,description\}/);
  });
});
