# Plan Wizard — Changes vs. the original spec

A list of every design decision we changed or added while building the interactive
mockup, relative to `plan_wizard_spec.md` as originally written. Hand this to the
spec author to fold in (alongside whatever other edits are already pending).

---

## Cross-cutting / conceptual

### 1. Volume model is the single source of truth (most important)
- Each muscle's **weekly hard-set target** is derived from its tier + per-muscle
  volume landmarks (Israetel-style MEV / MAV / MRV, matching the app's
  `lib/periodization` values), NOT from the spec's fixed "volume translation"
  numbers. Mapping: **Emphasize → toward MRV, Grow → ~MAV, Maintain → ~½ MEV.**
- This one number drives BOTH the Page 15 volume card AND Page 16 exercise
  generation, and they must reconcile exactly.
- The spec's per-tier set ranges (Emphasize 16–20, Maintain 10–14,
  De-emphasize 6–8) are replaced by the landmark-derived values.

### 2. Tier terminology changed to match the existing app
- Spec used **Emphasize / Maintain / De-emphasize**.
- We use the app's model: **Maintain / Grow / Emphasize**, plus **N/A** to drop a
  muscle entirely. (Grow replaces the spec's default "Maintain"; the spec's
  "De-emphasize" concept is gone — a muscle is either Maintain or N/A.)
- Recommended Emphasize cap is **3** (spec said 3–4).

### 3. Profile data comes from the user's existing FATRAT profile
- Age, biological sex, body weight, and height are NOT collected in the wizard.
  They are shown read-only and pulled from the profile.
- **lbs/kg (and ft/cm) unit toggles are removed from the wizard entirely** — units
  come from the profile and are only used for display.

---

## Page 1 — Welcome & Goal
- **Added a "Program name" text field** at the top (saves the program to the
  template library). Not in the original spec.

## Page 2 — Training Experience
- No substantive change.

## Page 3 — Body Profile & Constraints
- Age / sex / weight / height are now a **read-only "From your profile" summary**
  (with an "edit in profile" affordance), not wizard inputs.
- **Added "Stubborn areas you want to work on"** (optional multi-select): belly fat,
  flat/flabby glutes, love handles, arm definition, thighs, chest/pecs, calves.
  Intended to bias volume / exercise selection where it fits the split.
- Injuries multi-select retained as specced.

## Page 4 — Schedule & Availability
- **Added 7 days/week** (spec offered 2–6).
- Day-count selector shows just the number (no "days" label on each pill).
- **Added a "Start day" selector** (Mon–Sun) with a "Starts <date>" preview.
  Mirrors the current app.
- **Removed the "Preferred Training Days" multi-select** from this page. Its role is
  now split between the new Start Day (here) and the Rest Day picker (Page 7).

## Page 5 — Equipment Access
- No substantive change (grouped checklist as specced).

## Page 6 — Training Philosophy
- No substantive change (fit scoring, "recommend one", blending as specced).

## Page 7 — Training Split
- **Added an inline Rest Day picker** beneath the selected split: a 7-day work/rest
  strip plus tap-to-toggle rest days. Rules mirror the current app: "you have N
  rest days — marking a new one frees the oldest," the start day stays a work day,
  and a 7-day/week plan shows "you train every day — no rest days."
- The rest picker renders **directly below the selected split card**, and the split
  card's own week-preview already shows work/rest days (no duplicate "work days"
  strip).

## Page 8 — Muscle Group Prioritization (significant changes)
- UI now mirrors the current app: per-muscle **rows** with an **N/A** button plus
  **Maintain / Grow / Emphasize** buttons, an "**X / 3 emphasized**" counter, and
  tier color-coding.
- Muscle list is the app's `TEMPLATE_MUSCLES`: chest, back, shoulders, biceps,
  triceps, forearms, quads, hamstrings, glutes, calves.
  - NOTE: shoulders are **not** split into front/side/rear, and back is **not** split
    into lats/upper back, for any experience level. This drops the spec's
    finer-granularity-for-intermediate+ behavior.
- N/A removes a muscle from the program entirely (replaces the spec's
  "De-emphasize" tier).

## Page 9 — Set & Rep Preferences
- No substantive change.

## Page 10 — Rest Periods & Tempo
- No substantive change.

## Page 11 — Core & Abs Strategy
- The **selected** core method expands **inline** to reveal its controls (rather than
  showing all controls at the bottom of the page).
- **Dedicated Core Block** expands to ask **number of exercises at end of session
  (1–2 / 2–3 / 3–4)**. New.
- **Dedicated Core Day** expands to a **day picker** ("Which day(s)?") so the user
  chooses which day(s) the core session lands on. New/clarified.
- Core frequency shown inline for Block / Superset methods.

## Page 12 — Cardio & Conditioning
- No substantive change.

## Page 13 — Progression Model
- No substantive change. (Deload protocol selections now feed the Page 15 volume
  card and the week model — see below.)

## Page 14 — Strength Baselines (1RM)
- **Added "Start all conservative"** — one action sets every lift to the conservative
  starting method.
- **Added "Add a calibration week to find my 1RM"** — inserts a week-0 calibration
  week; real loading begins Week 2 and the program runs one week longer. Requires
  generator support (ramp-to-1RM logic to be defined).
- These two options are **mutually exclusive** (selecting one clears the other).
- When the calibration week is on, each lift displays **"Calculated during
  calibration week"** instead of the per-lift method chooser.
- **Removed the lbs/kg toggle** (units come from the profile).

## Page 15 — Program Review & Generate
- The spec's free-text "Estimated weekly volume per muscle group" is replaced by the
  current app's **"Volume per week" card**: a muscle × week grid of hard sets,
  color-coded by tier.
- The grid now reflects the full week structure:
  - an optional **calibration week** ("Cal", ~40% volume) when selected on Page 14;
  - **scheduled deload weeks** ("DL", ~50% volume) per the Page 13 deload protocol /
    frequency;
  - periodized philosophies ramp each muscle toward its ceiling across load weeks.
- (The ~40% / ~50% figures are placeholders pending the real ramp/deload math.)

## Page 16 — Exercise Review & Swap
- **The generated program must match the chosen split exactly** (e.g. Bro Split →
  Chest / Back / Shoulders / Legs / Arms) and must **only use exercises the user's
  equipment supports**.
- **Exercise count is driven by volume, not by a fixed per-tier "slot" count.** Each
  muscle's weekly hard-set target is split across its training days, then across
  exercises at a **default of ~3 sets per exercise**. Example: a 12-set chest target
  on a once-weekly day → **4 exercises × 3 sets**, not 1.
  - The only limit on exercise count is how many equipment-valid exercises exist for
    that muscle; movements repeat only when equipment is very sparse.
  - This explicitly supersedes any "slots per day = exercises per day" interpretation.
- **Default 3 sets per exercise** (traditional programs, steady). **Periodized blocks
  ramp 2 → 4 sets** across the block with deloads.
- Page 16 shows a **representative load week** (or the selected phase, for periodized).

---

## Wizard-wide interaction rules (may or may not belong in the spec)
- Progress shown as a top progress bar + "n / 16" only (no numbered step buttons).
- "Next" is gated until the user has seen the whole page, but ONLY when the page is
  taller than the screen and hasn't been scrolled to the bottom yet. Pages that fit
  on screen never gate, and a page already visited is never re-gated (going Back and
  returning doesn't force re-scrolling).
- Selecting an option never scrolls the page back to the top.
