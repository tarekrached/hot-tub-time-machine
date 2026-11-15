# Weekly routine: bromine, shock and tablets

Research behind the weekly dose card (summary step of the test wizard) and the linear test flow. Compiled 2026-11-14. Each claim is tagged:

- **sourced**: a linked document says it.
- **computed**: arithmetic from sourced or measured numbers.
- **inferred**: reasoning without a direct source.
- **measured (date)**: from this tub's data or the owner's own account.

## The routine

- After testing, add 2 bromine tablets and a 6.6 oz bleach shock, once a week. **measured (2026-11-14, owner's account)**
- No midweek shocks. 6.6 oz weekly is the only bleach dose. **measured (2026-11-14, owner's account)**
- Bromine is never retested after a shock. The weekly reading is how the floater and tablets get calibrated. **measured (2026-11-14, owner's account)**
- The floater's holes shift and can get blocked, so check them every time. **measured (2026-11-14, owner's account)**
- The app prefills both on the summary card, skips bleach when the latest bromine reading is 10 or more, and skips either one if it was logged this session or in the last 3 days (`getWeeklyDose` in `shared/chemistry.ts`).

## Dose arithmetic

- "7.5%" bleach is sodium hypochlorite by weight; the Clorox label says it yields 7.1% available chlorine ([EPA label 5813-120](https://www3.epa.gov/pesticides/chem_search/ppls/005813-00120-20190725.pdf)). **sourced**
- 6.6 fl oz = 195 mL into 330 gal = 1,249 L gives 11.1 ppm FC ignoring density, about 12.2 ppm at a density of about 1.10. **computed** (the density is **inferred**)
- With a bromide bank, bromine = 2.25 × FC (Br2 159.81 / Cl2 70.91), so 6.6 oz adds +25 to +28 ppm bromine on top of the current reading. The app uses 1.75 ppm FC per oz × 2.25 ≈ +26 ppm (`bromineRiseFromBleach`). **computed**
- 1 tbsp ≈ +0.9 ppm FC ≈ +2.1 ppm bromine. **computed**
- The bromide bank isn't a limit: 1.65 oz sodium bromide at refill is about 29 ppm bromide, and a shock consumes about 14. **computed**

## Targets

- CDC: hot tub bromine 4–8 ppm, pH 7.2–7.8 ([Legionella toolkit](https://www.cdc.gov/control-legionella/php/toolkit/hot-tub-module.html)). The consumer page gives pH 7.0–7.8 ([CDC](https://www.cdc.gov/healthy-swimming/safety/what-you-can-do-to-stay-healthy-in-hot-tubs.html)). **sourced**
- APSP-11 (2019) raised the public spa bromine minimum from 2.0 to 4.0 ppm ([Pool & Spa News](https://www.poolspanews.com/?p=26641)). **sourced**
- These are public-facility standards; nothing official covers home tubs. The app's 4–6 ppm target sits inside them. **inferred**

## Weekly shock

- Manufacturers say to shock about weekly. [Sundance](https://www.sundancespas.com/blog-articles/hot-tub-shock-treatments-complete-guide): cover off 20+ min with pumps running; re-enter when back in range. [Cal Spas manual](https://www.manualslib.com/manual/2557947/Cal-Spas-Les.html?page=32): cover open at least 20 min; let sanitizer fall to range. [Leslie's](https://lesliespool.com/blog/how-to-brominate-a-spa-or-hot-tub.html) also says weekly. **sourced**
- No source gives a bleach dose for a bromine tub. 6.6 oz rests on the forum method in `docs/bromine-3-step-method.md` (3 oz per 100 gal at 5.25%, scaled to 7.5% and 330 gal). **sourced**
- Manufacturer MPS weekly shocks are about 1–2 oz, roughly 5 ppm FC-equivalent, so 6.6 oz of bleach is 2–3× that. That is why the tub sits above 10 for a while after a shock. **inferred**

## Skip the shock at 10 or more

- The 3-step method: above 10, remove the floater, leave the spa open until it's under 10, and close the floater down. **sourced** (`docs/bromine-3-step-method.md`)
- Shocking on top of 10+ pushes bromine to about 35 or more. **computed**
- The rule is ≥ 10, not > 10, because the 25 mL drop slider tops out at 20 drops = 10 ppm, so "10" can mean "10 or more". **inferred**
- The 38 most recent "before" bromine readings in `seeds/historical.sql` (2025-11-03 to 2026-10-10): 8 below 4, 6 at 4–6, 4 between 6 and 8, 12 at 8–9.5, 8 at 10 or more. The rule skips about 1 session in 5. **measured (2026-11-14, seed data)**
- Readings swing from 0 to 16.25 ppm. The lever for that is the floater opening, not bleach. **measured (2026-11-14, seed data)** / **inferred**
- Soak when bromine is under 10 (3-step method). CDC's ceiling is 8. **sourced**
- The pH soft-skip in the wizard stays at > 10 ppm (Taylor kit limit); it is a separate rule from the shock skip.

## Test kit

- Taylor K-2106's FAS-DPD bromine titration reads up to about 20 ppm chlorine (≈ 45 ppm bromine) on a 10 mL sample without bleaching out; if the pink fades, add more R-0870. **sourced** (Taylor documents, search snippet only; weaker)
- The ~22.5 ppm "bleach-out" figure applies to color-match DPD, not this kit. **sourced** (same caveat)
- A bromine retest after the shock is pointless: the result is known to be far above 10 and changes no decision, and the 10 mL slider caps at 16 drops = 20 ppm. **inferred**

## Tablets

- [HTH Spa Bromine Tablets SDS](https://images.thdstatic.com/catalog/pdfImages/0a/0aa4e279-bfda-4be1-b644-b3abd1e43fad.pdf): BCDMH 50–60%, DCDMH 25–35%, DCEMH 10–20%. They carry their own chlorine. **sourced**
- The label on the container is the binding source for the ppm range and re-entry time; it hasn't been copied here yet.
- `BROMINE_TABLET_OZ = 0.7` is a typical 1" tablet weight, not measured.

## Where to pour

- Borax dissolved in tub water and poured into the filter well is mild. **inferred**
- Bleach and dry acid go into open water with the pump running, not through the cartridge. **inferred**
- Bleach must be plain (not splash-less or scented) and loses strength with age. **inferred**

## Open measurements

- **Mixing time after borax.** Borax goes in pre-dissolved via the filter well, pump on low (two-speed pump, no circulation pump). **measured (2026-11-14, owner's account)** Estimate 3–5 min, no source. **inferred** The 3-step method says about 30 min; an [HTH dealer tip sheet](https://cdn.shopify.com/s/files/1/2720/2188/files/HTH-Bromine-Tip-Sheet.pdf) says at least 30. **sourced** To measure: read pH at 3, 10 and 20–30 min, air valves closed, sampling elbow-deep away from the filter well and jets, on two occasions.
- **Shock decay.** The only back-to-back pair: 16.25 → 11.25 ppm in 3 h 20 min (2026-03-05, conditions unknown). **measured (seed data)** To measure: read bromine 24 h and 48 h after a shock.
- **Dose size.** Whether 6.6 oz is more than needed is an open measurement, not a code change. The decay readings above would inform it.
- **Tablet weight.** Weigh one HTH tablet to replace `BROMINE_TABLET_OZ`.
- **Tablet label.** Copy the label's ppm range and re-entry line into this file.
