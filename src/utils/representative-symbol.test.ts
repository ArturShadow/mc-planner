import { describe, expect, it } from "vitest";
import { representativeSymbol } from "./representative-symbol";

describe("representativeSymbol", () => {
  it("uses the first letter of a single-word name", () => {
    expect(representativeSymbol("Storage")).toBe("S");
  });

  it("uses every word initial for a multi-word name", () => {
    expect(representativeSymbol("Large Steam Boiler")).toBe("LSB");
  });

  it("normalizes whitespace and casing", () => {
    expect(representativeSymbol("  primitive   water pump ")).toBe("PWP");
  });
});
