import { FILTER_CHANGE_STEPS, FILTER_CLEANING_STEPS } from "shared/maintenance";
import styles from "~/styles/filter-steps.module.css";

// Both filter-change step lists, numbered straight through.
export function FilterSteps() {
  return (
    <div className={styles.filterSteps}>
      <div className={styles.title}>At the tub</div>
      <ol className={styles.list}>
        {FILTER_CHANGE_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className={styles.title}>Over the next day</div>
      <ol className={styles.list} start={FILTER_CHANGE_STEPS.length + 1}>
        {FILTER_CLEANING_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
