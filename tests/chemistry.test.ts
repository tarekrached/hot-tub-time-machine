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
  fromOz,
  toOz,
  getTestCadenceStatus,
  isCalciumDue,
  TEST_CADENCE_DAYS,
  MAINTENANCE_CADENCE_DAYS,
  DEFAULT_BROMINE_TABLETS,
  shouldSkipShock,
  bromineRiseFromBleach,
  getWeeklyDose,
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
  it("gives an advisory, not a dose, when bromine is low", () => {
    const recs = getRecommendations("bromine", 2);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Weekly shock");
    expect(recs[0].reason).toContain("open the floater");
    expect(recs[0].amountOz).toBeUndefined();
    expect(recs[0].unit).toBeUndefined();
  });

  it("advises skipping the shock when bromine is 10 or more", () => {
    const recs = getRecommendations("bromine", 10);
    expect(recs).toHaveLength(1);
    expect(recs[0].chemical).toBe("Skip this week's shock");
    expect(recs[0].amountOz).toBeUndefined();
  });

  it("returns nothing when bromine is 4 to under 10", () => {
    expect(getRecommendations("bromine", 4)).toHaveLength(0);
    expect(getRecommendations("bromine", 9.5)).toHaveLength(0);
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
    expect(recs[0].amountOz).toBeUndefined();
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

  it("provides structured amounts matching recommendation display units", () => {
    const cases = [
      getRecommendations("ta", 40)[0],
      getRecommendations("ph", 7.3)[0],
      getRecommendations("ph", 8.0)[0],
      getRecommendations("calcium", 110)[0],
    ];

    expect(cases[0].amountOz).toBe(0.75);
    expect(cases[1].amountOz).toBe(1.5);
    for (const rec of cases) {
      expect(rec.amountOz).toBeDefined();
      expect(rec.unit).toBeDefined();
      expect(Number(rec.amount.match(/^[\d.]+/)?.[0])).toBe(
        fromOz(rec.amountOz!, rec.unit!)
      );
    }
  });

  it("prefills tbsp recommendations from their displayed rounded amount", () => {
    for (let ta = 0; ta < 50; ta += 1) {
      const rec = getRecommendations("ta", ta)[0];
      expect(fromOz(rec.amountOz!, rec.unit!)).toBe(Number(rec.amount.match(/^[\d.]+/)?.[0]));
    }
    for (const ph of [6.8, 7.0, 7.1, 7.2, 7.3]) {
      const rec = getRecommendations("ph", ph)[0];
      expect(fromOz(rec.amountOz!, rec.unit!)).toBe(Number(rec.amount.match(/^[\d.]+/)?.[0]));
    }
  });
});

describe("dose unit conversion", () => {
  it("converts and round-trips amounts to two decimal places", () => {
    expect(toOz(3, "tbsp")).toBe(1.5);
    expect(toOz(9, "tsp")).toBe(1.5);
    expect(fromOz(1.5, "tbsp")).toBe(3);
    expect(fromOz(1.5, "tsp")).toBe(9);
    expect(toOz(fromOz(1.23, "tbsp"), "tbsp")).toBe(1.23);
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

describe("calcium cadence", () => {
  const now = new Date("2026-10-01T00:00:00Z");

  it("has no day timer", () => {
    expect(TEST_CADENCE_DAYS.calcium).toBeNull();
  });

  it("is not due without a drain & refill, however old the reading", () => {
    expect(isCalciumDue(null, null)).toBe(false);
    expect(isCalciumDue("2025-01-01 00:00:00", null)).toBe(false);
    expect(getTestCadenceStatus("calcium", null, now, null)).toBe("current");
    expect(getTestCadenceStatus("calcium", "2025-01-01 00:00:00", now, null)).toBe("current");
  });

  it("is due when a drain & refill is newer than the last reading", () => {
    expect(isCalciumDue("2026-06-01 00:00:00", "2026-07-05 02:17:01")).toBe(true);
    expect(isCalciumDue(null, "2026-07-05 02:17:01")).toBe(true);
    expect(getTestCadenceStatus("calcium", null, now, "2026-07-05 02:17:01")).toBe("due");
  });

  it("is not due once calcium is read after the drain & refill", () => {
    expect(isCalciumDue("2026-07-06 00:00:00", "2026-07-05 02:17:01")).toBe(false);
    expect(getTestCadenceStatus("calcium", "2026-07-06 00:00:00", now, "2026-07-05 02:17:01")).toBe("current");
  });

  it("leaves other tests on their day timers", () => {
    expect(getTestCadenceStatus("ph", "2026-09-01 00:00:00", now, null)).toBe("overdue");
    expect(getTestCadenceStatus("ph", null, now, null)).toBe("never");
  });
});

describe("maintenance cadence and tablets", () => {
  it("uses 180 days for drain & refill and drops water_change", () => {
    expect(MAINTENANCE_CADENCE_DAYS.drain_refill).toBe(180);
    expect(MAINTENANCE_CADENCE_DAYS.filter_change).toBe(30);
    expect(MAINTENANCE_CADENCE_DAYS.water_change).toBeUndefined();
  });

  it("defaults to 2 bromine tablets", () => {
    expect(DEFAULT_BROMINE_TABLETS).toBe(2);
  });
});

describe("weekly shock", () => {
  const now = new Date("2026-11-14T18:00:00Z");
  const base = {
    bromine: 5,
    bleachLoggedThisSession: false,
    tabletsLoggedThisSession: false,
    lastBleachAt: "2026-11-07 18:00:00",
    lastTabletsAt: "2026-11-07 18:00:00",
    now,
  };

  it("skips the shock at 10 ppm and above", () => {
    expect(shouldSkipShock(9.5)).toBe(false);
    expect(shouldSkipShock(10)).toBe(true);
    expect(shouldSkipShock(14)).toBe(true);
    expect(shouldSkipShock(null)).toBe(false);
  });

  it("6.6 oz of bleach raises bromine about 25-28 ppm", () => {
    const rise = bromineRiseFromBleach(6.6);
    expect(rise).toBeGreaterThanOrEqual(25);
    expect(rise).toBeLessThanOrEqual(28);
  });

  it("includes 2 tablets and 6.6 oz bleach on a normal week", () => {
    const dose = getWeeklyDose(base);
    expect(dose.tablets).toMatchObject({ include: true, count: 2 });
    expect(dose.bleach).toMatchObject({ include: true, oz: 6.6, expectedBromine: 31 });
    expect(dose.tablets.floaterHint).toContain("holes");
  });

  it("skips bleach at bromine 10 but keeps tablets", () => {
    const dose = getWeeklyDose({ ...base, bromine: 10 });
    expect(dose.bleach.include).toBe(false);
    expect(dose.bleach.skipReason).toContain("10 ppm");
    expect(dose.tablets.include).toBe(true);
    expect(dose.tablets.floaterHint).toContain("close the floater");
  });

  it("skips bleach already logged this session", () => {
    const dose = getWeeklyDose({ ...base, bleachLoggedThisSession: true });
    expect(dose.bleach.include).toBe(false);
    expect(dose.bleach.skipReason).toContain("this session");
  });

  it("skips bleach logged 2 days ago, includes it 4 days ago", () => {
    const twoDays = getWeeklyDose({ ...base, lastBleachAt: "2026-11-12 18:00:00" });
    expect(twoDays.bleach.include).toBe(false);
    expect(twoDays.bleach.skipReason).toContain("2 days ago");
    const fourDays = getWeeklyDose({ ...base, lastBleachAt: "2026-11-10 18:00:00" });
    expect(fourDays.bleach.include).toBe(true);
  });

  it("skips tablets logged this session or recently", () => {
    expect(getWeeklyDose({ ...base, tabletsLoggedThisSession: true }).tablets.include).toBe(false);
    expect(getWeeklyDose({ ...base, lastTabletsAt: "2026-11-14 08:00:00" }).tablets.skipReason).toContain("today");
  });

  it("omits the expected reading without a bromine test", () => {
    expect(getWeeklyDose({ ...base, bromine: null }).bleach).toMatchObject({ include: true, expectedBromine: undefined });
  });
});
