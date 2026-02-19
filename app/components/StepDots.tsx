import styles from "~/styles/step-dots.module.css";

interface StepDotsProps {
  total: number;
  current: number;
}

export function StepDots({ total, current }: StepDotsProps) {
  return (
    <div className={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`${styles.dot} ${i === current ? styles.active : ""} ${i < current ? styles.completed : ""}`}
        />
      ))}
    </div>
  );
}
