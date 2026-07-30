/**
 * Content truncation module per AXI §3.
 *
 * Truncates content by default and tells the agent how to get the full version.
 * Never omits large fields entirely — always includes a truncated preview.
 */

export interface TruncationOptions {
  /** Maximum number of characters before truncation. Default: 500. */
  maxLength?: number;
}

export interface TruncationResult {
  /** The (possibly truncated) text content. */
  truncated: string;
  /** Whether the content was truncated. */
  isTruncated: boolean;
  /** The original length of the content in characters. */
  originalLength: number;
}

const DEFAULT_MAX_LENGTH = 500;

/**
 * Truncate text content to a maximum character length.
 * Pure function with no side effects.
 */
export function truncate(
  text: string,
  options: TruncationOptions = {},
): TruncationResult {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const originalLength = text.length;

  if (originalLength <= maxLength) {
    return {
      truncated: text,
      isTruncated: false,
      originalLength,
    };
  }

  return {
    truncated: text.slice(0, maxLength),
    isTruncated: true,
    originalLength,
  };
}

/**
 * Generate a help hint telling the agent how to get full content.
 * Per AXI §3: show the total size and suggest the escape hatch.
 *
 * @param command - The command template to use for --full (e.g. "tasks view 42")
 * @param totalLength - Total character count of the original content
 * @param shownLength - How many characters were actually shown (the maxLength used)
 */
export function truncationHelp(
  command: string,
  totalLength: number,
  shownLength: number,
): string {
  if (totalLength <= shownLength) {
    return "";
  }

  return `... (truncated, ${totalLength} chars total)\nhelp[1]: Run \`${command} --full\` to see complete content`;
}
