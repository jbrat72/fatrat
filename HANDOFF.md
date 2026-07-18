# FATRAT — Project Handoff

_Last updated: 2026-07-18 (app v0.103.0)_

Paste this file (or point the new chat at it) to bring a fresh session up to speed.

---

## 0. NEXT TASK — none assigned

The task that sat here at v0.97.1 (Finish → mark incomplete sets as skipped)
shipped in v0.98. Nothing is queued — ask Brian for direction.

Open threads worth raising first:
- **v0.103.0 shipped without a full typecheck.** The mount degraded mid-session
  (see §2) and `tsc` stalled. The four changed files were syntax-verified with
  the TypeScript parser, but no type pass ran. Re-run `npx tsc --noEmit` from
  PowerShell early next session; fix anything it surfaces.
- **Set defaults changed** in v0.102.6 / v0.103.0 (reps now carry to the next
  set; swapping an exercise prefills from that exercise's own history). Worth
  confirming on a real workout that weight AND reps populate.
- Performance analytics (§10) is still the main un-started feature.

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

### Why it happens (diagnosed 2026-06-16)

The folder is shared into the Linux sandbox over a **virtiofs → FUSE bridge**
(`/mnt/.virtiofs-root/shared/c/Users/brian/_fatratapp`). It is NOT in OneDrive.
The bridge handles clean whole-file writes fine (a 444 KB `cp` verified 15/15),
but it corrupts two specific patterns:
  1. The **Edit/Write tools' partial-write path** desyncs from the FUSE view —
     files truncated mid-file, JSX mangled, null bytes appended, stale tails.
     (`.fuse_hidden*` files are the tell: a process held the file open during a
     replace.) `tsc` then reports TS1127 / TS1002 / TS17008 / TS1005.
  2. **git run through the mount** — git's lock→rename corrupts `.git/index` and
     leaves a stale `.git/index.lock`. (An index reset over FUSE killed the
     index in the v0.99 session.)

### Rules (mandatory)

1. **Never run git in the sandbox / over the mount.** No `git add/commit/reset/
   checkout/rm` against this repo from bash. All git happens in Brian's Windows
   PowerShell (the deploy block in §7, which also clears the stale index.lock).
   Read-only, non-index ops are fine: `git log`, `git show HEAD:path`.
2. **Write whole files, then verify + retry — never trust a single write.**
   Build the complete file, write it, then check with `cmp` / `tsc`; if it
   truncated, write again. Reliable pattern:

       cat > /tmp/f <<'XEOF'
       ...full file...
       XEOF
       cp /tmp/f "$MNT/path"; cmp -s /tmp/f "$MNT/path" || cp /tmp/f "$MNT/path"

   For surgical edits, prefer python in-place (read → replace → write) over the
   Edit tool — but STILL run `tsc` after and repair the tail if it was cut.
3. **Strip null bytes if they appear:** `tr -d '\000'` (or python
   `b.replace(b'\x00', b'')`), then restore the lost tail from the Read tool or
   `git show HEAD:path`.
4. **For big multi-file work, edit on the local ext4 disk** (`/tmp` — real disk,
   no bridge): typecheck/test there, then copy changed files back with the
   verified `cp` above. Optional, but the most robust path.
5. **After ANY change: `npx tsc --noEmit` from `app/`.** Repair truncations
   (`head -N` to the last good line, re-append the rest) before continuing. A
   workspace reconnect can clear a bad sync lag.

### Recovering a corrupt git index (from Windows)

If bash git ever reports `index file corrupt`: from PowerShell run
`Remove-Item C:\Users\brian\_fatratapp\.git\index.lock,C:\Users\brian\_fatratapp\.git\index -Force -ErrorAction SilentlyContinue`
then the normal deploy block — `git add -A` rebuilds the index from the working
tree. The working tree is never affected by index corruption.

### Environment mitigation

Exclude `C:\Users\brian\_fatratapp` from Windows Defender real-time scanning
(Defender opening files mid-replace is a likely race trigger): Settings →
Privacy & security → Windows Security → Virus & threat protection → Manage
settings → Exclusions → Add or remove exclusions → Add a folder.

### When the bridge goes SLOW (seen 2026-07-18)

A separate failure mode from corruption: the mount degrades until it is
I/O-bound rather than broken. Symptom — `npx tsc --noEmit` never finishes
(15+ min vs the usual ~20s) while `uptime` shows load ~0.00, i.e. blocked on
I/O, not CPU. `du` / `find` over the mount hang too, and truncated writes get
more frequent at the same time.

What to do:
- **Run the typecheck on Windows instead** — ask Brian to run
  `cd C:\Users\brian\_fatratapp\app ; npx tsc --noEmit` (native, ~20s, no
  bridge). This is the reliable fallback.
- **Syntax-only check inside the sandbox** (fast; catches the truncation class
  but NOT type errors): copy changed files to `/tmp`, then parse each with
  TypeScript's own parser — `ts.createSourceFile(p, src, Latest, true,
  ScriptKind.TSX).parseDiagnostics`.
- Background a long `tsc` with `setsid nohup ... &` and poll a logfile; a plain
  `&` job dies when the bash call returns (every call is a separate shell).
- `node_modules/.bin/esbuild` will not execute off this mount.
- **A fresh session gets a fresh mount** — the actual fix. Tell Brian to start a
  new chat, not reboot; his files and repo are never at risk.

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

**Current version: 0.103.0.**

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

## 9. Recent work (v0.67 → v0.103.0, condensed — full detail in app/CHANGELOG.md)

### v0.98 → v0.103.0 (most recent session)

- **Finish sweeps incomplete sets to skipped** (v0.98) — the old §0 task.
  `workedMuscles` excludes skips so feedback prompts are unchanged.
- **Week / plan correctness**: microcycles sorted by `weekNumber` in both repos
  + defensive sort in `planAdvance`; `migratedWeekStatusRepair` migration. Plan's
  current week is CALENDAR-derived (`meso.startDate` vs today); the Weeks list
  treats any earlier week as past so it never reads "Upcoming"; Plan auto-expands
  the calendar-current week, not the stale `status === 'active'` one.
- **History charts are metric-aware** (weight vs reps vs time) via
  `lib/exercise/resolveDef.ts`. A resolved library def is AUTHORITATIVE for
  metric — `def ? (def.metric ?? 'weight-reps') : (ex.metric ?? 'weight-reps')`.
  Falling back to the stored metric resurrected a stale 'reps' and hid the weight
  field. Unique exercise names enforced on create/edit + `dedupeExerciseNames`
  migration (a V2 flag re-runs it to fix metrics on re-pointed sessions).
- **Timers + alarm**: wall-clock deadlines (`endAtRef` + `setTimeout` +
  visibility/focus catch-up) — `setInterval` was throttled and fired late.
  `lib/ui/beep.ts` runs two paths (Web Audio resume-then-schedule + a
  synthesized-WAV `<audio>`); prime with `muted`, NOT `volume = 0` — iOS ignores
  volume and it fired the alarm on scroll.
- **Today dashboard**: `WeeklyRings` (3 donuts) + `lib/progress/dashboard.ts`;
  metrics configurable in Settings (`dashboardRings`); the workouts ring counts
  SCHEDULED sessions, not `daysPerWeek`. Cardio goal now sits INSIDE the Current
  Training Plan card on Plan (`CardioGoalCard embedded`), with a Settings toggle.
- **Cardio**: mm:ss entry (raw digits while focused, format on blur — a live
  reformat fought the caret); Cardio favorites filter in Profile
  (`cardioFavorites`) driving the Log Cardio picker; Pickleball added, time-based
  with avg HR. Shared list in `lib/cardio/activities.ts`.
- **Onboarding trimmed to 2 steps** (About you + Mode). New users get an EMPTY
  equipment profile, so Today shows a "finish setup" nudge and the Plan Wizard
  gates on equipment (with a bodyweight-only bypass).
- **Set defaults**: `hydrateFromHistory` prefers prior weight AND reps over the
  prescription (the generator pre-fills reps at the range low, so `s.reps ??`
  never picked up last time's). `nudgeNextSet` carries the just-logged reps to
  the next set — only the RPE >= 9 branches reset to the low end. Swapping an
  exercise mid-workout prefills from the swapped-IN exercise's own history.
- **Read hardening** (the recurring "no data / no plan" class): Firestore reads
  go to the server with no offline cache, so one transient read blanks a screen.
  Pattern — `withRetry` (retries THROWS) + retry-on-EMPTY where a non-empty
  result is guaranteed (an active plan always has microcycles) + commit related
  reads together + keep-last-good on failure. Applied to Today, Plan,
  WeeklyRings, SessionDetailModal and the workout page.
- **The workout screen can't strand you**: it hides the bottom nav, so a null
  session used to be a dead end. Now — retry the session read, a `loaded` flag,
  auto-redirect to `/today`, an explicit "Back to Today" button, and
  `load().catch()` so a rejected read can't hang on "Loading…". Finishing a
  workout returns to Today (mesocycle completion still shows its recap).
- **Missed-workout nag** is suppressed once any session was completed after the
  skipped date. Swap-with-another-day labels rows with the muscles trained, sorts
  chronologically, and is limited to the 3 most recent skips + next 2 scheduled.
- **Ad-hoc respects equipment**: `WorkoutPicker` filters template slots through
  `canUseExercise(def, itemsForProfile(user))` — hides undoable workouts, drops
  unusable exercises, and counts only what you can actually perform.

### Earlier (v0.67 → v0.97.1)

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
