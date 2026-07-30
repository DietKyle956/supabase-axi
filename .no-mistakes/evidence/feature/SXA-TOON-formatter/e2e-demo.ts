/**
 * E2E demonstration of the TOON Formatter Module.
 *
 * Exercises all four pure-function modules as an integrated system
 * to show the end-to-end experience a CLI consumer would see.
 */
import { toon } from "../../../../src/format/toon.js";
import { truncate, truncationHelp } from "../../../../src/format/truncate.js";
import { usageError, runtimeError, formatError, formatUnknownError } from "../../../../src/format/error.js";
import { formatHelp, formatFlagError, formatFlagRemovedError } from "../../../../src/format/help.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: string, expected: string) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
  }
}

function section(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${name}`);
  console.log("=".repeat(60));
}

// ── TOON Encoder ────────────────────────────────────────────────────
section("TOON Encoder - Object Serialization");

console.log("\n>>> Simple object:");
const obj1 = toon({ id: 123, name: "Ada", active: true });
console.log(obj1);
check("simple object", obj1, "id: 123\nname: Ada\nactive: true");

console.log("\n>>> Nested object:");
const obj2 = toon({ user: { id: 123, name: "Ada" } });
console.log(obj2);
check("nested object", obj2, "user:\n  id: 123\n  name: Ada");

console.log("\n>>> Inline primitive array:");
const arr1 = toon({ tags: ["admin", "ops", "dev"] });
console.log(arr1);
check("inline array", arr1, "tags[3]: admin,ops,dev");

console.log("\n>>> Tabular array (uniform objects):");
const tab1 = toon({
  items: [
    { sku: "A1", qty: 2, price: 9.99 },
    { sku: "B2", qty: 1, price: 14.5 },
  ],
});
console.log(tab1);
check("tabular array", tab1, "items[2]{sku,qty,price}:\n  A1,2,9.99\n  B2,1,14.5");

console.log("\n>>> Tabular with nested field groups:");
const tab2 = toon({
  orders: [
    { id: 1, customer: { name: "Ada", country: "DK" }, total: 99 },
    { id: 2, customer: { name: "Bob", country: "UK" }, total: 149 },
  ],
});
console.log(tab2);
check("tabular nested", tab2, "orders[2]{id,customer{name,country},total}:\n  1,Ada,DK,99\n  2,Bob,UK,149");

console.log("\n>>> Keyed tabular form:");
const kt1 = toon({
  users: {
    alice: { age: 30, city: "Berlin" },
    bob: { age: 25, city: "Oslo" },
  },
});
console.log(kt1);
check("keyed tabular", kt1, "users[2:]{age,city}:\n  alice: 30,Berlin\n  bob: 25,Oslo");

console.log("\n>>> String escaping and quoting:");
const esc1 = toon({ msg: 'line1\nline2' });
console.log(esc1);
check("string escape", esc1, 'msg: "line1\\nline2"');

console.log("\n>>> Custom delimiter (pipe):");
const del1 = toon({ tags: ["reading", "gaming", "coding"] }, { delimiter: "|" });
console.log(del1);
check("pipe delimiter", del1, "tags[3|]: reading|gaming|coding");

console.log("\n>>> Custom indentation:");
const ind1 = toon({ a: { b: 1 } }, { indentSize: 4 });
console.log(ind1);
check("custom indent", ind1, "a:\n    b: 1");

console.log("\n>>> Root array:");
const rootArr = toon([1, 2, 3]);
console.log(rootArr);
check("root array", rootArr, "[3]: 1,2,3");

console.log("\n>>> List form (non-uniform objects):");
const list1 = toon({
  items: [
    { id: 1, name: "First" },
    { id: 2, name: "Second", extra: true },
  ],
});
console.log(list1);

// ── Content Truncation ──────────────────────────────────────────────
section("Content Truncation");

console.log("\n>>> Under limit (no truncation):");
const tr1 = truncate("short message", { maxLength: 100 });
console.log(JSON.stringify(tr1));
check("under limit", tr1.isTruncated ? "truncated" : "ok", "ok");

console.log("\n>>> Over limit (truncated):");
const tr2 = truncate("This is a very long message that exceeds the maximum allowed length", { maxLength: 20 });
console.log(JSON.stringify(tr2));
check("over limit", tr2.isTruncated ? "truncated" : "ok", "truncated");
check("preserves length", tr2.originalLength.toString(), "67");

console.log("\n>>> Truncation help hint:");
const hint = truncationHelp("tasks view 42", 1024, 500);
console.log(hint);
check("has --full hint", hint.includes("--full") ? "yes" : "no", "yes");
check("has total chars", hint.includes("1024") ? "yes" : "no", "yes");

// ── Error Formatting ────────────────────────────────────────────────
section("Error Formatting");

console.log("\n>>> Usage error (exit code 2):");
const ue = usageError("--title is required", 'tasks create --title "..."');
const ueOut = formatError(ue);
console.log(ueOut);
check("usage error prefix", ueOut.startsWith("error:") ? "yes" : "no", "yes");
check("usage exit code", ue.exitCode.toString(), "2");

console.log("\n>>> Runtime error (exit code 1):");
const re = runtimeError("API returned 500");
const reOut = formatError(re);
console.log(reOut);
check("runtime exit code", re.exitCode.toString(), "1");

console.log("\n>>> No-op (exit code 0):");
const no = formatError({ message: "#42 already closed (no-op)", exitCode: 0 });
console.log(no);
check("no-op no prefix", no.startsWith("error:") ? "yes" : "no", "no");

console.log("\n>>> Unknown error wrapping:");
const unk = formatUnknownError(new Error("connection refused"));
console.log(unk);
check("unknown error wrap", unk, "error: connection refused");

// ── Help Text Generation ────────────────────────────────────────────
section("Help Text Generation");

console.log("\n>>> Full help output:");
const help = formatHelp({
  command: "tasks list",
  description: "List tasks in the current project",
  flags: [
    { name: "--state", description: "Filter by state (open, closed)", type: "string" },
    { name: "--assignee", description: "Filter by assignee", type: "string" },
    { name: "--limit", description: "Maximum results", type: "number", default: "30" },
    { name: "--full", description: "Show complete output without truncation", type: "boolean" },
  ],
  examples: [
    "tasks list",
    'tasks list --state open --assignee "@me"',
    "tasks list --limit 50",
  ],
});
console.log(help);
check("has command name", help.includes("tasks list") ? "yes" : "no", "yes");
check("has Flags section", help.includes("Flags:") ? "yes" : "no", "yes");
check("has Examples", help.includes("Examples:") ? "yes" : "no", "yes");
check("has defaults", help.includes("default: 30") ? "yes" : "no", "yes");

console.log("\n>>> Unknown flag error:");
const fe = formatFlagError("tasks list", "--bogus", ["--state", "--assignee", "--limit"]);
console.log(fe);
check("flag error", fe.includes("unknown flag --bogus") ? "yes" : "no", "yes");
check("shows valid flags", fe.includes("--state") ? "yes" : "no", "yes");

console.log("\n>>> Renamed flag error:");
const fr = formatFlagRemovedError("tasks list", "--status", "--state");
console.log(fr);
check("renamed hint", fr.includes("was renamed") ? "yes" : "no", "yes");

// ── Integration: full pipeline ──────────────────────────────────────
section("Integration: Task List Output Pipeline");

// Simulate: CLI encodes response from API into TOON, truncates if long,
// and formats any errors or help text.

const apiResponse = {
  tasks: [
    { id: 1, title: "Fix login bug", state: "open", assignee: "alice" },
    { id: 2, title: "Add dark mode", state: "open", assignee: "bob" },
    { id: 3, title: "Update docs", state: "closed", assignee: "alice" },
  ],
};

console.log("\n>>> 1. Encode response as TOON:");
const encoded = toon(apiResponse);
console.log(encoded);

console.log("\n>>> 2. Truncate if too long:");
const truncated = truncate(encoded, { maxLength: 200 });
console.log(`isTruncated: ${truncated.isTruncated}, originalLength: ${truncated.originalLength}`);
if (truncated.isTruncated) {
  console.log(truncationHelp("tasks list", truncated.originalLength, 200));
}

console.log("\n>>> 3. Error formatting for unknown flag:");
const flagErr = formatFlagError("tasks list", "--statuz", ["--state", "--assignee", "--limit"]);
console.log(flagErr);

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) process.exit(1);
