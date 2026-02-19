import { useLoaderData } from "react-router";
import type { Route } from "./+types/_layout.settings.log";
import { getTimeline } from "server/db";
import { timeSinceLabel } from "shared/chemistry";
import {
  TEST_LABELS,
  MAINTENANCE_LABELS,
  TEST_RANGES,
} from "shared/types";
import type { TestType, MaintenanceType } from "shared/types";
import styles from "~/styles/timeline.module.css";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const timeline = await getTimeline(env.DB);
  return { timeline };
}

export default function LogPage() {
  const { timeline } = useLoaderData<typeof loader>();

  if (timeline.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No activity yet. Start a test session to see your history.</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {timeline.map((entry) => {
        if (entry.type === "maintenance" && entry.maintenance) {
          const m = entry.maintenance;
          return (
            <div key={`m-${m.id}`} className={styles.entry}>
              <div className={styles.entryDot} data-type="maintenance" />
              <div className={styles.entryContent}>
                <div className={styles.entryHeader}>
                  <span className={styles.entryTitle}>
                    {MAINTENANCE_LABELS[m.event_type as MaintenanceType]}
                  </span>
                  <span className={styles.entryTime}>
                    {timeSinceLabel(m.created_at)}
                  </span>
                </div>
                {m.notes && (
                  <div className={styles.entryNotes}>{m.notes}</div>
                )}
              </div>
            </div>
          );
        }

        if (entry.type === "session" && entry.session) {
          const s = entry.session;
          const readings = s.readings || [];
          const testGroups: Record<string, typeof readings> = {};
          for (const r of readings) {
            if (!testGroups[r.test_type]) testGroups[r.test_type] = [];
            testGroups[r.test_type].push(r);
          }

          return (
            <div key={`s-${s.id}`} className={styles.entry}>
              <div className={styles.entryDot} data-type="session" />
              <div className={styles.entryContent}>
                <div className={styles.entryHeader}>
                  <span className={styles.entryTitle}>Test Session</span>
                  <span className={styles.entryTime}>
                    {timeSinceLabel(s.started_at)}
                  </span>
                </div>
                <div className={styles.readingsList}>
                  {Object.entries(testGroups).map(([tt, rds]) => {
                    const before = rds.find((r) => r.phase === "before");
                    const after = rds.find((r) => r.phase === "after");
                    const range = TEST_RANGES[tt as TestType];
                    const beforeOk =
                      before &&
                      before.value_ppm >= range.idealMin &&
                      before.value_ppm <= range.idealMax;
                    const afterOk =
                      after &&
                      after.value_ppm >= range.idealMin &&
                      after.value_ppm <= range.idealMax;

                    return (
                      <div key={tt} className={styles.readingRow}>
                        <span className={styles.readingLabel}>
                          {TEST_LABELS[tt as TestType]}
                        </span>
                        <span className={styles.readingValues}>
                          {before && (
                            <span className={beforeOk ? styles.good : styles.bad}>
                              {before.value_ppm}
                            </span>
                          )}
                          {after && (
                            <>
                              <span className={styles.arrow}> → </span>
                              <span className={afterOk ? styles.good : styles.bad}>
                                {after.value_ppm}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
