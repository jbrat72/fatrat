# FATRAT — Project Handoff

_Last updated: 2026-05-24 (app v0.23.0)_

Paste this file (or point the new chat at it) to bring a fresh session up to speed.

---

## 1. What this is

**FATRAT** is a strength-training web app. It plans periodized training programs,
guides the user through daily workouts, logs sets, and tracks progress over time.
The build is in active, iterative development — UI/UX is being refined screen by screen.

The original build brief, **`FATRAT Initial Build Specification.md`**, is in the
project root alongside this file. Reference screenshots are in `screenshots/`.

---

## 2. Location & the file-write corruption problem

- **Project root:** `C:\Users\brian\_fatratapp`
- **App code:** `C:\Users\brian\_fatratapp\app`

### File-write corruption — ACTIVE, workaround is mandatory

The Edit/Write tools corrupt files anywhere under `C:\Users\brian\_fatratapp` —
truncating them mid-file or appending garbage/null bytes. `tsc` reports the
damage as `TS1127 Invalid character`, `TS1002 Unterminated string literal`, or
`TS17008 JSX element has no closing tag`.

This is **not** rare. Confirmed 2026-05-24: a session that made ~40 Edit-tool
calls corrupted **every one of the 18 files it touched**. Treat the Edit tool as
unreliable in this project.

**Workaround — use bash heredocs for all writes:**

    cat > path/to/file <<'XEOF'
    ...full file contents...
    XEOF

The quoted delimiter preserves backticks, `$`, and template literals. Bash
writes to the mount are reliable.

- To **recover** a corrupted file: use the Read tool (it still returns the
  intact intended content even when the on-disk file is truncated), then
  rewrite the whole file via heredoc.
- After any work, **verify**: run the typecheck, and for non-code files
  (`.md`, `.json`) check byte count + tail since typecheck won't catch those.
- A null-byte sweep: `tr -cd '\0' < file | wc -c` (expect 0).

---

## 3. Tech stack

- **Next.js 14.2.5**, App Router, `'use client'` components
- **TypeScript** (strict mode)
- **Tailwind CSS 3.4** — themed via CSS custom properties (`--color-*` as RGB
  triplets, so Tailwind alpha modifiers like `bg-accent/10` work)
- **Data layer:** in-memory mock "Firestore" repository (`lib/firestore/`). No
  real backend. Seed data in `lib/firestore/seed/`. Persisted to localStorage
  under key `fatrat:mock:v4`.
- **Vitest** for unit tests (domain logic in `lib/`)
- Only runtime dep beyond React/Next is `clsx`.

---

## 4. Project structure

```
app/
  (main)/            route group — the signed-in app
    today/           daily workout screen
    plan/            program overview, meso/day/recap/templates sub-routes
    history/         calendar + progression charts
    exercises/       exercise library (personalizable per user)
    profile/  settings/
  onboarding/        setup wizard route
components/
  app/        AppShell, BottomNav, ThemeProvider, UserProvider, DemoUserPicker
  charts/     Sparkline, VolumeBars, VolumeTrafficLights
  history/    WeekCalendar, CalendarLegend, DaySessionSheet
  onboarding/ OnboardingWizard.tsx
  plan/  settings/  today/  ui/  workout/
lib/
  firestore/      mock repo + client + seed data (exercises, templates, users)
  periodization/  core domain math — e1rm, volume, rpe, deload, progression,
                  mode, terminology, modeDiff, adjustFromSoreness/Feedback
  program/        program generation, template layout, tier inference
  progress/       series, streaks, personal bests, meso recap
  session/        resolveToday, advance, hydrateFromHistory
  exercise/       personalize.ts (favorites/hidden)
  export/  ui/    (cn.ts, date.ts, units.ts, feedback.ts)
types/            exercise, periodization, profile, session, template
```

### Domain model (periodization hierarchy)

`Macrocycle → Mesocycle → Microcycle → WorkoutSession`

- A macrocycle holds exactly **one** mesocycle (1:1 — created together).
- **As of v0.22.0 the word "macrocycle" is retired from the UI.** The
  macrocycle still exists in the data model as an invisible wrapper, but
  everything the user sees calls it a **"Training Plan."** `macro.name` is the
  plan name; `meso.name` is the training block; `micro.weekNumber` is the week.
- The Plan screen's current-plan card shows: **"Current Training Plan"**, the
  plan name, and `Week n of n · Day d of D`, with a single **Change** button.

### Modes & terminology — two independent axes

- **Mode** (`profile.mode`: `BASIC | INTERMEDIATE | ADVANCED`) controls feature
  *depth*. Onboarding keeps the original 3-card picker; the experience +
  periodization questions recommend one.
- **Terminology** (`profile.advancedTerminology?: boolean`) is a *separate*
  opt-in for jargon — RIR/RPE numbers, MEV/MAV/MRV, mesocycle/microcycle
  naming. All three modes **default to plain language**. INTERMEDIATE/ADVANCED
  users can opt in (asked in onboarding, toggleable in Settings). BASIC users
  are never asked and always stay plain.
- `lib/periodization/terminology.ts` exposes `usesAdvancedTerminology(user)`
  and `terminologyMode(user)`. UI surfaces that render vocabulary are fed
  `terminologyMode(user)` rather than the raw mode, so an Advanced-mode user on
  plain language keeps every Advanced feature but sees no jargon.

---

## 5. Commands

Run from `C:\Users\brian\_fatratapp\app`:

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Typecheck (all source) | `npx tsc --noEmit --project tsconfig.check.json` |
| Unit tests | `npm test` (vitest) |

`tsconfig.check.json` scopes typechecking to `app/`, `components/`, `lib/`,
`types/`. **Current status: typecheck is clean (EXIT 0) as of v0.23.0.**

> Sandbox note: `npm test` (vitest) currently fails *inside the Linux shell
> sandbox* — `node_modules` was installed on Windows and rollup's native binary
> is platform-specific. Tests run fine on Brian's Windows machine. Verification
> in-session relies on the typecheck. To run tests in a sandbox, re-run
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

## 7. Versioning

Every change bumps the app version and adds a `CHANGELOG.md` entry. Keep three
things in sync: `lib/version.ts` (`APP_VERSION`), the `version` field in
`package.json`, and `app/CHANGELOG.md` (newest entry on top). Semver — patch for
tweaks/fixes, minor for new features/screens, major for a finished release.

**Current version: 0.23.0.**

---

## 8. Recent work (v0.21.0 → v0.23.0)

- **v0.21.0** — Plan card briefly split into two clickable rows (plan + block).
- **v0.22.0** — Retired "macrocycle" from the UI; everything is now a single
  "Training Plan." Plan card simplified to one section (name, week, day) + a
  single "Change" button.
- **v0.23.0** — Made terminology its own opt-in setting, separate from mode
  (see §4). Kept all three modes. (This reverted a brief v0.22.0 experiment
  that had collapsed modes to two.)

---

## 9. Loose ends / next steps

- **No git repository** is initialized. Strongly worth `git init` — it would
  give a real safety net against the file-corruption problem (§2).
- The build is screen-by-screen. Per Brian's standing instruction: **finish a
  section, then prompt before continuing.**
- `tsconfig.check.json` is a throwaway typecheck-scope file in `app/` — keep it.

---

## 10. How Brian likes to work

- Iterative, one focused UI/UX change at a time.
- Wants to be **prompted after each completed section** before moving on.
- Precise about wording/typography (font size, color, hierarchy) — read
  requests literally and match them exactly.
