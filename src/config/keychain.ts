/**
 * OS keychain access for Supabase access tokens.
 *
 * The Supabase CLI stores access tokens in the OS native keychain
 * (libsecret on Linux, Keychain on macOS, Credential Manager on Windows).
 * On Linux, tokens are stored under the "Supabase CLI" service name.
 *
 * This module provides best-effort access token retrieval from the keychain
 * with a plain-text file fallback (`~/.supabase/access-token`).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Look up the Supabase access token from the OS keychain.
 *
 * Linux: uses `secret-tool lookup service "Supabase CLI" key "access-token"`
 * Returns null if secret-tool is not installed, the token is not stored,
 * or any other error occurs.
 */
export function getAccessTokenFromKeychain(): string | null {
  try {
    const result = execSync(
      'secret-tool lookup service "Supabase CLI" key "access-token"',
      {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    const token = result.trim();
    return token.length > 0 ? token : null;
  } catch {
    // secret-tool not installed, token not stored, or lookup failed
    return null;
  }
}

/**
 * Read the access token from the Supabase CLI plain-text fallback file.
 *
 * The Supabase CLI writes `~/.supabase/access-token` when the OS keychain
 * is unavailable (e.g., headless server, Docker container).
 *
 * Returns null if the file does not exist.
 */
export function readAccessTokenFile(path?: string): string | null {
  const filePath = resolve(path ?? resolve(homedir(), ".supabase", "access-token"));

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf-8").trim();
    return content.length > 0 ? content : null;
  } catch {
    return null;
  }
}
