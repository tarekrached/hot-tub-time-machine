import { describe, it, expect } from "vitest";
import {
  dropsToPpm,
  ppmToDrops,
  ozToTablespoons,
  ozToTeaspoons,
  getRecommendations,
  BLEACH_SHOCK_OZ,
  BAKING_SODA_OZ_PER_10PPM,
  DRY_ACID_OZ_PER_02PH,
  CALCIUM_CHLORIDE_OZ_PER_10PPM,
  SODIUM_BROMIDE_OZ,
  TEST_ORDER,
} from "shared/chemistry";

describe("dropsToPpm", () => {
  it("converts bromine drops with 25ml sample", () => {
    expect(dropsToPpm("bromine", 8, 25)).toBe(4);
    expect(dropsToPpm("bromine", 12, 25)).toBe(6);
    expect(dropsToPpm("bromine", 0, 25)).toBe(0);
  });

  it("converts bromine drops with 10ml sample", () => {
    expect(dropsToPpm("bromine", 4, 10)).toBe(5);
    expect(dropsToPpm("bromine", 8, 10)).toBe(10);
  });

  it("defaults to 25ml for bromine when no sample size", () => {
    expect(dropsToPpm("bromine", 10)).toBe(5);
  });

  it("converts TA drops", () => {
    expect(dropsToPpm("ta", 5)).toBe(50);
    expect(dropsToPpm("ta", 7)).toBe(70);
  });

  it("converts calcium drops", () => {
    expect(dropsToPpm("calcium", 13)).toBe(130);
    expect(dropsToPpm("calcium", 15)).toBe(150);
  });

  it("returns drops directly for pH (not titrated)", () => {
    expect(dropsToPpm("ph", 7.4)).toBe(7.4);
  });

  it("handles zero drops", () => {
    expect(dropsToPpm("bromine", 0, 25)).toBe(0);
    expect(dropsToPpm("ta", 0)).toBe(0);
    expect(dropsToPpm("calcium", 0)).toBe(0);
  });
});

describe("ppmToDrops", () => {
  it("converts bromine ppm to drops (25ml)", () => {
    expect(ppmToDrops("bromine", 4, 25)).toBe(8);
    expect(ppmToDrops("bromine", 6, 25)).toBe(12);
  });

  it("converts bromine ppm to drops (10ml)", () => {
    expect(ppmToDrops("bromine", 5, 10)).toBe(4);
    expect(ppmToDrops("bromine", 10, 10)).toBe(8);
  });

  it("converts TA ppm to drops", () => {
    expect(ppmToDrops("ta", 50)).toBe(5);
    expect(ppmToDrops("ta", 70)).toBe(7);
  });

  it("converts calcium ppm to drops", () => {
    expect(ppmToDrops("calcium", 130)).toBe(13);
    expect(ppmToDrops("calcium", 150)).toBe(15);
  });

  it("roundtrips correctly", () => {
    expect(ppmToDrops("bromine", dropsToPpm("bromine", 8, 25), 25)).toBe(8);
    expect(ppmToDrops("ta", dropsToPpm("ta", 5))).toBe(5);
    expect(ppmToDrops("calcium", dropsToPpm("calcium", 13))).toBe(13);
  });
});

describe("ozToTablespoons", () => {
  it("converts ounces to tablespoons (1 oz = 2 tbsp)", () => {
    expect(ozToTablespoons(1)).toBe(2);
    expect(ozToTablespoons(6.6)).toBe(13.2);
    expect(ozToTablespoons(0.5)).toBe(1);
  });
});

describe("ozToTeaspoons", () => {
  it("converts ounces to teaspoons (1 oz = 6 tsp)", () => {
    expect(ozToTeaspoons(1)).toBe(6);
    expect(ozToTeaspoons(0.5)).toBe(3);
  });
});

describe("dosing constants", () => {
  it("bleach shock is 6.6 oz", () => {
    expect(BLEACH_SHOCK_OZ).toBe(6.6);
  });

  it("sodium bromide is 1.65 oz for 330 gal", () => {
    expect(SODIUM_BROMIDE_OZ).toBe(1.65);
  });

  it("baking soda is 0.75 oz per 10 ppm for 330 gal", () => {
    expect(BAKING_SODA_OZ_PER_10PPM).toBe(0.75);
  });

  it("dry acid is ~0.46 oz per 0.2 pH for 330 gal", () => {
    expect(DRY_ACID_OZ_PER_02PH).toBe(0.46);
  });

  it("calcium chloride is ~0.48 oz per 10 ppm for 330 gal", () => {
    expect(CALCIUM_CHLORIDE_OZ_PER_10PPM).toBe(0.48);
  });
});

describe("getRecommendations", () => {
  it("recommends bleach when bromine is low", () => {
    const recs = getRecommendations("bromine", 2);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("7.5% Bleach");
    expect(recs[0].amount).toContain("6.6 oz");
  });

  it("returns nothing when bromine is in range", () => {
    expect(getRecommendations("bromine", 5)).toHaveLength(0);
  });

  it("recommends baking soda when TA is low", () => {
    const recs = getRecommendations("ta", 30);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Baking Soda");
    // 20 ppm deficit = 2 units * 0.75 oz * 2 tbsp/oz = 3 tbsp
    expect(recs[0].amount).toContain("3 tbsp");
  });

  it("recommends aeration when TA is high", () => {
    const recs = getRecommendations("ta", 80);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Aeration");
  });

  it("returns nothing when TA is in range", () => {
    expect(getRecommendations("ta", 60)).toHaveLength(0);
  });

  it("recommends dry acid when pH is high", () => {
    const recs = getRecommendations("ph", 8.0);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Dry Acid (sodium bisulfate)");
  });

  it("recommends borax when pH is low", () => {
    const recs = getRecommendations("ph", 7.0);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Borax");
    // 0.6 pH deficit = 3 units * 1.0 oz * 2 tbsp/oz = 6 tbsp
    expect(recs[0].amount).toContain("6 tbsp");
  });

  it("returns nothing when pH is in range", () => {
    expect(getRecommendations("ph", 7.6)).toHaveLength(0);
  });

  it("recommends calcium chloride when calcium is low", () => {
    const recs = getRecommendations("calcium", 100);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Calcium Chloride");
    // 30 ppm deficit = 3 units * 0.48 oz = 1.44 -> rounded to 1.4
    expect(recs[0].amount).toContain("1.4 oz");
  });

  it("returns nothing when calcium is in range", () => {
    expect(getRecommendations("calcium", 140)).toHaveLength(0);
  });

  it("returns nothing for high calcium (no chemical to lower it)", () => {
    expect(getRecommendations("calcium", 500)).toHaveLength(0);
  });
});

describe("TEST_ORDER", () => {
  it("has bromine before pH (for pH enforcement)", () => {
    const bromineIdx = TEST_ORDER.indexOf("bromine");
    const phIdx = TEST_ORDER.indexOf("ph");
    expect(bromineIdx).toBeLessThan(phIdx);
  });

  it("has TA first", () => {
    expect(TEST_ORDER[0]).toBe("ta");
  });

  it("includes all 4 test types", () => {
    expect(TEST_ORDER).toHaveLength(4);
    expect(TEST_ORDER).toContain("ta");
    expect(TEST_ORDER).toContain("bromine");
    expect(TEST_ORDER).toContain("ph");
    expect(TEST_ORDER).toContain("calcium");
  });
});
