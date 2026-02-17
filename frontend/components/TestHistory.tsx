/** @jsxImportSource https://esm.sh/react@18.3.1 */
import React, { useState, useEffect } from "https://esm.sh/react@18.3.1";
import type { SessionDetail, TestType } from "../../shared/types.ts";
import { TEST_LABELS, TEST_RANGES } from "../../shared/types.ts";

export default function TestHistory() {
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/sessions?limit=30")
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <h2>No test history yet</h2>
        <p>Complete your first test session to see results here.</p>
      </div>
    );
  }

  return (
    <div className="test-history">
      <h2>Test History</h2>
      <div className="history-list">
        {sessions.map((s) => {
          const expanded = expandedId === s.id;
          const beforeReadings = s.readings.filter((r) => r.phase === "before");
          const afterReadings = s.readings.filter((r) => r.phase === "after");

          return (
            <div key={s.id} className="history-item">
              <button
                className="history-header"
                onClick={() => setExpandedId(expanded ? null : s.id)}
              >
                <span className="history-date">
                  {new Date(s.started_at + "Z").toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="history-tests">
                  {[
                    ...new Set(s.readings.map((r) => TEST_LABELS[r.test_type])),
                  ].join(", ")}
                </span>
                <span className="history-arrow">{expanded ? "\u25B2" : "\u25BC"}</span>
              </button>

              {expanded && (
                <div className="history-detail">
                  {beforeReadings.length > 0 && (
                    <>
                      <h4>Before</h4>
                      {beforeReadings.map((r) => {
                        const range = TEST_RANGES[r.test_type];
                        const inRange =
                          r.value_ppm !== null &&
                          r.value_ppm >= range.idealMin &&
                          r.value_ppm <= range.idealMax;
                        return (
                          <div
                            key={r.id}
                            className={`summary-row ${inRange ? "in-range" : "out-range"}`}
                          >
                            <span className="summary-label">
                              {TEST_LABELS[r.test_type]}
                            </span>
                            <span className="summary-value">
                              {r.value_ppm !== null
                                ? `${r.value_ppm}${range.unit ? ` ${range.unit}` : ""}`
                                : "—"}
                              {r.raw_drops !== null ? ` (${r.raw_drops} drops` : ""}
                              {r.raw_drops !== null && r.sample_size_ml
                                ? ` / ${r.sample_size_ml}mL)`
                                : r.raw_drops !== null
                                  ? ")"
                                  : ""}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {afterReadings.length > 0 && (
                    <>
                      <h4>After</h4>
                      {afterReadings.map((r) => {
                        const range = TEST_RANGES[r.test_type];
                        const inRange =
                          r.value_ppm !== null &&
                          r.value_ppm >= range.idealMin &&
                          r.value_ppm <= range.idealMax;
                        return (
                          <div
                            key={r.id}
                            className={`summary-row ${inRange ? "in-range" : "out-range"}`}
                          >
                            <span className="summary-label">
                              {TEST_LABELS[r.test_type]}
                            </span>
                            <span className="summary-value">
                              {r.value_ppm !== null
                                ? `${r.value_ppm}${range.unit ? ` ${range.unit}` : ""}`
                                : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {s.notes && <p className="history-notes">{s.notes}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
