# FATRAT — Project Handoff

_Last updated: 2026-05-31 (app v0.60.9)_

Paste this file (or point the new chat at it) to bring a fresh session up to speed.

---

## 1. What this is

**FATRAT** is a strength-training web app. The original brief was an opinionated
periodized-training planner; over development it has grown into a broader
workout app where periodized training is one option alongside ad-hoc single
workouts. It plans programs, runs daily workouts, logs sets, and tracks
progress over time.

**Live in production** as of v0.55.0+:
- Hosted on Vercel — `https://fatrat-pi.vercel.app`
- Backed by Firebase Auth (Google sign-in) + Firestore
- Custom domain `fatrat.app` is purchased at GoDaddy (DNS work pending; see §11)

The original build brief, **`FATRAT Initial Build Specification.md`**, is in
the project root. Reference screenshots live in `screenshots/`. Brian's
muscle-group volume guide for an upcoming refactor is at
**`Optimal Exercises per Muscle Group.txt`** in the root.

---

## 2. Location & the file-write corruption problem

- **Project root:** `C:\Users\brian\_fatratapp`
- **App code:** `C:\Users\brian\_fatratapp\app`

### File-write corruption — STILL ACTIVE, workaround is mandatory

The Edit/Write tools corrupt files anywhere under `C:\Users\brian\_fatratapp` —
truncating them mid-file, mangling JSX/TSX, or appending garbage/null bytes.
`tsc` reports the damage as `TS1127 Invalid character`, `TS1002 Unterminated
string literal`, or `TS17008 JSX element has no closing tag`.

This is **not** rare. Confirmed again 2026-05-31 — three sequential Edits on
`WeekCalendar.tsx` produced TS1127 errors at the end of the file, requiring a
full rewrite. Treat the Edit and Write tools as unreliable in this project.

**Workaround — use bash heredocs for all writes:**

    cat > /sessions/<session>/mnt/_fatratapp/path/to/file <<'XEOF'
    ...full file contents...
    XEOF

The quoted delimiter preserves backticks, `$`, and template literals. Bash
writes via the workspace mount are reliable.

- To **recover** a corrupted file: use the Read tool (it still returns the
  intact intended content even when the on-disk file is truncated), then
  rewrite the whole file via heredoc.
- After any work, **verify**: run `npx tsc --noEmit` from `app/`.

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
  present (i.e. production and any environment with a `.env.local`).
- `mock.ts` — in-memory + localStorage-backed (key `fatrat:mock:v4`), used when
  Firebase is not configured. Still useful for offline tinkering.

`lib/firebase/client.ts` exposes `isFirebaseEnabled()` and `getFirebaseAuth()`.

---

## 4. Project structure

```
app/
  (main)/                  route group — the signed-in app
    today/                 daily workout screen (+ workout/ logger sub-route)
    plan/                  current plan dashboard
       meso/[mesoId]/      week-by-week schedule for an active block
       day/[sessionId]/    a programmed day's preview
       templates/          landing page → programs/ or workouts/ sub-routes
    history/               calendar + progression charts + exercise history
    exercises/             exercise library (personalizable per user)
    profile/  settings/
  login/                   Google sign-in screen
  onboarding/              setup wizard
components/
  app/        AppShell, BottomNav, ThemeProvider, UserProvider, UpdateToast
  charts/     Sparkline, VolumeBars, VolumeTrafficLights
  history/    WeekCalendar, CalendarLegend, DaySessionSheet
  onboarding/ OnboardingWizard.tsx
  plan/       TemplateWizard, SingleWorkoutWizard, ChangePlanSheet, ...
  settings/  today/  ui/  workout/
lib/
  firebase/       client.ts — initialization + isFirebaseEnabled()
  firestore/      repo interface + mock + Firestore impl + seed data
  periodization/  core domain math — e1rm, volume, rpe, deload, progression,
                  mode, terminology, modeDiff, adjustFromSoreness/Feedback
                  (NOTE: half of this only applies to periodized plans —
                   see §10 cleanup task)
  program/        program generation, template layout, tier inference
  progress/       series, streaks, personal bests, meso recap
  session/        resolveToday, advance, hydrateFromHistory
  exercise/       personalize.ts (favorites/hidden)
  export/  ui/    (cn.ts, date.ts, units.ts, feedback.ts)
  version.ts      APP_VERSION (kept in sync with package.json + CHANGELOG)
types/            exercise, periodization, profile, session, template
public/           fatrat-logo2.png, fatrat-rat.png, PWA icons, manifest
scripts/          one-off migration scripts (e.g. exercise library seeding)
firestore.rules   security rules (root of repo, not under app/)
```

### Domain model

`Macrocycle → Mesocycle → Microcycle → WorkoutSession`

- A macrocycle holds exactly **one** mesocycle (1:1 — created together).
- The word "macrocycle" was retired from the UI back in v0.22.0; everything
  the user sees is a **"Training Plan."** `macro.name` is the plan name;
  `meso.name` is the training block; `micro.weekNumber` is the week.
- **However, macrocycle as a concept has effectively been eliminated** — it's
  vestigial. Removing the data-model relic is one of the cleanup tasks in §10.
- Sessions can be **ad-hoc** (no `microcycleId`/`mesocycleId`/`macrocycleId`)
  or **programmed** (all three IDs set). `WorkoutSession.name` is set on
  ad-hoc sessions so Today can display the workout's name without chasing
  IDs. Programmed sessions inherit display info from their meso/micro.

### Template kinds — two distinct things

Templates have a `kind: 'program' | 'workout'` discriminator.

- **`program`** — multi-week plan with periodization knobs. Becomes the
  user's active program when started; runs through `TemplateWizard`.
- **`workout`** — one-shot routine. Runs through `SingleWorkoutWizard`.
  Picked from Today's Ad-Hoc picker, materialized into an unattached
  `WorkoutSession`, then logged via `/today/workout`.

### Modes & terminology — two independent axes

- **Mode** (`profile.mode: BASIC | INTERMEDIATE | ADVANCED`) controls feature
  *depth*. Onboarding keeps a 3-card picker; experience + periodization
  questions recommend one.
- **Terminology** (`profile.advancedTerminology?: boolean`) is a *separate*
  opt-in for jargon — RIR/RPE numbers, MEV/MAV/MRV, mesocycle/microcycle
  naming. Defaults to plain language for all modes. INTERMEDIATE/ADVANCED
  can opt in; BASIC users are never asked.
- `lib/periodization/terminology.ts` exposes `usesAdvancedTerminology(user)`
  and `terminologyMode(user)`. UI surfaces are fed `terminologyMode(user)`
  rather than the raw mode.

### ExerciseMetric system

Not every exercise is weight × reps. `ExerciseDefinition.metric` is one of:

- `weight-reps` (bench, squat, curl)
- `reps` (pull-ups, push-ups, dips — bodyweight to failure)
- `time` (plank, dead hang, wall sit)
- `weight-time` (loaded carries)

`SetEntry` carries `weightKg?`, `reps?`, `timeSec?` per metric. The logging
UI, summary cards, prescription templates, and chart series all branch on
the exercise's metric.

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
slow. **Current status: typecheck clean (EXIT 0) at v0.60.9.**

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

**Current version: 0.60.9.**

After version bump + typecheck, Brian deploys via:

    cd C:\Users\brian\_fatratapp; git status; git add .; git commit -m "vX.Y.Z — summary"; git push

Vercel auto-deploys from `main`. The Update Toast (added v0.55.x) polls
`/api/version` so the user sees a "new version" prompt without hard-refresh.

---

## 8. Firestore layout (current)

```
exercises/                        ← global library, read-only for users
  ab-wheel-rollout, bench-press, ...

users/{uid}/                      ← profile doc (name, units, mode, prefs)
  ├ bodyWeight/{2026-05-31}       ← weight entries, doc id = ISO date
  ├ macrocycles/{id}              ← "Training Plan" (vestigial wrapper, 1:1 with meso)
  ├ mesocycles/{id}               ← training block (e.g. "5/3/1 Block 1")
  ├ microcycles/{id}              ← a single week
  ├ sessions/{id}                 ← a day's workout — entire thing in one doc
  │   fields: date, dayOfWeek, name,
  │           macrocycleId, mesocycleId, microcycleId  (all 3 = programmed; none = ad-hoc),
  │           exercises[{ name, sets[{weight, reps, rpe, ...}] }],
  │           cardio[]
  ├ customExercises/{id}
  ├ templates/{id}                ← user-saved program OR workout templates
  └ exercisePrefs/main            ← favorites + hidden, single doc
```

**Scale check (informational, not blocking):** at 10 users × 1 year × ~300
sessions/user = ~3,000 session docs total. Free Firestore tier (50K
reads/day, 20K writes/day) handles this with ~5% utilization. The only
read-cost weakness is the progression chart's `listSessions(limit: 1000)`
call — fine until any single user crosses ~3 years of history, after which
pagination or pre-aggregated stats become worth the work. Not urgent.

**Navigability is a known pain point** — every doc ID is a random slug, so
the Firestore console is unbrowsable. See §10.

---

## 9. Recent work (v0.56 → v0.60.9, condensed)

The detail is in `app/CHANGELOG.md`. Highlights since the live launch:

- **v0.56** — Single Workout template kind landed end-to-end (wizard, picker,
  Today integration). Templates page restructured: landing → programs / workouts.
- **v0.57** — Big exercise-library expansion from a TRX-style chart, all with
  dumbbell/bodyweight variants. ExerciseMetric system completed (time / reps /
  weight-time alongside weight-reps).
- **v0.58** — Picked workouts now run through `/today/workout` (not the old
  ad-hoc modal) — full logging experience identical to a programmed day.
- **v0.59** — Fixes from the live deployment: Firestore composite-index trap
  in `listSessionsInMicrocycle`, week-calendar default-week selection (was
  picking last instead of first week with sessions on fresh programs), ad-hoc
  sessions being mis-attached to the active program, settings ACCOUNT card
  refresh, removed "Reset demo data."
- **v0.60** — Plan management: Restart from a new date (delta-shifts every
  workout), Reschedule missed days, Cancel plan, Cancel-and-switch. New
  `ChangePlanSheet` shared by /plan and the meso detail page. Open button on
  Today's programmed session card. `deleteSession` added to repo so cancel
  cleans up pending sessions. History was leaking archived blocks as
  "current" — fixed via `currentMesoId` resolution chain + `isCurrent` prop
  on `WeekCalendar`.
- **v0.60.6–9** — History calendar polish for archived blocks: no future
  "Lift" cells, no "This week" badge, archived weeks default to Week 1, and
  for weeks entirely in the future of an archived block the "Week N of N"
  header swaps to **"No Active Plan"** while the grid still renders (all
  off-day tiles) so the user sees a real off-day calendar.

---

## 10. Upcoming work — read these before starting the next session

### A) Block design refinement (next thing Brian wants to tackle)

Brian uploaded **`Optimal Exercises per Muscle Group.txt`** to the project
root. It codifies how many exercises per muscle group per week different
experience levels should run, plus large/small muscle splits and the 10–20
sets-per-week hypertrophy heuristic.

The current block / program generator does not consult these rules. Read the
doc first, then audit `lib/program/templateProgram.ts` (and the wizard's
volume controls) to figure out where the rules should plug in. Likely
touches:

- Exercise count caps per muscle group, scaled by user mode (Basic /
  Intermediate / Advanced)
- Different handling for "small" vs "large" muscle groups
- Frequency-aware splitting (twice/week → 5–10 sets/session, etc.)

Expect this to be a multi-step effort — wizard UX changes plus generator
math plus possibly new template defaults. **Prompt Brian for direction after
auditing; don't refactor blindly.**

### B) Codebase clarity audit — three sub-tasks

These are interrelated. Brian wants a sweep.

**B1 — Confine periodization vocabulary to periodized plans only.**

The app was originally designed around periodization; periodization later
became one option inside a broader workout app. Today, periodization concepts
(RIR, RPE, mesocycle, microcycle, deload, MEV/MAV/MRV, target intensity by
week) leak into surfaces that have nothing to do with periodized plans —
ad-hoc workouts, single-workout sessions, Today copy, settings, History.

The fix is **language-only** for many places (rename "mesocycle" → "block",
strip RIR from non-periodization contexts) and **gating** for others (don't
ask for RIR after an ad-hoc workout). `lib/periodization/terminology.ts`
already encodes this distinction for users; the cleanup is to apply the same
gate to *plans/sessions* — if a session has no microcycleId, skip all
periodization prompts and copy.

Files to audit: `lib/periodization/`, `lib/program/`, `components/today/`,
`components/workout/`, `components/history/`, `app/(main)/today/page.tsx`,
post-workout summary, soreness prompts.

**B2 — Finish retiring `Macrocycle`.**

v0.22.0 removed "macrocycle" from the UI but left the data model intact —
every plan still has an invisible macro wrapper with a 1:1 meso. This is now
dead weight that confuses Firestore browsing, makes resolveToday more
complex than necessary, and confuses any future maintainer.

The cleanup:
- Promote `Macrocycle` fields needed by the UI (name, status, startDate)
  onto `Mesocycle` directly.
- Drop the `macrocycles` Firestore collection. Migration script needed for
  existing users (Brian + family).
- Remove `macrocycleId` from `WorkoutSession`. Sessions reference meso/micro
  only.
- Simplify `getActiveMacrocycle` → `getActivePlan` (returns the active meso).
- Update `ChangePlanSheet`, `resolveToday`, History page, Plan page.

This is a structural refactor, not a rename. Plan it, then execute in one
focused session.

**B3 — Make Firestore data navigable.**

Currently every doc ID under `users/{uid}/` is a random slug
(`mac-abc123`, `meso-xyz789`, `session-q0w9e8`). Browsing the Firestore
console to debug a real user is nearly impossible.

Two paths discussed with Brian (see chat history if needed):

1. **Cheap relabel** — rename `sessions` → `days`; denormalize `planName`
   onto each day doc so each row is self-describing.
2. **Date-keyed paths** — move to `users/{uid}/days/{2026-05-31}/...`.
   Cleaner browsing; requires a migration and a refactor of the repository.

Brian hasn't picked. Get a decision before doing the work. Both options
fold naturally into B2 (retiring macrocycle), so consider doing all three
in one stroke.

### C) Performance analytics (a bigger upcoming feature)

Brian wants real data analytics over completed blocks — "what worked, what
didn't" analysis on past training. Two tiers based on mode:

- **Advanced users:** Stimulus-to-Fatigue Ratio (SFR) per exercise — how
  much hypertrophic/strength stimulus a movement delivers relative to the
  fatigue cost. Requires reasoning over volume load, RPE trajectory across
  sessions, and recovery (could lean on the existing soreness prompts).
- **Basic / Intermediate users:** the same insight delivered in plain
  language — "X exercise gave you steady progress with manageable effort;
  Y exercise made you sore for two days every time and your lifts stalled."

Open questions before building:
- Does SFR need a research pass (math from the literature)?
- What's the UI surface — a new "Insights" tab? A post-block review screen?
  Annotations on the existing Progression chart?
- What's the minimum data needed for the calc, and do current sessions
  capture it? (Soreness data is currently periodization-only — see B1.)

This is **last** in priority — finish A and B first.

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

---

## 12. How Brian likes to work

- Iterative, one focused UI/UX change at a time.
- Wants to be **prompted after each completed section** before moving on.
- Precise about wording/typography (font size, color, hierarchy) — read
  requests literally and match them exactly.
- Bash heredocs for all file writes — see §2.
- Always run `npx tsc --noEmit` after a change. Always bump the version
  and add a changelog entry. Always end the response with the push command
  block — Brian copies it directly:

      cd C:\Users\brian\_fatratapp; git status; git add .; git commit -m "vX.Y.Z — summary"; git push

- Don't write extensive postambles after sharing a file/PR; Brian can read
  the diff.
- Don't be sycophantic. Acknowledge mistakes briefly, fix them, move on.
