# @dietkyle/supabase-axi

AXI-compliant CLI wrapper around the Supabase API for AI coding agents.

## Install

```bash
npm install -g @dietkyle/supabase-axi
```

## Setup

```bash
supabase-axi init
```

This discovers your Supabase project from your local `supabase/config.toml` and
OS keychain, then writes a `.supabase.env` file. Add `.supabase.env` to your
`.gitignore` — it holds secrets.

## Commands

- `tables list` — list tables in your project
- `migrations list` — list migrations
- `migrations apply` — apply a migration
- `branches list` — list development branches
- `branches create` — create a development branch
- `branches merge` — merge a development branch
- `sql exec` — execute SQL against your project
- `logs get` — fetch service logs
- `docs search` — search Supabase documentation

## License

MIT
