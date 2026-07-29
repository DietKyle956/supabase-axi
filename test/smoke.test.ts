import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("project skeleton", () => {
  it("should have expected directory structure", () => {
    const dirs = [
      "src/commands",
      "src/format",
      "src/api",
      "src/config",
      "src/hooks",
      "test",
    ];
    for (const dir of dirs) {
      expect(existsSync(dir)).toBe(true);
    }
  });

  it("should have package.json with correct name and bin entry", () => {
    const pkgJson = JSON.parse(
      readFileSync(resolve("package.json"), "utf-8"),
    );
    expect(pkgJson.name).toBe("@dietkyle/supabase-axi");
    expect(pkgJson.bin).toBeDefined();
    expect(pkgJson.bin["supabase-axi"]).toBe("./dist/cli.js");
  });

  it("should have tsconfig.json", () => {
    expect(existsSync("tsconfig.json")).toBe(true);
  });

  it("should have .supabase.env.example", () => {
    expect(existsSync(".supabase.env.example")).toBe(true);
  });
});
