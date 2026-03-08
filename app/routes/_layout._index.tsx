import { useLoaderData } from "react-router";
import type { Route } from "./+types/_layout._index";
import { getDashboardData, getSparklineData, getLastReadingValues } from "server/db";
import {
  TEST_CADENCE_DAYS,
  MAINTENANCE_CADENCE_DAYS,
  daysSince,
  timeSinceLabel,
  formatPhValue,
} from "shared/chemistry";
import { TEST_LABELS, TEST_RANGES, MAINTENANCE_LABELS } from "shared/types";
import type { TestType, MaintenanceType } from "shared/types";
import { SparklineChart } from "~/components/SparklineChart";
import styles from "~/styles/dashboard.module.css";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const [dashboard, lastValues] = await Promise.all([
    getDashboardData(env.DB),
    getLastReadingValues(env.DB),
  ]);

  const testTypes: TestType[] = ["ph", "bromine", "ta", "calcium"];
  const sparklines: Record<string, { before: number[]; after: number[] }> = {};
  for (const tt of testTypes) {
    sparklines[tt] = await getSparklineData(env.DB, tt);
  }

  return { dashboard, sparklines, lastValues };
}

function getUrgency(
  lastDate: string | null,
  cadenceDays: number
): "ok" | "warning" | "urgent" {
  if (!lastDate) return "urgent";
  const days = daysSince(lastDate);
  if (days === null) return "urgent";
  if (days >= cadenceDays) return "urgent";
  if (days >= cadenceDays * 0.75) return "warning";
  return "ok";
}

export default function Dashboard() {
  const { dashboard, sparklines, lastValues } = useLoaderData<typeof loader>();
  const testTypes: TestType[] = ["ph", "bromine", "ta", "calcium"];
  const maintTypes: MaintenanceType[] = ["filter_change", "water_change"];

  return (
    <div className={styles.dashboard}>
      <div className={styles.grid}>
        {testTypes.map((tt) => {
          const lastDate = dashboard.lastTests[tt];
          const urgency = getUrgency(lastDate, TEST_CADENCE_DAYS[tt]);
          const isDue = dashboard.suggestedTests.includes(tt);
          const sparkline = sparklines[tt];

          const lastVal = lastValues[tt];
          const range = TEST_RANGES[tt];
          const valInIdeal =
            lastVal !== null &&
            lastVal >= range.idealMin &&
            lastVal <= range.idealMax;
          const valOutOfSafe =
            lastVal !== null &&
            (lastVal < range.min || lastVal > range.max);
          const valClass = valOutOfSafe
            ? styles.cardValueBad
            : valInIdeal
              ? styles.cardValueGood
              : styles.cardValue;

          return (
            <div
              key={tt}
              className={`${styles.card} ${styles[urgency]}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{TEST_LABELS[tt]}</span>
                {isDue && <span className={styles.dueBadge}>Due</span>}
              </div>
              {lastVal !== null && (
                <div className={valClass}>
                  {tt === "ph"
                    ? formatPhValue(lastVal)
                    : `${lastVal}${range.unit ? ` ${range.unit}` : ""}`}
                </div>
              )}
              <div className={styles.cardTime}>
                {timeSinceLabel(lastDate)}
              </div>
              <div className={styles.sparkline}>
                <SparklineChart
                  before={sparkline.before}
                  after={sparkline.after}
                  range={TEST_RANGES[tt]}
                />
              </div>
            </div>
          );
        })}

        {maintTypes.map((mt) => {
          const lastDate = dashboard.lastMaintenance[mt];
          const cadence = MAINTENANCE_CADENCE_DAYS[mt];
          const urgency = getUrgency(lastDate, cadence);

          return (
            <div
              key={mt}
              className={`${styles.card} ${styles[urgency]}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  {MAINTENANCE_LABELS[mt]}
                </span>
                {urgency === "urgent" && (
                  <span className={styles.dueBadge}>Due</span>
                )}
              </div>
              <div className={styles.cardTime}>
                {timeSinceLabel(lastDate)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
