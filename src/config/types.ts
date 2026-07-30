/**
 * Shared type definitions for the configuration layer.
 *
 * Every config field tracks its provenance so agents can see where
 * each value came from — useful for debugging and auditing.
 */

/**
 * Tracks which source provided a config value.
 * Ordered by priority: later sources are fallbacks.
 */
export type ConfigSource =
  | { type: ".supabase.env" }
  | { type: "environment" }
  | { type: "supabase/config.toml"; path: string }
  | { type: "keychain" }
  | { type: "~/.supabase/access-token" }
  | { type: "not-found" };

/**
 * Fully resolved configuration with per-field source tracking.
 *
 * Each field is nullable — callers must check before using.
 * The `sources` map tells you where the value (or lack thereof) came from.
 */
export interface ResolvedConfig {
  /** Supabase project reference (e.g. "mxxjaefcqgosyqbfyzxk"). */
  projectRef: string | null;
  /** Personal access token for Management API (sbp_...). */
  accessToken: string | null;
  /** Service role key for admin database operations. */
  serviceRoleKey: string | null;
  /** Local project name from config.toml project_id field. */
  projectName: string | null;
  /** Per-field source tracking. */
  sources: {
    projectRef: ConfigSource;
    accessToken: ConfigSource;
    serviceRoleKey: ConfigSource;
    projectName: ConfigSource;
  };
}
