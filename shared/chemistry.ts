import type { TestType } from "./types";

// Tub configuration
export const TUB_GALLONS = 330;
export const BLEACH_CONCENTRATION = 7.5; // percent

// Drop-to-PPM conversion for Taylor K-2106
export const BROMINE_DROPS: Record<number, number> = {
  25: 0.5, // 25ml sample: 1 drop = 0.5 ppm
  10: 1.25, // 10ml sample: 1 drop = 1.25 ppm
};

// TA titration: 25ml sample, 1 drop = 10 ppm
export const TA_PPM_PER_DROP = 10;
export const TA_SAMPLE_SIZE_ML = 25;

// Calcium Hardness titration: 25ml sample, 1 drop = 10 ppm
export const CALCIUM_PPM_PER_DROP = 10;
export const CALCIUM_SAMPLE_SIZE_ML = 25;

// Test order: TA first, then Bromine before pH (to enforce pH skip), Calcium last
export const TEST_ORDER: TestType[] = ["ta", "bromine", "ph", "calcium"];

export function dropsToPpm(
  testType: TestType,
  drops: number,
  sampleSizeMl?: number
): number {
  switch (testType) {
    case "bromine": {
      const size = sampleSizeMl || 25;
      const ppmPerDrop = BROMINE_DROPS[size] || BROMINE_DROPS[25];
      return drops * ppmPerDrop;
    }
    case "ta":
      return drops * TA_PPM_PER_DROP;
    case "calcium":
      return drops * CALCIUM_PPM_PER_DROP;
    default:
      return drops;
  }
}

export function ppmToDrops(
  testType: TestType,
  ppm: number,
  sampleSizeMl?: number
): number {
  switch (testType) {
    case "bromine": {
      const size = sampleSizeMl || 25;
      const ppmPerDrop = BROMINE_DROPS[size] || BROMINE_DROPS[25];
      return Math.round(ppm / ppmPerDrop);
    }
    case "ta":
      return Math.round(ppm / TA_PPM_PER_DROP);
    case "calcium":
      return Math.round(ppm / CALCIUM_PPM_PER_DROP);
    default:
      return ppm;
  }
}

// --- Dosing calculations for 330 gallon tub ---

// Bleach shock: ~2 oz per 100 gal at 7.5%
// Standard: 3 oz per 100 gal at 5.25%, scaled: 3 * (5.25/7.5) * (330/100) = 6.93
// User confirmed: 6.6 oz for 330 gal at 7.5%
export const BLEACH_SHOCK_OZ = 6.6;

// Sodium bromide on refill: 1/2 oz per 100 gal
export const SODIUM_BROMIDE_OZ =
  Math.round(((0.5 * TUB_GALLONS) / 100) * 100) / 100; // 1.65 oz

// Baking soda to raise TA by 10 ppm: ~1.4 oz per 500 gal
// For 330 gal: ~0.92 oz per 10 ppm raise
export const BAKING_SODA_OZ_PER_10PPM =
  Math.round(((1.4 * TUB_GALLONS) / 500) * 100) / 100;

// Dry acid to lower pH by 0.2: ~0.7 oz per 500 gal
// For 330 gal: ~0.46 oz per 0.2 pH drop
export const DRY_ACID_OZ_PER_02PH =
  Math.round(((0.7 * TUB_GALLONS) / 500) * 100) / 100;

// Calcium chloride to raise CH by 10 ppm: ~0.73 oz per 500 gal
// For 330 gal: ~0.48 oz per 10 ppm raise
export const CALCIUM_CHLORIDE_OZ_PER_10PPM =
  Math.round(((0.73 * TUB_GALLONS) / 500) * 100) / 100;

export function ozToTablespoons(oz: number): number {
  return Math.round(oz * 2 * 10) / 10; // 1 oz = 2 tbsp
}

export function ozToTeaspoons(oz: number): number {
  return Math.round(oz * 6 * 10) / 10; // 1 oz = 6 tsp
}

export interface DosingRecommendation {
  chemical: string;
  amount: string;
  reason: string;
}

export function getRecommendations(
  testType: TestType,
  currentValue: number
): DosingRecommendation[] {
  const recs: DosingRecommendation[] = [];

  switch (testType) {
    case "bromine": {
      if (currentValue < 4) {
        recs.push({
          chemical: "7.5% Bleach",
          amount: `${BLEACH_SHOCK_OZ} oz (${ozToTablespoons(BLEACH_SHOCK_OZ)} tbsp)`,
          reason: `Bromine is low (${currentValue} ppm). Shock with bleach.`,
        });
      }
      break;
    }
    case "ta": {
      if (currentValue < 50) {
        const deficit = 50 - currentValue;
        const units = deficit / 10;
        const oz = Math.round(units * BAKING_SODA_OZ_PER_10PPM * 10) / 10;
        recs.push({
          chemical: "Baking Soda",
          amount: `${oz} oz (${ozToTeaspoons(oz)} tsp)`,
          reason: `TA is low (${currentValue} ppm). Raise to 50 ppm.`,
        });
      } else if (currentValue > 70) {
        recs.push({
          chemical: "Aeration",
          amount: "Run jets with cover open",
          reason: `TA is high (${currentValue} ppm). Aeration slowly lowers TA. You can also use dry acid cautiously.`,
        });
      }
      break;
    }
    case "ph": {
      if (currentValue > 7.8) {
        const excess = currentValue - 7.6;
        const units = excess / 0.2;
        const oz = Math.round(units * DRY_ACID_OZ_PER_02PH * 10) / 10;
        recs.push({
          chemical: "Dry Acid (sodium bisulfate)",
          amount: `${oz} oz (${ozToTeaspoons(oz)} tsp)`,
          reason: `pH is high (${currentValue}). Lower to ~7.6.`,
        });
      } else if (currentValue < 7.2) {
        recs.push({
          chemical: "Aeration / Borax",
          amount: "Run jets with cover open, or add borax",
          reason: `pH is low (${currentValue}). Aeration raises pH naturally.`,
        });
      }
      break;
    }
    case "calcium": {
      if (currentValue < 130) {
        const deficit = 130 - currentValue;
        const units = deficit / 10;
        const oz = Math.round(units * CALCIUM_CHLORIDE_OZ_PER_10PPM * 10) / 10;
        recs.push({
          chemical: "Calcium Chloride",
          amount: `${oz} oz (${ozToTeaspoons(oz)} tsp)`,
          reason: `Calcium is low (${currentValue} ppm). Raise to 130 ppm.`,
        });
      }
      break;
    }
  }

  return recs;
}

// Cadence in days for when tests should be performed
export const TEST_CADENCE_DAYS: Record<TestType, number> = {
  ph: 7, // weekly
  bromine: 7, // weekly
  ta: 21, // every 2-4 weeks (use 3 week default)
  calcium: 21, // every 2-4 weeks
};

// Maintenance cadence in days
export const MAINTENANCE_CADENCE_DAYS: Record<string, number> = {
  filter_change: 30,
  water_change: 30,
  drain_refill: 105, // ~3.5 months
};

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function timeSinceLabel(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const days = daysSince(dateStr);
  if (days === null) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}
