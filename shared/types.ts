export interface TestSession {
  id: number;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface TestReading {
  id: number;
  session_id: number;
  test_type: TestType;
  phase: "before" | "after";
  value_ppm: number;
  raw_drops: number | null;
  sample_size_ml: number | null;
  created_at: string;
}

export interface ChemicalAddition {
  id: number;
  session_id: number | null;
  chemical: ChemicalType;
  amount_oz: number;
  created_at: string;
}

export interface MaintenanceEvent {
  id: number;
  event_type: MaintenanceType;
  created_at: string;
  notes: string | null;
}

export type TestType = "ph" | "bromine" | "ta" | "calcium";
export type MaintenanceType = "filter_change" | "water_change" | "drain_refill";
export type ChemicalType =
  | "bleach_7.5"
  | "baking_soda"
  | "dry_acid"
  | "borax"
  | "sodium_bromide"
  | "calcium_chloride";

export interface TestRange {
  min: number;
  max: number;
  idealMin: number;
  idealMax: number;
  unit: string;
}

export const TEST_RANGES: Record<TestType, TestRange> = {
  ph: { min: 6.8, max: 8.2, idealMin: 7.4, idealMax: 7.8, unit: "" },
  bromine: { min: 4, max: 10, idealMin: 4, idealMax: 6, unit: "ppm" },
  ta: { min: 50, max: 70, idealMin: 50, idealMax: 70, unit: "ppm" },
  calcium: { min: 130, max: 400, idealMin: 130, idealMax: 150, unit: "ppm" },
};

export const TEST_LABELS: Record<TestType, string> = {
  ph: "pH",
  bromine: "Bromine",
  ta: "Total Alkalinity",
  calcium: "Calcium Hardness",
};

export const TEST_COLORS: Record<TestType, string> = {
  ph: "#F472B6",      // pink   — cheat sheet pH header
  bromine: "#FBBF24", // yellow — cheat sheet Bromine header
  ta: "#2DD4BF",      // teal   — cheat sheet TA header
  calcium: "#22D3EE", // cyan   — cheat sheet Calcium header
};

export const TEST_INSTRUCTIONS: Record<
  TestType,
  { procedure: string[]; guidance: string }
> = {
  ta: {
    procedure: [
      "Fill large tube to 25 ml (middle) mark",
      "Add 2 💧 R-0007, swirl",
      "Add 5 💧 R-0008, swirl",
      "Add R-0009 one 💧 at a time, swirl after each",
      "Count 💧 until color changes to red",
      "💧 × 10 = ppm TA",
    ],
    guidance:
      "Target 50–70 ppm.\nIf low, add baking soda.\nIf high, aerate (run jets with cover open).",
  },
  bromine: {
    procedure: [
      "Fill large tube to 10 ml (lowest) or 25 ml (middle) mark",
      "Add 2 scoops R-0870, swirl",
      "Count 💧 R-0872 until clear",
      "💧 × ppm/💧 = bromine ppm (see sample size toggle)",
    ],
    guidance:
      "Target 4–6 ppm.\nIf low, shock with bleach.\nAbove 10 ppm: remove floater, leave cover open until it drops.",
  },
  ph: {
    procedure: [
      "Fill large tube to 44 ml (top) mark",
      "Add 5 💧 R-0004, swirl",
      "Match color to comparator card",
    ],
    guidance:
      "Target 7.4–7.8.\nIf high (>7.8), add dry acid.\nIf low (<7.4), run jets or add borax.\nCannot test accurately above 10 ppm bromine.",
  },
  calcium: {
    procedure: [
      "Fill large tube to 25 ml (middle) mark",
      "Add 20 💧 R-0010L, swirl",
      "Add 5 💧 R-0011 — solution turns red",
      "Add R-0012 one 💧 at a time, swirl after each",
      "Count 💧 until color changes from red to blue",
      "💧 × 10 = ppm calcium",
    ],
    guidance: "Target 130–150 ppm.\nIf low, add calcium chloride.",
  },
};

export const MAINTENANCE_LABELS: Record<MaintenanceType, string> = {
  filter_change: "Filter Change",
  water_change: "Water Change",
  drain_refill: "Drain & Refill",
};

export interface DashboardData {
  lastTests: Record<TestType, string | null>;
  lastMaintenance: Record<MaintenanceType, string | null>;
  suggestedTests: TestType[];
  recentSessions: (TestSession & { readings: TestReading[] })[];
}

export interface SessionDetail extends TestSession {
  readings: TestReading[];
  additions: ChemicalAddition[];
}

export interface TimelineEntry {
  type: "session" | "maintenance";
  id: number;
  date: string;
  session?: SessionDetail;
  maintenance?: MaintenanceEvent;
}
