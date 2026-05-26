# Changelog

All notable changes to FATRAT are recorded here, newest first.
Versions follow [semver](https://semver.org/): MAJOR.MINOR.PATCH —
patch for tweaks/fixes, minor for new features/screens, major for a
finished release.

The current version also lives in `lib/version.ts` (`APP_VERSION`) and
in `package.json`; all three are kept in sync on every change.

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
