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

## Usage

```bash
supabase-axi              # home view (AXI §8)
supabase-axi init         # interactive setup or non-interactive
supabase-axi --help       # top-level help
supabase-axi --version    # print version
```

## Commands

| Command | Status | Description |
|---------|--------|-------------|
| `init` | ready | Configure supabase-axi with Supabase project credentials |
| `tables` | stub | List database tables |
| `migrations` | stub | List and apply migrations |
| `sql` | stub | Execute SQL queries |
| `branches` | stub | Manage Supabase branches |
| `logs` | stub | Retrieve service logs |
| `docs` | stub | Search Supabase documentation |
| `hooks` | stub | Manage Claude Code session hooks |

Run `supabase-axi <command> --help` for a command's flags and examples.
Stub commands print "coming soon" and return exit code 0.

## License

MIT
