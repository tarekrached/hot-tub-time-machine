import { useState, useEffect, useCallback } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { Route } from "./+types/_layout.test";
import { getDashboardData } from "server/db";
import {
  dropsToPpm,
  ppmToDrops,
  getRecommendations,
  ozToTeaspoons,
  ozToTablespoons,
  TEST_ORDER,
  formatPhValue,
} from "shared/chemistry";
import { TEST_LABELS, TEST_RANGES, TEST_COLORS, TEST_INSTRUCTIONS } from "shared/types";
import type { TestType } from "shared/types";
import { StepDots } from "~/components/StepDots";
import { Timer } from "~/components/Timer";
import {
  createSession,
  addReading,
  addChemicalAddition,
  completeSession,
  getRecentReadingsByTestType,
} from "server/db";
import styles from "~/styles/test-wizard.module.css";

const STORAGE_KEY = "hottub_wizard_state";

// pH slider: 13 discrete stops covering <7.0 through >8.0
const PH_VALUES = [6.8, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.0, 8.2];
const PH_DEFAULT_INDEX = 6; // 7.5 — center of range

const STEP_COLOR_MAP: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  clear: "#94a3b8",
};

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

function daysAgo(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr + "Z").getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
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
  recommendations: Record<string, { chemical: string; amount: string; reason: string }[]>;
  phSkipped: boolean;
  phSkippedReason: string | null;
  bromineValue: number | null;
  appliedChemicals: Record<string, boolean>;
}

function makeInitialState(suggestedTests: TestType[]): WizardState {
  return {
    sessionId: null,
    selectedTests: suggestedTests
      .slice()
      .sort((a, b) => TEST_ORDER.indexOf(a) - TEST_ORDER.indexOf(b)),
    currentTestIndex: 0,
    step: "select",
    readings: {},
    recommendations: {},
    phSkipped: false,
    phSkippedReason: null,
    bromineValue: null,
    appliedChemicals: {},
  };
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const [dashboard, recentReadings] = await Promise.all([
    getDashboardData(env.DB),
    getRecentReadingsByTestType(env.DB),
  ]);
  return { suggestedTests: dashboard.suggestedTests, recentReadings };
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
      const sessionId = Number(formData.get("sessionId"));
      const chemical = formData.get("chemical") as string;
      const amountOz = Number(formData.get("amountOz"));
      await addChemicalAddition(env.DB, sessionId, chemical, amountOz);
      return { ok: true };
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

export default function TestWizard() {
  const { suggestedTests, recentReadings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [state, setState] = useState<WizardState>(() => {
    if (typeof window === "undefined") return makeInitialState(suggestedTests);
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as WizardState;
      } catch {
        return makeInitialState(suggestedTests);
      }
    }
    return makeInitialState(suggestedTests);
  });
  const [showResume, setShowResume] = useState(false);
  const [inputMode, setInputMode] = useState<"ppm" | "drops">("drops");
  const [inputValue, setInputValue] = useState("");
  const [sampleSize, setSampleSize] = useState<number>(25);
  const [phIndex, setPhIndex] = useState(PH_DEFAULT_INDEX);
  const [dropCount, setDropCount] = useState(0);
  const [infoExpanded, setInfoExpanded] = useState(true);

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

  const update = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const currentTest = state.selectedTests[state.currentTestIndex] as
    | TestType
    | undefined;
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
      const selected = prev.selectedTests.includes(tt)
        ? prev.selectedTests.filter((t) => t !== tt)
        : [...prev.selectedTests, tt].sort(
            (a, b) => TEST_ORDER.indexOf(a) - TEST_ORDER.indexOf(b)
          );
      return { ...prev, selectedTests: selected };
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

  const handleApplyAndTimer = () => {
    if (!currentTest || !state.sessionId) return;
    const recs = state.recommendations[currentTest];
    if (recs && recs.length > 0) {
      // Record the first recommendation's addition
      const rec = recs[0];
      // Extract oz from amount string (e.g., "6.6 oz (13.2 tbsp)")
      const ozMatch = rec.amount.match(/([\d.]+)\s*oz/);
      if (ozMatch) {
        fetcher.submit(
          {
            intent: "saveAddition",
            sessionId: String(state.sessionId),
            chemical: rec.chemical,
            amountOz: ozMatch[1],
          },
          { method: "post" }
        );
      }
    }
    update({
      appliedChemicals: { ...state.appliedChemicals, [currentTest!]: true },
      step: "timer",
    });
  };

  const handleTimerComplete = useCallback(() => {
    setState((prev) => ({ ...prev, step: "retest" }));
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
      // Check pH enforcement
      const nextTest = state.selectedTests[nextIdx];
      if (
        nextTest === "ph" &&
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
        <Timer onComplete={handleTimerComplete} />
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
        <div className={styles.btnRow}>
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
    const recs = state.recommendations[currentTest] || [];
    const isInRange = recs.length === 0;
    const recRange = TEST_RANGES[currentTest];
    const beforePpm = state.readings[currentTest]?.before?.ppm;
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
              {recs.map((rec, i) => (
                <div key={i} className={styles.recCard}>
                  <div className={styles.recChemical}>{rec.chemical}</div>
                  <div className={styles.recAmount}>{rec.amount}</div>
                  <div className={styles.recReason}>{rec.reason}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className={styles.btnRow}>
          {isInRange ? (
            <button className={styles.btnPrimary} onClick={advanceToNextTest}>
              Next Test
            </button>
          ) : (
            <>
              <button
                className={styles.btnPrimary}
                onClick={handleApplyAndTimer}
              >
                Applied — Start Timer
              </button>
              <button
                className={styles.btnSecondary}
                onClick={advanceToNextTest}
              >
                Skip Re-test
              </button>
            </>
          )}
        </div>
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
          {testRecent.map((r, i) => (
            <div key={i} className={styles.infoRecentRow}>
              <span className={styles.infoRecentPpm}>
                {currentTest === "ph" ? formatPhValue(r.ppm) : r.ppm}
                {range.unit ? ` ${range.unit}` : ""}
              </span>
              <span className={styles.infoRecentDate}>
                {daysAgo(r.created_at)}
              </span>
            </div>
          ))}
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
      <div className={styles.btnRow}>
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
