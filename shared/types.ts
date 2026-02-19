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
  ph: { min: 7.2, max: 8.0, idealMin: 7.4, idealMax: 7.8, unit: "" },
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
