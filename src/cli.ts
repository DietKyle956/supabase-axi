#!/usr/bin/env node

/**
 * supabase-axi entry point.
 *
 * AXI-compliant CLI wrapper around the Supabase API for AI coding agents.
 * Routes argv to registered subcommands with flag validation and help.
 */

import { createRouter, stubHandler, type CommandDef } from "./router.js";
import { initCommandDef } from "./commands/init.js";

// ── Router setup ────────────────────────────────────────────────────────

const router = createRouter();

// Real commands
router.register(initCommandDef);

// Future commands (placeholders)
const futureCommands: CommandDef[] = [
  {
    name: "tables",
    description: "List database tables",
    handler: stubHandler("tables", 20),
  },
  {
    name: "migrations",
    description: "List and apply migrations",
    handler: stubHandler("migrations", 21),
  },
  {
    name: "sql",
    description: "Execute SQL queries",
    handler: stubHandler("sql", 22),
  },
  {
    name: "branches",
    description: "Manage Supabase branches",
    handler: stubHandler("branches", 23),
  },
  {
    name: "logs",
    description: "Retrieve service logs",
    handler: stubHandler("logs", 24),
  },
  {
    name: "docs",
    description: "Search Supabase documentation",
    handler: stubHandler("docs", 27),
  },
  {
    name: "hooks",
    description: "Manage Claude Code session hooks",
    handler: stubHandler("hooks", 26),
  },
];

for (const cmd of futureCommands) {
  router.register(cmd);
}

// ── Execute ─────────────────────────────────────────────────────────────

const result = await router.route(process.argv.slice(2));
if (result.output) {
  console.log(result.output);
}
process.exit(result.exitCode);
