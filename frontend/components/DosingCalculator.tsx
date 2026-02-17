/** @jsxImportSource https://esm.sh/react@18.3.1 */
import React from "https://esm.sh/react@18.3.1";
import {
  TUB_GALLONS,
  BLEACH_CONCENTRATION,
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
} from "../../shared/chemistry.ts";

export default function DosingCalculator() {
  return (
    <div className="dosing">
      <h2>Dosing Reference</h2>
      <p className="hint">Pre-calculated for your {TUB_GALLONS}-gallon tub with {BLEACH_CONCENTRATION}% bleach</p>

      <div className="dosing-card">
        <h3>Shock (Bleach)</h3>
        <div className="dosing-value">{BLEACH_SHOCK_OZ} oz</div>
        <div className="dosing-alt">{ozToTablespoons(BLEACH_SHOCK_OZ)} tbsp</div>
        <p className="dosing-note">
          {BLEACH_CONCENTRATION}% sodium hypochlorite, unscented. Add with jets running,
          cover open for 20 min.
        </p>
      </div>

      <div className="dosing-card">
        <h3>Sodium Bromide (on refill)</h3>
        <div className="dosing-value">{SODIUM_BROMIDE_OZ} oz</div>
        <div className="dosing-alt">{ozToTablespoons(SODIUM_BROMIDE_OZ)} tbsp</div>
        <p className="dosing-note">
          Add after every drain &amp; refill to establish the bromide bank.
          This is the MOST important step!
        </p>
      </div>

      <div className="dosing-card">
        <h3>Baking Soda (raise TA)</h3>
        <div className="dosing-value">{BAKING_SODA_OZ_PER_10PPM} oz per 10 ppm</div>
        <div className="dosing-alt">{ozToTeaspoons(BAKING_SODA_OZ_PER_10PPM)} tsp per 10 ppm</div>
        <p className="dosing-note">
          Raises Total Alkalinity. Always adjust TA before pH.
          Target: 50-70 ppm.
        </p>
      </div>

      <div className="dosing-card">
        <h3>Dry Acid (lower pH)</h3>
        <div className="dosing-value">{DRY_ACID_OZ_PER_02PH} oz per 0.2 pH</div>
        <div className="dosing-alt">{ozToTeaspoons(DRY_ACID_OZ_PER_02PH)} tsp per 0.2 pH</div>
        <p className="dosing-note">
          Sodium bisulfate. Target pH: 7.4-7.8.
          Also lowers TA, so be careful. Add small amounts.
        </p>
      </div>

      <div className="dosing-card">
        <h3>Calcium Chloride (raise CH)</h3>
        <div className="dosing-value">{CALCIUM_CHLORIDE_OZ_PER_10PPM} oz per 10 ppm</div>
        <div className="dosing-alt">{ozToTeaspoons(CALCIUM_CHLORIDE_OZ_PER_10PPM)} tsp per 10 ppm</div>
        <p className="dosing-note">
          Target: 130-150 ppm (acceptable up to 400 ppm).
          Pre-dissolve in a bucket of warm water.
        </p>
      </div>

      <div className="dosing-card">
        <h3>Drop-to-PPM Reference (Taylor K-2106)</h3>
        <table className="dosing-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Sample</th>
              <th>1 Drop =</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bromine</td>
              <td>25 mL</td>
              <td>{BROMINE_DROPS[25]} ppm</td>
            </tr>
            <tr>
              <td>Bromine</td>
              <td>10 mL</td>
              <td>{BROMINE_DROPS[10]} ppm</td>
            </tr>
            <tr>
              <td>Total Alkalinity</td>
              <td>25 mL</td>
              <td>{TA_PPM_PER_DROP} ppm</td>
            </tr>
            <tr>
              <td>Calcium Hardness</td>
              <td>25 mL</td>
              <td>{CALCIUM_PPM_PER_DROP} ppm</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="dosing-card">
        <h3>Testing Schedule</h3>
        <table className="dosing-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>pH + Bromine</td>
              <td>Weekly</td>
            </tr>
            <tr>
              <td>Total Alkalinity</td>
              <td>Every 2-4 weeks</td>
            </tr>
            <tr>
              <td>Calcium Hardness</td>
              <td>Every 2-4 weeks</td>
            </tr>
            <tr>
              <td>Drain &amp; Refill</td>
              <td>Every 3-4 months</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="dosing-card">
        <h3>Order of Adjustments</h3>
        <ol className="dosing-order">
          <li>Total Alkalinity (adjust first - affects pH)</li>
          <li>pH (adjust second)</li>
          <li>Calcium Hardness</li>
          <li>Sanitizer / Shock (always last)</li>
        </ol>
      </div>
    </div>
  );
}
