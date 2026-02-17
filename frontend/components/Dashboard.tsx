/** @jsxImportSource https://esm.sh/react@18.3.1 */
import React from "https://esm.sh/react@18.3.1";
import type { DashboardData, TestType, MaintenanceType } from "../../shared/types.ts";
import { TEST_LABELS, MAINTENANCE_LABELS } from "../../shared/types.ts";
import {
  timeSinceLabel,
  daysSince,
  TEST_CADENCE_DAYS,
  MAINTENANCE_CADENCE_DAYS,
} from "../../shared/chemistry.ts";

interface Props {
  data: DashboardData | null;
  onStartTest: () => void;
  onRefresh: () => void;
}

function urgencyClass(dateStr: string | null, cadenceDays: number): string {
  if (!dateStr) return "urgent";
  const days = daysSince(dateStr);
  if (days === null) return "urgent";
  if (days >= cadenceDays) return "urgent";
  if (days >= cadenceDays * 0.75) return "warning";
  return "ok";
}

export default function Dashboard({ data, onStartTest, onRefresh }: Props) {
  if (!data) {
    return <div className="loading">Loading...</div>;
  }

  const testTypes: TestType[] = ["ph", "bromine", "ta", "calcium"];
  const maintTypes: MaintenanceType[] = ["filter_change", "water_change", "drain_refill"];

  return (
    <div className="dashboard">
      <section className="section">
        <h2>Chemical Tests</h2>
        <div className="status-cards">
          {testTypes.map((tt) => (
            <div
              key={tt}
              className={`status-card ${urgencyClass(data.lastTests[tt], TEST_CADENCE_DAYS[tt])}`}
            >
              <div className="status-card-label">{TEST_LABELS[tt]}</div>
              <div className="status-card-value">{timeSinceLabel(data.lastTests[tt])}</div>
              {data.suggestedTests.includes(tt) && (
                <div className="status-card-badge">Due</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <button className="btn btn-primary btn-large" onClick={onStartTest}>
        Start Test Session
        {data.suggestedTests.length > 0 && (
          <span className="btn-sub">
            {data.suggestedTests.map((t) => TEST_LABELS[t]).join(", ")}
          </span>
        )}
      </button>

      <section className="section">
        <h2>Maintenance</h2>
        <div className="status-cards">
          {maintTypes.map((mt) => (
            <div
              key={mt}
              className={`status-card ${urgencyClass(
                data.lastMaintenance[mt],
                MAINTENANCE_CADENCE_DAYS[mt]
              )}`}
            >
              <div className="status-card-label">{MAINTENANCE_LABELS[mt]}</div>
              <div className="status-card-value">
                {timeSinceLabel(data.lastMaintenance[mt])}
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.recentSessions.length > 0 && (
        <section className="section">
          <h2>Recent Tests</h2>
          <div className="recent-list">
            {data.recentSessions.map((s) => (
              <div key={s.id} className="recent-item">
                <div className="recent-date">
                  {new Date(s.started_at + "Z").toLocaleDateString()}
                </div>
                <div className="recent-tests">
                  {[...new Set(s.readings.map((r) => TEST_LABELS[r.test_type]))].join(
                    ", "
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
