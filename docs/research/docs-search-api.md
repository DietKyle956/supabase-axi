# Supabase Docs Search API Research

## Overview

The Supabase documentation site exposes a **GraphQL Content API** at `https://supabase.com/docs/api/graphql` that provides full-text search across Supabase documentation pages, including guides, CLI command references, Management API references, client library function references, and troubleshooting guides. This API is used internally by the [Supabase MCP server](https://github.com/supabase/mcp) for its `search_docs` tool.

---

## 1. GraphQL Endpoint

**URL:** `https://supabase.com/docs/api/graphql`

- **Source:** [supabase/mcp source code](https://raw.githubusercontent.com/supabase/mcp/main/packages/mcp-server-supabase/src/server.ts) -- the `createContentApiClient` call defaults to `contentApiUrl = 'https://supabase.com/docs/api/graphql'`.
- **Confirmed:** The endpoint responds to GraphQL requests (verified via live `curl` test returning `{"data":{"__typename":"RootQueryType"}}`).

### HTTP Methods

- **POST** -- standard GraphQL POST with `Content-Type: application/json` and `{"query": "..."}` body. (Primary method.)
- **GET** -- also supported. Query is passed as a URL search parameter: `?query={ searchDocs(...) }`. Added in [PR #41443](https://github.com/supabase/supabase/pull/41443) for CDN caching.
  - Verified: `curl -G 'https://supabase.com/docs/api/graphql' --data-urlencode 'query={ __typename }'` returns HTTP 200.

### Authentication

**None required.** The endpoint is publicly accessible without any API key, authorization header, or authentication. The MCP server only sets a `User-Agent` header (`supabase-mcp/${version}`).

- **Source:** [graphql.ts source](https://raw.githubusercontent.com/supabase/mcp/main/packages/mcp-server-supabase/src/content-api/graphql.ts) -- no auth mechanism, only optional `headers: Record<string, string>`.
- **Source:** [server.ts source](https://raw.githubusercontent.com/supabase/mcp/main/packages/mcp-server-supabase/src/server.ts) -- only passes `'User-Agent': supabase-mcp/${version}`.

### Response Times

Live tests show ~700-860ms response time for `searchDocs` queries (tested from a US-based VPS).

### Rate Limits

No explicit rate limits were documented or observed during testing. The Supabase Management API has documented limits (120 req/min per user/project), and Auth endpoints have their own limits, but the docs Content API `/api/graphql` did not return any rate-limit headers or 429 responses during testing. The endpoint likely uses standard Vercel/Next.js infrastructure limits.

---

## 2. Complete GraphQL Schema

The schema was fetched live from the endpoint. Source: `curl -s 'https://supabase.com/docs/api/graphql' -H 'Content-Type: application/json' -d '{"query":"{ schema }"}'`

### Root Query Type

```graphql
type RootQueryType {
  schema: String!
  searchDocs(query: String!, limit: Int): SearchResultCollection
  error(code: String!, service: Service!): Error
  errors(first: Int, after: String, last: Int, before: String, service: Service, code: String): ErrorCollection
}
```

### Queries

| Query | Parameters | Returns |
|---|---|---|
| `schema` | (none) | `String!` -- the full GraphQL schema |
| `searchDocs` | `query: String!` (required), `limit: Int` (optional) | `SearchResultCollection` |
| `error` | `code: String!`, `service: Service!` | `Error` |
| `errors` | `first`, `after`, `last`, `before` (pagination), `service`, `code` (filters) | `ErrorCollection` |

### SearchResult Interface and Implementations

```graphql
interface SearchResult {
  title: String
  href: String
  content: String
}
```

Five types implement `SearchResult`:

| Type | Extra Fields | Description |
|---|---|---|
| `Guide` | `subsections: SubsectionCollection` | A documentation guide (concept or how-to). Subsections return only matching content chunks when from search. |
| `CLICommandReference` | (none) | A Supabase CLI command reference. |
| `ManagementApiReference` | (none) | A Management API endpoint reference. |
| `ClientLibraryFunctionReference` | `language: Language!`, `methodName: String` | A client library function. Language is required. |
| `TroubleshootingGuide` | (none) | A troubleshooting guide. |

### Enums

```graphql
enum Language { JAVASCRIPT, SWIFT, DART, CSHARP, KOTLIN, PYTHON }
enum Service { AUTH, REALTIME, STORAGE }
```

### Collection Types

```graphql
type SearchResultCollection {
  edges: [SearchResultEdge!]!
  nodes: [SearchResult!]!
  totalCount: Int!
}

type SearchResultEdge {
  node: SearchResult!
}

type SubsectionCollection {
  edges: [SubsectionEdge!]!
  nodes: [Subsection!]!
  totalCount: Int!
}

type Subsection {
  title: String
  href: String
  content: String
}
```

The schema also includes `Error`, `ErrorCollection`, `ErrorEdge`, and `PageInfo` types for the `error`/`errors` queries (relevant for looking up Supabase error codes).

---

## 3. Query Patterns for `searchDocs`

### Basic Search

```graphql
{
  searchDocs(query: "create project", limit: 10) {
    totalCount
    nodes {
      __typename
      title
      href
      content
    }
  }
}
```

- **Source:** Live test and [PR #35290](https://github.com/supabase/supabase/pull/35290).

### Filtering by Type (Inline Fragments)

```graphql
{
  searchDocs(query: "select", limit: 5) {
    nodes {
      __typename
      title
      href
      ... on Guide {
        subsections {
          nodes { title href content }
        }
      }
      ... on ClientLibraryFunctionReference {
        language
        methodName
      }
    }
  }
}
```

### Getting Subsections (Guide type only)

```graphql
{
  searchDocs(query: "storage", limit: 1) {
    nodes {
      ... on Guide {
        title
        href
        subsections {
          totalCount
          nodes {
            title
            href
            content
          }
        }
      }
    }
  }
}
```

### Edge Cases (verified via live tests)

| Scenario | Result |
|---|---|
| Empty query `""` | Returns `totalCount: 0, nodes: []` |
| No-match query `"zxywnonexistent"` | Returns `totalCount: 0, nodes: []` |
| No `limit` specified | Defaults vary; explicitly set `limit` for predictable results |
| High limit (e.g., `limit: 100`) | Returns up to total available; "storage" query returned 72 results |

---

## 4. Response Format Examples

### Guide Result

```json
{
  "__typename": "Guide",
  "title": "Features",
  "href": "https://supabase.com/docs/guides/getting-started/features",
  "content": "# Features\n\n\n\nThis is a non-exhaustive list of features...",
  "subsections": {
    "nodes": [
      { "title": "Database", "href": "...", "content": "..." }
    ],
    "totalCount": 1
  }
}
```

- **Source:** Live API response.

### CLICommandReference Result

```json
{
  "__typename": "CLICommandReference",
  "title": "Create a project on Supabase",
  "href": "https://supabase.com/docs/reference/cli/supabase-projects-create",
  "content": "# CLI Reference\n\nCreate a project on Supabase\n\n\n\nsupabase projects create [project name] [flags]..."
}
```

- **Source:** Live API response.

### ClientLibraryFunctionReference Result

```json
{
  "__typename": "ClientLibraryFunctionReference",
  "title": "Fetch data: select()",
  "href": "https://supabase.com/docs/reference/kotlin/select",
  "content": "...",
  "language": "KOTLIN",
  "methodName": "Fetch data: select()"
}
```

### ManagementApiReference Result

```json
{
  "__typename": "ManagementApiReference",
  "title": "Creates a new SSO provider",
  "href": "https://supabase.com/docs/reference/api/v1-create-a-sso-provider",
  "content": "# Management API Reference\n\nCreates a new SSO provider\n\nPath: POST /v1/projects/{ref}/config/auth/sso/providers\n..."
}
```

- **Source:** [PR #36289](https://github.com/supabase/supabase/pull/36289).

### TroubleshootingGuide Result

```json
{
  "__typename": "TroubleshootingGuide",
  "title": "Unable to call Edge Function",
  "href": "https://supabase.com/docs/guides/troubleshooting/unable-to-call-edge-function",
  "content": "..."
}
```

- **Source:** Live API response.

### Error Query (for reference)

```json
{
  "data": {
    "error": {
      "code": "over_email_send_rate_limit",
      "service": "AUTH",
      "httpStatusCode": null,
      "message": "Too many emails have been sent to this email address..."
    }
  }
}
```

- **Source:** Live API response. Total known errors: 145.

---

## 5. Important Behavioral Notes

### Default Limit
The `limit` parameter is optional. When omitted, the API appears to return a small default (possibly 10). Always specify `limit` for predictable behavior.

### Content Field
The `content` field contains the **full markdown body** of the matched document, including frontmatter-like headers (`# Title`) and the complete text. For `Guide` types with subsections, `content` contains all subsections concatenated. Subsections via `subsections { nodes { content } }` return only matching chunks.

### href Format
All `href` values are absolute URLs (e.g., `https://supabase.com/docs/reference/cli/...`), not relative paths.

### Search Scope
As of [PR #35290](https://github.com/supabase/supabase/pull/35290) (merged May 2025), `searchDocs` initially covered only Markdown guides. [PR #36289](https://github.com/supabase/supabase/pull/36289) later added Management API references. Client library function references (`ClientLibraryFunctionReference`) and CLI command references (`CLICommandReference`) are also included. The schema lists all five types; the search may not yet cover all reference types equally.

### `__typename` Discrimination
Always include `__typename` in queries to distinguish between `SearchResult` implementations. This is the recommended way to handle the polymorphic return type.

---

## 6. REST Alternative / Markdown Fallback

### Direct .md URL fetch
**Does NOT work.** Appending `.md` to a documentation URL (e.g., `https://supabase.com/docs/guides/getting-started/features.md`) returns an HTTP 308 redirect followed by a 404 HTML page.

- **Source:** Live test (`curl -sL` confirmed 404).

### Built-in Markdown Generation
The Supabase docs project generates plain Markdown (`.md`) files from the MDX source via `pnpm build:guides-markdown`. The output goes to `public/markdown/guides/` (git-ignored) and is bundled for Vercel production deployments. However, these files are not directly served at public URLs with `.md` suffixes.

- **Source:** [Supabase docs DEVELOPERS.md](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/DEVELOPERS.md).

### Alternative: Fetch from search result hrefs
Each search result returns an `href` linking to the docs page. While the full HTML is served, the `content` field already provides the markdown body directly from the search API -- making the GraphQL API itself the most convenient source of markdown content.

---

## 7. The `error` and `errors` Queries

The API also exposes an error code lookup system (not just docs search). This is useful for a CLI tool that needs to look up Supabase error codes.

```graphql
# Look up a specific error
{ error(code: "over_email_send_rate_limit", service: AUTH) { code service httpStatusCode message } }

# List all errors
{ errors(first: 10) { totalCount nodes { code service } } }
```

- **Source:** Live API responses. Total errors: 145 across AUTH, REALTIME, and STORAGE services.

---

## 8. TOON Formatting Conventions (from axi-sdk-js)

The `axi-sdk-js` package (v0.1.8) is the shared runtime for building AXI (Agent eXperience Interface) CLI tools. It uses **TOON (Token-Oriented Object Notation)** for output serialization.

- **Source:** [npm registry metadata](https://registry.npmjs.org/axi-sdk-js) and [github.com/kunchenguid/axi](https://github.com/kunchenguid/axi).

### Core TOON Format Rules

TOON is a token-efficient data format designed for LLM prompts, claiming ~40% token savings over JSON. The full specification is at [toonformat.dev](https://toonformat.dev/guide/format-overview.html).

**Key-value pairs:**
```
key: value
```

**Nested objects (2-space indentation):**
```
user:
  id: 123
  name: Ada
```

**Arrays with explicit length:**
```
tags[3]: admin,ops,dev
```

**Tabular arrays (uniform objects):**
```
items[2]{sku,qty,price}:
  A1,2,9.99
  B2,1,14.5
```

**Keyed tabular objects:**
```
users[2:]{age,city}:
  alice: 30,Berlin
  bob: 25,Oslo
```

**List form (mixed/non-uniform arrays):**
```
items[2]:
  - id: 1
    name: First
  - id: 2
    name: Second
```

**Comments (line-start `#` only):**
```
# This is a comment
host: example.com
```

**Quoting rules:** Strings are quoted only when necessary (empty strings, leading/trailing whitespace, contains `:`, `"`, `\`, brackets, braces, control characters, matches `true`/`false`/`null`, looks like a number, contains the active delimiter).

**Escape sequences:** `\\`, `\"`, `\n`, `\r`, `\t`, `\uXXXX`

### How axi-sdk-js Uses TOON

The `runAxiCli()` function from `axi-sdk-js` automatically handles TOON serialization of command output. Command handlers work with plain JavaScript objects, and the runtime converts them to TOON format for output.

- **Source:** [npm registry README](https://registry.npmjs.org/axi-sdk-js).

Related packages:
- `@toon-format/toon` (v4.1.0) -- core TOON serialization/deserialization library
- `@toon-format/cli` -- CLI validation tool (`npx @toon-format/cli --decode file.toon`)
- `@axi-office/core` -- re-exports `runAxiCli`/`AxiError` and adds TOON schema helpers

---

## 9. Recommendations for CLI Implementation

1. **Use the GraphQL endpoint directly** (`https://supabase.com/docs/api/graphql`) via POST with standard `Content-Type: application/json`.
2. **No authentication required** -- just a descriptive `User-Agent` header is good practice.
3. **Always include `__typename`** in search queries to handle the polymorphic `SearchResult` type.
4. **Always specify `limit`** -- the default is small and potentially undefined.
5. **Use inline fragments** (`... on Guide { subsections { ... } }`) to access type-specific fields.
6. **Output in TOON format** using the `@toon-format/toon` library (or via `axi-sdk-js`'s `runAxiCli()` for automatic serialization).
7. **Consider caching** -- search results are unlikely to change frequently. Results include a `content` field with full markdown body, so pagination or subsequent fetching of individual pages is unnecessary for most use cases.
8. **The `error`/`errors` queries** are a bonus feature for looking up Supabase error codes directly from the CLI.
