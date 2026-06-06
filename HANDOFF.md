# FATRAT — Project Handoff

_Last updated: 2026-06-05 (app v0.67.4)_

Paste this file (or point the new chat at it) to bring a fresh session up to speed.

---

## 1. What this is

**FATRAT** is a strength-training web app. The original brief was an opinionated
periodized-training planner; over development it has grown into a broader
workout app where periodized training is one option alongside ad-hoc single
workouts. It plans programs, runs daily workouts, logs sets, and tracks
progress over time.

**Live in production:**
- Hosted on Vercel — `https://fatrat-pi.vercel.app`
- Backed by Firebase Auth (Google sign-in) + Firestore
- Custom domain `fatrat.app` is purchased at GoDaddy (DNS work pending; see §11)

The original build brief, **`FATRAT Initial Build Specification.md`**, is in
the project root. Reference screenshots live in `screenshots/`. Brian's
muscle-group volume guide is at **`Optimal Exercises per Muscle Group.txt`**
in the root — relevant to the upcoming wizard rebuild (§10A).

---

## 2. Location & the file-write corruption problem

- **Project root:** `C:\Users\brian\_fatratapp`
- **App code:** `C:\Users\brian\_fatratapp\app`

### File-write corruption — STILL ACTIVE, workaround is mandatory

The Edit/Write tools corrupt files anywhere under `C:\Users\brian\_fatratapp` —
truncating them mid-file, mangling JSX/TSX, or appending garbage/null bytes.
`tsc` reports the damage as `TS1127 Invalid character`, `TS1002 Unterminated
string literal`, or `TS17008 JSX element has no closing tag`.

This is **constant**. Hit it dozens of times in the v0.61 → v0.67 work.
Treat the Edit and Write tools as unreliable in this project.

**Workaround — use bash heredocs for all writes:**

    cat > /sessions/<session>/mnt/_fatratapp/path/to/file <<'XEOF'
    ...full file contents...
    XEOF

The quoted delimiter preserves backticks, `$`, and template literals.

- To **recover** a corrupted file: prefer `git show HEAD:path/to/file` to
  recover the pristine version (the Read tool sometimes returns the
  on-disk truncated state, not the intended content). Then rewrite via
  heredoc.
- After any work, **verify**: run `npx tsc --noEmit` from `app/`.
- When `head -N` + heredoc to append, double-check you cut at the right
  line — off-by-one drops needed code. Always inspect the join with
  `sed -n` before moving on.

---

## 3. Tech stack

- **Next.js 14.2.5**, App Router, `'use client'` components
- **TypeScript** (strict mode)
- **Tailwind CSS 3.4** — themed via CSS custom properties (`--color-*` as RGB
  triplets, so Tailwind alpha modifiers like `bg-accent/10` work)
- **Firebase 11** — Auth (Google sign-in) + Firestore web SDK
- **Vitest** for unit tests (domain logic in `lib/`)
- Runtime deps beyond React/Next: `clsx`, `firebase`

### Data repository pattern

`lib/firestore/repository.ts` defines the `DataRepository` interface. Two
implementations swap behind it:

- `firestoreRepository.ts` — used when `NEXT_PUBLIC_FIREBASE_*` env vars are
  present (production + any environment with a `.env.local`).
- `mock.ts` — in-memory + localStorage-backed (key `fatrat:mock:v5`, bumped
  in v0.61 for the post-Macrocycle data model). Useful for offline tinkering.

`lib/firebase/client.ts` exposes `isFirebaseEnabled()` and `getFirebaseAuth()`.

---

## 4. Project structure

```
app/
  (main)/                  route group — the signed-in app
    today/                 daily workout screen (+ workout/ logger sub-route)
    plan/                  current plan dashboard
       meso/[mesoId]/      week-by-week schedule for an active block
       day/[sessionId]/    a programmed day's preview (incl. Edit-set mode)
       templates/          landing page → programs/ or workouts/ sub-routes
    history/               calendar + week-sessions list + progression charts
       session/[id]/       post-workout summary (incl. Edit-set mode)
    exercises/             exercise library (personalizable per user)
    profile/  settings/
  login/                   Google sign-in screen
  onboarding/              setup wizard (NO auto-plan generation as of v0.64.2)
components/
  app/        AppShell, BottomNav, ThemeProvider, UserProvider, UpdateToast
  charts/     Sparkline, VolumeBars, VolumeTrafficLights
  history/    WeekCalendar (paged/expandable, supports calendar-week mode),
              CalendarLegend, DaySessionSheet
  onboarding/ OnboardingWizard.tsx
  plan/       TemplateWizard, SingleWorkoutWizard, ChangePlanSheet,
              VolumeDashboard
  settings/   ModeSwitchDialog
  today/      StreakCard, BodyWeightCheckIn, WorkoutPicker, CardioLogModal
  ui/         InlineNumber, ChoiceCard, Button, Card, ... (cn, kgToDisplay)
  workout/    SetLoggerRow, ExerciseCard, EffortPicker, RestTimer,
              ExerciseTimer, EditableSetTable, AdHocWorkoutModal,
              SessionFeedbackModal, SorenessCheckIn, SwapExerciseModal,
              ExerciseHistorySheet
lib/
  firebase/       client.ts — initialization + isFirebaseEnabled()
  firestore/      repo interface + mock + Firestore impl + seed data
                  migrations/ — runtime one-shot migrations (dropMacrocycle,
                                relabelSessionsToDays)
  periodization/  core domain math — e1rm, volume, rpe, deload, progression,
                  mode, terminology, modeDiff, adjustFromSoreness/Feedback,
                  rest, effortShort
  program/        program generation (generate), template-program builder,
                  mesoToTemplate (Edit-this-plan), startingWeights,
                  templateLayout, structuredLayout, inferTiers,
                  recommendTemplate
  progress/       series, streaks, personal bests, meso recap
  session/        resolveToday (returns todaySessions[]), advance,
                  hydrateFromHistory, nextSetNudge, cleanupArchived
  exercise/       personalize.ts (favorites/hidden)
  ui/             cn, beep (double-beep helper), date, feedback, units
  export/         index.ts
  version.ts      APP_VERSION (kept in sync with package.json + CHANGELOG)
types/            exercise, periodization, profile, session, template
public/           fatrat-logo2.png, fatrat-rat.png, PWA icons, manifest
scripts/          one-off migration scripts (e.g. exercise library seeding)
firestore.rules   security rules (root of repo, not under app/)
```

### Domain model — POST-MACROCYCLE (v0.61+)

`Mesocycle → Microcycle → WorkoutSession`

- **Macrocycle is gone** (retired v0.61). What used to live on a macro
  (name, goal, startDate, targetDate) lives on `Mesocycle` directly. The
  meso IS the user's "Training Plan."
- Sessions can be **ad-hoc** (no `microcycleId` / `mesocycleId`) or
  **programmed** (both set). Sessions carry a denormalized `planName`
  (mesocycle.name) and an optional `restSeconds` for ad-hoc / single-
  workout sessions that have no meso.
- `WorkoutSession.name` is set on ad-hoc sessions so Today can display the
  workout's name without chasing IDs. Programmed sessions inherit display
  info from their meso/micro.
- Cardio-only sessions: `exercises.length === 0 && cardio.length > 0`.
  Today renders them as "CARDIO" cards; the post-workout summary header
  reads "Cardio done!" instead of "Workout done!".
- Multiple sessions per day are supported (v0.63.0). A pending session and
  a completed session can coexist on the same date. `listSessionsOnDate`
  returns them all. Save flows only reuse an existing session's id when
  that session is still incomplete — completed sessions never get
  overwritten.

### Template kinds — two distinct things

Templates have a `kind: 'program' | 'workout'` discriminator.

- **`program`** — multi-week plan with periodization knobs. Becomes the
  user's active program when started; runs through `TemplateWizard`.
  Activate-flow also saves the program back as a custom template
  ("Summer Workout, by Brian") so the user can find it in Browse
  templates later.
- **`workout`** — one-shot routine. Runs through `SingleWorkoutWizard`.
  Picked from Today's Ad-Hoc picker, materialized into an unattached
  `WorkoutSession` (sets pre-filled from `repsLow`/`timeLow`/
  `startingWeightKg`; `restSeconds` carried on the session), then logged
  via `/today/workout`.

### Modes & terminology — two independent axes

- **Mode** (`profile.mode: BASIC | INTERMEDIATE | ADVANCED`) controls feature
  *depth*. Onboarding keeps a 3-card picker; experience + periodization
  questions recommend one.
- **Terminology** (`profile.advancedTerminology?: boolean`) is a *separate*
  opt-in for jargon — RIR/RPE numbers, MEV/MAV/MRV, mesocycle/microcycle
  naming. Defaults to plain language for all modes. INTERMEDIATE/ADVANCED
  can opt in; BASIC users are never asked.
- `lib/periodization/terminology.ts` exposes `usesAdvancedTerminology(user)`,
  `terminologyMode(user)`, `isPeriodizedSession(session, meso)`, and
  `effortShort(mode, rpe)` — all single source of truth, used everywhere.

### ExerciseMetric system

Not every exercise is weight × reps. `ExerciseDefinition.metric` is one of:

- `weight-reps` (bench, squat, curl) — default when omitted
- `reps` (push-ups — pure bodyweight)
- `time` (plank, dead hang, wall sit)
- `weight-time` (loaded carries)

`SetEntry` carries `weightKg?`, `reps?`, `timeSec?` per metric. The logging
UI, summary cards, prescription templates, and chart series all branch on
the exercise's metric.

**Live-def-metric override** (v0.64.2): `ExerciseCard` prefers the live
exercise definition's `metric` over the saved `exercise.metric` on the
session. Protects against stale denormalized data when the library evolves
(e.g. Reverse Fly that was once 'reps' is now 'weight-reps').

---

## 5. Commands

Run from `C:\Users\brian\_fatratapp\app`:

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Typecheck (all source) | `npx tsc --noEmit` |
| Unit tests | `npm test` (vitest) |

`tsconfig.check.json` exists as a scoped fallback if root `tsc` ever gets
slow. **Current status: typecheck clean (EXIT 0) at v0.67.4.**

> Sandbox note: `npm test` (vitest) may fail *inside the Linux shell sandbox*
> — `node_modules` was installed on Windows and rollup's native binary is
> platform-specific. Tests run fine on Brian's Windows machine. Verification
> in-session relies on `npx tsc --noEmit`. To run vitest in a sandbox, run
> `npm install` there first.

---

## 6. Critical gotcha — CSS cascade layers

`app/globals.css` defines `.card` as an **unlayered** CSS rule. Tailwind
utilities live in `@layer utilities`, and **unlayered CSS beats layered
utilities** — so a plain `border-accent` on a `.card` element is silently
overridden by `.card`'s own `border`.

**Fix pattern:** use Tailwind's `!` important prefix — e.g.
`!border-accent !bg-accent/10` (already done on `ChoiceCard`'s selected state).
Watch for this whenever a `.card`-based component needs a custom border /
background / shadow.

---

## 7. Versioning & shipping

Every change bumps the app version and adds a `CHANGELOG.md` entry. Keep three
files in sync: `lib/version.ts` (`APP_VERSION`), the `"version"` field in
`package.json`, and `app/CHANGELOG.md` (newest entry on top). Semver — patch
for tweaks/fixes, minor for new features/screens, major for a finished release.

**Current version: 0.67.4.**

After version bump + typecheck, Brian deploys via:

    cd C:\Users\brian\_fatratapp; git status; git add .; git commit -m "vX.Y.Z — summary"; git push

Vercel auto-deploys from `main`. The Update Toast polls `/api/version` so the
user sees a "new version" prompt without hard-refresh.

---

## 8. Firestore layout (current, post v0.62)

```
exercises/                        ← global library, read-only for users
  ab-wheel-rollout, bench-press, ...

users/{uid}/                      ← profile doc (name, units, mode, prefs,
                                    soundsEnabled, migratedMacroDrop,
                                    migratedSessionsToDays)
  ├ bodyWeight/{2026-05-31}       ← weight entries, doc id = ISO date
  ├ mesocycles/{id}               ← training plan — owns name/goal/startDate
  │                                 (Macrocycle was retired in v0.61)
  ├ microcycles/{id}              ← a single week
  ├ days/{id}                     ← a day's workout — formerly `sessions/`
  │   fields: date, dayOfWeek, name, planName (denormalized),
  │           mesocycleId, microcycleId  (both set = programmed; none = ad-hoc),
  │           exercises[{ name, metric, sets[{weight, reps, timeSec, rpe, ...}] }],
  │           cardio[],
  │           restSeconds (single-workout / ad-hoc only)
  ├ customExercises/{id}
  ├ templates/{id}                ← user-saved program OR workout templates
  └ exercisePrefs/main            ← favorites + hidden, single doc
```

**One-shot runtime migrations** (run on sign-in, idempotent via profile flags):
- `migrateMacrocyclesForUser` — folds old `macrocycles/*` data onto mesos,
  strips `macrocycleId` from sessions. Gated by `profile.migratedMacroDrop`.
- `migrateSessionsToDaysForUser` — copies `sessions/*` to `days/*` with
  `planName` filled. Gated by `profile.migratedSessionsToDays`.
- `cleanupArchivedPendingSessions` — sweeps uncompleted sessions tied to
  archived mesos. Runs on every History page load (idempotent). Cleans up
  orphan pending sessions from plans cancelled before v0.60.

The old `macrocycles` and `sessions` subcollections are left orphan in
Firestore for cancelled users' data — delete manually in the console once
you've confirmed each user has migrated.

**Scale check:** at 10 users × 1 year × ~300 sessions/user = ~3,000 day docs
total. Free Firestore tier handles this with ~5% utilization. The only
read-cost weakness is the progression chart's `listSessions(limit: 1000)`
call. Not urgent.

---

## 9. Recent work (v0.61 → v0.67.4, condensed)

The detail is in `app/CHANGELOG.md`. The big arcs since the last handoff:

### B-audit (v0.60.10 → v0.62.0)

- **v0.60.10** — B1: confined periodization vocab to periodized sessions.
  New `isPeriodizedSession(session, meso)` gate. RIR readout hidden unless
  ADVANCED. `effortShort` consolidated.
- **v0.61.0** — B2: retired Macrocycle from types, repo, generators, seed,
  and every caller. New repo surface: `getActivePlan(userId)`,
  `listMesocycles(userId)`. One-shot Firestore migration.
- **v0.62.0** — B3: renamed `sessions` subcollection → `days`. Denormalized
  `planName` onto each day doc. One-shot Firestore migration.

### Edit-this-plan flow (v0.62.1 → v0.62.3)

- New "Edit this plan" button on the Change Plan sheet (both /plan and
  /plan/meso/[id]). Opens TemplateWizard pre-populated with the current
  meso's name/goal/weeks/days/split/tiers/set styles/rest, and pulls
  per-exercise `startingWeightKg` from each session's first set.

### UX / wiring fixes (v0.62.4 → v0.65.2)

- Core skipped from feedback prompts. Reps +/- on the set logger was
  double-firing on mobile (touchstart + synthetic mousedown) — fixed with
  pointer events. Easy weeks (RIR ≥ 2) hold weight steady regardless of
  set feel.
- "Make it active" in TemplateWizard ALSO saves the program as a custom
  template (so user can find "Summer Workout, by Brian" in Browse later).
- InlineNumber editor floats above the row at smart-expand width (anchors
  to whichever side has more room) with a visible Done button. Replaces
  the 160% centered expansion that went off-screen.
- Today supports multiple sessions per day. `resolveToday.todaySessions`
  returns all of them. Picker / AdHoc / Cardio save flows never overwrite
  a completed session — they create a new doc.
- INTERMEDIATE effort picker renamed Smooth/Solid/Tough/Grinding/Failed →
  Easy/Solid/Tough/Hard/Failed.
- Plan + History session detail pages render set bodies metric-aware
  (reps-only shows `× N`, time shows `Xs`, weight-time shows `kg × Ns`).
- Web Audio double-beep helper + `profile.soundsEnabled` setting. Rest
  timer beeps; new `ExerciseTimer` overlay for time-based sets with ±10s
  and Done.
- Edit-set mode on `/history/session/[id]` and `/plan/day/[id]`. Shared
  `EditableSetTable` component. Skipped sets stay marked Skipped. Plan
  day renders the skipped icon as a red ✕ (not green ✓).

### Today / Plan / History redesign (v0.66 → v0.67.4)

- **v0.66.0** — Skip-ahead: pull a future scheduled workout into today.
  Today card + Plan day detail page both surface the action.
- **v0.66.1** — Pull-ahead lookup expanded from "next pending in active
  micro" to "next pending in any micro" (then re-tightened in v0.67.0 to
  active meso only).
- **v0.66.2** — Today renders cardio-only sessions as "CARDIO" (not
  "AD-HOC WORKOUT") with the cardio list. Every session card got an
  explicit Open button.
- **v0.66.3** — History calendar overlays completed sessions from other
  blocks (cancelled plans) onto the displayed week.
- **v0.66.4** — Single-workout templates pre-fill reps/time on materialized
  sets; `WorkoutSession.restSeconds` carries the rest setting so the timer
  fires for ad-hoc sessions.
- **v0.67.0 → v0.67.4** — History redesigned around the user's full
  timeline:
  - Block dropdown defaults to "All blocks (by date)".
  - All-blocks mode buckets sessions by *calendar* week (Mon-Sun), so
    multiple blocks overlapping the same calendar week merge into one row.
  - `WeekCalendar` gained a `calendarWeeks` prop (date-organized mode),
    a `blockNameByWeek` map (shown in the week header), and an
    `onViewWeekChange` callback.
  - `cleanupArchivedPendingSessions` sweep runs on History load to delete
    orphan pending sessions from cancelled plans.
  - "Week Sessions" collapsible card sits between the calendar and the
    progression chart. Always shows the in-view week's sessions; each
    session row collapses individually to reveal exercise/cardio details.
    "Open" link routes to the full post-workout summary.
  - Today's UP NEXT / pull-into-today card is gated on having an active
    plan AND restricts the search to the active meso (so archived plans
    can't surface a stale workout).

### Onboarding (v0.64.2)

- New users no longer get an auto-generated starter program. Onboarding
  saves the profile and lands them on Today with no active plan. The
  user picks a template (or builds one) when ready.

---

## 10. Upcoming work

### A) Rebuild the wizard for a better outcome — **NEXT TASK**

Brian wants to redesign the program/workout wizard. The current
`TemplateWizard` and `SingleWorkoutWizard` (under `components/plan/`) have
grown organically and aren't producing the outcome he wants. Specific
direction will come at the start of the new chat — **prompt Brian for the
problem statement before touching code**.

Likely scope to think about while reading the existing code:
- TemplateWizard: multi-step flow (program style → workout type → days →
  emphasis → muscle layout → starting weights → save). Lots of state,
  lots of toggles. Volume controls are derived from `volumeRamp` + tiers.
- The `Optimal Exercises per Muscle Group.txt` doc in the root codifies
  per-tier exercise count caps + 10–20 sets/week heuristics. The current
  generator doesn't consult it — likely a piece of this rebuild.
- SingleWorkoutWizard is its own flow but shares some primitives.
- Edit-this-plan (v0.62.1+) opens TemplateWizard pre-populated from a live
  meso via `mesocycleToTemplate`. Any redesign needs to preserve this
  entry point.
- `generateCustomProgram` (templateProgram.ts) and `generateProgram`
  (generate.ts) are the two materialization paths. Both create sessions
  pre-filled with reps/weight/RIR.

**Don't refactor blindly.** Audit the existing wizard files first, then
ask Brian what specifically he wants different about the outcome.

### B) Performance analytics (still on the back burner)

Brian wants real data analytics over completed blocks — "what worked,
what didn't" analysis on past training. Two tiers based on mode:

- **Advanced users:** Stimulus-to-Fatigue Ratio (SFR) per exercise.
- **Basic / Intermediate users:** the same insight in plain language.

Open questions before building:
- Does SFR need a research pass (math from the literature)?
- What's the UI surface — a new "Insights" tab? A post-block review?
  Annotations on the existing Progression chart?
- What's the minimum data needed for the calc, and do current sessions
  capture it?

After the wizard rebuild lands.

---

## 11. Pending deployment chores (low priority)

- **Custom domain `fatrat.app`** — purchased at GoDaddy. Not yet:
  - added to Vercel project's Domains
  - DNS configured at GoDaddy (A `@ → 76.76.21.21`, CNAME `www → cname.vercel-dns.com`)
  - added to Firebase Auth authorized domains
  App runs fine at `fatrat-pi.vercel.app` in the meantime.

- **Global exercises Firestore migration** — `firestoreRepository.listGlobalExercises`
  currently falls back to the in-code `GLOBAL_EXERCISES` seed because Brian's
  Workspace (brianratcliff.com) blocks service-account key creation, which
  blocked the migration script. The fallback is fine; revisit if the
  organization policy changes or Brian moves to a personal Google account.

- **`GLOBAL_TEMPLATES` also still ships in code**, not Firestore. Same
  reason. `listTemplates` merges code-defined globals with user-saved
  templates from Firestore.

- **Orphan Firestore collections** — `users/{uid}/macrocycles/*` and
  `users/{uid}/sessions/*` are inert post-migration but still take space.
  Delete via console once you're confident every active user has migrated.

---

## 12. How Brian likes to work

- Iterative, one focused UI/UX change at a time.
- Wants to be **prompted after each completed section** before moving on.
  For larger redesigns (like the wizard rebuild), audit first and ask
  direction before cutting.
- Precise about wording/typography (font size, color, hierarchy) — read
  requests literally and match them exactly.
- Bash heredocs for all file writes — see §2. Edit/Write are unreliable.
- Always run `npx tsc --noEmit` after a change. Always bump the version
  and add a changelog entry. Always end the response with the push command
  block — Brian copies it directly:

      cd C:\Users\brian\_fatratapp; git status; git add .; git commit -m "vX.Y.Z — summary"; git push

- Don't write extensive postambles after sharing a file/PR; Brian can read
  the diff. Two or three sentences max — outcome + caveat.
- Don't be sycophantic. Acknowledge mistakes briefly, fix them, move on.
- When a screenshot shows something unexpected, treat it as authoritative
  over your reasoning about the code path. Trace the actual data flow that
  produced what the screenshot shows.
