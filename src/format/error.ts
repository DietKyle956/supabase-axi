/**
 * Structured error formatting per AXI §6.
 *
 * Errors go to stdout in structured format so agents can read and act on them.
 * Includes what went wrong and an actionable suggestion.
 * Never leaks dependency names or stack traces.
 */

export interface AxError {
  /** Human-readable error message. */
  message: string;
  /** Exit code: 0 = success/no-op, 1 = error, 2 = usage error. */
  exitCode: number;
  /** Optional actionable suggestion (help hint). */
  suggestion?: string;
}

/**
 * Create a usage error (exit code 2).
 * For missing required flags, unrecognized flags, invalid arguments.
 */
export function usageError(
  message: string,
  suggestion?: string,
): AxError {
  return { message, exitCode: 2, suggestion };
}

/**
 * Create a runtime error (exit code 1).
 * For API failures, unexpected state, operational errors.
 */
export function runtimeError(
  message: string,
  suggestion?: string,
): AxError {
  return { message, exitCode: 1, suggestion };
}

/**
 * Create a no-op acknowledgment (exit code 0).
 * For idempotent operations where the desired state already exists.
 * Per AXI §6: "Don't error when the desired state already exists."
 */
export function noopError(message: string): AxError {
  return { message, exitCode: 0 };
}

/**
 * Format an AxError as structured output for stdout.
 *
 * Output follows AXI §6 pattern:
 *   error: <what went wrong>
 *   help: <actionable suggestion>
 *
 * No-op messages omit the "error:" prefix per convention.
 */
export function formatError(error: AxError): string {
  const lines: string[] = [];

  if (error.exitCode === 0) {
    // No-op: just the message, no error prefix
    lines.push(error.message);
  } else {
    lines.push(`error: ${error.message}`);
  }

  if (error.suggestion) {
    lines.push(`help: ${error.suggestion}`);
  }

  return lines.join("\n");
}

/**
 * Wrap an unknown/caught error into a structured error string.
 * Extracts message from Error objects; never leaks stack traces or dependency names.
 */
export function formatUnknownError(err: unknown): string {
  let message: string;

  if (err instanceof Error) {
    message = err.message;
  } else if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    message = (err as { message: string }).message;
  } else if (typeof err === "string") {
    message = err;
  } else {
    message = "An unexpected error occurred";
  }

  return `error: ${message}`;
}
