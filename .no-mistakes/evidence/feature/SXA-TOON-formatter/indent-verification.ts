import { toon } from "../../../../src/format/toon.js";

// Test case: list item object with non-inline/non-tabular array as first field
// This is the exact code path at toon.ts lines 255-265
const data = {
  items: [
    { id: 1, data: [[10, 20], [30, 40]] },
    { id: 2, data: [[50, 60]] },
  ],
};

console.log("=== Default indent (2 spaces) ===");
console.log(toon(data));
console.log();

console.log("=== indentSize=4 ===");
const result4 = toon(data, { indentSize: 4 });
console.log(result4);
console.log();

console.log("=== indentSize=3 ===");
const result3 = toon(data, { indentSize: 3 });
console.log(result3);
console.log();

// Verification: each indentation level should be a multiple of indentSize
function verifyIndent(output: string, indentSize: number): string[] {
  const lines = output.split("\n");
  const errors: string[] = [];
  for (const line of lines) {
    const leadingSpaces = line.match(/^(\s*)/)![1].length;
    if (leadingSpaces === 0) continue;
    if (leadingSpaces % indentSize !== 0) {
      errors.push(
        `Bad indent: ${leadingSpaces} spaces for line: "${line}" (expected multiple of ${indentSize})`,
      );
    }
  }
  return errors;
}

console.log("=== Verification ===");
let allPass = true;
for (const size of [2, 3, 4]) {
  const output = toon(data, { indentSize: size });
  const errors = verifyIndent(output, size);
  if (errors.length > 0) {
    console.log(`FAIL indentSize=${size}:`);
    errors.forEach((e) => console.log(`  ${e}`));
    allPass = false;
  } else {
    console.log(
      `PASS indentSize=${size}: all indentation is a multiple of ${size}`,
    );
  }
}

// Additional edge case: deeply nested arrays in list items
const deepData = {
  items: [
    { name: "First", nested: [[[1]]] },
    { name: "Second", nested: [[[2], [3]]] },
  ],
};

console.log();
console.log("=== Deeply nested (indentSize=4) ===");
const deepResult = toon(deepData, { indentSize: 4 });
console.log(deepResult);
console.log();

const deepErrors = verifyIndent(deepResult, 4);
if (deepErrors.length > 0) {
  console.log("FAIL deeply nested:");
  deepErrors.forEach((e) => console.log(`  ${e}`));
  allPass = false;
} else {
  console.log("PASS deeply nested: all indentation is a multiple of 4");
}

if (!allPass) process.exit(1);
