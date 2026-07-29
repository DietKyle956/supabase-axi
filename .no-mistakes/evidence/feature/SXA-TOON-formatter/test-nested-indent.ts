import { toon } from "../src/format/toon.js";

// Test nested list with arrays of arrays using custom indent
const data = {
  items: [
    { id: 1, pairs: [[1, 2], [3, 4]] },
  ],
};

console.log("=== indent 2 (default) ===");
console.log(toon(data));

console.log("\n=== indent 4 ===");
console.log(toon(data, { indentSize: 4 }));
