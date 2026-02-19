import {
  BLEACH_SHOCK_OZ,
  SODIUM_BROMIDE_OZ,
  BAKING_SODA_OZ_PER_10PPM,
  DRY_ACID_OZ_PER_02PH,
  CALCIUM_CHLORIDE_OZ_PER_10PPM,
  ozToTablespoons,
  ozToTeaspoons,
  BROMINE_DROPS,
  TA_PPM_PER_DROP,
  CALCIUM_PPM_PER_DROP,
  TEST_CADENCE_DAYS,
  MAINTENANCE_CADENCE_DAYS,
} from "shared/chemistry";
import styles from "~/styles/reference.module.css";

export default function ReferencePage() {
  return (
    <div className={styles.reference}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Dosing Amounts (330 gal)</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Chemical</th>
              <th>Amount</th>
              <th>Equiv.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bleach (shock)</td>
              <td>{BLEACH_SHOCK_OZ} oz</td>
              <td>{ozToTablespoons(BLEACH_SHOCK_OZ)} tbsp</td>
            </tr>
            <tr>
              <td>Sodium Bromide (refill)</td>
              <td>{SODIUM_BROMIDE_OZ} oz</td>
              <td>{ozToTablespoons(SODIUM_BROMIDE_OZ)} tbsp</td>
            </tr>
            <tr>
              <td>Baking Soda (per 10 ppm TA)</td>
              <td>{BAKING_SODA_OZ_PER_10PPM} oz</td>
              <td>{ozToTeaspoons(BAKING_SODA_OZ_PER_10PPM)} tsp</td>
            </tr>
            <tr>
              <td>Dry Acid (per 0.2 pH)</td>
              <td>{DRY_ACID_OZ_PER_02PH} oz</td>
              <td>{ozToTeaspoons(DRY_ACID_OZ_PER_02PH)} tsp</td>
            </tr>
            <tr>
              <td>Calcium Chloride (per 10 ppm)</td>
              <td>{CALCIUM_CHLORIDE_OZ_PER_10PPM} oz</td>
              <td>{ozToTeaspoons(CALCIUM_CHLORIDE_OZ_PER_10PPM)} tsp</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Drop-to-PPM (Taylor K-2106)</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Test</th>
              <th>Sample</th>
              <th>PPM/Drop</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bromine</td>
              <td>25 ml</td>
              <td>{BROMINE_DROPS[25]}</td>
            </tr>
            <tr>
              <td>Bromine</td>
              <td>10 ml</td>
              <td>{BROMINE_DROPS[10]}</td>
            </tr>
            <tr>
              <td>Total Alkalinity</td>
              <td>25 ml</td>
              <td>{TA_PPM_PER_DROP}</td>
            </tr>
            <tr>
              <td>Calcium Hardness</td>
              <td>25 ml</td>
              <td>{CALCIUM_PPM_PER_DROP}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Test Schedule</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Test</th>
              <th>Cadence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>pH + Bromine</td>
              <td>{TEST_CADENCE_DAYS.ph} days</td>
            </tr>
            <tr>
              <td>TA + Calcium</td>
              <td>{TEST_CADENCE_DAYS.ta} days</td>
            </tr>
            <tr>
              <td>Filter Change</td>
              <td>{MAINTENANCE_CADENCE_DAYS.filter_change} days</td>
            </tr>
            <tr>
              <td>Water Change</td>
              <td>{MAINTENANCE_CADENCE_DAYS.water_change} days</td>
            </tr>
            <tr>
              <td>Drain & Refill</td>
              <td>{MAINTENANCE_CADENCE_DAYS.drain_refill} days</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Adjustment Order</h3>
        <ol className={styles.orderList}>
          <li>
            <strong>Total Alkalinity</strong> — adjust TA first (affects pH
            buffering)
          </li>
          <li>
            <strong>Bromine</strong> — test before pH to check if above 10 ppm
          </li>
          <li>
            <strong>pH</strong> — skip if bromine &gt; 10 ppm (Taylor kit limit)
          </li>
          <li>
            <strong>Calcium Hardness</strong> — adjust last
          </li>
        </ol>
      </section>
    </div>
  );
}
