import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { Route } from "./+types/_layout.settings.maintenance";
import { getMaintenanceEvents, addMaintenanceEvent } from "server/db";
import { timeSinceLabel } from "shared/chemistry";
import { MAINTENANCE_LABELS } from "shared/types";
import type { MaintenanceType } from "shared/types";
import styles from "~/styles/maintenance.module.css";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const events = await getMaintenanceEvents(env.DB, 10);
  return { events };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env as { DB: D1Database };
  const formData = await request.formData();
  const eventType = formData.get("eventType") as MaintenanceType;
  const notes = formData.get("notes") as string | null;
  await addMaintenanceEvent(env.DB, eventType, notes || undefined);
  return { ok: true };
}

export default function MaintenancePage() {
  const { events } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showBromideReminder, setShowBromideReminder] = useState(false);
  const [bromideStep, setBromideStep] = useState(0);

  const handleLog = (eventType: MaintenanceType) => {
    if (eventType === "drain_refill") {
      setShowBromideReminder(true);
      setBromideStep(0);
      return;
    }
    fetcher.submit({ eventType }, { method: "post" });
  };

  const handleBromideNext = () => {
    if (bromideStep < 2) {
      setBromideStep(bromideStep + 1);
    } else {
      fetcher.submit(
        { eventType: "drain_refill", notes: "Sodium bromide added" },
        { method: "post" }
      );
      setShowBromideReminder(false);
    }
  };

  const bromideSteps = [
    "Fill the tub with fresh water and heat to temperature.",
    "Add 1.65 oz (3.3 tbsp) of sodium bromide. Run jets for 15 minutes.",
    "Add 6.6 oz (13.2 tbsp) of bleach to activate the bromide bank. Run jets for 15 minutes.",
  ];

  if (showBromideReminder) {
    return (
      <div className={styles.bromideFlow}>
        <h3 className={styles.bromideTitle}>Drain & Refill</h3>
        <div className={styles.bromideStep}>
          <div className={styles.bromideStepNum}>
            Step {bromideStep + 1} of 3
          </div>
          <p className={styles.bromideText}>{bromideSteps[bromideStep]}</p>
        </div>
        <div className={styles.btnRow}>
          <button className={styles.btnPrimary} onClick={handleBromideNext}>
            {bromideStep === 2 ? "Done — Log It" : "Next"}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => setShowBromideReminder(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const maintTypes: MaintenanceType[] = [
    "filter_change",
    "water_change",
    "drain_refill",
  ];

  return (
    <div className={styles.maintenance}>
      <div className={styles.actions}>
        {maintTypes.map((mt) => (
          <button
            key={mt}
            className={styles.actionBtn}
            onClick={() => handleLog(mt)}
            disabled={fetcher.state !== "idle"}
          >
            {MAINTENANCE_LABELS[mt]}
          </button>
        ))}
      </div>

      {events.length > 0 && (
        <div className={styles.recentList}>
          <h3 className={styles.recentTitle}>Recent</h3>
          {events.map((e) => (
            <div key={e.id} className={styles.recentItem}>
              <span>
                {MAINTENANCE_LABELS[e.event_type as MaintenanceType]}
              </span>
              <span className={styles.recentTime}>
                {timeSinceLabel(e.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
