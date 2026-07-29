import { describe, it, expect } from "vitest";
import { truncate, truncationHelp, type TruncationResult } from "../../src/format/truncate.js";

describe("truncate", () => {
  it("should return text unchanged when under maxLength", () => {
    const result = truncate("hello", { maxLength: 100 });
    expect(result).toEqual<TruncationResult>({
      truncated: "hello",
      isTruncated: false,
      originalLength: 5,
    });
  });

  it("should truncate text exceeding maxLength", () => {
    const result = truncate("hello world this is long", { maxLength: 11 });
    expect(result.isTruncated).toBe(true);
    expect(result.originalLength).toBe(24);
    expect(result.truncated.length).toBeLessThanOrEqual(11);
    expect(result.truncated).toBe("hello world");
  });

  it("should use default maxLength of 500 when not specified", () => {
    const shortText = "abc";
    const result = truncate(shortText);
    expect(result.isTruncated).toBe(false);
    expect(result.truncated).toBe("abc");
  });

  it("should truncate to exact maxLength boundary", () => {
    const result = truncate("12345", { maxLength: 3 });
    expect(result.truncated).toBe("123");
    expect(result.isTruncated).toBe(true);
    expect(result.originalLength).toBe(5);
  });

  it("should handle empty string", () => {
    const result = truncate("");
    expect(result).toEqual<TruncationResult>({
      truncated: "",
      isTruncated: false,
      originalLength: 0,
    });
  });

  it("should handle maxLength of 0", () => {
    const result = truncate("hello", { maxLength: 0 });
    expect(result.truncated).toBe("");
    expect(result.isTruncated).toBe(true);
  });

  it("should handle text exactly at maxLength", () => {
    const result = truncate("hello", { maxLength: 5 });
    expect(result.isTruncated).toBe(false);
    expect(result.truncated).toBe("hello");
  });

  it("should handle unicode / multi-byte characters", () => {
    const result = truncate("hello 世界 👋 test", { maxLength: 6 });
    // "hello " is 6 chars, world emoji is 1 char but multi-byte
    expect(result.isTruncated).toBe(true);
    expect(result.truncated).toBe("hello ");
  });

  it("should handle multiline text", () => {
    const text = "line1\nline2\nline3\nline4";
    const result = truncate(text, { maxLength: 11 });
    expect(result.truncated).toBe("line1\nline2");
    expect(result.isTruncated).toBe(true);
  });
});

describe("truncationHelp", () => {
  it("should generate help hint with --full flag", () => {
    const hint = truncationHelp("tasks view 42", 1024, 500);
    expect(hint).toContain("truncated");
    expect(hint).toContain("1024");
    expect(hint).toContain("--full");
  });

  it("should generate help hint with custom command template", () => {
    const hint = truncationHelp("myapp logs 1", 2000, 700);
    expect(hint).toContain("truncated");
    expect(hint).toContain("2000");
    expect(hint).toContain("myapp logs 1 --full");
  });

  it("should include total character count", () => {
    const hint = truncationHelp("cmd", 9999, 100);
    expect(hint).toContain("9999");
    expect(hint).toContain("chars total");
  });

  it("should return empty string when total equals shown", () => {
    const hint = truncationHelp("cmd", 100, 100);
    expect(hint).toBe("");
  });
});
