# FATRAT — Project Handoff

_Last updated: 2026-06-15 (app v0.97.1)_

Paste this file (or point the new chat at it) to bring a fresh session up to speed.

---

## 0. NEXT TASK — Finish → mark incomplete sets as skipped

When the user taps **Finish** on a workout, every exercise/set that was **not
completed** should be marked **skipped** (not left pending, not silently
dropped). Today, finishing finalizes the session as-is.

- Logger + finish flow live in `app/(main)/today/workout/page.tsx`
  (`requestFinish` → `finalizeWorkout`). Skipped sets are modeled as
  `SetEntry.completed === true` with `setType: 'skip'` (see `skipSet` /
  `skipRemaining` already in that file — reuse that shape).
- Make finalize sweep all exercises: any set with `!completed` becomes
  `{ completed: true, setType: 'skip' }`. Stats already filter `setType==='skip'`
  out of "logged" counts, so this should be consistent end-to-end.
- Watch the per-muscle feedback gate: `musclesMissingFeedback` / the final
  `SessionFeedbackModal` already runs on finish — confirm marking-skipped
  doesn't change which muscles count as "worked" (worked = has ≥1 *completed
  non-skip* set, so skipping shouldn't add feedback prompts).
- Verify with `npx tsc --noEmit`, bump version, changelog entry.

Prompt Brian to confirm: should an exercise with **zero** completed sets stay
on the session (all skipped) or be removed? Default assumption: keep it, all
sets skipped, so history shows it was programmed-but-skipped.

---

## 1. What this is

**FATRAT** is a strength-training web app. The original brief was an opinionated
periodized-training planner; it has grown into a broader workout app where
periodized training is one option alongside ad-hoc single workouts. It plans
programs, runs daily workouts, logs sets, and tracks progress over time.

**Live in production:**
- Hosted on Vercel — `https://fatrat-pi.vercel.app`
- Backed by Firebase Auth (Google sign-in) + Firestore
- Custom domain `fatrat.app` purchased at GoDaddy (DNS work pending; see §11)

The original brief, **`FATRAT Initial Build Specification.md`**, and the wizard
spec docs (**`plan_wizard_spec.md`**, **`wizard-spec-changes.md`**) are in the
project root. Brian's muscle-group volume guide is at **`Optimal Exercises per
Muscle Group.txt`**.

---

## 2. Location & the file-write corruption problem

- **Project root:** `C:\Users\brian\_fatratapp`
- **App code:** `C:\Users\brian\_fatratapp\app`

### File-write corruption — STILL ACTIVE, workaround is mandatory

The Edit/Write tools (and the shell mount that `tsc` reads) get out of sync in
this project: files are truncated mid-file, JSX/TSX is mangled, or null bytes /
stale copies appear. `tsc` reports `TS1127 Invalid character`, `TS1002
Unterminated string`, or `TS17008 JSX element has no closing tag`. This was
constant again through the v0.93 → v0.97 work — it hit nearly every multi-file
edit.

**Workaround — write/repair through bash heredocs:**

    cat > /sessions/<session>/mnt/_fatratapp/path/to/file <<'XEOF'
    ...full file contents...
    XEOF

The quoted delimiter preserves backticks, `$`, and template literals.

- The **file tool view (Read) is usually the correct/intended content**; the
  **bash mount is what tsc reads and is what truncates**. When they disagree,
  read the correct tail via the Read tool, then repair the mount: `head -N file`
  to the last good line, append the rest via heredoc, re-run `tsc`.
- To recover a badly mangled file, prefer `git show HEAD:path` for the pristine
  version, then rewrite via heredoc.
- After ANY work, verify: `npx tsc --noEmit` from `app/`. A workspace reconnect
  sometimes clears the sync lag if it gets bad.

---

## 3. Tech stack

- **Next.js 14.2.5**, App Router, `'use client'` components
- **TypeScript** (strict)
- **Tailwind CSS 3.4** — themed via CSS custom props (`--color-*` RGB triplets,
  so alpha modifiers like `bg-accent/10` work)
- **Firebase 11** — Auth (Google) + Firestore web SDK
- **Vitest** for unit tests (domain logic in `lib/`)

### Data repository pattern

`lib/firestore/repository.ts` defines `DataRepository`. Two implementations:
- `firestoreRepository.ts` — when `NEXT_PUBLIC_FIREBASE_*` env vars present.
- `mock.ts` — in-memory + localStorage (key `fatrat:mock:v5`). Offline tinkering.

`lib/firebase/client.ts` → `isFirebaseEnabled()`, `getFirebaseAuth()`.

---

## 4. Project structure (high level)

```
app/
  (main)/
    today/                 daily screen
       page.tsx            TodayWorkoutCard (interactive) + StartWorkoutModal
       workout/            the set logger (table view, see §6A)
    plan/                  plan dashboard
       meso/[mesoId]/      week-by-week schedule + Edit-plan entry (PlanWizardV2)
       day/[sessionId]/    a programmed day's preview
       templates/          programs/ (gallery + drafts) and workouts/
    history/  exercises/  profile/  settings/
  login/  onboarding/
components/
  app/        AppShell, BottomNav, ThemeProvider, UserProvider (runs migrations)
  plan/       PlanWizardV2 (the program wizard), SingleWorkoutWizard,
              ChangePlanSheet, TemplateWizard (legacy single-workout/edit paths)
  today/      StreakCard, BodyWeightCheckIn, WorkoutPicker, CardioLogModal,
              TodayWorkoutCard, StartWorkoutModal
  workout/    ExerciseCard (table + ⋮ menu), SetLoggerRow (table row),
              EffortPicker, RestTimer, ExerciseTimer, StructureSheet/Editor,
              SwapExerciseModal, SessionFeedbackModal, SorenessCheckIn, ...
  ui/         InlineNumber, Button, Card, MuscleBadge, ... (cn, units)
lib/
  firestore/  repo interface + mock + Firestore impl + seed
              migrations/ dropMacrocycle, relabelSessionsToDays, fixedExercises
  periodization/ e1rm, volume, rpe (incl. effortFeelLabel), deload, mode,
              terminology, adjustFromSoreness/Feedback, rest
  program/    generate, templateProgram (generateCustomProgram / materializeWeeks
              / assignExercises), startingWeights, recommendTemplate
  session/    resolveToday, advance, hydrateFromHistory, nextSetNudge, cleanup
  wizard/     types (WizardState), engine, persist (activate/gallery/draft),
              editFromMeso (reconstruct state for editing old plans)
  workout/    structure.ts (day-of set-structure pure helpers — see §6B)
  ui/         cn, beep, date, units (mm:ss + imperial), sets (formatSetValue,
              formatPrev), cardio
  version.ts  APP_VERSION (sync with package.json + CHANGELOG)
types/        exercise, periodization, profile, session, template
firestore.rules
```

### Domain model

`Mesocycle → Microcycle → WorkoutSession`. No Macrocycle (retired v0.61).

- Sessions are **ad-hoc** (no micro/meso ids) or **programmed** (both set).
- `Mesocycle` carries, beyond the basics: `equipmentProfileId`, `templateId`
  (the gallery template it came from — now also stores the wizard state, see
  §6C), `weekKinds: ('cal'|'ramp'|'load'|'deload')[]`, `allowedSetTypes:
  ('pyramid'|'drop')[]`, `fixedExercises?: boolean`, `muscleTiers`.
- `ExerciseEntry`: `{ exerciseId, name, muscle, metric, prescribedSets,
  prescribedRepsLow/High, prescribedTimeLow/High, sets: SetEntry[], setStyle?,
  supersetGroup?, swappedFromExerciseId? }`.
- `SetEntry`: `{ setIndex, weightKg?, reps?, timeSec?, rpe?, completed,
  setType?: 'skip'|'drop' }`. **Skipped = `completed:true` + `setType:'skip'`.**
- `ExerciseMetric`: `weight-reps` (default) | `reps` | `time` | `weight-time`.
  `ExerciseCard` prefers the LIVE def metric over the stored one.

### Modes & terminology (two independent axes)

- **Mode** (`profile.mode: BASIC|INTERMEDIATE|ADVANCED`) — feature depth.
- **Terminology** (`profile.advancedTerminology?`) — separate jargon opt-in.
- `lib/periodization/terminology.ts`: `usesAdvancedTerminology`,
  `terminologyMode`, `isPeriodizedSession`.

---

## 5. Commands (run from `app/`)

| Task | Command |
|---|---|
| Dev server | `npm run dev` (don't auto-run for Brian) |
| Build | `npm run build` |
| Typecheck | `npx tsc --noEmit` |
| Tests | `npm test` (vitest) |

> Sandbox note: vitest often can't launch in the Linux shell (rollup native
> binary is platform-specific; `node_modules` installed on Windows). Tests run
> on Brian's Windows machine. In-session verification = `npx tsc --noEmit`.

---

## 6. Key subsystems added since the last handoff

### A) In-workout set logger — TABLE view (v0.96)

`components/workout/ExerciseCard.tsx` + `SetLoggerRow.tsx`. Replaced the
stacked per-set cards with a compact table: one header per exercise
(`SET · PREV · weight · reps/time · LOG`), one row per set; columns adapt to
the metric. Behaviors:
- **Effort is asked AFTER logging.** Tap LOG → set is recorded → "How did it
  feel?" appears inline on that row. The next set does NOT activate and the rest
  timer does NOT start until a rating is chosen (`logSet` marks done +
  `pendingEffort`; `setEffort` does the nudge/advance/rest). Re-tap the
  checkmark to unlock + cancel the pending rating.
- **PREV column** shows last-time weight×reps (`formatPrev` in `lib/ui/sets.ts`)
  plus the effort tag (Easy/Solid/…/RPE n via `effortFeelLabel`). Last-time
  lookup matches by exercise id → swappedFromExerciseId → normalized NAME
  (the name fallback fixed PREV not populating on id-drifted exercises).
- **⋮ menu** (all wired): Add set, Remove set, Replace exercise (SwapExerciseModal),
  Superset with… / Unlink superset (mid-workout pairing), Skip remaining sets,
  Remove exercise.

### B) Day-of set structure — `lib/workout/structure.ts`

Plans are built as straight sets; supersets / pyramid / drop are chosen
**day-of**. Pure helpers: `applyStyleAt`, `pairSuperset`, `unlinkGroup`,
`setSetCount`, `groupLetters`, `removeExerciseAt`. Used by the Today card
(`TodayWorkoutCard`, collapsible exercise rows + set-type pills + sets stepper)
and the ad-hoc `StructureSheet`, and now by the in-workout superset menu.

### C) Plan Wizard v2 — `components/plan/PlanWizardV2.tsx` + `lib/wizard/*`

The wizard rebuild (the old "next task") shipped. Multi-page flow accumulating
a `WizardState` (`lib/wizard/types.ts`), engine (`engine.ts`), persistence
(`persist.ts`: `activateWizardProgram`, `saveWizardToGallery`, `saveWizardDraft`
— builds `CustomProgramInput` and reuses `generateCustomProgram`). Drafts and
now-activated plans store the full `{state, program}` JSON in the template's
`draftState`, so **Edit reopens fully prepopulated**. For pre-v0.97.1 plans
that lack saved state, `lib/wizard/editFromMeso.ts` reconstructs a best-effort
`WizardState` from the meso + week-1 sessions (name, length, equipment, tiers,
set types, fixed flag, days, week-1 exercises; goal/experience/style reset).

### D) Equipment profiles + fixed-vs-variety exercises

- Granular equipment lives in the profile (`lib/exercise/equipment.ts`,
  profiles with item lists). The wizard, Swap, and Add filter against the plan's
  `equipmentProfileId`.
- `fixedExercises` (per meso): when true, weeks 2+ reuse week 1's exercises
  instead of rotating (`templateProgram.ts:~303`). One-shot migration
  `migrateFixedExercises` defaults existing plans to fixed.

---

## 7. Versioning & shipping

Bump three files in sync on every change: `lib/version.ts` (`APP_VERSION`),
`package.json` `"version"`, and `app/CHANGELOG.md` (newest on top). Semver.

**Current version: 0.97.1.**

PowerShell deploy (Brian copies this verbatim; note the `;` separators and the
index.lock guard):

    Remove-Item C:\Users\brian\_fatratapp\.git\index.lock -Force -ErrorAction SilentlyContinue ; cd C:\Users\brian\_fatratapp ; git add -A ; git commit -m "vX.Y.Z — summary" ; git push

Vercel auto-deploys from `main`. The Update Toast polls `/api/version`.

---

## 8. Firestore layout

```
exercises/                        ← global library (read-only); falls back to
                                    in-code GLOBAL_EXERCISES seed (see §11)
users/{uid}/                      ← profile doc (name, units, mode, prefs,
                                    soundsEnabled, migrated* flags)
  ├ bodyWeight/{ISO date}
  ├ mesocycles/{id}               ← the training plan
  ├ microcycles/{id}              ← one week
  ├ days/{id}                     ← a day's workout (formerly sessions/)
  ├ customExercises/{id}
  ├ templates/{id}                ← program/workout templates; programs carry
  │                                 draftState (wizard state) for editing
  └ exercisePrefs/main            ← favorites + hidden
```

One-shot migrations run on sign-in (gated by profile flags, idempotent):
`migrateMacrocyclesForUser`, `migrateSessionsToDaysForUser`,
`migrateFixedExercises`. `cleanupArchivedPendingSessions` runs on History load.

---

## 9. Recent work (v0.67 → v0.97, condensed — full detail in app/CHANGELOG.md)

- **Plan Wizard v2** (the big rebuild): goals → experience → schedule →
  equipment profile → training style → split → prioritization tiers → sets/reps
  → rest/tempo → core → cardio → progression/deload → baselines → reviewed
  program (page 16, drag-reorder, set-type grouping). Activates/saves to gallery
  /draft; ramp/calibration/deload week kinds; e1RM auto-seed after a calibration
  week.
- **Day-of structure**: plans are straight sets; supersets/pyramid/drop chosen
  on the Today card or ad-hoc sheet. Fixed-vs-variety exercises per plan + migration.
- **Today card redesign** (v0.94): muscle pills + "n Exercises · n Sets" with
  collapsible exercise rows (set-type pills, sets stepper, Swap, Remove).
  Start Workout modal: Scheduled / Swap-with-another-day / Ad-Hoc.
- **In-workout logger** rebuilt as a table (v0.96, see §6A); effort-after-logging;
  mid-workout supersets; robust PREV matching + effort tag (v0.97).
- **Set-logger bug fixes** (v0.96.1): `hydrateFromHistory` no longer re-adds sets
  on open (it was overwriting manual set-count reductions); Today-card edits now
  flush (await) before navigating into the workout (was a fire-and-forget race
  that also caused Plan/Today exercise mismatches).
- **Edit-plan prepopulation** (v0.97.1): wizard state saved on the template;
  reconstruct-from-meso fallback for old plans.
- Earlier: cardio mm:ss + imperial + treadmill stats; editable exercise library
  metrics with propagation; last-time reference + Pause Workout; soft-outline
  muscle pills; consolidated set/cardio renderers; per-exercise set-count adjust.

---

## 10. Upcoming / back burner

- **Finish → mark incomplete as skipped** — see §0 (the next task).
- **Performance analytics** — "what worked" over completed blocks. Advanced:
  Stimulus-to-Fatigue Ratio per exercise; Basic/Intermediate: same in plain
  language. Needs a research pass on the math + a UI surface (Insights tab? post-
  block review?). After near-term fixes.

---

## 11. Pending deployment chores (low priority)

- **Custom domain `fatrat.app`** — bought at GoDaddy; not yet added to Vercel
  Domains / DNS configured / added to Firebase authorized domains. App runs at
  `fatrat-pi.vercel.app` meanwhile.
- **Global exercises/templates still ship in code**, not Firestore — Brian's
  Workspace (brianratcliff.com) blocks service-account key creation. Fallback is
  fine; revisit if org policy changes.
- **Orphan Firestore collections** — `macrocycles/*`, `sessions/*` inert post-
  migration; delete via console once all users confirmed migrated.

---

## 12. How Brian likes to work

- Iterative, one focused UI/UX change at a time. Prompt after each completed
  section before moving on. For larger redesigns, audit first + ask direction.
- Be concise and direct — minimal preamble/postamble. Don't re-explain a diff
  he can read. Two or three sentences of outcome + caveat.
- Precise about wording/typography — read requests literally, match exactly.
- **Bash heredocs for all writes** (§2); Edit/Write + the tsc mount are
  unreliable here. Always `npx tsc --noEmit` after a change. Always bump version
  + changelog. Always end with the PowerShell push block (§7) — he copies it.
- PowerShell user: use `;` not `&&`; keep the `.git/index.lock` removal prefix.
- Don't recommend `npm run dev`.
- Don't be sycophantic. Acknowledge mistakes briefly, fix, move on.
- A screenshot showing something unexpected is authoritative over reasoning
  about the code — trace the actual data flow that produced it.
