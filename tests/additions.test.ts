import { describe, expect, it } from "vitest";
import { isAdditionInput, parseAdditionInput, parseSessionId } from "shared/additions";

describe("addition input validation", () => {
  it("accepts a positive integer session and trims chemical names", () => {
    expect(parseSessionId(12)).toBe(12);
    const addition = parseAdditionInput({ chemical: "  Borax ", amountOz: 1.5 });
    expect(isAdditionInput(addition)).toBe(true);
    if (isAdditionInput(addition)) {
      expect(addition).toEqual({ chemical: "Borax", amountOz: 1.5 });
    }
  });

  it("rejects invalid sessions and additions", () => {
    expect(parseSessionId(0)).toHaveProperty("error");
    expect(parseSessionId(1.5)).toHaveProperty("error");
    expect(parseAdditionInput({ chemical: " ", amountOz: 1 })).toHaveProperty("error");
    expect(parseAdditionInput({ chemical: "B".repeat(61), amountOz: 1 })).toHaveProperty("error");
    expect(parseAdditionInput({ chemical: "Borax", amountOz: 0 })).toHaveProperty("error");
    expect(parseAdditionInput({ chemical: "Borax", amountOz: Infinity })).toHaveProperty("error");
    expect(parseAdditionInput({ chemical: "Borax", amountOz: 101 })).toHaveProperty("error");
  });
});
