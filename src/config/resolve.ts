/**
 * Multi-source config resolution for supabase-axi.
 *
 * Resolves each config field independently through a priority chain:
 *
 *  projectRef:    .supabase.env → env var → config.toml remotes
 *  accessToken:   .supabase.env → env var → keychain → ~/.supabase/access-token
 *  serviceRoleKey:  .supabase.env → env var
 *  projectName:   config.toml root project_id
 *
 * Every field tracks its provenance so agents can see where each value
 * came from (or that it was not found).
 */

import { resolve } from "node:path";
import type { ResolvedConfig, ConfigSource } from "./types.js";
import { readDotenvFile } from "./dotenv.js";
import { readSupabaseToml } from "./supabase-toml.js";
import { getAccessTokenFromKeychain, readAccessTokenFile } from "./keychain.js";

/**
 * Options for config resolution. All fields are optional.
 * Every injectable surface is exposed so tests can control the environment.
 */
export interface ResolveOptions {
  /** Directory to search for supabase/config.toml. Default: cwd. */
  projectDir?: string;
  /** Explicit path to .supabase.env. Default: <projectDir>/.supabase.env. */
  envFilePath?: string;
  /** Environment variable lookup. Default: process.env. */
  env?: Record<string, string | undefined>;
  /** Skip keychain lookup (for CI/testing). */
  skipKeychain?: boolean;
}

/**
 * Resolve all config fields from available sources.
 *
 * Each field is resolved independently through its own priority chain.
 * Fields that cannot be resolved from any source are null with source "not-found".
 */
export function resolveConfig(options: ResolveOptions = {}): ResolvedConfig {
  const projectDir = resolve(options.projectDir ?? process.cwd());
  const env = options.env ?? (process.env as Record<string, string | undefined>);

  // Read .supabase.env file once (cached for all fields)
  const dotenvPath = options.envFilePath
    ? resolve(options.envFilePath)
    : resolve(projectDir, ".supabase.env");
  const dotenv: Record<string, string> | null = readDotenvFile(dotenvPath);

  // Read supabase/config.toml once
  const tomlResult = readSupabaseToml(projectDir);

  // Resolve each field independently
  const [projectRef, projectRefSource] = resolveProjectRef(dotenv, env, tomlResult ?? undefined);
  const [accessToken, accessTokenSource] = resolveAccessToken(
    dotenv,
    env,
    options.skipKeychain ?? false,
  );
  const [serviceRoleKey, serviceRoleKeySource] = resolveServiceRoleKey(dotenv, env);
  const [projectName, projectNameSource] = resolveProjectName(tomlResult ?? undefined);

  return {
    projectRef,
    accessToken,
    serviceRoleKey,
    projectName,
    sources: {
      projectRef: projectRefSource,
      accessToken: accessTokenSource,
      serviceRoleKey: serviceRoleKeySource,
      projectName: projectNameSource,
    },
  };
}

// ── Per-field resolvers ───────────────────────────────────────────────

function resolveProjectRef(
  dotenv: Record<string, string> | null,
  env: Record<string, string | undefined>,
  tomlResult?: { config: { projectId: string | null; remotes: Record<string, { projectId: string | null }> }; path: string },
): [string | null, ConfigSource] {
  // 1. .supabase.env
  if (dotenv?.["SUPABASE_PROJECT_REF"]) {
    return [dotenv["SUPABASE_PROJECT_REF"], { type: ".supabase.env" }];
  }

  // 2. Environment variable
  if (env["SUPABASE_PROJECT_REF"]) {
    return [env["SUPABASE_PROJECT_REF"], { type: "environment" }];
  }

  // 3. config.toml remotes (use first remote's project_id)
  if (tomlResult) {
    const remotes = tomlResult.config.remotes;
    const remoteNames = Object.keys(remotes);
    if (remoteNames.length > 0) {
      const firstRemoteProjectId = remotes[remoteNames[0]!]!.projectId;
      if (firstRemoteProjectId) {
        return [firstRemoteProjectId, { type: "supabase/config.toml", path: tomlResult.path }];
      }
    }
  }

  // 4. config.toml root project_id as fallback
  if (tomlResult?.config.projectId) {
    return [tomlResult.config.projectId, { type: "supabase/config.toml", path: tomlResult.path }];
  }

  return [null, { type: "not-found" }];
}

function resolveAccessToken(
  dotenv: Record<string, string> | null,
  env: Record<string, string | undefined>,
  skipKeychain: boolean,
): [string | null, ConfigSource] {
  // 1. .supabase.env
  if (dotenv?.["SUPABASE_ACCESS_TOKEN"]) {
    return [dotenv["SUPABASE_ACCESS_TOKEN"], { type: ".supabase.env" }];
  }

  // 2. Environment variable
  if (env["SUPABASE_ACCESS_TOKEN"]) {
    return [env["SUPABASE_ACCESS_TOKEN"], { type: "environment" }];
  }

  // 3. OS keychain
  if (!skipKeychain) {
    const token = getAccessTokenFromKeychain();
    if (token) {
      return [token, { type: "keychain" }];
    }
  }

  // 4. ~/.supabase/access-token file
  const fileToken = readAccessTokenFile();
  if (fileToken) {
    return [fileToken, { type: "~/.supabase/access-token" }];
  }

  return [null, { type: "not-found" }];
}

function resolveServiceRoleKey(
  dotenv: Record<string, string> | null,
  env: Record<string, string | undefined>,
): [string | null, ConfigSource] {
  // 1. .supabase.env
  if (dotenv?.["SUPABASE_SERVICE_ROLE_KEY"]) {
    return [dotenv["SUPABASE_SERVICE_ROLE_KEY"], { type: ".supabase.env" }];
  }

  // 2. Environment variable
  if (env["SUPABASE_SERVICE_ROLE_KEY"]) {
    return [env["SUPABASE_SERVICE_ROLE_KEY"], { type: "environment" }];
  }

  return [null, { type: "not-found" }];
}

function resolveProjectName(
  tomlResult?: { config: { projectId: string | null }; path: string },
): [string | null, ConfigSource] {
  if (tomlResult?.config.projectId) {
    return [tomlResult.config.projectId, { type: "supabase/config.toml", path: tomlResult.path }];
  }

  return [null, { type: "not-found" }];
}
