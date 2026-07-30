import { describe, it, expect } from "vitest";
import { parseSupabaseToml } from "../../src/config/supabase-toml.js";

describe("parseSupabaseToml", () => {
  it("should extract root-level project_id", () => {
    const content = 'project_id = "supabase-axi"';
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("supabase-axi");
  });

  it("should return null projectId when not present", () => {
    const content = "# empty config\nenabled = true\n";
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBeNull();
  });

  it("should extract project_id from remotes section", () => {
    const content = `
project_id = "supabase-axi"

[remotes.production]
project_id = "mxxjaefcqgosyqbfyzxk"
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("supabase-axi");
    expect(result.remotes).toHaveProperty("production");
    expect(result.remotes.production!.projectId).toBe("mxxjaefcqgosyqbfyzxk");
  });

  it("should handle multiple remotes", () => {
    const content = `
project_id = "my-project"

[remotes.default]
project_id = "abc123"

[remotes.production]
project_id = "def456"

[remotes.staging]
project_id = "ghi789"
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("my-project");
    expect(Object.keys(result.remotes)).toHaveLength(3);
    expect(result.remotes.default!.projectId).toBe("abc123");
    expect(result.remotes.production!.projectId).toBe("def456");
    expect(result.remotes.staging!.projectId).toBe("ghi789");
  });

  it("should ignore non-project_id keys", () => {
    const content = `
project_id = "supabase-axi"
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("supabase-axi");
    // Non-project_id keys are silently ignored
  });

  it("should handle full-line comments", () => {
    const content = `
# For detailed configuration reference, visit:
# https://supabase.com/docs/guides/local-development/cli/config
project_id = "supabase-axi"
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("supabase-axi");
  });

  it("should handle subsection headers beyond remotes", () => {
    const content = `
project_id = "root-project"

[api]
enabled = true

[api.tls]
enabled = false

[remotes.default]
project_id = "the-remote-ref"
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("root-project");
    expect(result.remotes.default!.projectId).toBe("the-remote-ref");
  });

  it("should handle empty input", () => {
    const result = parseSupabaseToml("");
    expect(result.projectId).toBeNull();
    expect(result.remotes).toEqual({});
  });

  it("should handle quoted values with special characters", () => {
    const content = 'project_id = "my-project-123_test"';
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("my-project-123_test");
  });

  it("should handle missing closing bracket on section header", () => {
    const content = `
project_id = "root"

[remotes.default
project_id = "still-at-root"
`;
    const result = parseSupabaseToml(content);
    // Malformed section header (no closing bracket) is skipped, so current
    // section stays at root level. The second project_id overwrites the first.
    expect(result.projectId).toBe("still-at-root");
    expect(result.remotes).toEqual({});
  });

  it("should handle realistic supabase init output", () => {
    // Snapshot from an actual `supabase init` config.toml
    const content = `
# A string used to distinguish different Supabase projects on the same host.
project_id = "supabase-axi"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[api.tls]
enabled = false

[db]
port = 54322

[db.pooler]
port = 6543

[remotes.default]
project_id = "mxxjaefcqgosyqbfyzxk"
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("supabase-axi");
    expect(result.remotes.default!.projectId).toBe("mxxjaefcqgosyqbfyzxk");
  });

  it("should handle project_id inside nested non-remotes sections (should be ignored)", () => {
    const content = `
project_id = "root"

[auth]
project_id = "not-a-real-project-id"

[remotes.default]
project_id = "real-remote-id"
`;
    const result = parseSupabaseToml(content);
    expect(result.projectId).toBe("root");
    expect(result.remotes.default!.projectId).toBe("real-remote-id");
    // auth.project_id is not in remotes, so it's ignored
  });
});
