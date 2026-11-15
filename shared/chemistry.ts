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
export const BLEACH_CHEMICAL = "7.5% Bleach";

// FC per oz of bleach: 7.5% NaOCl is 7.1% available chlorine (Clorox label).
// 6.6 fl oz = 195 mL into 330 gal = 1,249 L → 195 × 0.071 / 1249 ≈ 11.1 ppm FC,
// ~12.2 ppm at density ~1.10. Midpoint ≈ 11.6 ppm per 6.6 oz ≈ 1.75 ppm per oz.
export const BLEACH_FC_PPM_PER_OZ = 1.75;
// With a bromide bank, 1 ppm FC becomes 2.25 ppm bromine (Br2 159.81 / Cl2 70.91).
export const BROMINE_PER_FC = 2.25;

export function bromineRiseFromBleach(oz: number): number {
  return Math.round(oz * BLEACH_FC_PPM_PER_OZ * BROMINE_PER_FC); // 6.6 oz → 26
}

// Skip the weekly shock at 10+. ">=" because the 25 ml slider tops out at
// 20 drops = 10 ppm, so a reading of 10 can mean "10 or more".
export const SHOCK_SKIP_BROMINE_PPM = 10;

export function shouldSkipShock(bromine: number | null): boolean {
  return bromine !== null && bromine >= SHOCK_SKIP_BROMINE_PPM;
}

// Bleach or tablets logged fewer than this many days ago count as this week's dose.
export const WEEKLY_DOSE_RECENT_DAYS = 3;

// Sodium bromide on refill: 1/2 oz per 100 gal
export const SODIUM_BROMIDE_OZ =
  Math.round(((0.5 * TUB_GALLONS) / 100) * 100) / 100; // 1.65 oz

// Baking soda to raise TA by 10 ppm: ~1.5 lbs per 10,000 gal (Swim University reference)
// For 330 gal: 24 oz × (330/10,000) = 0.79 oz → rounded to 0.75 oz (= 1.5 tbsp per 10 ppm)
export const BAKING_SODA_OZ_PER_10PPM = 0.75;

// Dry acid to lower pH by 0.2: ~0.7 oz per 500 gal
// For 330 gal: ~0.46 oz per 0.2 pH drop
export const DRY_ACID_OZ_PER_02PH =
  Math.round(((0.7 * TUB_GALLONS) / 500) * 100) / 100;

// Borax to raise pH by 0.2: ~1 oz per 330 gal (1 tbsp ≈ +0.1 pH)
export const BORAX_OZ_PER_02PH = 1.0;

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

// HTH Spa bromine tablets (BCDMH-based, so they carry their own chlorine).
// BROMINE_TABLET_OZ is a typical 1" tablet weight, not yet measured.
// The picker takes a tablet count and stores count × this in amount_oz.
export const BROMINE_TABLET = "Bromine tablet";
export const BROMINE_TABLET_OZ = 0.7;
// Tablets added with the weekly shock (summary card).
export const DEFAULT_BROMINE_TABLETS = 2;

export function tabletsToOz(count: number): number {
  return Math.round(count * BROMINE_TABLET_OZ * 100) / 100;
}

export type AmountUnit = "oz" | "tbsp" | "tsp";

export function toOz(value: number, unit: AmountUnit): number {
  const ounces = unit === "oz" ? value : unit === "tbsp" ? value / 2 : value / 6;
  return Math.round(ounces * 100) / 100;
}

export function fromOz(oz: number, unit: AmountUnit): number {
  const value = unit === "oz" ? oz : unit === "tbsp" ? oz * 2 : oz * 6;
  return Math.round(value * 100) / 100;
}

export interface DosingRecommendation {
  chemical: string;
  amount: string;
  reason: string;
  amountOz?: number;
  unit?: "oz" | "tbsp";
}

export function getRecommendations(
  testType: TestType,
  currentValue: number
): DosingRecommendation[] {
  const recs: DosingRecommendation[] = [];

  switch (testType) {
    case "bromine": {
      // Advisory only: the weekly bleach + tablets are logged from the summary card.
      if (currentValue < 4) {
        recs.push({
          chemical: "Weekly shock",
          amount: "Covered by today's shock",
          reason: `Bromine is low (${currentValue} ppm). If it's low two weeks running, open the floater a notch.`,
        });
      } else if (shouldSkipShock(currentValue)) {
        recs.push({
          chemical: "Skip this week's shock",
          amount: "Close the floater down a notch",
          reason: `Bromine is high (${currentValue} ppm). Leave the cover open until it's under 10.`,
        });
      }
      break;
    }
    case "ta": {
      if (currentValue < 50) {
        const deficit = 50 - currentValue;
        const units = deficit / 10;
        const tbsp = Math.round(units * BAKING_SODA_OZ_PER_10PPM * 2 * 10) / 10;
        recs.push({
          chemical: "Baking Soda",
          amount: `${tbsp} tbsp (1 tbsp ≈ +6 ppm TA)`,
          reason: `TA is low (${currentValue} ppm). Raise to 50 ppm.`,
          amountOz: tbsp / 2,
          unit: "tbsp",
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
          reason: `pH is high (${formatPhValue(currentValue)}). Lower to ~7.6.`,
          amountOz: oz,
          unit: "oz",
        });
      } else if (currentValue < 7.4) {
        const deficit = 7.6 - currentValue;
        const units = deficit / 0.2;
        const tbsp = Math.round(units * BORAX_OZ_PER_02PH * 2 * 10) / 10;
        recs.push({
          chemical: "Borax",
          amount: `${tbsp} tbsp (1 tbsp ≈ +0.1 pH)`,
          reason: `pH is low (${formatPhValue(currentValue)}). Add borax, or aerate (run jets with cover open).`,
          amountOz: tbsp / 2,
          unit: "tbsp",
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
          amountOz: oz,
          unit: "oz",
        });
      }
      break;
    }
  }

  return recs;
}

// Cadence in days for when tests should be performed
// Calcium has no day timer (null): it only changes on a drain & refill, so it is
// due only when a drain_refill is newer than the last calcium reading.
export const TEST_CADENCE_DAYS: Record<TestType, number | null> = {
  ph: 7, // weekly
  bromine: 7, // weekly
  ta: 21, // every 2-4 weeks (use 3 week default)
  calcium: null, // event-driven, see getTestCadenceStatus
};

// Maintenance cadence in days
export const MAINTENANCE_CADENCE_DAYS: Record<string, number> = {
  filter_change: 30,
  drain_refill: 180, // ~6 months
};

export function formatPhValue(ppm: number): string {
  if (ppm < 7.0) return "<7.0";
  if (ppm > 8.0) return ">8.0";
  return (Math.round(ppm * 10) / 10).toString();
}

export function daysSince(dateStr: string | null, now = new Date()): number | null {
  if (!dateStr) return null;
  // SQLite stores UTC without timezone suffix; append "Z" to parse as UTC
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

// Calcium is due only after a drain & refill that is newer than the latest
// calcium reading (or when there is a drain & refill and no reading ever).
// Timestamps are SQLite "YYYY-MM-DD HH:MM:SS" UTC strings, so they compare lexicographically.
export function isCalciumDue(
  lastCalciumAt: string | null,
  lastDrainRefillAt: string | null
): boolean {
  if (!lastDrainRefillAt) return false;
  if (!lastCalciumAt) return true;
  return lastDrainRefillAt > lastCalciumAt;
}

export type TestCadenceStatus = "current" | "due" | "overdue" | "never";

export function getTestCadenceStatus(
  testType: TestType,
  lastTestedAt: string | null,
  now = new Date(),
  lastDrainRefillAt: string | null = null
): TestCadenceStatus {
  const cadenceDays = TEST_CADENCE_DAYS[testType];
  if (cadenceDays === null) {
    return isCalciumDue(lastTestedAt, lastDrainRefillAt) ? "due" : "current";
  }
  const elapsedDays = daysSince(lastTestedAt, now);
  if (elapsedDays === null) return "never";
  if (elapsedDays > cadenceDays) return "overdue";
  if (elapsedDays === cadenceDays) return "due";
  return "current";
}

export function timeSinceLabel(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const days = daysSince(dateStr);
  if (days === null) return "Never";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

export interface WeeklyDoseInput {
  bromine: number | null;
  bleachLoggedThisSession: boolean;
  tabletsLoggedThisSession: boolean;
  lastBleachAt: string | null;
  lastTabletsAt: string | null;
  now?: Date;
}

export interface WeeklyDose {
  tablets: { include: boolean; count: number; skipReason?: string; floaterHint: string };
  bleach: { include: boolean; oz: number; skipReason?: string; expectedBromine?: number };
}

function recentSkipReason(label: string, lastAt: string | null, now: Date): string | undefined {
  const days = daysSince(lastAt, now);
  if (days === null || days >= WEEKLY_DOSE_RECENT_DAYS) return undefined;
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `${label} already logged ${when}.`;
}

// The weekly bleach shock + tablets, prefilled on the summary step.
export function getWeeklyDose(input: WeeklyDoseInput): WeeklyDose {
  const now = input.now ?? new Date();
  const { bromine } = input;

  const hints = ["Check the floater's holes aren't blocked and its setting hasn't shifted."];
  if (bromine !== null && bromine < 4) {
    hints.push("Bromine was low: if it's low again next week, open the floater a notch.");
  } else if (shouldSkipShock(bromine)) {
    hints.push("Bromine was high: close the floater down a notch.");
  }

  const tabletsSkip = input.tabletsLoggedThisSession
    ? "Tablets already logged this session."
    : recentSkipReason("Tablets", input.lastTabletsAt, now);

  const bleachSkip = input.bleachLoggedThisSession
    ? "Bleach already logged this session."
    : shouldSkipShock(bromine)
      ? `Skip this week: bromine is ${bromine} ppm (${SHOCK_SKIP_BROMINE_PPM}+).`
      : recentSkipReason("Bleach", input.lastBleachAt, now);

  return {
    tablets: {
      include: !tabletsSkip,
      count: DEFAULT_BROMINE_TABLETS,
      skipReason: tabletsSkip,
      floaterHint: hints.join(" "),
    },
    bleach: {
      include: !bleachSkip,
      oz: BLEACH_SHOCK_OZ,
      skipReason: bleachSkip,
      expectedBromine:
        !bleachSkip && bromine !== null
          ? Math.round(bromine + bromineRiseFromBleach(BLEACH_SHOCK_OZ))
          : undefined,
    },
  };
}
