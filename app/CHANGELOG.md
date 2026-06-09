# Changelog

All notable changes to FATRAT are recorded here, newest first.
Versions follow [semver](https://semver.org/): MAJOR.MINOR.PATCH —
patch for tweaks/fixes, minor for new features/screens, major for a
finished release.

The current version also lives in `lib/version.ts` (`APP_VERSION`) and
in `package.json`; all three are kept in sync on every change.

## v0.82.0 — 2026-06-08

- Calibration week, layoff ramp-up, scheduled deloads, and the layoff volume
  drop now actually change the generated program (previously they only showed
  in the wizard preview). The program is built from an explicit per-week
  structure — ramp / calibration / load / deload — so what you pick is what you
  train.
  - Calibration week: estimates your e1RM (averaged Epley/Brzycki) from the top
    sets you log that week, then auto-seeds working weights into the remaining
    weeks (inverse-Epley at each week's rep target). Weighted lifts only.
  - Layoff ramp-up: a 12+ month layoff prepends two reduced reintroduction
    weeks; a shorter break prepends one. A 12+ month layoff also drops every
    muscle one volume tier (emphasize→grow, grow→maintain).
  - Scheduled deloads from the progression step are inserted at the chosen
    cadence, not just a single deload at the end.
  - Traditional (non-periodized) programs keep their steady volume — only
    periodized programs ramp.

## v0.81.1 — 2026-06-08

- Fixed dumbbell exercises showing reps-only with no weight field. Root cause:
  swapping an exercise mid-workout kept the *old* exercise's metric, so swapping
  a bodyweight slot to a loaded dumbbell move (e.g. Triceps Kickback, Rotating
  Dumbbell Chest Press) inherited "reps only." Two fixes:
  - Swaps now carry the new exercise's metric.
  - The set logger now resolves the metric from the live exercise definition
    (defaulting loadable exercises to weight-reps), which also corrects any
    existing sessions that already have a stale metric.

## v0.81.0 — 2026-06-08

- Bodyweight exercises can now carry optional added weight. Moves like glute
  bridge, single-leg calf raise, lunges, and dips are stored as bodyweight
  (reps only), so there was no way to log the dumbbell you were holding. The
  set logger now shows an optional "+ WEIGHT" field on rep-based exercises —
  log it when you load the move, leave it blank for pure bodyweight (never
  required).
- Fixed the workout screen loading only global exercises into its definition
  map, so custom exercises you added lost their rest-timer and movement-pattern
  data mid-workout. It now loads your custom exercises too.

## v0.80.1 — 2026-06-08

- Fixed custom exercises not appearing in the Plan wizard. The wizard read from
  the bundled seed library, so exercises you added in the Exercise Library
  (e.g. while building a plan) never showed in the dropdowns. It now loads the
  live library — global plus your own custom exercises — when it opens.

## v0.80.0 — 2026-06-08

- Start a plan any day — no more waiting for Monday.
  - Page 16's button is now **Finish**, which opens a modal: **Activate this
    plan** or **Save to Gallery**. Save to Gallery stores the finished plan
    (single instance) without scheduling anything.
  - Activating asks for a **start date**. If it's mid-week, a first-week editor
    shows your typical week on top and the actual first week below, with past
    days greyed out. Work days are placed in the remaining days and you can flip
    any remaining day between train and rest. Workouts that don't fit are
    skipped (short first week); the normal pattern resumes the next Monday.
  - Schedule is stored as a Monday-anchored weekly pattern + start date, so the
    first week is a clean override and weeks 2+ follow the typical week.
- Activated plans stay as a single Gallery entry, now flagged **● Active**
  (the active block links back to its template via `templateId`).

## v0.79.4 — 2026-06-08

- Plan wizard, step 1 of the start-anytime work: dropped the "start day"
  question. Your schedule is now a Monday-anchored typical week, and any day —
  including Monday — can be a rest day. Copy notes that you'll be able to lay
  out a different first week when you activate the plan (the activation modal +
  first-week editor land next).

## v0.79.3 — 2026-06-08

- Fixed finishing a plan creating a duplicate. A plan now keeps a single id for
  its whole life: saving a draft, then finishing it, updates that one gallery
  record in place instead of leaving the draft behind next to a new copy. The
  wizard also seeds its draft id when resuming, so re-saving a resumed draft
  no longer forks a second one.

## v0.79.2 — 2026-06-08

- Fixed supersets (and other review-page edits) being lost. Navigating through
  the "Generate" page used to wipe and regenerate the program, discarding your
  superset groups, swaps, and reordering. The review page now regenerates only
  when the underlying settings actually change, and preserves your edits
  otherwise — including when resuming a saved program.
- Swapping an exercise from the review-page dropdown now updates its underlying
  exercise id (not just the name), so the saved program matches the choice.
- Resuming a saved program no longer disables Next or forces you to scroll to
  the bottom on pages you already completed.

## v0.79.1 — 2026-06-08

- Profile cards: My Equipment and Exercise Library now share the same label
  font, and the expand/chevron arrows on the profile cards are larger and more
  visible.

## v0.79.0 — 2026-06-08

- Profile page reorganized:
  - New editable personal-details card at the top (name, birthday, sex, weight,
    height) in a collapsible card.
  - Removed the read-only Overview card.
  - Exercise Library moved to a button directly below My Equipment (pulled out
    of the Settings card; the library page itself is unchanged).
- My Equipment no longer stacks setups — a dropdown selects which setup to edit
  and "+ Add" creates a new one, all reusing the same space.
- Onboarding no longer asks about training days, session length, or goals —
  those are chosen per-program in the Plan builder. New profiles seed neutral
  defaults (general fitness, 3 days, 60 min) until a plan is built.

## v0.78.2 — 2026-06-08

- Fixed the whole-page reset (scroll jumps to top, collapsible cards snap shut,
  focus lost) that happened after any profile edit. `refresh()` was flipping the
  global loading flag, which made AppShell blank and remount the entire page;
  background refreshes are now silent and leave the current page mounted. Affects
  My Equipment toggles and every other in-place profile change (mode, units,
  calendar, sounds).

## v0.78.1 — 2026-06-08

- My Equipment moved out of Settings into its own collapsible card on the
  Profile page. Toggling an item now updates instantly via local state and
  persists in the background, so the page no longer jumps to the top on each
  tap.
- Plan Wizard footer: the **Next** button is now compact and right-justified,
  with **Save** sitting to its left; Save was removed from the top header.

## v0.78.0 — 2026-06-08

- Plan Wizard Page 16 — exercise ordering and set structure.
  - Select 2+ exercises in a day and tap **Superset** to pair them; selected
    moves are reordered to sit together and tagged with a shared group. Works
    for any pairing, including your two core moves.
  - Per-day action bar offers **Straight**, **Superset**, and — only when you
    enabled them in the set-types step — **Drop set** and **Pyramid**. Applying
    a non-superset style clears any existing grouping.
  - Drag the ⋮⋮ handle to reorder exercises within a day; supersets move as a
    contiguous block so a pair never gets split.
  - Grouped rows show a left accent bar and a "⟂ Superset" label at the group
    start; drop/pyramid rows show a small badge. `setStyle` / `supersetGroup`
    carry through generation, persistence, and the superset-aware logger.
- Ad-hoc workout — equipment profile picker. The ad-hoc logger now asks which
  equipment profile is on hand (defaulting to your default), filters the library
  to what that setup can do, and stamps the session's `equipmentProfileId` so
  in-workout swaps match the same gear.

## v0.77.0 — 2026-06-06

- Multiple equipment profiles (e.g. Home + Commercial Gym). A program is built
  for one profile and references it live.
  - `profile.equipmentProfiles[]` (named, each a granular checklist) +
    `defaultEquipmentProfileId`. Legacy single-list / coarse users migrate on
    read into one "My Gym" profile — no data migration needed.
  - Settings → My Equipment manages multiple setups: add / rename / delete /
    set default, each with its own checklist.
  - Onboarding seeds a default profile from the granular picker.
  - Plan Wizard's equipment page becomes a selector when you have more than one
    setup ("Which setup is this program for?"), defaulting to your default; with
    one setup it stays a read-only summary.
  - The Mesocycle stores `equipmentProfileId`; in-workout Swap filters against
    that program's profile (falls back to the default). So adding a pull-up bar
    to the profile a program was built for makes pull-ups available in that
    program's swaps immediately — the live behavior, now per-location.
  - New shared helpers (`getEquipmentProfiles`, `defaultProfileId`,
    `itemsForProfile`, `newProfileId`) + tests.

## v0.76.0 — 2026-06-06

- Plan Wizard: Save / resume drafts. A "Save" button in the wizard header
  stores the current state as a draft without activating anything; a ✕ closes
  the wizard from any page. Saving again updates the same draft.
  - Drafts serialize the full WizardState plus any Page-16 exercise edits, so
    resuming restores exactly where you left off.
  - Programs page lists saved drafts ("DRAFT" cards) with Resume and Discard.
    Activating a resumed draft cleans it up automatically.
  - New `repo.deleteTemplate(id)` (interface + mock + Firestore). Draft state is
    carried on `ProgramTemplate` via new `isDraft` / `draftState` fields; drafts
    are excluded from the normal programs list.
  - Save is available from the create flow and the edit-this-plan flow.

## v0.75.1 — 2026-06-06

- Onboarding now captures the granular equipment list (the same Settings →
  My Equipment checklist) and writes it to profile.equipmentItems; the legacy
  coarse `equipment` field is derived from it. Leaving everything unchecked =
  bodyweight only.
- Plan Wizard equipment page copy made explicit that equipment is pulled from
  the profile and edited in Settings → My Equipment.

## v0.75.0 — 2026-06-06

- Equipment is now a single source of truth on the profile, editable in
  Settings — and changes apply everywhere live (no program rebuild).
  - New `profile.equipmentItems: string[]` (granular Page-5 labels). Seeded
    lazily from the existing coarse `equipment` via `inferEquipmentItems()`
    (home-gym → barbell+rack+dumbbells+bench+pull-up, commercial → everything,
    etc.) — no migration needed; it's derived on read until first edited.
  - New shared `lib/exercise/equipment.ts`: `availableTypes`, `canUseExercise`
    (coarse type + `requiresEquipment`, with the Adjustable→Flat bench rule),
    `inferEquipmentItems`, equipment groups. One filter used everywhere.
  - Settings → "My Equipment": a granular checklist. Add a pull-up bar there and
    pull-ups immediately appear in the in-workout Swap picker and in the wizard's
    Add-exercise list — because availability is computed live from the profile,
    not baked into the saved program.
  - Plan Wizard: the equipment page is now read-only ("from your profile") and
    the wizard generates against `profile.equipmentItems`. The in-checklist step
    is gone.
  - Swap (`findSimilar`) now filters by the granular list instead of the coarse
    enum, so swap alternatives respect exactly what you own.
  - Tests updated to the items-based model.

## v0.74.1 — 2026-06-06

- Plan Wizard v2 scroll + custom-split fixes:
  - Fixed "Next" not starting at the top, and selections not scrolling to the
    next section. The wizard now renders inside a real overlay whose own div is
    the scroll container; all scroll logic (scroll-to-top on page change,
    scroll-to-next-section, and the "scrolled to bottom" gate) targets that
    container instead of window/document, which don't scroll in the overlay.
  - Page 7 custom builder groups the lower body as a single "Legs" chip
    (quads + hamstrings + glutes + calves) instead of four separate ones. The
    split preview and generated day labels collapse those four to "Legs" too.

## v0.74.0 — 2026-06-06

- New logos. Phone/PWA app icon is now the white-on-black logo (regenerated
  square 192/512 + apple-touch icon on a black field; manifest updated to
  any+maskable). Inside the app the logo is theme-aware: white-on-black in dark
  mode, black-on-white in light mode — applied to the login screen and the
  app-header brand mark via CSS (`.logo-on-dark` / `.logo-on-light`), no JS so
  there's no theme flicker.
  - Note: the browser-tab favicon (`app/icon.svg`) is read-only and was left as
    is; it doesn't affect the installed phone icon. Can overwrite it on request.

## v0.73.2 — 2026-06-06

- Equipment: floor-based barbell lifts no longer require a rack. Deadlift,
  Romanian Deadlift, barbell rows (Barbell/Pendlay/T-Bar), shrugs, barbell &
  EZ-bar curls, and skull crushers are available with just a barbell + plates.
  Only rack-dependent lifts (back/front squat, bench presses, overhead press,
  rack pull, good morning) still require a Power/Squat Rack. Test updated.

## v0.73.1 — 2026-06-06

- Equipment rules corrected per feedback:
  - Dumbbell flat and decline presses are floor-capable — they no longer
    require a bench. Incline dumbbell work still needs an adjustable bench;
    dumbbell flyes/pullovers still need a flat bench.
  - All barbell exercises now require a Power/Squat Rack (reverses the earlier
    "barbell implies a rack" default). Barbell bench variants need a bench too.
  - Tests updated.

## v0.73.0 — 2026-06-06

- Plan Wizard v2 — edit flow, no phases, precise equipment.
  - Edit-this-plan now opens Plan Wizard v2 (not the old TemplateWizard). It is
    seeded with the plan's name; you rebuild from there, and saving archives the
    current plan and starts the new one. Wired on both /plan and the meso detail
    page. "Build a custom program" on /plan also uses v2 now.
  - Removed Block Periodization entirely — a multi-week plan IS a block; users
    make separate plans for later phases. Dropped the periodization "block"
    option, all phase tabs and phase language on Page 16, and the related
    progression locks. Periodization strategy is now None / DUP / Weekly.
  - Granular equipment: new `requiresEquipment` field on exercises (Page-5
    checklist labels needed beyond the coarse type). Populated across the
    library — machine sub-types (leg press vs pec deck vs lat pulldown, etc.),
    pull-up bar / dip / ab-wheel moves, and bench-dependent lifts. Per your
    calls: free-weight pressing requires a bench (incline/decline → adjustable;
    an adjustable bench also satisfies flat); barbell squat/bench do NOT require
    a separate rack. Orphan selectorized machines (hip abduction, etc.) are
    commercial-gym only. Optional equipment (e.g. Russian Twist) requires
    nothing. Commercial Gym has everything. Replaces the old special-case hack.
  - Tests: equipment gating (machines, benches, commercial), and the existing
    suites updated.

## v0.72.0 — 2026-06-06

- Plan Wizard v2 — 1RM baselines now persist (follow-up to Chunk 3).
  - Page 14 inputs are controlled and stored: "Known 1RM" captures the max,
    "Recent set" captures weight × reps, keyed by the lift's exercise id.
  - `persist.ts` seeds `startingWeights` from those values — a known 1RM is
    converted to a working weight for the program's rep range (Epley-inverse),
    a recent set's weight is used directly; values convert lb→kg from the
    profile unit. "Start conservative" / calibration week leave weights to the
    existing defaults.
  - Engine fix so this lines up: a muscle's first exercise each day is pinned to
    its top compound (the anchor) instead of being rotated by day index, so the
    Page-14 lifts match the program's anchors exactly. Accessories still rotate
    day to day for variety.
  - Double-submit guard on "Start My Program" so a fast double-tap can't create
    two plans.
  - Tests: startingWeights-from-1RM mapping.
  - Still open: routing Edit-this-plan through v2; Block-periodization phase-
    specific exercise lists persist only the representative phase today.

## v0.71.0 — 2026-06-06

- Plan Wizard v2 — persistence + integration (Chunk 3). The new wizard now
  saves real programs and is wired into the app.
  - "Create Custom Program" on the Programs page now launches Plan Wizard v2
    (full-screen). "Start My Program" persists the plan and lands you on Today.
  - New `lib/wizard/persist.ts`: converts the wizard's reviewed week into an
    AssignedWeek and reuses the proven `generateCustomProgram` + `buildCustomTemplate`
    path, so the plan materializes into a Mesocycle + Microcycles + day sessions
    (volume ramp, RIR targets, deloads) and is also saved as a custom template.
    Archives any active plan first, exactly like the existing activate flow.
    Maps wizard split → SplitType, volume framework/periodization → programStyle,
    rest preference → restSeconds, and equipment → the allowed EquipmentType set.
  - Edit-this-plan is preserved: the Change Plan sheet still opens the existing
    TemplateWizard. (Routing the v2 wizard into the edit round-trip is a future
    step.)
  - Test added for the wizard→CustomProgramInput mapping.
  - Known follow-ups: 1RM baseline values entered on Page 14 aren't captured yet
    (inputs are display-only), so week-1 starts without seeded weights; and the
    /wizard-v2 preview route remains for QA.

## v0.70.0 — 2026-06-06

- Plan Wizard v2 (Chunk 2):
  - Time-based exercises now display correctly. Each generated exercise carries
    its library `metric`; time/weight-time moves (Plank, Side Plank, carries)
    show as `sets×Ns` (e.g. 3×30s) instead of `sets×reps`. Swapping or adding
    an exercise updates the metric/units to match the new movement.
  - Core now varies day to day — core exercises rotate through the pool by day
    index instead of repeating the same picks every session.
  - New custom split: Page 7 has a "Custom — build each day" option that lets
    you assign muscle groups to each training day yourself (e.g. Mon chest/back,
    Tue biceps/triceps, Wed shoulders). The engine generates and the volume card
    reconciles from this per-day layout via a new `dayLayout()`.
  - Engine tests added for time metrics, core day-to-day variation, and custom
    splits.

## v0.69.3 — 2026-06-06

- Plan Wizard v2 (Chunk 2): Page 5 (Equipment) now scrolls down to the
  equipment checklist after you pick a training environment. The group headers
  were wrapped in per-group divs, so they weren't direct children of the page
  container the scroll logic scans; rendering them as fragments restores the
  auto-scroll target.

## v0.69.2 — 2026-06-06

- Plan Wizard v2 review fixes (Chunk 2):
  - Page 6 (Training Style) now scrolls to the next section after the first
    selection — the auto-scroll runs on a double rAF so it fires after the
    base-style choice reveals the Volume/Periodization sections.
  - Page 14 (Baselines) now shows the right inputs per method: a weight field
    for "Known 1RM", and weight × reps for "Recent set".
  - Page 16 exercise pools fixed: (a) time-based core holds (Plank, Side Plank)
    were being filtered out by a metric guard — removed, so they appear now;
    (b) bodyweight-tagged moves that actually need equipment (Ab Wheel, pull-up
    bar, dip station) are gated behind the Page-5 checklist, so they no longer
    appear when you didn't select that equipment. Commercial gyms still get
    everything (and respect explicit unchecks).
  - Engine tests added for both behaviors.

## v0.69.1 — 2026-06-06

- Fixed blank screen at `/wizard-v2`: the preview route returned null whenever
  there was no signed-in user (Firebase mode, signed out, or still loading).
  It now shows a loading state, falls back to a stub profile when signed out
  (with a "preview mode" banner), and wraps the wizard in an error boundary so
  any runtime error is shown on-screen instead of blanking.

## v0.69.0 — 2026-06-06

- Plan Wizard v2 — UI (Chunk 2 of 3). New `components/plan/PlanWizardV2.tsx`,
  a React/TSX port of the approved 16-page mockup, driven by the Chunk-1
  `lib/wizard` engine. Themed with the app's tokens (bg-card, accent, ink-*).
  - All 16 pages: goal (6 incl. Transform / Lean Out), experience, read-only
    profile + injuries + stubborn areas, schedule (7 days + start day),
    equipment, the 3-step Training Style (base + volume framework +
    periodization) with smart defaults/filtering, split + inline rest-day
    picker, muscle prioritization, sets/reps, rest/tempo, core (inline
    expanders incl. core-day picker), cardio, progression, baselines (quick
    actions + calibration week), review with the volume-per-week card, and the
    exercise editor (per-row muscle + dropdown, add/remove, core as a group).
  - Volume + generation come entirely from the engine, so the in-app program
    reconciles with the volume card exactly.
  - Mounted on a preview route at `/wizard-v2` (NOT linked in nav, existing
    TemplateWizard untouched). "Start My Program" currently logs the state +
    generated program; persistence + the Programs-flow swap + Edit-this-plan
    land in Chunk 3.
  - Typecheck clean. One non-blocking react-hooks/exhaustive-deps warning on
    the scroll effect (intentional).

## v0.68.1 — 2026-06-06

- Fixed a timezone-fragile unit test: `streak.test.ts > isoWeekStamp` built
  dates with `new Date('YYYY-MM-DD')` (parsed as UTC), so it failed on
  machines west of UTC even though `isoWeekStamp` and all production callers
  use local-midnight dates. Test now uses `...T00:00:00` to match. No
  production code changed.

## v0.68.0 — 2026-06-06

- Plan Wizard v2 — engine foundation (Chunk 1 of 3). New, additive
  `lib/wizard/` module; no UI or existing flows changed yet.
  - `types.ts` — `WizardState` model matching the approved mockup: 6 goals
    (incl. Transform / Lean Out), 4 experience tiers, `trainingStyle`
    {baseStyle, volumeFramework, periodizationStrategy}, calibration week,
    stubborn areas, per-muscle tiers.
  - `engine.ts` — pure generation engine. Volume is the single source of
    truth: tier → MEV/MAV/MRV landmark targets (Emphasize→MRV, Grow→MAV,
    Maintain→~½MEV). `weekStructure()` builds the calibration + scheduled-
    deload week shape; `muscleSetsForWeek()` ramps load weeks for
    Evidence-Based / Block. `generateWeek()` is volume-driven: each muscle's
    weekly target is split across its training days then into exercises at
    ~3 sets each, selecting only equipment-valid movements from the real
    exercise library, with core treated as its own group. Granular Page-5
    equipment is mapped onto the library's coarse EquipmentType set.
  - `engine.test.ts` — covers volume-driven exercise count, card↔program
    reconciliation, equipment filtering, calibration/deload week structure,
    and the evidence-based volume ramp. (Run on Windows via `npm test`;
    vitest can't run in the Linux sandbox — rollup native binary.)
  - Next: Chunk 2 (wizard UI in React/TSX), Chunk 3 (persistence +
    Edit-this-plan round-trip + stored-type extensions + migration).

## v0.67.4 — 2026-05-31

- Fixed: WeekCalendar prev/next week buttons stopped working after v0.67.3.
  The `onViewWeekChange` callback's identity changed every parent render,
  re-firing the effect that called it, which re-triggered the parent and
  pinned `viewWeek` in a loop. Removed the callback from the effect's
  dependency list — only the actual `week` value triggers the notification.
- Week Sessions card no longer has a top-level collapse. The week is
  always shown; each individual session row collapses on tap to reveal
  exercise summaries (logged sets with weight × reps, or cardio details).
  A separate "Open" link still routes to the full post-workout summary.

## v0.67.3 — 2026-05-31

- History: collapsible "WEEK SESSIONS" card now sits between the calendar
  and the progression chart. Header shows the in-view week's session
  count; tap to expand and see each session as a row (day · date,
  exercise summary, ✓ Done badge). Each row opens the post-workout
  summary (`/history/session/[id]`).
- New `WeekCalendar.onViewWeekChange(weekNumber, startDate)` callback —
  fires whenever the displayed week changes so the History page can
  re-derive the visible session list as you page through weeks.
- Works in both single-block and All-blocks (by-date) modes.

## v0.67.2 — 2026-05-31

- Cancelled-plan cleanup: new `cleanupArchivedPendingSessions(repo, userId)`
  sweep deletes uncompleted sessions tied to archived mesocycles. The v0.60
  cancel flow already deletes pending sessions at cancel time, but plans
  cancelled before that landed still had orphan Mon-Wed-Fri scheduled
  sessions in Firestore — those showed as Skipped/Planned cells in
  History's All-blocks calendar. The sweep runs on every History page
  load; safe to call repeatedly.
- WeekCalendar date-organized mode now prefers *completed* sessions when
  multiple sessions exist on the same calendar date. Previously a pending
  session won; that meant even after cleanup, a stale future planned
  session could still hide a completed one if they clashed on the same
  date.

## v0.67.1 — 2026-05-31

- History "All blocks (by date)" mode now actually buckets sessions by
  calendar week. v0.67.0 renumbered each source micro into a unique
  "week N", so when two blocks overlapped the same calendar week (e.g.
  a cancelled plan whose dates intersected Summer Workout's week 1)
  the calendar surfaced only one of them depending on sort order.
- New `WeekCalendar.calendarWeeks` prop. When provided, the calendar
  enters *date-organized* mode: each entry is a calendar week anchored
  at a `startDate`, in chronological order, and cells look up sessions
  by their date across the entire `sessions` prop. Multiple source
  blocks that overlap the same calendar week merge correctly.
- History page in "All blocks" mode: buckets every session into
  calendar-week start dates (Mon-Sun, honoring `weekStartsOn`), picks
  the dominant parent meso per week for the block label, and passes
  the resulting list to the calendar.

## v0.67.0 — 2026-05-31

- Today: the "UP NEXT" / pull-this-workout-into-today card no longer shows
  when the user has no active plan. The next-pending lookup is also now
  restricted to the active mesocycle, so cancelled / archived plans can't
  surface a stale workout.
- History redesigned around the user's full timeline. The Block dropdown
  defaults to "All blocks (by date)" — the calendar concatenates every
  block's micros in chronological order (sorted by each micro's earliest
  session date), renumbers their `weekNumber` globally, and paginates
  through them as one continuous timeline. Picking a specific block
  filters back to its weeks only.
- New `WeekCalendar.blockNameByWeek` prop. When present, the paged header
  shows the block name in place of the per-week intensity badge — so the
  Week N header changes its block label as you scroll through the
  timeline. Specific-block view keeps the intensity badge.
- Page subtitle now reads "Every workout, sorted by date." in All-blocks
  mode and "Every session in this training block." in single-block mode.

## v0.66.4 — 2026-05-31

- Single-workout templates: when the user picks the workout from Today
  (or starts it from the template detail page), the materialized session
  now (a) pre-fills the reps / time on each set from `slot.repsLow` /
  `slot.timeLow` so the value Brian set in the wizard actually shows up
  in the logger; (b) carries `restSeconds` on the WorkoutSession so the
  rest timer fires between sets.
- New `WorkoutSession.restSeconds?: number` field. Programmed sessions
  still pull rest from `mesocycle.restSeconds`; ad-hoc / single-workout
  sessions now carry their own.
- workout/page.tsx rest-timer trigger no longer requires a meso — the
  precedence is `session.restSeconds → meso.restSeconds → defaultRestSec
  (phase, patterns)`. Ad-hoc workouts without any rest hint fall back to
  the hypertrophy default for the movement so the timer still fires.
- Pre-fill applies to weight-reps (reps), reps-only (reps), time
  (timeSec), and weight-time (weight + timeSec) metrics — weight comes
  from `startingWeightKg`, reps from `repsLow`, time from `timeLow`.

## v0.66.3 — 2026-05-31

- History calendar now overlays completed workouts from *other* blocks
  (e.g. plans that were cancelled mid-stream) onto the displayed week.
  Previously the calendar only rendered sessions belonging to the
  currently-selected block, so a cancelled plan's Mon–Thu lifts showed
  as Rest. New `WeekCalendar.extraCompletedSessions` prop accepts a list
  of cross-block completed sessions and the calendar fills any empty
  cell whose date matches one of them. History page passes every
  completed session from a different mesocycle.
- The selected block's own sessions still take precedence — extras only
  fill cells the selected block leaves empty.

## v0.66.2 — 2026-05-31

- Today SessionCard renders cardio-only sessions (no logged exercises,
  cardio entries present) with the title "CARDIO" — not "AD-HOC WORKOUT".
  The body lists each cardio activity (Treadmill · 40 min · 145 bpm)
  instead of the empty exercises list.
- Every SessionCard now has an explicit "Open" button at the bottom.
  Completed sessions route to `/history/session/[sessionId]` (the post-
  workout summary); pending ones route to `/today/workout`. Programmed
  pending sessions also get a "Plan" button alongside Open that jumps to
  the meso week schedule. The "✓ Done" badge stays in the top right as a
  visual indicator (no longer clickable; Open replaces it).

## v0.66.1 — 2026-05-31

- "Pull this workout into today" now actually shows. The v0.66.0 condition
  was too narrow — it only fired when `state === 'pending'` (next session
  in the active micro) AND today had no session at all, so off-days with
  a completed cardio entry, or the end of a week, hid the button.
  Replaced with a separate search across all the user's sessions that
  finds the earliest pending session dated strictly after today (any
  micro). The "UP NEXT" card with the pull button shows whenever nothing
  is pending for today and a future scheduled workout exists.

## v0.66.0 — 2026-05-31

- Skip-ahead: pull a future scheduled workout into today on off-days.
  When nothing's scheduled today but the next session is later this week,
  Today shows a card with the upcoming day plus a "Pull this workout into
  today" button. Tap it and the session's date moves to today; the
  original date becomes an off-day. Same action also lives on the Plan day
  detail page (`/plan/day/[sessionId]`) — a "Move to today" button shows
  in the status card for any pending future session.
- Post-workout summary header now reads "Cardio done!" when the session
  has no logged exercises (cardio-only); other sessions still read
  "Workout done!". Fixes the case where logging cardio on a rest day
  showed "Workout done!" with no exercises listed.

## v0.65.2 — 2026-05-31

- Plan day detail page: skipped set rows now show a red ✕ icon instead of
  the green ✓. The body already read "Skipped" from v0.65.1; the icon now
  matches so the row reads as skipped at a glance.
- History session page (`/history/session/[sessionId]`) doesn't render
  per-set icons — its set list is text-only — so no change needed there.

## v0.65.1 — 2026-05-31

- Edit-set capability extended to the Plan day detail page
  (`/plan/day/[sessionId]`). The original v0.65.0 only added Edit to
  `/history/session/[sessionId]` — Brian reached completed workouts via
  Plan → expand week → Open full day and found no button there.
- Extracted `EditableSetTable` to `components/workout/` so both pages
  share the same metric-aware editor. The Plan day page's "History"
  button now sits next to an "Edit" link; tapping Edit opens the per-set
  editor (weight / reps / time), with Save / Cancel at the bottom of the
  exercise card. Skipped sets stay marked Skipped.
- Same single-exercise-at-a-time constraint applies — opening Edit on one
  exercise disables Edit on the others until you Save or Cancel.

## v0.65.0 — 2026-05-31

- History session detail page (`/history/session/[sessionId]`) — each
  exercise card now has an "Edit" button next to "Details". Tapping it
  switches that exercise's set rows into a metric-aware editor: weight /
  reps / time InlineNumbers per set, one set per row. Save persists the
  edited sets back to the WorkoutSession via `upsertSession`; Cancel
  discards the draft. Only one exercise can be in edit mode at a time
  (the others' Edit buttons disable while one is open).
- Skipped sets stay marked Skipped and are not editable.
- New `EditableSetTable` helper component in the same file. The editor
  uses the existing `InlineNumber` from `components/ui`, so the smart
  popup expansion from v0.64.4 carries over.

## v0.64.5 — 2026-05-31

- Russian Twist exercise definition: metric changed from 'reps' to
  'weight-reps' so the workout logger shows weight + reps. Russian twists
  are commonly weighted with a plate or dumbbell.

## v0.64.4 — 2026-05-31

- InlineNumber open editor now expands toward the screen interior on tap.
  Cells on the left half of the viewport anchor their left edge and grow
  to the right (target ~260 px wide, clamped to the viewport with 8 px
  margin); cells on the right half anchor their right edge and grow to
  the left; cells already spanning at least 75% of the viewport stay matched
  to the cell width. Brian's narrow REPS column on the set-logger row now
  expands into the LOG column instead of staying squished.
- Position is computed on open via getBoundingClientRect — no resize listener,
  no reflow churn.

## v0.64.3 — 2026-05-31

- Inverted Row exercise definition: metric changed from 'reps' to
  'weight-reps'. Inverted rows are commonly loaded with a vest or backpack;
  the workout logger now shows weight + reps so users can record what they
  added on top of bodyweight.
- Wizard-generated plans floor `core` exercises at 3 sets per slot.
  Core's volume model lands at 1 set per slot for low-volume tiers, which
  produced "1 × 60s" planks — too sparse for a real ab block. Other
  muscles keep their existing volume model. Global core-specific templates
  in the seed library already prescribed 3 sets, so this change brings
  wizard-built plans into line.

## v0.64.2 — 2026-05-31

- ExerciseCard now prefers the live exercise definition's `metric` over the
  saved `exercise.metric`. Existing sessions whose denormalized metric is
  stale (e.g. Reverse Fly persisted as 'reps' from an earlier seed) now
  render correctly — Reverse Fly shows weight + reps because the def says
  'weight-reps'.
- Cardio logged from Today no longer auto-attaches to the active plan.
  Dropped the `microcycleId` / `mesocycleId` / `planName` props from the
  Today page's CardioLogModal — cardio on a rest day shows as a standalone
  "Cardio · 40 min" card instead of "Week 1 Day 2 · Summer Workout".
- CardioLogModal layout: treadmill mode now packs Duration / Speed / Incline
  into a single 3-col row. The derived-stat panel (calculated distance /
  speed / pace) and AVG HEART RATE sit side-by-side in a 2-col row.
- InlineNumber editor no longer expands past the parent cell width — the
  popup that opens on tap stays within the viewport instead of going
  off-screen on cells near the edge. Input + buttons inside stay larger
  than the closed state.
- New users no longer get an auto-generated starter program from
  onboarding. The wizard saves the profile and routes to Today; the user
  picks a template from /plan/templates (or builds one) when they're ready.

## v0.64.1 — 2026-05-31

- Plan page: the *expanded* per-exercise card inside a week row also now
  branches on `metric` for the prescription header. Time exercises (Plank,
  Side Plank) read "1 × 30–60s" instead of "1 × ?–? reps". The outer
  session card was fixed in v0.64.0; this fix covers the inner expanded
  view that the screenshot showed.

## v0.64.0 — 2026-05-31

- Plan page now renders set entries based on the exercise's `metric`. Time
  exercises (planks, hangs) show `Xs`; reps-only exercises (pull-ups,
  push-ups) show `× N`; weight-time shows `weight × Ns`; weight-reps stays
  unchanged. The prescription header on each exercise row also branches on
  metric so it reads "8–12 reps" for rep exercises and "30–60s" for time
  exercises, instead of always saying "reps".
- New exercise countdown timer for time-based sets. SetLoggerRow shows a
  "▶ Start timer" button under the time input on active rows. Tapping opens
  a full-width overlay (`ExerciseTimer`) that counts down from the set's
  current value (or `prescribedTimeLow`, fallback 30s), with ±10s and
  Stop/Done. On zero it plays a double-beep and waits for the user to
  dismiss.
- Rest timer also now plays the same double-beep when it reaches zero.
- New `lib/ui/beep.ts` helper — Web Audio sine pulses, two 150ms beeps
  ~30ms apart. Silently skipped when the browser can't create an
  AudioContext or the user disabled sounds.
- New profile field `soundsEnabled` (default on; set false to mute). New
  Settings card with an On/Off pill — sits between MODE and UNITS.

## v0.63.1 — 2026-05-31

- INTERMEDIATE effort picker — renamed "Smooth" → "Easy" and "Grinding" →
  "Hard" so the endpoints match the BASIC scale (Easy / Just Right / Hard).
  Underlying RPE values unchanged; historical sets render with the new
  labels. Doc comments and the mode-diff description updated. Also folded
  the fourth `effortShort` copy (in plan/day) into the shared
  `lib/periodization/terminology.ts` helper.

## v0.63.0 — 2026-05-31

- Today page now supports multiple sessions per day. If a workout is
  finished, adding another ad-hoc workout (or starting a single-workout
  template) creates a *new* session instead of overwriting the completed
  one. Today renders every session on today's date — pending ones first
  (with their normal exercise list), completed ones below with the green
  Done badge linking to the post-workout summary.
- New repository method `listSessionsOnDate(userId, isoDate)` — returns
  every session for a date. Mock + Firestore impls. `resolveToday` now
  returns `{ session, todaySessions, ... }`; `session` is the primary
  target for the header button, `todaySessions` is the full list the UI
  iterates.
- Save flows updated to only reuse an existing session's id when that
  session is still incomplete — picker (today/page), AdHoc workout modal,
  and the template-detail single-workout start. Completed sessions are
  never replaced.
- Minor version bump because the resolveToday shape changed and the Today
  page rendering model is now a list, not a single card.

## v0.62.6 — 2026-05-31

- InlineNumber editor (the inline weight/reps/time inputs) — when open it
  now floats above the row at 160% width with a much larger input field
  (h-16 vs h-12), wider +/- buttons (w-12 vs w-7), and a visible "Done"
  button. The "Enter to confirm" caption is gone — Done replaces it for
  mobile users who only use the +/- buttons and never see a keyboard. Row
  layout no longer shifts when a cell opens (the closed button stays
  rendered as a height-preserving spacer; the editor overlays it).

## v0.62.5 — 2026-05-31

- "Make it active" in the Template Wizard now also saves the program as a
  custom template — it shows up in Browse templates afterwards alongside the
  active plan (e.g. "Summer Workout, by Brian"). Previously the activate path
  only persisted the mesocycle and the user had to hit "Save as a template"
  separately to make the program reusable. When `modifyTemplateId` is set
  (Edit-an-existing-template flow), it overwrites that template instead of
  creating a duplicate. Helper copy under the save buttons updated to
  reflect the new behavior.

## v0.62.4 — 2026-05-31

- Three workout tweaks:
  - Core no longer gets a per-muscle feedback (pump/volume/joint-pain)
    prompt. It's incidentally trained on most days and the signal is noise.
    Filtered out at the trigger site (today/workout), in the post-workout
    "Add feedback" card (history/session), and defensively inside
    `SessionFeedbackModal` itself.
  - Reps +/- on the set logger was bumping by 2 on touch devices —
    `onTouchStart` and the synthetic `onMouseDown` both fired. Swapped
    `InlineNumber` to pointer events (`onPointerDown` / `onPointerUp` /
    `onPointerLeave` / `onPointerCancel`); one event per interaction.
  - On easy weeks (microcycle `targetRIR >= 2`), `nudgeNextSet` now holds
    weight steady regardless of how the prior set felt. Those weeks are
    supposed to be easy — nudging the bar up just because the user had
    reps in the tank defeats the point. Hard weeks (RIR <= 1) and
    ad-hoc sessions still get the full nudge behavior.

## v0.62.3 — 2026-05-31

- Edit this plan — wizard now actually opens with the saved plan's values.
  Two fixes: (1) `mesocycleToTemplate` emits an array of length
  `meso.weeks` (only week 0 carries content) so the wizard's
  `clamp(t.weeks.length, 3, 8)` lands on the real plan duration instead of
  defaulting to 3. (2) Each slot now carries `startingWeightKg` from the
  first set of the matching session, and the wizard's seed effect converts
  it to display units and writes it into `weightEdits.weight` — the
  starting-weights step opens pre-filled. Reps, time, RIR, tiers, set
  styles, rest seconds, program style, split, days/week all already
  carried over; weeks and weights now do too.

## v0.62.2 — 2026-05-31

- Wired "Edit this plan" on the Meso detail page's Change Plan sheet —
  Today → Open → Change now shows it too. Same flow as the main Plan page:
  builds a single-week ProgramTemplate from the live meso and opens the
  Template Wizard pre-populated.

## v0.62.1 — 2026-05-31

- Change Plan sheet — added an "Edit this plan" action above "Cancel this
  plan". Tapping it closes the sheet and opens the Template Wizard
  pre-populated with the current plan's name, goal, weeks, days per week,
  split, tiers, set styles, and week-1 exercise layout. New helper
  `mesocycleToTemplate` (lib/program/mesoToTemplate.ts) synthesizes a
  single-week ProgramTemplate from the live meso + first-week sessions —
  the wizard already knows how to seed from `initialTemplate`, so no
  changes inside the wizard itself. Saving via "Make it active" archives
  the current plan and starts a fresh one — same flow as Cancel + start a
  new plan from a template. Available on the main Plan page; the Meso
  detail page's Change sheet does not yet wire it (next pass if you want it).

## v0.62.0 — 2026-05-31

- B3 clarity audit — Firestore sessions are now navigable. Renamed the
  `users/{uid}/sessions` subcollection to `users/{uid}/days` and denormalized
  `planName` (mesocycle.name) onto each day doc. Browsing the console no
  longer means staring at random slugs — each row carries its plan name and
  date directly. UI behavior is unchanged; it still reads the live meso
  when rendering.
- New session ID prefix `day-` for newly generated sessions (template
  generator + custom-program generator). Existing IDs are kept as-is by
  the migration for round-trip safety.
- `WorkoutSession.planName?: string` added. Generators set it. The
  CardioLogModal and AdHocWorkoutModal accept an optional `planName` prop,
  set by the Today, Plan, and History pages from the meso in scope, so
  ad-hoc sessions attached to a plan get the same denorm.
- One-shot Firestore migration (`migrateSessionsToDaysForUser`) runs on
  sign-in after the Macrocycle migration: copies every doc from `sessions/*`
  to `days/*` with `planName` filled. Gated by `profile.migratedSessionsToDays`
  so it never runs twice. The orphan `sessions` subcollection is left for
  manual cleanup in the console.

## v0.61.0 — 2026-05-31

- B2 clarity audit — retired `Macrocycle` from the data model. The macro
  wrapper was 1:1 with the meso since v0.22.0 and had become dead weight.
  Promoted the fields the UI actually read (`name`, `goal`, `startDate`,
  `targetDate`) directly onto `Mesocycle`. Dropped `Mesocycle.macrocycleId`
  and `WorkoutSession.macrocycleId`. Sessions now reference meso/micro only.
- New repository surface: `listMesocycles(userId)` and `getActivePlan(userId)`
  replace `listMacrocycles` / `getActiveMacrocycle` / `listMesocycles(macroId)`.
  Both repository impls (mock + firestore) updated. `ChangePlanSheet`,
  `resolveToday`, `TemplateWizard`, `OnboardingWizard`, the Today, Plan,
  History, Settings, plan/meso, plan/templates pages, plus the cardio/ad-hoc
  modals all stop fetching or passing macrocycle data.
- One-shot Firestore migration (`migrateMacrocyclesForUser`) runs on first
  sign-in: copies each `users/{uid}/macrocycles/*`'s name/goal/startDate/
  targetDate onto the matching meso, strips `macrocycleId` from every session,
  sets `profile.migratedMacroDrop` so it never runs twice. The orphan
  `macrocycles` subcollection is left in place; delete in the console after
  migration. Mock-mode bumps `STORAGE_KEY` to `fatrat:mock:v5` to re-seed
  cleanly — no localStorage migration needed in dev.
- Consolidated the third copy of `effortShort(mode, rpe)` (Plan page) into
  `lib/periodization/terminology.ts`. All three call sites now share one
  implementation.

## v0.60.10 — 2026-05-31

- B1 clarity audit — confined periodization vocabulary and prompts to
  periodized sessions only. New `isPeriodizedSession(session, meso)`
  helper in `lib/periodization/terminology.ts` returns true iff the
  session has a `microcycleId` and the meso's `programStyle` isn't
  `traditional`. The prior gates used `meso?.programStyle !== 'traditional'`,
  which silently fired for ad-hoc workouts (no meso at all). Fixed
  three sites in `today/workout/page.tsx` (soreness check-in, per-muscle
  feedback mid-workout, finish-workout feedback prompt) plus the
  post-workout summary's "Add feedback" card. Ad-hoc and Traditional
  sessions no longer get periodization-only prompts.
- Hid the ` · X RIR` readout on `ExerciseCard` unless the user reads as
  ADVANCED — it was leaking jargon to BASIC/INTERMEDIATE.
- Consolidated the duplicated `effortShort(mode, rpe)` function (workout
  summary + day-session sheet) into `lib/periodization/terminology.ts`.
  Single source of truth for the per-set effort label.

## v0.60.9 — 2026-05-31

- Inverted the archived-block "no plan" treatment: instead of replacing
  the calendar with a placeholder card, the calendar always renders so
  the user can see real off-days. For weeks entirely in the future of
  a non-current block, the "Week N of N" header swaps to "No Active
  Plan" while the grid below it shows all-rest cells (since cellState
  already returns 'rest' for empty days on archived blocks).

## v0.60.8 — 2026-05-31

- Refine archived-block calendar in History:
  - "No active plan" placeholder now only shows for weeks **entirely** in
    the future. The current week (which still contains past days worth
    inspecting) renders the normal grid again — past days show their real
    history, future days within the week render as rest.
  - Week N of N header + date range stay visible above the placeholder so
    you always know which week you're paged to.
  - When the viewed block isn't the active one, the calendar defaults to
    Week 1 of that block instead of "today's week" (which is meaningless
    for an archived block). Combined with the existing `key=` remount,
    switching blocks via the dropdown now lands you at Week 1 every time.

## v0.60.7 — 2026-05-31

- Fix: History dropdown still showed current/future weeks of an archived
  block as if they were a real schedule (empty Rest tiles with date numbers
  and "Week N of N" header), which read as "this is your current plan".
  When the viewed block isn't the user's active block:
  - The current week and any future weeks now show a "No active plan"
    placeholder instead of the calendar grid, with prev/next nav to step
    back into the weeks that do have data.
  - Past weeks still render normally so the actual completed/skipped
    history remains visible.

## v0.60.6 — 2026-05-26

- Fix: History showed future "Lift" / "Planned" cells on archived blocks —
  cancelled programs still looked like they had upcoming workouts because
  WeekCalendar's cellState/caption ignored whether the block being viewed
  is current. Both now gate the 'planned' state behind isCurrent:
- Future / today non-completed sessions on an archived block render as
  rest (cross-hatch) instead of planned/Lift.
- Empty cells inferred-as-scheduled (via scheduledDows) on an archived
  block render as rest instead of Planned.
- Completed (green) and skipped (orange) still show as before — the actual
  logged history is preserved.

## v0.60.5 — 2026-05-26

- Fix: History's WeekCalendar still showed the "· This week" badge on
  archived blocks when today's date happened to fall inside the visible
  week's range. WeekCalendar gained an isCurrent prop (defaults true so
  the Plan page is unchanged); History passes false unless the meso being
  viewed is the user's currentMesoId. Archived blocks no longer get the
  "This week" indicator.

## v0.60.4 — 2026-05-26

- Fix: after cancelling a plan, History still labeled the archived meso as
  "· current". Cause: the currentMesoId resolution chain ended with
  `?? flat[0]`, so when there was no active macro and no active meso, it
  defaulted to whatever meso happened to be first. Removed the flat[0]
  fallback for currentMesoId (now null when nothing is active). The
  initial-selection logic for the History dropdown still falls back so the
  page renders something useful when there's no active plan.

## v0.60.3 — 2026-05-26

- Fix: Today showed a random workout for users with no active plan. Cause:
  cancelling a plan only archived the macro/meso but left pending sessions
  in Firestore. resolveToday found them by date and rendered them.
- Two-part fix:
- (1) resolveToday only accepts a date-matched session if it's ad-hoc
  (no macrocycleId) OR its macrocycleId matches the currently active macro.
  Stale sessions from cancelled programs are now ignored — defense in depth.
- (2) ChangePlanSheet's Cancel and Cancel-and-switch actions now also delete
  every pending (un-logged) session belonging to the macro being archived.
  Completed sessions stay so History remains intact.
- Added DataRepository.deleteSession and implementations in both the mock
  and Firestore repos to support the cleanup.
- Existing orphan sessions auto-clear: visit Today once on v0.60.3 — the
  guard in resolveToday hides them. (They'll still live in Firestore until
  you cancel/restart that plan again.)

## v0.60.2 — 2026-05-26

- TemplateWizard's Modify Day modal: Core was missing from the "Add a
  muscle" pill list (TEMPLATE_MUSCLES intentionally excludes it because
  Core has its own card on the Week Layout step). Added Core as an
  explicit option so you can give a specific day extra core slots on top
  of the baseline.

## v0.60.1 — 2026-05-26

- Change Training Plan sheet restructured. Dropped "Explore current plan"
  and "Build a custom plan" (the Switch path leads to Templates, which now
  has its own Create Custom flows for both programs and single workouts).
  The sheet now offers three actions, in order:
    1. Cancel this plan (danger) — archives the active macro + meso
    2. Restart from a new date… — the existing shift-dates flow
    3. Cancel and switch plans — archive + route to /plan/templates
  Logic extracted into a new ChangePlanSheet component shared by /plan and
  the meso detail page.
- Today's programmed session card now shows an "Open" button at the top
  right (in line with WEEK n DAY n) that routes to /plan/meso/{mesoId}.
  Ad-hoc workouts (no microcycleId) get no Open button — they don't have
  a program to open.
- /plan/meso/[mesoId] gains a "Change" button next to its "< Plan" back
  button at the top, opening the same ChangePlanSheet.

## v0.60.0 — 2026-05-26

- Plan page: two new program-management actions.
- Restart from a new date. The Change sheet on the Plan page now has a
  "Restart from a new date…" action. Pick a date in the sheet, and every
  workout in the program shifts so the first one lands on that date
  (delta-shift; preserves day-of-week pattern). All completion flags
  clear, all micros reset, the first week becomes active. Use case: you
  set up a program a couple days early, didn't actually start, and want
  it to start fresh today.
- Move a missed workout onto an off-day. When you tap any day in the
  calendar's "Add to this day" sheet, it now shows a "Move a missed
  workout here (N)" option whenever you have skipped sessions
  (incomplete, date < today). Picking one shows the missed sessions and
  tapping reassigns that session's date + dayOfWeek to the new day.

## v0.59.5 — 2026-05-26

- Settings → ACCOUNT card refreshed. The stale dev-mode copy ("Auth comes
  online with Firebase. For now, switch demo users from the header pill.")
  is gone — it predated real Firebase auth. The card now shows the
  signed-in email and a Sign out button next to the (still-disabled)
  Delete account placeholder.

## v0.59.4 — 2026-05-26

- Removed the "Reset demo data" card from Settings (Danger Zone). It only
  ever did anything in mock mode — it wiped the in-memory store and
  re-seeded the three demo users. In Firebase mode it was a no-op that
  reloaded the page. Now that the app is on real Firebase it's misleading
  to expose. Also dropped the unused resetMockRepository import and the
  doReset / confirmReset state.

## v0.59.3 — 2026-05-26

- Fix: Plan calendar was opening to the wrong week. When today's date didn't
  fall inside any of the program's weeks (a fresh program whose week 1
  starts a few days from now, or a paused program), the old fallback chose
  the LAST week with sessions — so a brand-new 3-week program starting next
  Monday opened to Week 3 (June 15-21) instead of Week 1.
- Default-week selection is now: (1) the week containing today, else (2)
  the active microcycle's weekNumber, else (3) the first week that has
  sessions, else (4) Week 1.

## v0.59.2 — 2026-05-26

- Fix: picking an ad-hoc workout was attaching it to the active program's
  micro/meso/macro ids, so Today rendered it as "WEEK 1 / Full Body / Block 1
  / Thursday" — looked like a programmed day. Two parts:
- (1) WorkoutSession gained optional name. The picker and the workout-template
  detail page now save the chosen workout's name on the session and DON'T set
  microcycleId / mesocycleId / macrocycleId. resolveToday still picks the
  session up by date so /today/workout works the same.
- (2) Today's session card branches on session.microcycleId. Programmed
  sessions still show WEEK N DAY M + the mesocycle name. Ad-hoc sessions
  show "AD-HOC WORKOUT" + the workout's name (e.g. "Push Day"), with the
  exercise list and Continue/Start button identical to a programmed day.

## v0.59.1 — 2026-05-26

- Fix: programs activated against the live Firebase backend appeared to
  load (macrocycle + mesocycle showed up on Plan) but the week calendar
  was all Off-day hatching with no sessions. Cause: firestoreRepository's
  listSessionsInMicrocycle combined where('microcycleId', '==', x) with
  orderBy('date', 'asc') — a compound query that Firestore requires a
  composite index for. Without the index, the query throws (silently in
  some SDK error modes) and returns no docs. Dropped the server-side
  orderBy and sort client-side instead; sessions-per-micro counts are
  small so the cost is negligible and we skip the index roundtrip
  entirely.

## v0.59.0 — 2026-05-26

- Workout-run flow restructured. Picking a single workout — from Today's
  Ad-Hoc Workout picker OR from a workout template's detail page — now
  creates a real WorkoutSession (marked started, not completed) and routes
  to /today/workout, the same full logging experience as a scheduled day
  in a program. AdHocWorkoutModal is no longer used from those entry
  points; it stays mounted on the Plan and History pages for after-the-fact
  logging of past days.
- resolveToday now consults getTodaySession first. Any session whose date
  matches today wins regardless of microcycle membership — so ad-hoc
  sessions (no microcycleId) are found, and a session attached to today's
  micro is still found by date even if micro/meso state is unusual.
- If a session already exists for today when picking a workout, it's
  overwritten in place (same id) with the new exercises — single source of
  truth per date.

## v0.58.1 — 2026-05-26

- Fix: when picking a workout from Today's Ad-Hoc picker, the AdHocWorkoutModal
  still showed its ADD EXERCISE search panel at the top alongside the
  pre-populated workout — looked like the empty "create custom" flow was
  stacked above the chosen workout. The picker is now collapsed by default
  when the modal opens with a pre-filled workout, and replaced by a
  "+ Add an exercise" button that re-expands it. Opening with an empty
  workout (true create-custom) keeps the picker expanded as before.

## v0.58.0 — 2026-05-26

- Brand refresh.
- /fatrat-logo2.png replaces /fatrat-logo.png as the canonical mark — used
  on the login screen, in the PWA manifest, and as the favicon /
  apple-touch icon (app/icon.png and app/apple-icon.png refreshed from the
  new file). The original /fatrat-logo.png stays in /public so older
  bookmarks / cached references don't 404.
- AppShell header gains the bare rat illustration (/fatrat-rat.png) to the
  left of the FATRAT wordmark + version, sized h-9 so it spans the height
  of both lines of text. Marked aria-hidden — purely decorative; the
  wordmark next to it is the accessible label.

## v0.57.5 — 2026-05-26

- SingleWorkoutWizard step 1 (Workout): equipment multi-select filter under
  Category. Tap any combination of Barbell / Dumbbell / Machine / Cable /
  Bodyweight / Kettlebell / Band / Smith — selected pills filter step 2's
  exercise list to only those types. Leave them all off to see everything.
  Wraps onto multiple lines (no horizontal scroll).

## v0.57.4 — 2026-05-26

- Two fixes in the SingleWorkoutWizard's exercise + starting-values flow.
- Step 1 exercise list was capped at 30 results, which hid newer entries
  that sort late in the seed (Dumbbell Row, Rotating Chest Press, etc.).
  Cap removed — the muscle filter + search box are the only narrowing.
- Step 3 (Starting values) now asks for a starting Weight per exercise
  alongside reps or time, for any exercise whose metric uses weight
  (weight-reps and weight-time). Band exercises still show "Band" instead
  of a number field, matching the program wizard's behavior.
- TemplateExerciseSlot gained startingWeightKg. WorkoutPicker and the
  template detail page copy that weight into the materialized ExerciseEntry
  sets, so picking a custom workout pre-fills the Ad-Hoc logger with weight
  in addition to reps/time. Library single workouts (which don't have
  startingWeightKg set) still work — those sets open empty for weight.

## v0.57.3 — 2026-05-26

- Today → Ad-Hoc Workout → "Create Custom Workout" now routes to
  /plan/templates/workouts?create=1 instead of opening an empty
  AdHocWorkoutModal. The workouts page consumes the query param and
  auto-opens the SingleWorkoutWizard, so the user lands directly in the
  full workout-creation flow (naming, category, muscle-filtered exercise
  picker, starting values + rest). Newly-saved workouts then show up in
  the picker library next time.

## v0.57.2 — 2026-05-26

- SingleWorkoutWizard step 1 (Exercises) — category-aware filtering.
- The category picked on the Workout step now narrows what shows up on the
  Exercise step: Upper Body limits to chest/back/shoulders/biceps/triceps/
  forearms, Lower Body to quads/hams/glutes/calves, Core to core. Full Body
  and Other don't restrict.
- The muscle filter pills wrap onto multiple lines instead of horizontally
  scrolling. Pills outside the chosen category are hidden entirely so the
  user only sees relevant options.
- If the user re-opens step 0 and changes category to a narrower one, the
  current muscle filter falls back to All if it's no longer in scope.

## v0.57.1 — 2026-05-26

- Exercise library: ensure every movement in the TRX-chart screenshot has a
  dumbbell and/or bodyweight variant.
- Re-tagged the three v0.57.0 entries that defaulted to cable/barbell:
    Wide-Grip Row → Wide-Grip Dumbbell Row (dumbbell)
    Reverse Fly → kept the name, now dumbbell (bent-over with dumbbells)
    Wide-Grip Barbell Curl → Wide Curl (dumbbell)
- Added 8 new entries so the remaining items have a dumbbell or bodyweight
  option: Decline Dumbbell Bench Press, Dumbbell Skull Crusher, Dumbbell
  Triceps Press, Top-Half Dumbbell Curl, Bottom-Half Dumbbell Curl,
  Dumbbell Deadlift, Bodyweight Side Lunge, Bodyweight Reverse Lunge.

## v0.57.0 — 2026-05-26

- /plan/templates is now a landing page — pick Program (multi-week plan) or
  Single Workout (one-shot routine). The two flows live at
  /plan/templates/programs and /plan/templates/workouts respectively, each
  with its own list + create-custom button. Detail page links unchanged.
- SingleWorkoutWizard step 1 (Exercises) gained a horizontally-scrollable
  muscle filter pill row above the search field — All / Chest / Back /
  Shoulders / Biceps / Triceps / Forearms / Quads / Hams / Glutes / Calves /
  Core / Neck. Combines with the text search.
- 13 new exercises seeded into the global library:
    Rotating Dumbbell Chest Press, Single-Arm Skull Crusher,
    Wide-Grip Row, Dumbbell Pullover, Reverse Fly (back-focused cable),
    Wide-Grip Barbell Curl, Y Raise, Swimmers (bodyweight),
    Dumbbell Upright Row, Sumo Goblet Squat, Side Lunge, Reverse Lunge,
    Pulse Squat.

## v0.56.0 — 2026-05-26

- Single Workouts: a new template kind alongside Programs.
- ProgramTemplate gained kind ('program' | 'workout') and a WorkoutCategory
  field. 'program' is the default for everything that already exists, so no
  data migration. A workout is a one-shot template (one week, one day).
- Seeded 8 sample single workouts: Push Day, Pull Day, Upper Body Mass,
  Squat Day, Hinge Day, Core Crusher, Quick Core, Quick Full Body —
  spanning upper / lower / core / full-body categories.
- Templates page split into two sections — Programs and Single Workouts —
  each with its own "Create Custom" button. The programs section is unchanged;
  the workouts section is new and lists library + user-saved workouts.
- New SingleWorkoutWizard component — 3-step wizard mirroring the program
  wizard's look: Workout (name/category), Exercises (pick/reorder/sets),
  Starting values + Rest. Save writes a workout-kind ProgramTemplate.
- Template detail page now detects kind: workout templates show category,
  rest, and a single day's exercises (no week breakdown), with "Use This
  Workout" button that opens AdHocWorkoutModal pre-populated. Modify on a
  custom workout opens SingleWorkoutWizard.
- Today's Ad-Hoc Workout button now opens a WorkoutPicker sheet listing
  single workouts grouped by category, with "Create Custom Workout" at the
  top. Picking one pre-populates the logging modal with that workout's
  exercises (sets blanked but reps/time targets carried over).
- AdHocWorkoutModal accepts initialExercises and an optional sourceLabel so
  the sheet header shows the workout name when opened from the picker or
  from the template detail page.

## v0.55.1 — 2026-05-26

- Fix: Template Wizard steps weren't reliably opening at the top — the scroll
  reset on step change was racing with focus-induced scrolling from inputs
  that mount with the new step. Now uses scrollTo({ behavior: 'auto' }) to
  override any inherited smooth-scroll, runs at three points
  (immediate, requestAnimationFrame, +50ms setTimeout) to beat late layout,
  and also resets when the wizard itself first opens.

## v0.55.0 — 2026-05-26

- App refresh / new-version detection.
- New /api/version returns the deployed APP_VERSION (no-store, dynamic). The
  client compares against the bundle's baked-in version and shows a toast
  when they don't match.
- UpdateChecker component polls on mount, on tab focus, on visibility change,
  and on a slow 5-minute interval while the tab is active. Mounted in
  AppShell so the toast appears on all authenticated routes (sits just above
  the BottomNav so it doesn't overlap nav controls).
- Toast: "A new version is available · vCurrent → vLatest" with Update and
  dismiss buttons. Update clears all browser caches via the CacheStorage API
  then reloads the page. Dismiss persists per-version in localStorage so the
  toast doesn't keep re-popping until a fresh version lands.
- No service worker / PWA build changes — purely application-level polling.
  If we ever want offline support we can layer next-pwa on top later.

## v0.54.1 — 2026-05-26

- Fix: finishing onboarding bounced the user back to step 0 instead of /today.
  Cause: app/onboarding/page.tsx still wrapped its content in its own
  <UserProvider> (a leftover from before v0.53.1 hoisted UserProvider to the
  root layout). That created a second, isolated UserProvider, so refresh()
  after onboarding updated the local provider's state, but AppShell on the
  /today route reads the root provider — which still saw user === null and
  bounced back to /onboarding. Removed the redundant wrap; the root layout's
  UserProvider is the single source of truth.

## v0.54.0 — 2026-05-26

- Phases 4 + 5 of the live-launch work: real Firestore persistence is now
  wired in, plus the security rules and migration script that go with it.
- New module lib/firestore/firestoreRepository.ts implements DataRepository
  against Firestore using the same interface the UI already speaks. Data
  layout: /exercises/{id} (global, read-only), /users/{uid} for the profile,
  and per-user subcollections (bodyWeight, macrocycles, mesocycles,
  microcycles, sessions, customExercises, templates, exercisePrefs).
- getRepository() now returns the Firestore repo when env vars are present
  and falls back to the in-memory mock otherwise — local dev keeps working
  with no Firebase configuration.
- firestore.rules (project root) locks /exercises to read-only for signed-in
  users and gates /users/{uid}/** to the matching authenticated user. Ready
  to paste into the Firestore Rules tab.
- scripts/migrate-exercises.ts one-shot copies GLOBAL_EXERCISES (175ish
  movements) into Firestore /exercises/. Uses firebase-admin via a service
  account key (scripts/serviceAccountKey.json, gitignored).
- devDependencies: firebase-admin, tsx (for running the migration).

## v0.53.1 — 2026-05-26

- Fix: production build was failing because the /login page calls useUser()
  but UserProvider only wrapped the (main) routes — Next's prerender for
  /login couldn't find the context. Hoisted UserProvider to the root layout
  so /login and /onboarding share the same auth context as the main app.
- (main)/layout is now a thin wrapper that only renders AppShell.

## v0.53.0 — 2026-05-26

- Phase 3 of the live-launch work: real Firebase Auth wired up.
- New module lib/firebase/client.ts initializes the SDK from
  NEXT_PUBLIC_FIREBASE_* env vars. Falls back to "Firebase disabled" when env
  vars are absent so local dev still works against the mock repo.
- Login page now signs in with a real Google popup when Firebase is enabled;
  in mock mode the old fake delay still works for local dev.
- UserProvider listens to onAuthStateChanged, exposes the FirebaseUser, and
  loads the matching profile from the repo by Firebase uid. Adds signOut().
- AppShell adds an auth gate (Firebase mode only): unauthenticated visitors
  to any (main) route are redirected to /login; signed-in users without a
  profile are sent to /onboarding. DemoUserPicker is hidden in Firebase mode
  and replaced with a Sign out button.
- OnboardingWizard uses the Firebase uid as the new profile's userId so the
  rest of the app (sessions, templates, body weight, etc.) keys off it.
- package.json adds firebase ^11.0.0 as a dependency.

## v0.52.0 — 2026-05-25

- Exercises now declare what they measure per set.
- New ExerciseMetric field on ExerciseDefinition with four values:
  weight-reps (default), reps (bodyweight reps only), time (isometric hold,
  seconds only), and weight-time (loaded carry — weight + seconds).
- Tagged: Plank, Side Plank, Dead Hang, Towel Hang → time.
  Farmer's Carry → weight-time.
  39 bodyweight rep movements → reps (all push-ups & pull-ups, dips, core,
  neck, sissy squat, nordic curl, glute bridge, bodyweight calf raises, etc.).
- SetEntry gained timeSec; ExerciseEntry gained prescribedTimeLow/High and
  metric. TemplateExerciseSlot reps fields are now optional and it gained
  timeLow/timeHigh.
- Wizard step 6 ("Starting weights, reps & rest") renders the right inputs
  per metric — Weight + Reps, Weight + Time, just Reps, or just Time. Default
  starting time range is 30–60s; tunable like reps.
- Workout logging (SetLoggerRow) adapts per metric: bodyweight rep exercises
  hide the weight column; planks show a single TIME column (seconds); loaded
  carries show WEIGHT + TIME. Log validation updates messages accordingly.
- Exercise card header shows "X sets · 30–60s" for time exercises.
- Today session list, history session summary, and DaySessionSheet display
  per-set values in the right format ("1: 45s", "1: × 12", "1: 50 lb × 30s").
- Ad-hoc workout modal lets you log a plank or carry by switching to the
  appropriate inputs based on the picked exercise's metric.

## v0.51.2 — 2026-05-25

- Post-workout / day summaries now mark skipped sets clearly. Sets with
  setType:'skip' render as "N: Skipped" instead of showing the prefilled
  weight × reps (which was misleading since those values were never actually
  performed). Affects the history session page and the day session sheet.

## v0.51.1 — 2026-05-25

- Fix: skipped sets no longer count toward the "X / Y logged" counter on the
  exercise card. The counter now shows only sets that were actually logged
  (e.g. "3 / 4 logged" when one was skipped). The green Done badge still
  appears once every set is dealt with — logged or skipped — so the exercise
  card visually marks itself complete without inflating the logged count.

## v0.51.0 — 2026-05-25

- Today: Log Workout button labels shortened to "Start Workout" /
  "Continue Workout" / "Ad-Hoc Workout". The two buttons now use a 3:2 grid
  split so the workout button gets the room it needs and Log Cardio
  proportionally less.
- Skip a single set, mid-workout.
- The active set row now has a small "Skip this set" link in the bottom-right.
  Tapping it marks that set with setType:'skip' (a new SetType value),
  completes it so the workout advances to the next set, and shows a SKIP
  badge in place of the set number on the locked row.
- Use case: you decide you only want to do the last set of an exercise —
  skip your way to it without leaving the workout flow.

## v0.50.0 — 2026-05-25

- The FATRAT mascot logo is now the app's visual identity.
- Login screen: the typographic FATRAT wordmark is replaced by the logo image
  (the wordmark is baked into the mark itself).
- The logo is now the favicon, the iOS apple-touch icon, and the PWA manifest
  icon — so "Add to Home Screen" on a phone uses the mascot. A web app
  manifest (app/manifest.webmanifest) and a matching theme color were added
  so installed instances look like a real app.
- File renamed from "fatrat logo.png" (with space) to "fatrat-logo.png" for
  clean URLs.

## v0.49.1 — 2026-05-25

- Today: the workout-action card is renamed "Log Workout" and its two buttons
  sit side by side (flex-1, with wrapped text so the longer labels don't
  overflow).

## v0.49.0 — 2026-05-25

- Today page restructured around a richer Quick card.
- Quick moved up to just below the Streak card and now holds two buttons:
  the primary workout action and Log Cardio. The workout action adapts to
  state — "Start Today's Workout" on a fresh scheduled day, "Continue Today's
  Workout" once a set has been logged, or "Start Ad-Hoc Workout" on rest days
  and after the day's session is finished. The ad-hoc button opens
  AdHocWorkoutModal, which merges into today's session if one already exists.
- The session card no longer carries its own Start/Continue button — it's
  display-only now, keeping the Week N Day N header, mesocycle name, date,
  the ✓ Done badge when finished, and the exercise list.

## v0.48.0 — 2026-05-25

- Custom templates can now be modified.
- The template detail page shows a Modify button for any template you saved
  (template.isCustom). It opens the wizard pre-loaded with the template and,
  on save, writes back to the same template id instead of creating a duplicate.
- The save sheet retitles to "Save changes" in modify mode; activating the
  modified plan still archives the current active program as before.
- Library (non-custom) templates are unchanged — Use This Template only.

## v0.47.1 — 2026-05-25

- Spacing tweak in the wizard's Week Layout step: the Volume per Week card
  now has a top margin so it sits a bit below the last day card instead of
  butting right up against it.

## v0.47.0 — 2026-05-25

- Rest between sets is now a wizard choice.
- The final step is now "Starting weights, reps & rest" and has a pill
  selector for rest time (30s / 45s / 60s / 90s / 2 min / 3 min / 4 min /
  5 min, default 2 min).
- The workout rest timer auto-starts with the user-chosen value. If unset
  (older programs / templates), it falls back to the phase + movement default
  as before.
- The choice is stored on the mesocycle and on saved templates, so reopening
  a template restores its rest setting.

## v0.46.0 — 2026-05-25

- Soreness check-ins and pump/volume/pain feedback are now gated to
  Periodization workouts only. Traditional programs run start-to-finish
  without those prompts.
- The check-in feeds the periodization model's volume adjustments and the
  pump/volume/pain ratings feed deload and progression decisions — neither
  applies to a Traditional program, so the questions just got in the way.

## v0.45.0 — 2026-05-25

- Core controls are back in the wizard for Upper/Lower and PPL.
- The Core card (Days/week + Exercises/day) was previously only shown for
  Full Body and Body Part Emphasis; on Upper/Lower and PPL, core was silently
  scheduled on lower/leg days with one slot and no way to adjust.
- It now shows for every workout type, and Upper/Lower and PPL layouts honor
  the chosen Days/week and Exercises/day — core lands on the first N training
  days with the chosen slot count, and can be moved via long-press or removed
  via the pill x.
- Picking a workout type seeds sensible core defaults: Upper/Lower defaults to
  half the training days x 1 slot; PPL defaults to a third x 1 slot; Full Body
  and Body Part Emphasis still default to every day x 2 slots.

## v0.44.0 — 2026-05-25

- A sets-per-exercise cap in the template wizard.
- The volume model sets a weekly hard-set target per muscle, then splits it
  across that muscle's exercises. On splits where a muscle gets only one
  exercise per day, that single movement absorbed the whole share — e.g. 7
  sets of Deadlift. The Volume per Week card now has a "Max sets per exercise"
  stepper (default 4) that caps any single exercise's prescription.
- The Volume per Week table reflects the cap, so the numbers shown are what
  the plan actually prescribes.

## v0.43.0 — 2026-05-25

- Week Layout step refinements in the template wizard.
- The Volume per Week card now sits at the bottom of the step, below the day
  list — the editable day-by-day layout comes first.
- Modify and long-press-to-move now work on every workout type, not just Body
  Part Emphasis — Full Body, Upper/Lower, and Push/Pull/Legs days can be
  rearranged the same way.
- Each muscle pill in the day list has an × that removes that muscle from the
  day on a short press; long-press still arms a move.

## v0.42.0 — 2026-05-25

- Group 4b pass 3 — the day-start set-style override, completing Group 4.
- When a workout opens with supersets, pyramids, or drop sets, a banner offers
  a one-tap switch to plain straight sets for that day — and back again. It is
  available until the first set is logged, then locks in.
- Switching to straight sets un-pairs supersets, removes the drop-set rows,
  and flattens pyramid steps; the prescribed styles are snapshotted on the
  session so "Use prescribed styles" restores them exactly. It only affects
  that day's session — the program and template are untouched.

## v0.41.0 — 2026-05-25

- Group 4b pass 2 — pyramids and drop sets.
- Pyramid exercises generate with stepped sets — weight climbs set to set
  while reps come down — and the auto-nudge is skipped so the steps hold.
- Drop-set exercises get a lighter AMRAP drop appended after the last working
  set; it shows in the logging screen as an indented "DROP" row.
- Exercise cards show a Pyramid / Drop sets tag.
- Next: the day-start override (swap a day to straight sets).

## v0.40.0 — 2026-05-25

- Group 4b pass 1 — supersets in the workout-logging screen.
- Program generation pairs consecutive superset-tagged exercises into superset
  groups (new ExerciseEntry.supersetGroup).
- The workout screen renders a superset pair inside a labelled "Superset"
  block, and logging alternates between the two exercises (A1, B1, A2, B2 …)
  instead of finishing one then the other. The rest timer is skipped between
  the two exercises of a round and runs after the round instead.
- Next passes: pyramids + drop sets, then the day-start override.

## v0.39.0 — 2026-05-25

- Group 4a — set-style data model and wizard capture.
- New SetStyle type (straight / superset / drop / pyramid) and an ExerciseEntry
  setStyle field; mesocycles now record a preferred set style and per-muscle
  superset/drop designations.
- Template Wizard, Prioritize muscles step: for Push/Pull/Legs and Upper/Lower
  a "Set styles" card was added — a preferred set style picker (Traditional
  plans) and per-muscle Superset / Drop set designations (both program
  styles). Full Body has no set styles.
- Program generation tags every exercise with a set style: a per-muscle
  designation wins, otherwise the preferred style for Traditional plans
  (straight for Periodization).
- Note: this captures and records set styles. The workout-logging rebuild
  that actually drives supersets, pyramids, and drop sets — plus the variety
  sprinkle and the day-start override — is the next pass (Group 4b).

## v0.38.0 — 2026-05-25

- Group 3 of the program-style work — Full Body opt-out and circuits.
- Full Body's "Prioritize muscles" step is now a muscle opt-out list: every
  muscle is included by default; tap one to leave it out of the plan. The
  layout and volume skip excluded muscles. (Applies to Full Body in both
  program styles.)
- Traditional Full Body is now a circuit. The Workout step gains a Circuit
  style choice — Classic Circuit (full rest) or Speed Circuit (short rest,
  conditioning) — and the Week layout step gains a "Circuit rounds" control
  for how many times you go through the circuit. Each exercise is generated
  with one set per round, and the per-week volume table is replaced by the
  rounds control.
- Periodization Full Body is unchanged (steady maintenance volume, no
  circuit).

## v0.37.0 — 2026-05-25

- Group 2 of the program-style work: periodization vocabulary is now confined
  to Periodization plans. A Traditional plan is generated without the
  periodization model — no RIR targets on its weeks or exercises, no deload
  week, and weekly volume held steady instead of ramping toward a ceiling.
  Its mesocycle records a linear progression scheme and a 'traditional'
  programStyle.
- Because the underlying data no longer carries RIR/deload, the week
  calendars, the workout screen, and the Plan screen automatically stop
  showing effort/intensity labels for Traditional plans.
- The wizard's "Volume per week" table drops the deload (DL) column for
  Traditional plans and relabels the volume as steady each week.
- "Hypertrophy" phase wording is hidden for Traditional plans on the block
  page, the template detail page, and the templates list.
- Group 1 tweaks: Workout name is back at the top of the Workout step, and
  the Traditional description now reads "Build a multi-week program designed
  around your goals using traditional progressions and set types."

## v0.36.0 — 2026-05-25

- Template Wizard, Workout step: added a "Program style" question as the
  first choice — Traditional program vs Periodization training. The
  workout-type list adapts: Traditional offers Full Body, Upper / Lower,
  and Push / Pull / Legs; Periodization keeps all four (including Body Part
  Emphasis). Switching to Traditional off an Emphasis selection falls back
  to Full Body.
- This is the first step of a larger change to confine mesocycle/RIR/deload
  language to periodization-based plans. Following steps: dropping that
  vocabulary from Traditional plans, Full Body circuits, and set-style
  options.

## v0.35.0 — 2026-05-25

- Equipment options gained three combinations — Bodyweight + bands,
  Bodyweight + kettlebells, and Bodyweight + dumbbells — available in the
  Template Wizard and onboarding.
- Template Wizard, Starting weights step: band exercises no longer take a
  starting weight — the weight box now reads "Band", and band exercises are
  generated without a prescribed weight.
- Exercise library: added push-up variations (wide, military, diamond,
  decline, archer) and pull-up variations (wide-grip, neutral-grip,
  commando, archer, negative) — all bodyweight.
- Exercise Library screen: each exercise row now has a hide (eye) button
  next to the favorite star, so an exercise can be hidden or unhidden
  without opening the manage sheet.

## v0.34.2 — 2026-05-25

- Fixed the wizard assigning barbell/dumbbell exercises to a bodyweight-only
  plan. The exercise library had no bodyweight options for shoulders, biceps,
  forearms, or calves, so exercise assignment fell back to any same-muscle
  exercise regardless of equipment. Added bodyweight exercises for all four
  (pike push-up, wall handstand push-up, inverted curl, doorway curl, dead
  hang, towel hang, bodyweight calf raise, single-leg calf raise) — every
  Full Body muscle now has a bodyweight option.

## v0.34.1 — 2026-05-25

- Template Wizard: the Equipment picker moved from the Frequency step to the
  Workout step, alongside the workout name and type.

## v0.34.0 — 2026-05-25

- Template Wizard: "Workout" is now its own first step — the workout name
  (first) and the workout-type picker — ahead of a separate "Frequency" step
  (weeks, days, start day, equipment). The wizard is now six steps.
- Full Body plans now include the Core card, so core days/week and
  exercises/day are configurable like any other type (fullBodyLayout takes
  the core settings). Upper/Lower and PPL still place core automatically.
- Workout screen: the soreness check-in is skipped for any muscle group on
  the Maintenance tier — its volume isn't auto-adjusted, so the question
  added nothing. (Full Body plans are all-maintenance, so they ask no
  soreness questions.)
- Templates page: the first card is now a "Create Custom Template" button
  that opens the wizard to build a plan from scratch.

## v0.33.0 — 2026-05-25

- The workout type now drives how the wizard builds a plan, fixing the bug
  where Full Body plans had their muscle groups spread apart. New pure module
  lib/program/structuredLayout.ts with three type-specific layout generators:
  - Full Body — every muscle group plus core on every training day, at
    maintenance volume. Muscle groups intentionally repeat on consecutive
    days (no spreading).
  - Upper / Lower — training days alternate an upper-body day (chest, back,
    shoulders, biceps, triceps, forearms) and a lower-body day (quads,
    hamstrings, glutes, calves); core on lower days.
  - Push / Pull / Legs — training days cycle Push (chest, shoulders,
    triceps), Pull (back, biceps, forearms), Legs (lower body + core).
- Body Part Emphasis is unchanged — it keeps the tier system, the
  emphasis/core cards, day-spacing, and the Modify / long-press-move editing.
- Wizard step changes by type: Full Body skips the "Prioritize muscles" step
  (an info card explains it). Upper/Lower and PPL show the tier picker as a
  lighter volume nudge (emphasize = an extra exercise on the muscle's day) —
  the day structure itself is fixed by the type. For the three structured
  types the emphasis/core cards and the Modify / drag editing are hidden;
  day cards are labelled Full Body / Upper / Lower / Push / Pull / Legs.
- Per-exercise starting weights and rep ranges (the wizard's final step)
  remain available for every workout type.

## v0.32.0 — 2026-05-25

- Template Wizard, Frequency step: added a "Workout type" question at the top
  with four choices — Body Part Emphasis (the current behaviour, default),
  Full Body, Upper / Lower Split, and Push / Pull / Legs. The choice is
  recorded on the generated program's microcycles and on saved templates
  (via splitType), and is restored when a template is re-loaded into the
  wizard.
- This is the first step of the workout-type work: the question is captured
  and tracked. The plan-building logic still uses the Body Part Emphasis
  structure for every type; specialising the structure for Full Body,
  Upper/Lower, and PPL is the next piece.

## v0.31.0 — 2026-05-25

- Template detail page: added a "Use This Template" button. If a plan is
  already active, it first confirms the switch; then it opens the Template
  Wizard pre-loaded with the template — its weeks, days, muscle tiers,
  per-day exercises, and rep ranges — so the user can review, customize, or
  refine every step.
- From there the wizard's existing save options apply: activate it now
  (replacing the current plan), save it as a personal template (keeping the
  current plan), or cancel. The old in-page tier-picker shortcut is replaced
  by this fuller wizard flow.
- TemplateWizard gained an optional initialTemplate prop and reports which
  save path was taken so callers can route appropriately.

## v0.30.1 — 2026-05-25

- Plan screen: added "Plan Templates" and "Exercise Library" buttons side by
  side at the bottom, linking to the templates browser and the exercise
  library.

## v0.30.0 — 2026-05-25

- Template Wizard, Week layout step: added a "Work Days" card at the top. It
  shows a one-row calendar of the training week (work vs rest days) and, below
  it, a tappable row to choose which days are rest. Changing a rest day
  updates the calendar row live.
- The number of training days stays fixed at the days/week chosen in step 1
  (2-7 work days, so 0-5 rest days). Marking a new rest day frees up the
  oldest one to keep the count. The plan's start day is always kept as a work
  day and cannot be marked rest.
- The Week layout day list now includes rest-day cards interleaved with the
  work-day cards, in week order; work-day cards are labelled with their
  weekday.
- Program generation places each training day on the chosen work weekday
  (new CustomProgramInput.workOffsets) instead of an automatic spread.

## v0.29.0 — 2026-05-25

- Settings: added a CALENDAR section with a "week starts on" choice —
  Monday (default), Sunday, or Saturday. It controls how every week calendar
  (History and Plan) is laid out; it is display-only and does not change when
  workouts are scheduled.
- WeekCalendar now renders its 7 columns starting on the chosen weekday
  instead of always Sunday — headers, day cells, dates, and the "this week"
  range all follow the setting. A microcycle whose days do not all fall in a
  single calendar week may span across the grid; that is expected.
- This is the display half of the week-start work; the plan-scheduling half
  (the wizard "Start day" picker) shipped in v0.28.0.

## v0.28.0 — 2026-05-25

- Template Wizard, Frequency step: added a "Start day" picker (Mon-Sun,
  defaulting to Monday). The generated plan's week 1 begins on the next
  occurrence of the chosen weekday on or after today; the step shows the
  resolved start date. Previously a plan always started the day it was built.
- Note: this is the scheduling half of the week-start work. Flipping the
  calendar display to Monday-first is a separate follow-up — the WeekCalendar
  currently models a microcycle as a Sunday-Saturday week.

## v0.27.0 — 2026-05-24

- Template Wizard: each step now scrolls back to the top when you move to it
  (forward or back), instead of keeping the previous step's scroll position.
- Template Wizard, Prioritize muscles step: each muscle row gained a small
  "N/A" button before Maintain. Marking a muscle N/A excludes it from the
  plan entirely — it gets no training days and is dropped from the week
  layout and the volume table. The three tiers (Maintain/Grow/Emphasize)
  still default to Grow.

## v0.26.0 — 2026-05-24

- Template Wizard, Week layout step: muscles can now be moved between days
  with a long-press. Press and hold a muscle pill to pick it up — every
  other day card highlights with a dashed outline as a drop target (empty
  rest days included) — then tap a day to move that muscle there. All of the
  muscle's slots on the source day move together.
- While a move is armed, a banner names the muscle being moved and offers
  Cancel; tapping the source day or its lifted pill also cancels. A move is
  a manual edit, so it sticks until an upstream change refreshes the layout.
  The Modify sheet still handles adding and removing muscles.

## v0.25.1 — 2026-05-24

- Template Wizard: the Core card's Days/week picker now goes down to 0, so
  core can be left out of a plan entirely. At 0 days no core work is added
  and the Core row drops out of the "Volume per week" table.

## v0.25.0 — 2026-05-24

- Template Wizard: Core is no longer one of the tiered muscle groups. It is
  removed from the "Prioritize muscles" step (no Maintain/Grow/Emphasize
  choice) and instead gets its own card in the "Week layout" step, sitting
  just below the Emphasis muscles card.
- The Core card has a Days/week and an Exercises/day picker, just like an
  emphasis muscle. It defaults to training every day with 2 exercises per
  day. Core is placed last on each of its training days.
- Core runs on its own track in the layout generator (TemplateLayoutInput.core)
  rather than through the tier system, and consecutive core days no longer
  trip the "back-to-back training days" warning since daily core is
  intentional. Core still appears in the "Volume per week" table.

## v0.24.0 — 2026-05-24

- Template Wizard: training-block length now goes up to 8 weeks (was 6).
- Template Wizard: the week-count and days-per-week pickers show just the
  number — the "weeks"/"days" suffix is dropped from each box since the
  question above already says which is which.
- New "Starting weights" step (the wizard's fifth and final step). For every
  exercise in the plan it shows a starting weight and a rep range, each
  editable. Values are suggested automatically: from the user's own logged
  history of that lift when it exists, otherwise estimated from their profile
  (experience tier, sex, bodyweight, the trained muscle, and equipment).
- The chosen weights seed week 1's sessions; rep ranges are now per-exercise
  (inferred from movement pattern — compound/isolation — when not set) rather
  than a fixed 8-12 for every lift. Custom templates carry the per-exercise
  rep ranges too.
- New pure module lib/program/startingWeights.ts (suggestStartingWeight,
  defaultRepRange).
- Note: this covers the custom Template Wizard. Editing starting weights on an
  already-active plan, and prompting for them when starting a pre-built
  library template, are follow-up work.

## v0.23.1 — 2026-05-24

- Fixed the Today screen showing "No Session" while the Plan screen showed an
  in-progress training plan (e.g. "Week 3 of 5"). The demo seed hard-coded
  which week was active; on a Sunday — after that week's Tue/Thu/Sat sessions
  were all in the past — the active week had no sessions left, so Today fell
  through to the empty state. The seed now derives the active week from the
  session dates: the active microcycle is the first week still holding a
  session dated today or later, so Today and Plan always agree.

## v0.23.0 — 2026-05-24

- Terminology is now its own setting, separate from mode. All three modes
  (Beginner/Intermediate/Advanced) default to plain language; INTERMEDIATE and
  ADVANCED users can opt into advanced terminology — RIR/RPE, MEV/MAV/MRV
  volume landmarks, and mesocycle/microcycle naming.
- Onboarding keeps the three-mode picker. When an INTERMEDIATE or ADVANCED
  mode is chosen, a follow-up question offers Plain language vs Advanced
  terminology (defaulting to plain).
- Settings gained a Terminology toggle (shown for INTERMEDIATE/ADVANCED
  users) so the choice can be changed anytime.
- New `terminologyMode` helper drives effort labels, the volume dashboard,
  week-intensity labels, RIR targets, the progression chart, and the block
  recap — a user on plain language never sees jargon, even in Advanced mode.
- Reverts the v0.22.0 two-mode collapse: the Beginner/Intermediate/Advanced
  modes are all retained.

## v0.22.0 — 2026-05-24

- Retired the "macrocycle" concept from the interface. The app now speaks in
  terms of a single "Training Plan" — the macrocycle still exists internally
  as a wrapper but is no longer surfaced to users.
- The Plan screen's current-plan card was simplified: it shows "Current
  Training Plan" with the plan name, the current week, and the current day
  (e.g. "Week 2 of 4 · Day 3 of 5"), plus a single, unambiguous "Change"
  button. The Change button opens one sheet to explore the current plan,
  switch to another program, or build a custom one.
- This replaces the v0.21.0 two-row card (separate "plan" and "block" names
  with their own sheets), which leaned on the macrocycle/mesocycle split.

## v0.21.0 — 2026-05-23

- The Plan screen's current-plan card was restructured into two labelled,
  clickable rows: "Current Training Plan" (the macrocycle name) and
  "Current Block" (the mesocycle name + Week n of n). Each name is now a
  button.
- Tapping the plan name opens a sheet to explore it, switch to another
  program, or build a custom plan. Tapping the block name opens a sheet to
  explore the block, start a different block, or build a custom one.
- This replaces the single ambiguous "Change" button (which prompted
  "Change program" without saying whether it meant the block or the plan).
  Both sheets now spell out that changing starts a fresh program — the old
  plan is archived, not deleted — since a plan runs one block at a time.

## v0.20.0 — 2026-05-23

- The exercise library is now personalizable per user. On the Exercises
  screen you can star favorites, hide exercises you'll never do, and the
  list filters by All / Favorites / Custom / Hidden. Tapping an exercise
  opens a manage sheet (favorite, hide, view history, and — for custom
  exercises — edit and delete).
- Custom exercises gained edit + delete (previously add-only) and richer
  fields: secondary muscles and movement patterns, not just primary muscle
  and equipment.
- Favorites and hidden now flow into program building. The Template Wizard,
  library-template generation, and the in-workout swap picker all prefer
  favorited exercises and skip hidden ones (a hidden exercise is only kept
  if there is genuinely no usable replacement).
- The built-in global library expanded from 54 to 115 exercises — broader
  coverage across every muscle (including neck) and equipment type
  (kettlebell, band, and smith-machine variants added).
- New per-user data: UserExercisePrefs (favorites + hidden), with repository
  support (getExercisePrefs / upsertExercisePrefs / deleteUserExercise) and
  a pure `personalizeLibrary` helper.

## v0.19.0 — 2026-05-23

- Template Wizard: each emphasized muscle now has an "Exercises / day"
  stepper alongside its "Days / week" stepper, in the renamed "Emphasis
  muscles" card. You can give a priority muscle 2 or 3 separate exercises on
  each day it is trained (default 2, range 1–3) — the layout, volume ramp,
  and exercise assignment all follow the chosen slot count.
- The layout generator takes a per-muscle exercises/day override
  (`emphasisSlotsPerDay`); `slotsPerDay` stays the default fallback.

## v0.18.3 — 2026-05-23

- Fixed the progression chart showing nothing but today. The chart code was
  correct — the local data store simply held no earlier sessions. The store
  version was bumped (v3 to v4), which re-seeds the demo data on next load
  with its full multi-block training history (two prior blocks of completed
  sessions). The chart now has months of real history to plot.
- Note: bumping the store version resets locally saved data — any programs
  generated or workouts logged during testing are replaced by the fresh
  demo seed.

## v0.18.2 — 2026-05-23

- Reworked the progression chart range as a plain date filter instead of
  block-based scoping, which kept failing to surface earlier training. The
  selector now offers Past 30 Days, Past 60 Days, Past 90 Days, Past Year,
  and All Time (the default), filtering the chart purely by session date —
  every logged session in the window is plotted regardless of which block
  it belonged to.

## v0.18.1 — 2026-05-23

- Fixed the progression chart's "Current and Last Block" range showing no
  earlier data. The "last block" was resolved from macrocycle metadata,
  which could point at a block with no logged sessions — so the range added
  nothing. Block order is now derived from the logged sessions themselves
  (each block by its latest session date), so "last block" always means the
  most recent earlier block that actually has training in it.

## v0.18.0 — 2026-05-23

- The History progression chart can now span more than one training block.
  A new range selector sits in the chart's filter row with three choices:
  "Current Block", "Current and Last Block" (the default), and "All Blocks".
  The block immediately before the one in view counts as the "last block".
  The exercise picker and the chart both follow the selected range, so a
  lift you only trained in an earlier block is still selectable and plotted.
  The Block dropdown and week calendar above are unaffected — they still
  show the single selected block.

## v0.17.1 — 2026-05-23

- Fixed the History "Block" dropdown listing more than one block as
  "current". The Template Wizard's "Make it active now" was archiving the
  old macrocycle but leaving its mesocycle marked active, so an old block
  kept its "current" tag. Activating a program now archives the old
  mesocycles too, and History resolves the single current block through the
  active macrocycle rather than trusting status alone.
- The History / Plan week calendar now reliably opens on the week that
  contains today. Sessions load a beat after the calendar mounts, so it was
  sometimes left showing Week 1; it now snaps to the current week once the
  data arrives, until you page to another week yourself.

## v0.17.0 — 2026-05-23

- Post-session feedback now uses plain-language scales instead of 0–5:
  Joint pain — None / Low / Moderate / High; Pump — Low / Moderate /
  Amazing; Volume — Not enough / Just right / Pushed limits / Too much.
- Feedback is now collected per muscle group, right after you finish that
  muscle's last set, rather than all at once at the end. Any muscle you
  skip during the workout is gathered in a single check-in when you tap
  Finish; if every muscle was already answered, finishing is immediate.
- The post-workout summary and the day's history sheet now show each
  muscle's feedback inline, in the same card as that exercise's weight and
  reps — the separate feedback block is gone.
- Program templates now carry per-muscle volume tiers. Custom templates
  keep the tiers they were built with; when you start a library template a
  "Prioritize muscles" picker opens, pre-filled by inferring each muscle's
  tier from your recent training history, so a restarted or library program
  is tier-aware for the soreness auto-adjust.

## v0.16.0 — 2026-05-23

- Soreness auto-adjust is now tier-aware. The volume change a "never got
  sore" reading triggers depends on how the muscle is prioritised in your
  program: an EMPHASIZE muscle adds two sets, a GROW muscle adds one, and a
  MAINTAIN muscle holds — adding volume to a muscle you only mean to maintain
  defeats the point, so its check-in closes quietly like the healthy
  ratings. "Still sore" still eases a set back (or skips the muscle) on any
  tier — recovery comes first regardless of priority.
- The Template Wizard now records each muscle's tier on the mesocycle
  (`muscleTiers`), so the workout knows whether a muscle is being emphasised,
  grown, or maintained. Programs created before this (or not from the wizard)
  have no tiers and fall back to GROW behaviour — the same single-set
  adjustment as before.

## v0.15.0 — 2026-05-23

- Soreness now auto-adjusts your volume — not just next week's, but the
  rest of the current week. When the soreness check-in opens at the first
  exercise for a previously trained muscle, your answer drives a change:
  "Never got sore" offers to add a set this week (recovered easily — room
  for more); "Still sore" offers to drop a set this week or skip that
  muscle today. "Healed a while ago" and "Healed just on time" hold steady.
  The chosen change is applied to today's session and rippled to every
  remaining incomplete session for that muscle in the current microcycle —
  piggy-backing on the same volume logic the post-session feedback
  ("Grinding" / "Failed") already uses.
- New pure module `lib/periodization/adjustFromSoreness.ts` maps a
  soreness rating to an add / hold / reduce suggestion.

## v0.14.0 — 2026-05-23

- New soreness tracker (template_notes Page 2, collect phase). During a
  workout, when you reach the first exercise for a muscle you have trained
  before, a check-in asks how sore it got from the previous session — Never
  got sore / Healed a while ago / Healed just on time / Still sore. The
  rating is stored on the session and shown under a "Recovery" section in
  the day's history. Using soreness to auto-adjust next week's volume is the
  next build.

## v0.13.0 — 2026-05-23

- Custom templates now sort to the top of Browse templates, are tagged
  "CUSTOM", and show their creator in the title — e.g. "Summer Bod, by Brian".

## v0.12.0 — 2026-05-23

- Template Wizard can now be saved. The final step's "Save" opens a choice:
  "Make it active now" generates the full program — a macrocycle, mesocycle,
  a microcycle per week and a session per training day, with the volume ramp
  baked into per-week set counts and exercises rotated week to week — and
  switches your plan to it (the old program is archived). "Save as a template"
  stores it so it appears under Browse templates to start later.
- The repository now stores custom templates (`upsertTemplate`); `generateProgram`
  honours multi-week templates so a saved custom template keeps its volume ramp
  when started again.

## v0.11.0 — 2026-05-23

- Template Wizard restructured into four steps: Frequency, Prioritize
  muscles, Week layout, and Week 1 exercises. The layout step shows the
  muscle plan; confirming and swapping exercises is now its own final step.
- Exercise assignment now rotates through each muscle's available exercises,
  so the pick varies every time the muscle is worked — slot to slot and day
  to day — with reuse spaced out. (Week-to-week variation is supported by the
  generator and lands with the save flow.)

## v0.10.0 — 2026-05-23

- Template Wizard: added an Equipment dropdown to the Setup step, defaulted
  to your profile equipment. Change it for this block and exercise
  assignment + swapping use that choice.
- Fixed emphasis-frequency defaults so they no longer pile every emphasized
  muscle onto the same day. The week's training days are now shared across
  the emphasized muscles (e.g. 3 muscles on a 5-day week default to 2/2/1
  days rather than 3/3/3), so they land on different days. Still adjustable
  with the per-muscle steppers.

## v0.9.0 — 2026-05-23

- Template Wizard now assigns a real exercise to every muscle slot, picked
  from the library and filtered to the user's available equipment. Tap any
  exercise in the preview to swap it for another that trains the same muscle.
- The preview gained a "Volume per week" table: target hard sets per muscle,
  ramping from MEV in week 1 toward each muscle's ceiling (MRV for emphasis,
  MAV for grow), with a deload in the final week.
- New pure module `lib/program/templateProgram.ts` (exercise assignment +
  volume ramp). Saving the template as a usable program is the next step.

## v0.8.0 — 2026-05-23

- Fixed the "no back-to-back days" rule. The layout generator now evaluates
  every possible set of training days for each muscle and treats avoiding
  consecutive days as a hard priority over spreading muscles apart — so two
  emphasized muscles will share a day rather than be forced onto back-to-back
  days.
- Template Wizard: when two or more muscles are emphasized, a "Start the week
  with" selector chooses which leads the week.
- Template Wizard: if a muscle's frequency genuinely cannot be spaced out at
  the chosen week length, a warning names the affected muscles and offers an
  "Add a training day" action (and the emphasis-frequency steppers can lower
  a muscle's days/week).

## v0.7.0 — 2026-05-23

- Template Wizard: added a template name field, and the proposed week is
  now tunable — each emphasized muscle has a days/week stepper, and every
  day has a "Modify" button that opens a per-day editor (add or remove
  muscle slots).
- Layout generator now follows the structuring rules: a muscle is never
  trained on back-to-back days where the frequency allows; emphasis
  muscles are spread onto different days from each other; and emphasis
  frequency is size-aware — bigger muscles (chest, back, quads, hamstrings,
  glutes) train fewer days/week than smaller ones, all overridable.
- Plan screen: the Current Plan card now has a "Change" button that opens
  a Browse templates / Create custom template menu. The separate "Change
  program" card has been removed (folded into that menu).

## v0.6.0 — 2026-05-23

- New Template Wizard (Plan screen → "Template Wizard", next to "Browse
  templates"). A three-step creator: pick training frequency (weeks +
  days/week), sort each muscle into Maintain / Grow / Emphasize (max 3
  emphasized), then preview an auto-generated training week. Emphasis
  muscles are trained most often, placed first in the week and first in
  each day, with two exercise slots per training day.
- Layout-first v1 — exercise assignment and the per-week MV→MRV volume
  ramp are follow-up steps. The Page 2 soreness tracker comes later.

## v0.5.0 — 2026-05-23

- The app version now shows discreetly below the FATRAT wordmark in the
  in-app header, on every screen.
- The Plan screen's "Add to this day" menu now offers the full ad-hoc
  workout logger ("Log a workout") in place of the old "coming soon"
  placeholder — matching the History screen.

## v0.4.0 — 2026-05-23

- Calendar: "today" is now marked with a red circle around the day number
  instead of recolouring the whole cell — so today still shows whether it is
  a completed, scheduled, or rest day. The legend lists "Today" first.
- Plan screen now uses the horizontal week calendar. In place of the ‹ ›
  arrows it has a chevron toggle (below the calendar, above the legend) that
  expands the single week into the whole plan — every week stacked, still
  horizontal. Each week's effort level sits to the left of its row.
- Calendar legend extracted into one shared component used by both the
  History and Plan screens.

## v0.3.0 — 2026-05-23

- History calendar redesigned: replaced the full-block grid with a
  horizontal one-week view (Sun–Sat) and ‹ › arrows to page between weeks.
- The week's effort level now shows next to "Week n of n" in a distinct
  mono font (e.g. "Hard", or "2 RIR" in ADVANCED mode).
- Every day in the calendar is now clickable. Empty days open an
  "Add to this day" menu; logged days open the session detail, which now
  also has an "Add cardio or a workout to this day" action.
- New ad-hoc workout logger: log a full strength workout on any day —
  search the exercise library, add exercises, and log weight/reps per set.
  Replaces the old "coming soon" placeholder.

## v0.2.0 — 2026-05-23

- Added a login screen (`/login`) with a "Sign in with Google" button.
  UI-only for now — it enters the app with the seeded demo user; real
  Firebase auth can be wired in later.
- The app version is displayed discreetly beneath the FATRAT wordmark on
  the login screen.
- Introduced version tracking: `lib/version.ts` is the single source of
  truth, and this changelog records every change going forward.
- Root route (`/`) now lands on the login screen instead of `/today`.

## v0.1.0 — baseline

- Initial FATRAT build (periodization engine, Today / Plan / History /
  Exercises / Profile screens, onboarding wizard, mock data layer).
  Recorded as the baseline before version tracking began.
