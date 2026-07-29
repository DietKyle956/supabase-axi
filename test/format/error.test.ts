import { describe, it, expect } from "vitest";
import {
  AxError,
  formatError,
  usageError,
  runtimeError,
  noopError,
  formatUnknownError,
} from "../../src/format/error.js";

describe("AxError factories", () => {
  it("usageError should create error with exit code 2", () => {
    const err = usageError("--title is required");
    expect(err.exitCode).toBe(2);
    expect(err.message).toContain("--title is required");
  });

  it("usageError should include suggestion when provided", () => {
    const err = usageError(
      "--title is required",
      'tasks create --title "..." [--body "..."]',
    );
    expect(err.suggestion).toBe(
      'tasks create --title "..." [--body "..."]',
    );
  });

  it("runtimeError should create error with exit code 1", () => {
    const err = runtimeError("Failed to connect to API");
    expect(err.exitCode).toBe(1);
    expect(err.message).toBe("Failed to connect to API");
  });

  it("runtimeError should include suggestion when provided", () => {
    const err = runtimeError(
      "Failed to connect to API",
      "Check your SUPABASE_ACCESS_TOKEN in .supabase.env",
    );
    expect(err.suggestion).toBe(
      "Check your SUPABASE_ACCESS_TOKEN in .supabase.env",
    );
  });

  it("noopError should create error with exit code 0", () => {
    const err = noopError("already closed");
    expect(err.exitCode).toBe(0);
    expect(err.message).toBe("already closed");
  });
});

describe("formatError", () => {
  it("should format bare error message with exit code 2 prefix", () => {
    const err = usageError("--title is required");
    const output = formatError(err);
    expect(output).toContain("error: --title is required");
  });

  it("should include suggestion as help hint", () => {
    const err = usageError(
      "--title is required",
      'tasks create --title "..."',
    );
    const output = formatError(err);
    expect(output).toContain("error: --title is required");
    expect(output).toContain('help: tasks create --title "..."');
  });

  it("should format runtime errors", () => {
    const err = runtimeError("API returned 500");
    const output = formatError(err);
    expect(output).toContain("error: API returned 500");
  });

  it("should format no-op as informational", () => {
    const err = noopError("#42 already closed (no-op)");
    const output = formatError(err);
    expect(output).toContain("#42 already closed (no-op)");
  });

  it("should omit suggestion line when not present", () => {
    const err = runtimeError("something went wrong");
    const output = formatError(err);
    expect(output).not.toContain("help:");
  });

  it("should not contain suggestion for no-suggestion errors", () => {
    const err: AxError = { message: "bare error", exitCode: 1 };
    const output = formatError(err);
    expect(output).toBe("error: bare error");
  });
});

describe("formatUnknownError", () => {
  it("should wrap an unknown Error object", () => {
    const error = new Error("connection refused");
    const output = formatUnknownError(error);
    expect(output).toContain("error: connection refused");
  });

  it("should wrap a string error", () => {
    const output = formatUnknownError("something broke");
    expect(output).toContain("error: something broke");
  });

  it("should handle non-Error objects with message property", () => {
    const output = formatUnknownError({ message: "custom error" });
    expect(output).toContain("error: custom error");
  });

  it("should provide fallback for unrecognized errors", () => {
    const output = formatUnknownError(42);
    expect(output).toContain("error: An unexpected error occurred");
  });
});
