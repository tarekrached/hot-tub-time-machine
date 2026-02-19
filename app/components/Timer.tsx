import { useState, useEffect, useRef } from "react";
import styles from "~/styles/timer.module.css";

interface TimerProps {
  durationSeconds?: number;
  onComplete: () => void;
}

export function Timer({ durationSeconds = 900, onComplete }: TimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
