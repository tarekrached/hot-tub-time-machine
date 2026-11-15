import { useState, useEffect, useCallback } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { Route } from "./+types/_layout.test";
import { getDashboardData, getLastAdditionTimes } from "server/db";
import {
  dropsToPpm,
  ppmToDrops,
  getRecommendations,
  TEST_ORDER,
  formatPhValue,
  fromOz,
  toOz,
  BROMINE_TABLET,
  BLEACH_CHEMICAL,
  BLEACH_SHOCK_OZ,
  DEFAULT_BROMINE_TABLETS,
  tabletsToOz,
  formatAddition,
  daysSince,
  getWeeklyDose,
  bromineRiseFromBleach,
} from "shared/chemistry";
import type { AmountUnit, DosingRecommendation } from "shared/chemistry";
import { isAdditionInput, parseAdditionInput, parseSessionId } from "shared/additions";
import { TEST_LABELS, TEST_RANGES, TEST_COLORS, TEST_INSTRUCTIONS } from "shared/types";
import type { TestType } from "shared/types";
import { StepDots } from "~/components/StepDots";
import { Timer } from "~/components/Timer";
import {
  createSession,
  addReading,
  addChemicalAddition,
  addChemicalAdditions,
  completeSession,
  getRecentReadingsByTestType,
} from "server/db";
import styles from "~/styles/test-wizard.module.css";

const STORAGE_KEY = "hottub_wizard_state";
const RETEST_SECONDS = 15 * 60;

// pH slider: 13 discrete stops covering <7.0 through >8.0
const PH_VALUES = [6.8, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.0, 8.2];
const PH_DEFAULT_INDEX = 6; // 7.5 — center of range

const STEP_COLOR_MAP: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  clear: "#94a3b8",
};

const CHOOSE_CHEMICAL = "";

function buildSelectedTests(tests: TestType[]): TestType[] {
  return tests.slice().sort((a, b) => TEST_ORDER.indexOf(a) - TEST_ORDER.indexOf(b));
}

function renderStep(text: string) {
  const pattern =
    /(R-\d+[A-Z]?\b|×\s*\d+|\d+\s*(?:ml|💧|scoops?)|\bred\b|\bblue\b|\bclear\b)/gi;
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const lower = part.toLowerCase();
        if (STEP_COLOR_MAP[lower]) {
          return (
            <strong key={i} style={{ color: STEP_COLOR_MAP[lower] }}>
              {part}
            </strong>
          );
        }
        if (
          /^R-\d+[A-Z]?$/i.test(part) ||
          /^×\s*\d+$/.test(part) ||
          /^\d+\s*(?:ml|💧|scoops?)$/.test(part)
        ) {
          return <strong key={i}>{part}</strong>;
        }
        return part;
      })}
    </>
  );
}

function daysAgoShort(dateStr: string): string {
  const days = daysSince(dateStr) ?? 0;
  return days === 0 ? "today" : `${days}d`;
}

function getMaxDrops(testType: TestType, sampleSize: number): number {
  if (testType === "bromine") return sampleSize === 10 ? 16 : 20;
  if (testType === "ta") return 20;
  if (testType === "calcium") return 30;
  return 20;
}

interface WizardState {
  sessionId: number | null;
  selectedTests: TestType[];
  currentTestIndex: number;
  step: "select" | "input" | "recommendation" | "timer" | "retest" | "summary";
  readings: Record<
    string,
    {
      before?: { ppm: number; drops?: number; sampleSize?: number };
      after?: { ppm: number; drops?: number; sampleSize?: number };
    }
  >;
  recommendations: Record<string, DosingRecommendation[]>;
  phSkipped: boolean;
  phSkippedReason: string | null;
  bromineValue: number | null;
  appliedChemicals: Record<string, boolean>;
  additions: { chemical: string; amountOz: number }[];
  recommendationAmounts: Record<string, { value: string; unit: AmountUnit }>;
  /** Wall-clock end of the re-test timer (ms); persisted so it survives reloads. */
  timerEndsAt?: number | null;
  /** What the summary's weekly-dose card logged, so it can't be logged twice. */
  weeklyDoseLogged?: { chemical: string; amountOz: number }[];
}

// Saved state from before the linear flow may hold the removed "bromine_fix"
// step; discard it rather than resume into a step that no longer exists.
function loadSavedState(suggestedTests: TestType[]): WizardState {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return makeInitialState(suggestedTests);
  try {
    const parsed = JSON.parse(saved) as WizardState;
    if ((parsed.selectedTests as string[]).includes("bromine_fix")) {
      sessionStorage.removeItem(STORAGE_KEY);
      return makeInitialState(suggestedTests);
    }
    return {
      ...parsed,
      additions: parsed.additions || [],
      recommendationAmounts: parsed.recommendationAmounts || {},
    };
  } catch {
    return makeInitialState(suggestedTests);
  }
}

function makeInitialState(suggestedTests: TestType[]): WizardState {
  return {
    sessionId: null,
    selectedTests: buildSelectedTests(suggestedTests),
    currentTestIndex: 0,
    step: "select",
    readings: {},
    recommendations: {},
    phSkipped: false,
    phSkippedReason: null,
    bromineValue: null,
    appliedChemicals: {},
    additions: [],
    recommendationAmounts: {},
  };
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const [dashboard, recentReadings, lastAdditions] = await Promise.all([
    getDashboardData(env.DB),
    getRecentReadingsByTestType(env.DB),
    getLastAdditionTimes(env.DB),
  ]);
  return { suggestedTests: dashboard.suggestedTests, recentReadings, lastAdditions };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "createSession": {
      const id = await createSession(env.DB);
      return { sessionId: id };
    }
    case "saveReading": {
      const sessionId = Number(formData.get("sessionId"));
      const testType = formData.get("testType") as TestType;
      const phase = formData.get("phase") as "before" | "after";
      const valuePpm = Number(formData.get("valuePpm"));
      const rawDrops = formData.get("rawDrops")
        ? Number(formData.get("rawDrops"))
        : null;
      const sampleSizeMl = formData.get("sampleSizeMl")
        ? Number(formData.get("sampleSizeMl"))
        : null;
      await addReading(
        env.DB,
        sessionId,
        testType,
        phase,
        valuePpm,
        rawDrops,
        sampleSizeMl
      );
      return { ok: true };
    }
    case "saveAddition": {
      const sessionId = parseSessionId(Number(formData.get("sessionId")));
      const addition = parseAdditionInput({
        chemical: formData.get("chemical"),
        amountOz: Number(formData.get("amountOz")),
      });
      if (typeof sessionId !== "number") return sessionId;
      if (!isAdditionInput(addition)) return addition;
      try {
        await addChemicalAddition(env.DB, sessionId, addition.chemical, addition.amountOz);
        return { ok: true, additions: [addition] };
      } catch {
        return { error: "Unable to save addition. Please try again." };
      }
    }
    case "saveAdditions": {
      const sessionId = parseSessionId(Number(formData.get("sessionId")));
      if (typeof sessionId !== "number") return sessionId;
      const rawAdditions = formData.get("additions");
      let additions: unknown;
      try {
        additions = typeof rawAdditions === "string" ? JSON.parse(rawAdditions) : null;
      } catch {
        return { error: "Invalid additions" };
      }
      if (!Array.isArray(additions)) return { error: "Invalid additions" };
      const parsed = additions.map(parseAdditionInput);
      const invalid = parsed.find((addition) => !isAdditionInput(addition));
      if (invalid && !isAdditionInput(invalid)) return invalid;
      const validAdditions = parsed as { chemical: string; amountOz: number }[];
      try {
        await addChemicalAdditions(env.DB, sessionId, validAdditions);
        return { ok: true, additions: validAdditions };
      } catch {
        return { error: "Unable to save additions. Please try again." };
      }
    }
    case "completeSession": {
      const sessionId = Number(formData.get("sessionId"));
      await completeSession(env.DB, sessionId);
      return { ok: true };
    }
    default:
      return { error: "Unknown intent" };
  }
}

// One editable line of the weekly-dose card: remove/undo, skip reason, amount input, unit.
function DoseRow({
  label,
  inputLabel,
  noun,
  unit,
  inputMode,
  min,
  include,
  skipReason,
  value,
  defaultValue,
  onChange,
  children,
}: {
  label: string;
  inputLabel: string;
  noun: string;
  unit: string;
  inputMode: "numeric" | "decimal";
  min?: string;
  include: boolean;
  skipReason?: string;
  value: string | null;
  defaultValue: string;
  onChange: (value: string | null) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.doseRow}>
      <div className={styles.doseRowHead}>
        <span className={styles.recChemical}>{label}</span>
        {include && (
          <button
            className={styles.doseRemove}
            aria-label={value === null ? `Add ${noun} back` : `Remove ${noun}`}
            onClick={() => onChange(value === null ? defaultValue : null)}
          >
            {value === null ? "Undo" : "×"}
          </button>
        )}
      </div>
      {!include ? (
        <div className={styles.recReason}>{skipReason}</div>
      ) : value === null ? (
        <div className={styles.recReason}>Not adding this week.</div>
      ) : (
        <>
          <div className={styles.recommendationAmount}>
            <input type="number" inputMode={inputMode} min={min} className={styles.additionInput} aria-label={inputLabel} value={value} onChange={(e) => onChange(e.target.value)} />
            <span className={styles.unitLabel}>{unit}</span>
          </div>
          {children}
        </>
      )}
    </div>
  );
}

export default function TestWizard() {
  const { suggestedTests, recentReadings, lastAdditions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const additionsFetcher = useFetcher();
  const [state, setState] = useState<WizardState>(() =>
    typeof window === "undefined" ? makeInitialState(suggestedTests) : loadSavedState(suggestedTests)
  );
  const [showResume, setShowResume] = useState(false);
  const [inputMode, setInputMode] = useState<"ppm" | "drops">("drops");
  const [inputValue, setInputValue] = useState("");
  const [sampleSize, setSampleSize] = useState<number>(25);
  const [phIndex, setPhIndex] = useState(PH_DEFAULT_INDEX);
  const [dropCount, setDropCount] = useState(0);
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [showAdditionForm, setShowAdditionForm] = useState(false);
  const [customChemical, setCustomChemical] = useState(CHOOSE_CHEMICAL);
  // Weekly-dose card inputs; null = removed with ×.
  const [weeklyTablets, setWeeklyTablets] = useState<string | null>(String(DEFAULT_BROMINE_TABLETS));
  const [weeklyBleach, setWeeklyBleach] = useState<string | null>(String(BLEACH_SHOCK_OZ));
  const [customOtherChemical, setCustomOtherChemical] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<AmountUnit>("oz");
  const [additionError, setAdditionError] = useState<string | null>(null);
  const [pendingAdditionSave, setPendingAdditionSave] = useState<
    | { type: "recommendations"; recKey: string; then: "timer" | "next" }
    | { type: "custom" }
    | { type: "weekly" }
    | null
  >(null);

  // Check for resume on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WizardState;
        if (parsed.sessionId && parsed.step !== "select") {
          setShowResume(true);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist state
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state.step !== "select" || state.sessionId) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  // Handle fetcher responses for session creation
  useEffect(() => {
    if (fetcher.data && "sessionId" in fetcher.data && !state.sessionId) {
      setState((prev) => ({
        ...prev,
        sessionId: (fetcher.data as { sessionId: number }).sessionId,
        step: "input",
      }));
    }
  }, [fetcher.data, state.sessionId]);

  useEffect(() => {
    const data = additionsFetcher.data as
      | { error?: string; additions?: { chemical: string; amountOz: number }[] }
      | undefined;
    if (!data) return;
    if (data.error) {
      setAdditionError(data.error);
      setPendingAdditionSave(null);
      return;
    }
    if (data.additions) {
      setState((prev) => ({ ...prev, additions: [...prev.additions, ...data.additions!] }));
      setAdditionError(null);
      if (pendingAdditionSave?.type === "recommendations" && pendingAdditionSave.then === "next") {
        if (state.step === "recommendation") advanceToNextTest();
      } else if (pendingAdditionSave?.type === "recommendations") {
        setState((prev) =>
          prev.step === "recommendation"
            ? {
                ...prev,
                appliedChemicals: { ...prev.appliedChemicals, [pendingAdditionSave.recKey]: true },
                step: "timer",
                timerEndsAt: Date.now() + RETEST_SECONDS * 1000,
              }
            : prev
        );
      } else if (pendingAdditionSave?.type === "weekly") {
        setState((prev) => ({ ...prev, weeklyDoseLogged: data.additions }));
      } else if (pendingAdditionSave?.type === "custom") {
        setCustomAmount("");
        setCustomOtherChemical("");
        setShowAdditionForm(false);
      }
      setPendingAdditionSave(null);
    }
  }, [additionsFetcher.data]);

  const update = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const currentTest = state.selectedTests[state.currentTestIndex] as TestType | undefined;
  const totalSteps = state.selectedTests.length + 1; // +1 for summary
  const currentStepNum =
    state.step === "summary"
      ? totalSteps - 1
      : state.step === "select"
        ? -1
        : state.currentTestIndex;

  const clearWizard = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(makeInitialState(suggestedTests));
    setShowResume(false);
    setPhIndex(PH_DEFAULT_INDEX);
  };

  const handleStartFresh = () => {
    clearWizard();
  };

  const handleResume = () => {
    setShowResume(false);
  };

  // --- Test Selection ---
  const handleToggleTest = (tt: TestType) => {
    setState((prev) => {
      const next = prev.selectedTests.includes(tt)
        ? prev.selectedTests.filter((t) => t !== tt)
        : [...prev.selectedTests, tt];
      return { ...prev, selectedTests: buildSelectedTests(next) };
    });
  };

  const handleStartSession = () => {
    if (state.selectedTests.length === 0) return;
    fetcher.submit({ intent: "createSession" }, { method: "post" });
  };

  // --- Input Reading ---
  const canUseDrop = currentTest && currentTest !== "ph";

  const handleSubmitReading = (phase: "before" | "after") => {
    if (!currentTest || !state.sessionId) return;
    if (currentTest !== "ph" && inputMode === "ppm" && !inputValue) return;
    if (currentTest !== "ph" && inputMode === "drops" && dropCount === 0) return;

    let ppm: number;
    let rawDrops: number | null = null;
    let sampleSizeMl: number | null = null;

    if (currentTest === "ph") {
      ppm = PH_VALUES[phIndex];
    } else if (inputMode === "drops" && canUseDrop) {
      rawDrops = dropCount;
      sampleSizeMl = currentTest === "bromine" ? sampleSize : 25;
      ppm = dropsToPpm(currentTest, rawDrops, sampleSizeMl);
    } else {
      ppm = Number(inputValue);
    }

    fetcher.submit(
      {
        intent: "saveReading",
        sessionId: String(state.sessionId),
        testType: currentTest,
        phase,
        valuePpm: String(ppm),
        rawDrops: rawDrops !== null ? String(rawDrops) : "",
        sampleSizeMl: sampleSizeMl !== null ? String(sampleSizeMl) : "",
      },
      { method: "post" }
    );

    const readingData = {
      ppm,
      drops: rawDrops ?? undefined,
      sampleSize: sampleSizeMl ?? undefined,
    };

    if (phase === "before") {
      // Track bromine value for pH enforcement
      if (currentTest === "bromine") {
        update({ bromineValue: ppm });
      }

      const recs = getRecommendations(currentTest, ppm);
      setState((prev) => ({
        ...prev,
        readings: {
          ...prev.readings,
          [currentTest]: { ...prev.readings[currentTest], before: readingData },
        },
        recommendations: { ...prev.recommendations, [currentTest]: recs },
        step: "recommendation",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        readings: {
          ...prev.readings,
          [currentTest]: { ...prev.readings[currentTest], after: readingData },
        },
      }));
      advanceToNextTest();
    }

    setInputValue("");
  };

  // Saves the entered doses, then starts the re-test timer ("timer") or moves
  // on to the next test without re-testing ("next").
  const handleApplied = (then: "timer" | "next") => {
    if (!currentTest || !state.sessionId || additionsFetcher.state !== "idle") return;
    const recKey = currentTest;
    const recs = state.recommendations[recKey] ?? [];
    const additions = recs.flatMap((rec, index) => {
      if (rec.amountOz === undefined || !rec.unit) return [];
      const input = getRecommendationInput(recKey, index, rec);
      const enteredAmount = Number(input.value);
      const amountOz = toOz(enteredAmount, input.unit);
      if (!Number.isFinite(enteredAmount) || amountOz <= 0) return [];
      return [{ chemical: rec.chemical, amountOz }];
    });
    const invalidAddition = additions.map(parseAdditionInput).find((addition) => !isAdditionInput(addition));
    if (invalidAddition && !isAdditionInput(invalidAddition)) {
      setAdditionError(invalidAddition.error);
      return;
    }
    setAdditionError(null);
    if (additions.length > 0) {
      setPendingAdditionSave({ type: "recommendations", recKey, then });
      additionsFetcher.submit(
        { intent: "saveAdditions", sessionId: String(state.sessionId), additions: JSON.stringify(additions) },
        { method: "post" }
      );
      return;
    }
    if (then === "next") {
      advanceToNextTest();
      return;
    }
    update({
      appliedChemicals: { ...state.appliedChemicals, [recKey]: true },
      step: "timer",
      timerEndsAt: Date.now() + RETEST_SECONDS * 1000,
    });
  };

  const handleTimerComplete = useCallback(() => {
    setState((prev) => ({ ...prev, step: "retest", timerEndsAt: null }));
  }, []);

  const handleSkipRetest = () => {
    advanceToNextTest();
  };

  const handleSkipTest = () => {
    advanceToNextTest();
  };

  const advanceToNextTest = () => {
    const nextIdx = state.currentTestIndex + 1;
    if (nextIdx >= state.selectedTests.length) {
      update({ step: "summary" });
    } else {
      const nextStepVal = state.selectedTests[nextIdx];
      // Check pH enforcement
      if (
        nextStepVal === "ph" &&
        state.bromineValue !== null &&
        state.bromineValue > 10
      ) {
        setState((prev) => ({
          ...prev,
          currentTestIndex: nextIdx,
          step: "input",
          phSkipped: true,
          phSkippedReason:
            "pH skipped: bromine is above 10 ppm (Taylor kit limit). Re-test pH when bromine drops below 10.",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          currentTestIndex: nextIdx,
          step: "input",
          phSkipped: false,
          phSkippedReason: null,
        }));
      }
    }
    setInputValue("");
    setInputMode("drops");
    setPhIndex(PH_DEFAULT_INDEX);
    setDropCount(0);
    setInfoExpanded(true);
  };

  const handleOverridePh = () => {
    update({ phSkipped: false, phSkippedReason: null });
  };

  const handleComplete = () => {
    if (!state.sessionId) return;
    fetcher.submit(
      { intent: "completeSession", sessionId: String(state.sessionId) },
      { method: "post" }
    );
    clearWizard();
  };

  const getRecommendationInput = (
    recKey: string,
    index: number,
    rec: DosingRecommendation
  ) => {
    const key = `${recKey}-${index}`;
    return state.recommendationAmounts[key] || {
      value: String(fromOz(rec.amountOz!, rec.unit!)),
      unit: rec.unit!,
    };
  };

  const updateRecommendationInput = (
    recKey: string,
    index: number,
    rec: DosingRecommendation,
    partial: Partial<{ value: string; unit: AmountUnit }>
  ) => {
    const key = `${recKey}-${index}`;
    const current = getRecommendationInput(recKey, index, rec);
    setState((prev) => ({
      ...prev,
      recommendationAmounts: {
        ...prev.recommendationAmounts,
        [key]: { ...current, ...partial },
      },
    }));
  };

  const handleSaveCustomAddition = () => {
    if (!state.sessionId || additionsFetcher.state !== "idle") return;
    if (customChemical === CHOOSE_CHEMICAL) {
      setAdditionError("Choose a chemical.");
      return;
    }
    const chemical = customChemical === "Other" ? customOtherChemical : customChemical;
    const amount = Number(customAmount);
    const amountOz =
      customChemical === BROMINE_TABLET
        ? tabletsToOz(amount)
        : toOz(amount, customUnit);
    const addition = parseAdditionInput({ chemical, amountOz });
    if (!isAdditionInput(addition)) {
      setAdditionError(addition.error);
      return;
    }
    setAdditionError(null);
    setPendingAdditionSave({ type: "custom" });
    additionsFetcher.submit(
      {
        intent: "saveAddition",
        sessionId: String(state.sessionId),
        chemical: addition.chemical,
        amountOz: String(addition.amountOz),
      },
      { method: "post" }
    );
  };

  useEffect(() => {
    setShowAdditionForm(false);
  }, [state.step, currentTest]);

  // Weekly-dose card on the summary step.
  const latestBromine = state.readings.bromine?.after?.ppm ?? state.readings.bromine?.before?.ppm ?? null;
  const weeklyDose = getWeeklyDose({
    bromine: latestBromine,
    bleachLoggedThisSession: state.additions.some((a) => a.chemical === BLEACH_CHEMICAL),
    tabletsLoggedThisSession: state.additions.some((a) => a.chemical === BROMINE_TABLET),
    lastBleachAt: lastAdditions.lastBleachAt,
    lastTabletsAt: lastAdditions.lastTabletsAt,
  });
  const weeklyAdditions = [
    ...(weeklyDose.tablets.include && weeklyTablets !== null
      ? [{ chemical: BROMINE_TABLET, amountOz: tabletsToOz(Number(weeklyTablets)) }]
      : []),
    ...(weeklyDose.bleach.include && weeklyBleach !== null
      ? [{ chemical: BLEACH_CHEMICAL, amountOz: Number(weeklyBleach) }]
      : []),
  ];

  const handleLogWeeklyDose = () => {
    if (!state.sessionId || additionsFetcher.state !== "idle" || weeklyAdditions.length === 0) return;
    const invalid = weeklyAdditions.map(parseAdditionInput).find((a) => !isAdditionInput(a));
    if (invalid && !isAdditionInput(invalid)) {
      setAdditionError(invalid.error);
      return;
    }
    setAdditionError(null);
    setPendingAdditionSave({ type: "weekly" });
    additionsFetcher.submit(
      { intent: "saveAdditions", sessionId: String(state.sessionId), additions: JSON.stringify(weeklyAdditions) },
      { method: "post" }
    );
  };

  const openAdditionForm = () => {
    setCustomChemical(currentTest === "bromine" ? BROMINE_TABLET : CHOOSE_CHEMICAL);
    setCustomOtherChemical("");
    setCustomAmount("");
    setCustomUnit("oz");
    setAdditionError(null);
    setShowAdditionForm(true);
  };

  const additionForm = (
    <>
      {showAdditionForm ? (
        <div className={styles.additionForm}>
          <select className={styles.additionSelect} value={customChemical} onChange={(e) => setCustomChemical(e.target.value)}>
            <option value={CHOOSE_CHEMICAL}>Choose chemical…</option>
            <option>{BLEACH_CHEMICAL}</option>
            <option>Baking Soda</option>
            <option>Borax</option>
            <option>Dry Acid (sodium bisulfate)</option>
            <option>Calcium Chloride</option>
            <option>Sodium Bromide</option>
            <option>{BROMINE_TABLET}</option>
            <option>Other</option>
          </select>
          {customChemical === "Other" && (
            <input className={styles.additionInput} placeholder="Chemical name" value={customOtherChemical} onChange={(e) => setCustomOtherChemical(e.target.value)} />
          )}
          <div className={styles.additionAmountRow}>
            <input type="number" inputMode="decimal" className={styles.additionInput} placeholder={customChemical === BROMINE_TABLET ? "Tablets" : "Amount"} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
            {customChemical === BROMINE_TABLET ? (
              <span className={styles.unitLabel}>tablets</span>
            ) : (
              <div className={styles.unitToggle}>
                {(["oz", "tbsp", "tsp"] as AmountUnit[]).map((unit) => (
                  <button key={unit} className={`${styles.unitBtn} ${customUnit === unit ? styles.unitActive : ""}`} onClick={() => setCustomUnit(unit)}>{unit}</button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.btnRow}>
            <button className={styles.btnPrimary} disabled={additionsFetcher.state !== "idle"} onClick={handleSaveCustomAddition}>Save addition</button>
            <button className={styles.btnSecondary} disabled={additionsFetcher.state !== "idle"} onClick={() => setShowAdditionForm(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className={styles.addChemicalButton} onClick={openAdditionForm}>+ Add something else</button>
      )}
      {additionError && <div className={styles.additionError}>{additionError}</div>}
    </>
  );

  // Compute conversion display (PPM mode only; drops mode shows inline in slider)
  let conversionDisplay = "";
  if (canUseDrop && inputMode === "ppm" && inputValue) {
    const val = Number(inputValue);
    if (!isNaN(val)) {
      const drops = ppmToDrops(
        currentTest!,
        val,
        currentTest === "bromine" ? sampleSize : 25
      );
      conversionDisplay = `= ${drops} drops`;
    }
  }

  // --- Resume Prompt ---
  if (showResume) {
    return (
      <div className={styles.wizard}>
        <div className={styles.resumePrompt}>
          <h2>Resume Session?</h2>
          <p>
            You have a test session in progress ({state.selectedTests.length}{" "}
            tests, on test {state.currentTestIndex + 1}).
          </p>
          <div className={styles.btnRow}>
            <button className={styles.btnPrimary} onClick={handleResume}>
              Resume
            </button>
            <button className={styles.btnSecondary} onClick={handleStartFresh}>
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Test Selection ---
  if (state.step === "select") {
    return (
      <div className={styles.wizard}>
        <h2 className={styles.heading}>Select Tests</h2>
        <div className={styles.testList}>
          {TEST_ORDER.map((tt) => {
            const isSelected = state.selectedTests.includes(tt);
            const isSuggested = suggestedTests.includes(tt);
            return (
              <label
                key={tt}
                className={`${styles.testOption} ${isSelected ? styles.testSelected : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleTest(tt)}
                  className={styles.checkbox}
                />
                <span className={styles.testName}>{TEST_LABELS[tt]}</span>
                {isSuggested && (
                  <span className={styles.suggestedBadge}>Due</span>
                )}
              </label>
            );
          })}
        </div>
        <button
          className={styles.btnPrimary}
          onClick={handleStartSession}
          disabled={state.selectedTests.length === 0 || fetcher.state !== "idle"}
        >
          {fetcher.state !== "idle" ? "Starting..." : "Start"}
        </button>
      </div>
    );
  }

  // --- Summary ---
  if (state.step === "summary") {
    const logged = state.weeklyDoseLogged;
    const busy = additionsFetcher.state !== "idle";
    const bleachAmount = Number(weeklyBleach) || 0;
    const bleachRise = bromineRiseFromBleach(bleachAmount);
    return (
      <div className={styles.wizard}>
        <StepDots total={totalSteps} current={totalSteps - 1} />
        <h2 className={styles.heading}>Summary</h2>
        <div className={styles.summaryList}>
          {state.selectedTests.map((tt) => {
            const reading = state.readings[tt];
            const range = TEST_RANGES[tt];
            const before = reading?.before;
            const after = reading?.after;
            const beforeInRange =
              before &&
              before.ppm >= range.idealMin &&
              before.ppm <= range.idealMax;
            const afterInRange =
              after &&
              after.ppm >= range.idealMin &&
              after.ppm <= range.idealMax;

            return (
              <div key={tt} className={styles.summaryItem}>
                <div className={styles.summaryLabel}>{TEST_LABELS[tt]}</div>
                {before ? (
                  <div className={styles.summaryValues}>
                    <span
                      className={beforeInRange ? styles.valGood : styles.valBad}
                    >
                      {tt === "ph" ? formatPhValue(before.ppm) : before.ppm}
                      {before.drops !== undefined && (
                        <small> ({before.drops} drops)</small>
                      )}
                    </span>
                    {after && (
                      <>
                        <span className={styles.arrow}> → </span>
                        <span
                          className={
                            afterInRange ? styles.valGood : styles.valBad
                          }
                        >
                          {tt === "ph" ? formatPhValue(after.ppm) : after.ppm}
                          {after.drops !== undefined && (
                            <small> ({after.drops} drops)</small>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={styles.summarySkipped}>Skipped</div>
                )}
              </div>
            );
          })}
        </div>
        {state.additions.length > 0 && (
          <div className={styles.additionsList}>
            <div className={styles.summaryLabel}>Additions</div>
            {state.additions.map((addition, index) => (
              <div key={`${addition.chemical}-${index}`} className={styles.additionSummary}>
                {formatAddition(addition.chemical, addition.amountOz)}
              </div>
            ))}
          </div>
        )}
        <div className={styles.doseCard}>
          <div className={styles.summaryLabel}>Before you close the lid</div>
          {logged ? (
            <div className={styles.additionSummary}>✓ Logged</div>
          ) : (
            <>
              <DoseRow
                label="Bromine tablets"
                inputLabel="Bromine tablets"
                noun="tablets"
                unit="tablets"
                inputMode="numeric"
                min="0"
                include={weeklyDose.tablets.include}
                skipReason={weeklyDose.tablets.skipReason}
                value={weeklyTablets}
                defaultValue={String(weeklyDose.tablets.count)}
                onChange={setWeeklyTablets}
              />
              <DoseRow
                label="Bleach shock"
                inputLabel="Bleach amount"
                noun="bleach"
                unit="oz"
                inputMode="decimal"
                include={weeklyDose.bleach.include}
                skipReason={weeklyDose.bleach.skipReason}
                value={weeklyBleach}
                defaultValue={String(weeklyDose.bleach.oz)}
                onChange={setWeeklyBleach}
              >
                {bleachAmount > 0 && (
                  <div className={styles.recReason}>
                    Adds about {bleachRise} ppm bromine
                    {latestBromine !== null ? ` (expect ~${Math.round(latestBromine + bleachRise)})` : ""}.
                  </div>
                )}
                <div className={styles.recReason}>Pour into open water, pump running.</div>
                <div className={styles.recReason}>Cover off 20 min. Soak when bromine is under 10.</div>
              </DoseRow>
            </>
          )}
          <div className={styles.recReason}>{weeklyDose.tablets.floaterHint}</div>
          {!logged && weeklyAdditions.length > 0 && (
            <button className={styles.btnPrimary} disabled={busy} onClick={handleLogWeeklyDose}>
              {pendingAdditionSave?.type === "weekly" ? "Logging..." : "Log these"}
            </button>
          )}
        </div>
        {additionForm}
        <button className={styles.btnPrimary} onClick={handleComplete}>
          Done
        </button>
      </div>
    );
  }

  // --- Per-test Loop ---
  if (!currentTest) return null;

  // pH enforcement (auto-skip)
  if (state.phSkipped && currentTest === "ph") {
    return (
      <div className={styles.wizard}>
        <StepDots total={totalSteps} current={currentStepNum} />
        <h2 className={styles.heading}>{TEST_LABELS[currentTest]}</h2>
        <div className={styles.phSkip}>
          <p className={styles.phSkipMsg}>{state.phSkippedReason}</p>
          <div className={styles.btnRow}>
            <button className={styles.btnSecondary} onClick={handleOverridePh}>
              Test pH Anyway
            </button>
            <button className={styles.btnPrimary} onClick={handleSkipTest}>
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Timer step
  if (state.step === "timer") {
    return (
      <div className={styles.wizard}>
        <StepDots total={totalSteps} current={currentStepNum} />
        <h2 className={styles.heading}>{TEST_LABELS[currentTest]}</h2>
        <Timer
          durationSeconds={RETEST_SECONDS}
          endsAt={state.timerEndsAt}
          onComplete={handleTimerComplete}
        />
      </div>
    );
  }

  // Re-test step
  if (state.step === "retest") {
    const phPpm = PH_VALUES[phIndex];
    const phZoneRetest =
      phPpm >= 7.4 && phPpm <= 7.8
        ? styles.phValueGood
        : phPpm >= 7.2 && phPpm <= 8.0
          ? styles.phValueWarning
          : styles.phValueBad;
    return (
      <div className={styles.wizard}>
        <StepDots total={totalSteps} current={currentStepNum} />
        <h2 className={styles.heading}>Re-test {TEST_LABELS[currentTest]}</h2>
        {currentTest === "ph" ? (
          <div className={styles.phSlider}>
            <div className={`${styles.phValue} ${phZoneRetest}`}>
              {formatPhValue(phPpm)}
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={phIndex}
              onChange={(e) => setPhIndex(Number(e.target.value))}
              className={styles.phRangeInput}
            />
            <div className={styles.phZoneStrip} />
            <div className={styles.phEndLabels}>
              <span>&lt;7.0</span>
              <span>&gt;8.0</span>
            </div>
          </div>
        ) : (
          <div className={styles.inputGroup}>
            {canUseDrop && (
              <div className={styles.inputControls}>
                <div className={styles.modeToggle}>
                  <button
                    className={`${styles.modeBtn} ${inputMode === "drops" ? styles.modeActive : ""}`}
                    onClick={() => {
                      setInputMode("drops");
                      setInputValue("");
                      setDropCount(0);
                    }}
                  >
                    Drops
                  </button>
                  <button
                    className={`${styles.modeBtn} ${inputMode === "ppm" ? styles.modeActive : ""}`}
                    onClick={() => {
                      setInputMode("ppm");
                      setInputValue("");
                    }}
                  >
                    PPM
                  </button>
                </div>
                {inputMode === "drops" && currentTest === "bromine" && (
                  <div className={styles.sampleToggle}>
                    <button
                      className={`${styles.sampleBtn} ${sampleSize === 25 ? styles.sampleActive : ""}`}
                      onClick={() => setSampleSize(25)}
                    >
                      25 ml
                    </button>
                    <button
                      className={`${styles.sampleBtn} ${sampleSize === 10 ? styles.sampleActive : ""}`}
                      onClick={() => setSampleSize(10)}
                    >
                      10 ml
                    </button>
                  </div>
                )}
              </div>
            )}
            {inputMode === "drops" ? (
              <div className={styles.dropSlider}>
                <div className={styles.dropCount}>{dropCount}</div>
                <input
                  type="range"
                  min={0}
                  max={getMaxDrops(currentTest, sampleSize)}
                  step={1}
                  value={dropCount}
                  onChange={(e) => setDropCount(Number(e.target.value))}
                  className={styles.phRangeInput}
                />
                <div className={styles.dropEndLabels}>
                  <span>0</span>
                  <span>{getMaxDrops(currentTest, sampleSize)}</span>
                </div>
                {dropCount > 0 && (
                  <div className={styles.conversion}>
                    = {dropsToPpm(currentTest, dropCount, currentTest === "bromine" ? sampleSize : 25)} ppm
                  </div>
                )}
              </div>
            ) : (
              <>
                <input
                  type="number"
                  inputMode="decimal"
                  className={styles.input}
                  placeholder="PPM value"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  autoFocus
                />
                {conversionDisplay && (
                  <div className={styles.conversion}>{conversionDisplay}</div>
                )}
              </>
            )}
          </div>
        )}
        <div className={`${styles.btnRow} ${styles.stickyActions}`}>
          <button
            className={styles.btnPrimary}
            onClick={() => handleSubmitReading("after")}
            disabled={
              (currentTest !== "ph" && (inputMode === "ppm" ? !inputValue : dropCount === 0)) ||
              fetcher.state !== "idle"
            }
          >
            Submit
          </button>
          <button className={styles.btnSecondary} onClick={handleSkipRetest}>
            Skip Re-test
          </button>
        </div>
      </div>
    );
  }

  // Recommendation step
  if (state.step === "recommendation") {
    const recKey = currentTest;
    const recs = state.recommendations[recKey] || [];
    const isInRange = recs.length === 0;
    // Bromine recs are advisories (the weekly dose is logged at the summary): no Applied/timer.
    const advisoryOnly = isInRange || currentTest === "bromine";
    const recRange = TEST_RANGES[currentTest];
    const beforePpm = state.readings[recKey]?.before?.ppm;
    const currentDisplay =
      beforePpm !== undefined
        ? currentTest === "ph"
          ? formatPhValue(beforePpm)
          : `${beforePpm} ${recRange.unit}`
        : null;
    const targetDisplay = `${recRange.idealMin}–${recRange.idealMax}${recRange.unit ? ` ${recRange.unit}` : ""}`;

    return (
      <div className={styles.wizard}>
        <StepDots total={totalSteps} current={currentStepNum} />
        <h2 className={styles.heading}>{TEST_LABELS[currentTest]}</h2>
        {isInRange ? (
          <div className={styles.inRange}>
            <span className={styles.checkIcon}>&#10003;</span>
            <span>In range!</span>
          </div>
        ) : (
          <>
            {currentDisplay && (
              <div className={styles.recContext}>
                {currentDisplay} · target {targetDisplay}
              </div>
            )}
            <div className={styles.recList}>
              {recs.map((rec, i) => {
                const input = rec.amountOz !== undefined && rec.unit
                  ? getRecommendationInput(recKey, i, rec)
                  : null;
                return (
                <div key={i} className={styles.recCard}>
                  <div className={styles.recChemical}>{rec.chemical}</div>
                  <div className={styles.recAmount}>{rec.amount}</div>
                  <div className={styles.recReason}>{rec.reason}</div>
                  {input && (
                    <div className={styles.recommendationAmount}>
                      <input
                        type="number"
                        inputMode="decimal"
                        className={styles.additionInput}
                        aria-label={`${rec.chemical} amount`}
                        value={input.value}
                        onChange={(e) => updateRecommendationInput(recKey, i, rec, { value: e.target.value })}
                      />
                      <div className={styles.unitToggle}>
                        {(["oz", "tbsp", "tsp"] as AmountUnit[]).map((unit) => (
                          <button
                            key={unit}
                            className={`${styles.unitBtn} ${input.unit === unit ? styles.unitActive : ""}`}
                            onClick={() => updateRecommendationInput(recKey, i, rec, {
                              value: String(fromOz(toOz(Number(input.value) || 0, input.unit), unit)),
                              unit,
                            })}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </>
        )}
        <div className={styles.btnRow}>
          {advisoryOnly ? (
            <button className={styles.btnPrimary} onClick={advanceToNextTest}>
              Next Test
            </button>
          ) : (
            <>
              <button
                className={styles.btnPrimary}
                disabled={additionsFetcher.state !== "idle"}
                onClick={() => handleApplied("timer")}
              >
                Applied — Start Timer
              </button>
              <button
                className={styles.btnSecondary}
                disabled={additionsFetcher.state !== "idle"}
                onClick={() => handleApplied("next")}
              >
                Applied — Skip Re-test
              </button>
            </>
          )}
        </div>
        {!advisoryOnly && (
          <button
            className={styles.btnLink}
            disabled={additionsFetcher.state !== "idle"}
            onClick={advanceToNextTest}
          >
            Didn't add anything
          </button>
        )}
        {additionForm}
        {state.additions.length > 0 && (
          <div className={styles.additionsList}>
            {state.additions.map((addition, index) => (
              <div key={`${addition.chemical}-${index}`} className={styles.additionSummary}>
                {formatAddition(addition.chemical, addition.amountOz)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Info panel (shared between input step renders)
  const range = TEST_RANGES[currentTest];
  const instructions = TEST_INSTRUCTIONS[currentTest];
  const testColor = TEST_COLORS[currentTest];
  const testRecent = recentReadings[currentTest] ?? [];
  const infoPanel = (
    <div className={styles.infoPanel}>
      <button
        className={styles.infoPanelHeader}
        style={{ backgroundColor: testColor }}
        onClick={() => setInfoExpanded((prev) => !prev)}
      >
        <span className={styles.infoPanelTitle}>
          <span className={styles.infoPanelName}>{TEST_LABELS[currentTest]}</span>
          <span className={styles.infoPanelTarget}>
            🎯 {range.idealMin}–{range.idealMax}
            {range.unit ? ` ${range.unit}` : ""}
            {currentTest === "bromine" ? ` · max ${range.max} ppm` : ""}
          </span>
        </span>
        <span className={styles.infoPanelChevron}>
          {infoExpanded ? "▲" : "▼"}
        </span>
      </button>
      {infoExpanded && (
        <div className={styles.infoPanelBody}>
          <ol className={styles.infoProcedureList}>
            {instructions.procedure.map((step, i) => (
              <li key={i}>{renderStep(step)}</li>
            ))}
          </ol>
          <div className={styles.infoGuidance}>{instructions.guidance}</div>
          {testRecent.length > 0 && (
            <div className={styles.infoRecentLine}>
              <span className={styles.infoRecentLabel}>Last</span>
              {testRecent.map((r, i) => (
                <span key={i} className={styles.infoRecentItem}>
                  <span className={styles.infoRecentPpm}>
                    {currentTest === "ph" ? formatPhValue(r.ppm) : r.ppm}
                    {range.unit ? ` ${range.unit}` : ""}
                  </span>{" "}
                  <span className={styles.infoRecentDate}>{daysAgoShort(r.created_at)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Input step
  const phPpm = PH_VALUES[phIndex];
  const phZone =
    phPpm >= 7.4 && phPpm <= 7.8
      ? styles.phValueGood
      : phPpm >= 7.2 && phPpm <= 8.0
        ? styles.phValueWarning
        : styles.phValueBad;

  return (
    <div className={styles.wizard}>
      <StepDots total={totalSteps} current={currentStepNum} />
      {infoPanel}
      {currentTest === "ph" ? (
        <div className={styles.phSlider}>
          <div className={`${styles.phValue} ${phZone}`}>
            {formatPhValue(phPpm)}
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={phIndex}
            onChange={(e) => setPhIndex(Number(e.target.value))}
            className={styles.phRangeInput}
          />
          <div className={styles.phZoneStrip} />
          <div className={styles.phEndLabels}>
            <span>&lt;7.0</span>
            <span>&gt;8.0</span>
          </div>
        </div>
      ) : (
        <div className={styles.inputGroup}>
          {canUseDrop && (
            <div className={styles.inputControls}>
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeBtn} ${inputMode === "drops" ? styles.modeActive : ""}`}
                  onClick={() => {
                    setInputMode("drops");
                    setInputValue("");
                    setDropCount(0);
                  }}
                >
                  Drops
                </button>
                <button
                  className={`${styles.modeBtn} ${inputMode === "ppm" ? styles.modeActive : ""}`}
                  onClick={() => {
                    setInputMode("ppm");
                    setInputValue("");
                  }}
                >
                  PPM
                </button>
              </div>
              {inputMode === "drops" && currentTest === "bromine" && (
                <div className={styles.sampleToggle}>
                  <button
                    className={`${styles.sampleBtn} ${sampleSize === 25 ? styles.sampleActive : ""}`}
                    onClick={() => setSampleSize(25)}
                  >
                    25 ml
                  </button>
                  <button
                    className={`${styles.sampleBtn} ${sampleSize === 10 ? styles.sampleActive : ""}`}
                    onClick={() => setSampleSize(10)}
                  >
                    10 ml
                  </button>
                </div>
              )}
            </div>
          )}
          {inputMode === "drops" ? (
            <div className={styles.dropSlider}>
              <div className={styles.dropCount}>{dropCount}</div>
              <input
                type="range"
                min={0}
                max={getMaxDrops(currentTest, sampleSize)}
                step={1}
                value={dropCount}
                onChange={(e) => setDropCount(Number(e.target.value))}
                className={styles.phRangeInput}
              />
              <div className={styles.dropEndLabels}>
                <span>0</span>
                <span>{getMaxDrops(currentTest, sampleSize)}</span>
              </div>
              {dropCount > 0 && (
                <div className={styles.conversion}>
                  = {dropsToPpm(currentTest, dropCount, currentTest === "bromine" ? sampleSize : 25)} ppm
                </div>
              )}
            </div>
          ) : (
            <>
              <input
                type="number"
                inputMode="decimal"
                className={styles.input}
                placeholder="PPM value"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
              {conversionDisplay && (
                <div className={styles.conversion}>{conversionDisplay}</div>
              )}
            </>
          )}
        </div>
      )}
      <div className={`${styles.btnRow} ${styles.stickyActions}`}>
        <button
          className={styles.btnPrimary}
          onClick={() => handleSubmitReading("before")}
          disabled={
            (currentTest !== "ph" && (inputMode === "ppm" ? !inputValue : dropCount === 0)) ||
            fetcher.state !== "idle"
          }
        >
          Submit
        </button>
        <button className={styles.btnSecondary} onClick={handleSkipTest}>
          Skip
        </button>
      </div>
    </div>
  );
}
