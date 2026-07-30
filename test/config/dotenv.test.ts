import { describe, it, expect } from "vitest";
import { parseDotenv } from "../../src/config/dotenv.js";

describe("parseDotenv", () => {
  it("should parse a simple key=value pair", () => {
    const result = parseDotenv("FOO=bar");
    expect(result).toEqual({ FOO: "bar" });
  });

  it("should parse multiple key=value pairs", () => {
    const result = parseDotenv("FOO=bar\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("should ignore empty lines", () => {
    const result = parseDotenv("FOO=bar\n\nBAZ=qux\n");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("should ignore full-line comments", () => {
    const result = parseDotenv("# this is a comment\nFOO=bar\n# another comment");
    expect(result).toEqual({ FOO: "bar" });
  });

  it("should strip export prefix", () => {
    const result = parseDotenv("export FOO=bar");
    expect(result).toEqual({ FOO: "bar" });
  });

  it("should uppercase keys", () => {
    const result = parseDotenv("supabase_project_ref=abc123");
    expect(result).toEqual({ SUPABASE_PROJECT_REF: "abc123" });
  });

  it("should handle double-quoted values", () => {
    const result = parseDotenv('FOO="bar baz"');
    expect(result).toEqual({ FOO: "bar baz" });
  });

  it("should handle single-quoted values", () => {
    const result = parseDotenv("FOO='bar baz'");
    expect(result).toEqual({ FOO: "bar baz" });
  });

  it("should process escape sequences in double-quoted strings", () => {
    const result = parseDotenv('FOO="line1\\nline2"');
    expect(result).toEqual({ FOO: "line1\nline2" });
  });

  it("should handle escaped backslashes in double-quoted strings", () => {
    const result = parseDotenv('FOO="path\\\\to\\\\file"');
    expect(result).toEqual({ FOO: "path\\to\\file" });
  });

  it("should handle escaped double quotes in double-quoted strings", () => {
    const result = parseDotenv('FOO="value with \\"quotes\\""');
    expect(result).toEqual({ FOO: 'value with "quotes"' });
  });

  it("should handle equals inside quoted values", () => {
    const result = parseDotenv('FOO="key=value"');
    expect(result).toEqual({ FOO: "key=value" });
  });

  it("should handle empty value", () => {
    const result = parseDotenv("FOO=");
    expect(result).toEqual({ FOO: "" });
  });

  it("should handle empty quoted value", () => {
    const result = parseDotenv('FOO=""');
    expect(result).toEqual({ FOO: "" });
  });

  it("should trim whitespace around bare values", () => {
    const result = parseDotenv("FOO=  bar  ");
    expect(result).toEqual({ FOO: "bar" });
  });

  it("should preserve whitespace inside quoted values", () => {
    const result = parseDotenv('FOO="  bar  "');
    expect(result).toEqual({ FOO: "  bar  " });
  });

  it("should handle empty input", () => {
    const result = parseDotenv("");
    expect(result).toEqual({});
  });

  it("should handle whitespace-only input", () => {
    const result = parseDotenv("   \n  \n  ");
    expect(result).toEqual({});
  });

  it("should handle Supabase-style config keys", () => {
    const input = `
SUPABASE_PROJECT_REF=mxxjaefcqgosyqbfyzxk
SUPABASE_ACCESS_TOKEN=sbp_oauth_abc123
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJzdWIi
`;
    const result = parseDotenv(input);
    expect(result).toEqual({
      SUPABASE_PROJECT_REF: "mxxjaefcqgosyqbfyzxk",
      SUPABASE_ACCESS_TOKEN: "sbp_oauth_abc123",
      SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIi",
    });
  });

  it("should skip malformed lines without = sign", () => {
    const result = parseDotenv("FOO=bar\nmalformed\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });
});
