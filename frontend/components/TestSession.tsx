/** @jsxImportSource https://esm.sh/react@18.3.1 */
import React, { useState } from "https://esm.sh/react@18.3.1";
import type { TestType } from "../../shared/types.ts";
import { TEST_LABELS, TEST_RANGES } from "../../shared/types.ts";
import {
  dropsToPpm,
  getRecommendations,
  BROMINE_DROPS,
  type DosingRecommendation,
} from "../../shared/chemistry.ts";

interface Props {
  suggestedTests: TestType[];
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "select" | "before" | "recommendations" | "after" | "summary";

interface ReadingInput {
  mode: "drops" | "ppm";
  drops: string;
  ppm: string;
  sampleSize: number; // for bromine
}

const ALL_TESTS: TestType[] = ["ph", "bromine", "ta", "calcium"];

function defaultInput(testType: TestType): ReadingInput {
  return {
    mode: testType === "ph" ? "ppm" : "drops",
    drops: "",
    ppm: "",
    sampleSize: 25,
  };
}

function getPpmValue(testType: TestType, input: ReadingInput): number | null {
  if (input.mode === "ppm") {
    const v = parseFloat(input.ppm);
    return isNaN(v) ? null : v;
  }
  const d = parseInt(input.drops);
  if (isNaN(d)) return null;
  return dropsToPpm(testType, d, input.sampleSize);
}

export default function TestSession({ suggestedTests, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selectedTests, setSelectedTests] = useState<Set<TestType>>(
    new Set(suggestedTests)
  );
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [beforeInputs, setBeforeInputs] = useState<Record<string, ReadingInput>>({});
  const [afterInputs, setAfterInputs] = useState<Record<string, ReadingInput>>({});
  const [recommendations, setRecommendations] = useState<
    Record<string, DosingRecommendation[]>
  >({});
  const [saving, setSaving] = useState(false);

  const toggleTest = (t: TestType) => {
    const next = new Set(selectedTests);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelectedTests(next);
  };

  const initInputs = () => {
    const inputs: Record<string, ReadingInput> = {};
    selectedTests.forEach((t) => {
      inputs[t] = defaultInput(t);
    });
    return inputs;
  };

  const handleStartTests = async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const { id } = await res.json();
    setSessionId(id);
    setBeforeInputs(initInputs());
    setStep("before");
  };

  const updateInput = (
    inputs: Record<string, ReadingInput>,
    setInputs: React.Dispatch<React.SetStateAction<Record<string, ReadingInput>>>,
    testType: string,
    field: string,
    value: any
  ) => {
    setInputs({
      ...inputs,
      [testType]: { ...inputs[testType], [field]: value },
    });
  };

  const handleBeforeDone = async () => {
    setSaving(true);
    const recs: Record<string, DosingRecommendation[]> = {};

    for (const tt of selectedTests) {
      const input = beforeInputs[tt];
      const ppm = getPpmValue(tt as TestType, input);
      if (ppm === null) continue;

      await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          test_type: tt,
          phase: "before",
          value_ppm: ppm,
          raw_drops: input.mode === "drops" ? parseInt(input.drops) : null,
          sample_size_ml: tt === "bromine" ? input.sampleSize : null,
        }),
      });

      const testRecs = getRecommendations(tt as TestType, ppm);
      if (testRecs.length > 0) recs[tt] = testRecs;
    }

    setRecommendations(recs);
    setAfterInputs(initInputs());
    setSaving(false);
    setStep("recommendations");
  };

  const handleAfterDone = async () => {
    setSaving(true);

    for (const tt of selectedTests) {
      const input = afterInputs[tt];
      const ppm = getPpmValue(tt as TestType, input);
      if (ppm === null) continue;

      await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          test_type: tt,
          phase: "after",
          value_ppm: ppm,
          raw_drops: input.mode === "drops" ? parseInt(input.drops) : null,
          sample_size_ml: tt === "bromine" ? input.sampleSize : null,
        }),
      });
    }

    await fetch(`/api/sessions/${sessionId}`, { method: "PUT" });
    setSaving(false);
    setStep("summary");
  };

  const handleSkipAfter = async () => {
    await fetch(`/api/sessions/${sessionId}`, { method: "PUT" });
    setStep("summary");
  };

  const renderInput = (
    testType: TestType,
    inputs: Record<string, ReadingInput>,
    setInputs: React.Dispatch<React.SetStateAction<Record<string, ReadingInput>>>
  ) => {
    const input = inputs[testType];
    if (!input) return null;
    const range = TEST_RANGES[testType];

    return (
      <div key={testType} className="test-input-group">
        <div className="test-input-header">
          <label className="test-input-label">{TEST_LABELS[testType]}</label>
          <span className="test-range">
            ({range.idealMin}
            {range.unit ? ` ${range.unit}` : ""} - {range.idealMax}
            {range.unit ? ` ${range.unit}` : ""})
          </span>
        </div>

        {testType !== "ph" && (
          <div className="mode-toggle">
            <button
              className={`mode-btn ${input.mode === "drops" ? "active" : ""}`}
              onClick={() => updateInput(inputs, setInputs, testType, "mode", "drops")}
            >
              Drops
            </button>
            <button
              className={`mode-btn ${input.mode === "ppm" ? "active" : ""}`}
              onClick={() => updateInput(inputs, setInputs, testType, "mode", "ppm")}
            >
              PPM
            </button>
          </div>
        )}

        {testType === "bromine" && input.mode === "drops" && (
          <div className="sample-size-toggle">
            <span className="toggle-label">Sample:</span>
            <button
              className={`mode-btn ${input.sampleSize === 25 ? "active" : ""}`}
              onClick={() => updateInput(inputs, setInputs, testType, "sampleSize", 25)}
            >
              25 mL
            </button>
            <button
              className={`mode-btn ${input.sampleSize === 10 ? "active" : ""}`}
              onClick={() => updateInput(inputs, setInputs, testType, "sampleSize", 10)}
            >
              10 mL
            </button>
          </div>
        )}

        {input.mode === "drops" && testType !== "ph" ? (
          <div className="input-row">
            <input
              type="number"
              inputMode="numeric"
              className="num-input"
              placeholder="# of drops"
              value={input.drops}
              onChange={(e) =>
                updateInput(inputs, setInputs, testType, "drops", e.target.value)
              }
            />
            <span className="input-hint">
              {input.drops && !isNaN(parseInt(input.drops))
                ? `= ${getPpmValue(testType, input)} ppm`
                : ""}
            </span>
          </div>
        ) : (
          <div className="input-row">
            <input
              type="number"
              inputMode="decimal"
              step={testType === "ph" ? "0.1" : "1"}
              className="num-input"
              placeholder={testType === "ph" ? "e.g. 7.6" : "ppm value"}
              value={input.ppm}
              onChange={(e) =>
                updateInput(inputs, setInputs, testType, "ppm", e.target.value)
              }
            />
            <span className="input-hint">{range.unit || ""}</span>
          </div>
        )}

        {/* Warning: pH unreliable when bromine > 10 */}
        {testType === "ph" && (() => {
          const bromineInput = inputs["bromine"];
          if (!bromineInput) return null;
          const brPpm = getPpmValue("bromine", bromineInput);
          if (brPpm !== null && brPpm > 10) {
            return (
              <div className="warning-badge">
                pH may be unreliable when bromine is above 10 ppm
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  };

  // Ordered tests: TA first, then pH (per the article's recommendation)
  const orderedTests = [...selectedTests].sort((a, b) => {
    const order: Record<string, number> = { ta: 0, ph: 1, bromine: 2, calcium: 3 };
    return (order[a] ?? 4) - (order[b] ?? 4);
  });

  return (
    <div className="test-session">
      {step === "select" && (
        <>
          <h2>Select Tests</h2>
          <p className="hint">Pre-selected based on your schedule</p>
          <div className="test-select-list">
            {ALL_TESTS.map((t) => (
              <button
                key={t}
                className={`test-select-btn ${selectedTests.has(t) ? "selected" : ""}`}
                onClick={() => toggleTest(t)}
              >
                <span className="check">{selectedTests.has(t) ? "\u2713" : ""}</span>
                {TEST_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={selectedTests.size === 0}
              onClick={handleStartTests}
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === "before" && (
        <>
          <h2>Before Readings</h2>
          <p className="hint">Enter your test results before adjusting chemicals</p>
          {orderedTests.map((tt) =>
            renderInput(tt, beforeInputs, setBeforeInputs)
          )}
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => setStep("select")}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleBeforeDone}
              disabled={saving}
            >
              {saving ? "Saving..." : "Get Recommendations"}
            </button>
          </div>
        </>
      )}

      {step === "recommendations" && (
        <>
          <h2>Recommendations</h2>
          {Object.keys(recommendations).length === 0 ? (
            <div className="all-good">
              All levels look good! No adjustments needed.
            </div>
          ) : (
            <div className="rec-list">
              {Object.entries(recommendations).map(([tt, recs]) =>
                recs.map((rec, i) => (
                  <div key={`${tt}-${i}`} className="rec-card">
                    <div className="rec-reason">{rec.reason}</div>
                    <div className="rec-chemical">{rec.chemical}</div>
                    <div className="rec-amount">{rec.amount}</div>
                  </div>
                ))
              )}
            </div>
          )}
          <p className="hint">
            After making adjustments, wait at least 15 minutes with jets running,
            then re-test.
          </p>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={handleSkipAfter}>
              Done (No Re-test)
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep("after")}
            >
              Enter After Readings
            </button>
          </div>
        </>
      )}

      {step === "after" && (
        <>
          <h2>After Readings</h2>
          <p className="hint">Enter your re-test results after adjusting</p>
          {orderedTests.map((tt) =>
            renderInput(tt, afterInputs, setAfterInputs)
          )}
          <div className="btn-row">
            <button
              className="btn btn-secondary"
              onClick={() => setStep("recommendations")}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAfterDone}
              disabled={saving}
            >
              {saving ? "Saving..." : "Finish Session"}
            </button>
          </div>
        </>
      )}

      {step === "summary" && (
        <>
          <h2>Session Complete</h2>
          <div className="summary">
            <h3>Before Readings</h3>
            {orderedTests.map((tt) => {
              const input = beforeInputs[tt];
              const ppm = getPpmValue(tt, input);
              const range = TEST_RANGES[tt];
              const inRange =
                ppm !== null && ppm >= range.idealMin && ppm <= range.idealMax;
              return (
                <div
                  key={tt}
                  className={`summary-row ${ppm !== null ? (inRange ? "in-range" : "out-range") : ""}`}
                >
                  <span className="summary-label">{TEST_LABELS[tt]}</span>
                  <span className="summary-value">
                    {ppm !== null ? `${ppm}${range.unit ? ` ${range.unit}` : ""}` : "—"}
                    {input?.mode === "drops" && input.drops
                      ? ` (${input.drops} drops)`
                      : ""}
                  </span>
                </div>
              );
            })}
            {Object.values(afterInputs).some(
              (i) => i.drops || i.ppm
            ) && (
              <>
                <h3>After Readings</h3>
                {orderedTests.map((tt) => {
                  const input = afterInputs[tt];
                  const ppm = getPpmValue(tt, input);
                  if (ppm === null) return null;
                  const range = TEST_RANGES[tt];
                  const inRange = ppm >= range.idealMin && ppm <= range.idealMax;
                  return (
                    <div
                      key={tt}
                      className={`summary-row ${inRange ? "in-range" : "out-range"}`}
                    >
                      <span className="summary-label">{TEST_LABELS[tt]}</span>
                      <span className="summary-value">
                        {ppm}
                        {range.unit ? ` ${range.unit}` : ""}
                        {input?.mode === "drops" && input.drops
                          ? ` (${input.drops} drops)`
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <button className="btn btn-primary btn-large" onClick={onComplete}>
            Done
          </button>
        </>
      )}
    </div>
  );
}
