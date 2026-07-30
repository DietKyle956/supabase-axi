import { describe, it, expect } from "vitest";
import {
  formatHelp,
  formatFlagError,
  formatFlagRemovedError,
  type HelpSection,
  type FlagDef,
} from "../../src/format/help.js";

const sampleFlags: FlagDef[] = [
  { name: "--state", description: "Filter by state (open, closed)", type: "string" },
  { name: "--assignee", description: "Filter by assignee", type: "string" },
  { name: "--limit", description: "Maximum results", type: "number", default: "30" },
  { name: "--full", description: "Show complete output without truncation", type: "boolean" },
];

const sampleSection: HelpSection = {
  command: "tasks list",
  description: "List tasks in the current project",
  flags: sampleFlags,
  examples: [
    "tasks list",
    'tasks list --state open --assignee "@me"',
    "tasks list --limit 50",
  ],
};

describe("formatHelp", () => {
  it("should include command name and description", () => {
    const output = formatHelp(sampleSection);
    expect(output).toContain("tasks list");
    expect(output).toContain("List tasks in the current project");
  });

  it("should list all flags with their descriptions", () => {
    const output = formatHelp(sampleSection);
    for (const flag of sampleFlags) {
      expect(output).toContain(flag.name);
      if (flag.description) {
        expect(output).toContain(flag.description);
      }
    }
  });

  it("should show defaults for flags that have them", () => {
    const output = formatHelp(sampleSection);
    expect(output).toContain("default: 30");
  });

  it("should show type for flags", () => {
    const output = formatHelp(sampleSection);
    expect(output).toContain("(string)");
    expect(output).toContain("(number)");
    expect(output).toContain("(boolean)");
  });

  it("should include usage examples", () => {
    const output = formatHelp(sampleSection);
    expect(output).toContain("Examples:");
    expect(output).toContain("tasks list --state open");
  });

  it("should handle section with no flags", () => {
    const section: HelpSection = {
      command: "tasks view",
      description: "View task details",
      examples: ["tasks view 42"],
    };
    const output = formatHelp(section);
    expect(output).toContain("tasks view");
    expect(output).not.toContain("Flags:");
  });

  it("should handle section with no examples", () => {
    const section: HelpSection = {
      command: "tasks count",
      description: "Count tasks",
      flags: [{ name: "--project", description: "Project slug", type: "string" }],
    };
    const output = formatHelp(section);
    expect(output).toContain("tasks count");
    expect(output).not.toContain("Examples:");
  });

  it("should handle minimal section with only command", () => {
    const section: HelpSection = {
      command: "tasks ping",
      description: "Check connectivity",
    };
    const output = formatHelp(section);
    expect(output).toContain("tasks ping");
    expect(output).toContain("Check connectivity");
  });
});

describe("formatFlagError", () => {
  it("should report unknown flag by name", () => {
    const output = formatFlagError("tasks list", "--stat", [
      "--state",
      "--assignee",
      "--limit",
    ]);
    expect(output).toContain("error: unknown flag --stat");
    expect(output).toContain("tasks list");
    expect(output).toContain("--state");
    expect(output).toContain("--assignee");
    expect(output).toContain("--limit");
  });

  it("should include all valid flags", () => {
    const output = formatFlagError("tasks create", "--bogus", [
      "--title",
      "--body",
    ]);
    expect(output).toContain("--title");
    expect(output).toContain("--body");
  });

  it("should mention --help is always allowed", () => {
    const output = formatFlagError("tasks list", "--wrong", ["--state"]);
    expect(output).toContain("--help");
  });
});

describe("formatFlagRemovedError", () => {
  it("should provide a targeted hint for renamed flags", () => {
    const output = formatFlagRemovedError(
      "tasks list",
      "--status",
      "--state",
    );
    expect(output).toContain("error: --status was renamed");
    expect(output).toContain("use --state instead");
  });
});
