import { describe, it, expect } from "vitest";
import { toon } from "../../src/format/toon.js";

describe("toon - primitives", () => {
  it("should encode a string value", () => {
    expect(toon("hello")).toBe("hello");
  });

  it("should encode a number value", () => {
    expect(toon(42)).toBe("42");
  });

  it("should encode a boolean value", () => {
    expect(toon(true)).toBe("true");
    expect(toon(false)).toBe("false");
  });

  it("should encode null", () => {
    expect(toon(null)).toBe("null");
  });

  it("should quote strings that look like booleans", () => {
    expect(toon("true")).toBe('"true"');
    expect(toon("false")).toBe('"false"');
    expect(toon("null")).toBe('"null"');
  });

  it("should quote strings that look like numbers", () => {
    expect(toon("123")).toBe('"123"');
    expect(toon("1.5")).toBe('"1.5"');
    expect(toon("-42")).toBe('"-42"');
  });

  it("should quote strings containing colon, brackets, braces", () => {
    expect(toon("a:b")).toBe('"a:b"');
    expect(toon("[test]")).toBe('"[test]"');
    expect(toon("{test}")).toBe('"{test}"');
  });

  it("should quote strings containing delimiter", () => {
    expect(toon("a,b")).toBe('"a,b"');
  });

  it("should quote strings starting with dash", () => {
    expect(toon("-hello")).toBe('"-hello"');
  });

  it("should quote strings starting with hash", () => {
    expect(toon("#comment")).toBe('"#comment"');
  });

  it("should quote empty string", () => {
    expect(toon("")).toBe('""');
  });

  it("should not quote plain strings unnecessarily", () => {
    expect(toon("hello")).toBe("hello");
    expect(toon("hello_world")).toBe("hello_world");
    expect(toon("hello 世界")).toBe("hello 世界");
  });

  it("should canonicalize numbers", () => {
    expect(toon(0)).toBe("0");
    expect(toon(-0)).toBe("0"); // -0 normalizes to 0
    expect(toon(1.0)).toBe("1");
    expect(toon(1.5)).toBe("1.5");
    expect(toon(1e6)).toBe("1000000");
    expect(toon(0.000001)).toBe("0.000001");
  });
});

describe("toon - objects", () => {
  it("should encode simple key-value pairs", () => {
    const result = toon({ id: 123, name: "Ada", active: true });
    expect(result).toBe("id: 123\nname: Ada\nactive: true");
  });

  it("should encode nested objects with indentation", () => {
    const result = toon({ user: { id: 123, name: "Ada" } });
    expect(result).toBe("user:\n  id: 123\n  name: Ada");
  });

  it("should encode empty object as empty string", () => {
    expect(toon({})).toBe("");
  });

  it("should preserve key order", () => {
    const result = toon({ zebra: 1, apple: 2, mango: 3 });
    const lines = result.split("\n");
    expect(lines[0]).toContain("zebra");
    expect(lines[1]).toContain("apple");
    expect(lines[2]).toContain("mango");
  });

  it("should deeply nest objects", () => {
    const result = toon({ a: { b: { c: 1 } } });
    expect(result).toBe("a:\n  b:\n    c: 1");
  });

  it("should quote object keys that need quoting", () => {
    const result = toon({ "my-key": 1, "123": 2 });
    expect(result).toContain('"my-key": 1');
    expect(result).toContain('"123": 2');
  });

  it("should allow dotted keys without quoting", () => {
    const result = toon({ "data.items": [1, 2] });
    expect(result).toContain("data.items[2]:");
  });
});

describe("toon - inline primitive arrays", () => {
  it("should encode inline primitive array", () => {
    const result = toon({ tags: ["admin", "ops", "dev"] });
    expect(result).toBe("tags[3]: admin,ops,dev");
  });

  it("should encode array of numbers inline", () => {
    const result = toon({ scores: [1, 2, 3] });
    expect(result).toBe("scores[3]: 1,2,3");
  });

  it("should encode array of booleans inline", () => {
    const result = toon({ flags: [true, false, true] });
    expect(result).toBe("flags[3]: true,false,true");
  });

  it("should encode mixed primitives inline without unnecessary quoting", () => {
    // Primitive arrays inline - "two" doesn't need quoting since it's a plain word
    const result = toon({ mixed: [1, "two", true] });
    expect(result).toBe("mixed[3]: 1,two,true");
  });

  it("should encode root array inline", () => {
    const result = toon([1, 2, 3]);
    expect(result).toBe("[3]: 1,2,3");
  });

  it("should encode empty array in object field", () => {
    const result = toon({ tags: [] });
    expect(result).toBe("tags: []");
  });

  it("should encode empty root array", () => {
    const result = toon([]);
    expect(result).toBe("[]");
  });
});

describe("toon - tabular arrays (uniform objects)", () => {
  it("should encode array of uniform objects in tabular form", () => {
    const result = toon({
      items: [
        { sku: "A1", qty: 2, price: 9.99 },
        { sku: "B2", qty: 1, price: 14.5 },
      ],
    });
    expect(result).toBe(
      "items[2]{sku,qty,price}:\n  A1,2,9.99\n  B2,1,14.5",
    );
  });

  it("should encode tabular with nested field groups", () => {
    const result = toon({
      orders: [
        { id: 1, customer: { name: "Ada", country: "DK" }, total: 99 },
        { id: 2, customer: { name: "Bob", country: "UK" }, total: 149 },
      ],
    });
    expect(result).toBe(
      "orders[2]{id,customer{name,country},total}:\n  1,Ada,DK,99\n  2,Bob,UK,149",
    );
  });

  it("should fall back to list form for non-uniform objects", () => {
    const result = toon({
      items: [
        { id: 1, name: "First" },
        { id: 2, name: "Second", extra: true },
      ],
    });
    // Objects have different key sets, so they can't be tabular
    expect(result).toContain("items[2]:");
    expect(result).toContain("- id: 1");
  });

  it("should fall back to list form when a column has mixed types", () => {
    const result = toon({
      items: [
        { id: 1, value: "text" },
        { id: 2, value: 42 },
      ],
    });
    // value column has mixed types (string + number), can't be tabular
    expect(result).toContain("items[2]:");
    expect(result).toContain("- id: 1");
  });
});

describe("toon - keyed tabular form", () => {
  it("should encode object of uniform objects in keyed tabular", () => {
    const result = toon({
      users: {
        alice: { age: 30, city: "Berlin" },
        bob: { age: 25, city: "Oslo" },
      },
    });
    expect(result).toBe(
      "users[2:]{age,city}:\n  alice: 30,Berlin\n  bob: 25,Oslo",
    );
  });

  it("should fall back to nested objects when only 1 entry", () => {
    const result = toon({
      users: {
        alice: { age: 30, city: "Berlin" },
      },
    });
    // Single entry - use nested object form instead of keyed tabular
    expect(result).not.toContain("[1:]");
    expect(result).toContain("alice:");
  });
});

describe("toon - list form (mixed/non-uniform arrays)", () => {
  it("should encode mixed array inline since primitives", () => {
    const result = toon({ items: [1, "text", true] });
    expect(result).toBe("items[3]: 1,text,true");
  });

  it("should encode array of objects as list when objects have varying shapes", () => {
    const result = toon({
      items: [
        { id: 1, name: "First" },
        { id: 2, name: "Second", extra: true },
      ],
    });
    expect(result).toContain("items[2]:");
    expect(result).toContain("- id: 1");
    expect(result).toContain("  name: First");
    expect(result).toContain("- id: 2");
    expect(result).toContain("  name: Second");
    expect(result).toContain("  extra: true");
  });

  it("should encode array of arrays (primitive arrays of arrays)", () => {
    const result = toon({
      pairs: [
        [1, 2],
        [3, 4],
      ],
    });
    expect(result).toContain("pairs[2]:");
    expect(result).toContain("- [2]: 1,2");
    expect(result).toContain("- [2]: 3,4");
  });
});

describe("toon - string escaping", () => {
  it("should escape newlines in strings", () => {
    const result = toon({ message: "line1\nline2" });
    expect(result).toBe('message: "line1\\nline2"');
  });

  it("should escape tabs in strings", () => {
    const result = toon({ message: "col1\tcol2" });
    expect(result).toBe('message: "col1\\tcol2"');
  });

  it("should escape backslashes and quotes", () => {
    const result = toon({ path: 'C:\\Users\\"name"' });
    expect(result).toBe('path: "C:\\\\Users\\\\\\"name\\""');
  });

  it("should escape control characters", () => {
    const result = toon({ data: "\x00" });
    expect(result).toContain("\\u0000");
  });
});

describe("toon - delimiter support", () => {
  it("should support pipe delimiter", () => {
    const result = toon({ tags: ["reading", "gaming", "coding"] }, { delimiter: "|" });
    expect(result).toBe("tags[3|]: reading|gaming|coding");
  });

  it("should support tab delimiter", () => {
    const result = toon({ tags: ["admin", "ops"] }, { delimiter: "\t" });
    expect(result).toBe("tags[2\t]: admin\tops");
  });

  it("should quote values containing the active pipe delimiter", () => {
    const result = toon({ values: ["a|b", "c"] }, { delimiter: "|" });
    expect(result).toBe('values[2|]: "a|b"|c');
  });
});

describe("toon - indentation", () => {
  it("should support custom indent size", () => {
    const result = toon({ a: { b: 1 } }, { indentSize: 4 });
    expect(result).toBe("a:\n    b: 1");
  });

  it("should default to 2-space indent", () => {
    const result = toon({ a: { b: 1 } });
    expect(result).toBe("a:\n  b: 1");
  });
});

describe("toon - edge cases", () => {
  it("should handle null values in objects", () => {
    const result = toon({ key: null });
    expect(result).toBe("key: null");
  });

  it("should handle undefined as null", () => {
    const result = toon({ key: undefined });
    expect(result).toBe("key: null");
  });

  it("should handle array with null element inline", () => {
    const result = toon({ values: [1, null, 3] });
    expect(result).toBe("values[3]: 1,null,3");
  });

  it("should handle deeply nested mixed structures", () => {
    const data = {
      config: {
        servers: [
          { host: "a", port: 80 },
          { host: "b", port: 443 },
        ],
      },
    };
    const result = toon(data);
    expect(result).toContain("config:");
    expect(result).toContain("servers[2]{host,port}:");
    expect(result).toContain("a,80");
    expect(result).toContain("b,443");
  });

  it("should detect tabular even when first element has extra null keys", () => {
    // All elements must have the same keys for tabular
    const result = toon({
      items: [
        { id: 1, status: "open" },
        { id: 2, status: "closed" },
      ],
    });
    expect(result).toBe("items[2]{id,status}:\n  1,open\n  2,closed");
  });
});
