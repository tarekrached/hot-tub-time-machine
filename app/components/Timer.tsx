import { useState, useEffect } from "react";
import styles from "~/styles/timer.module.css";

interface TimerProps {
  durationSeconds?: number;
  /** Wall-clock end time (ms since epoch). Persisted by the wizard so the
   *  countdown survives backgrounding, screen lock, and reloads. */
  endsAt?: number | null;
  onComplete: () => void;
}

// Remaining time is derived from the clock, not counted down tick by tick:
// mobile browsers throttle or freeze intervals while the tab is hidden, so a
// decrementing counter only advances while the page is on screen.
export function Timer({ durationSeconds = 900, endsAt, onComplete }: TimerProps) {
  const [end] = useState(() => endsAt ?? Date.now() + durationSeconds * 1000);
  const secondsLeft = () => Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(secondsLeft);

  useEffect(() => {
    const tick = () => setRemaining(secondsLeft());
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  useEffect(() => {
    if (remaining === 0) {
      onComplete();
    }
  }, [remaining, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = 1 - remaining / durationSeconds;

  return (
    <div className={styles.timer}>
      <div className={styles.display}>
        <svg viewBox="0 0 120 120" className={styles.ring}>
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="6"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-blue)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress)}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className={styles.time}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>
      <p className={styles.hint}>Run jets to mix chemicals</p>
      <button className={styles.continueBtn} onClick={onComplete}>
        Continue Early
      </button>
    </div>
  );
}
