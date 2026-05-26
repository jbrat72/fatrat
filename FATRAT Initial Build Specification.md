FATRAT — Initial Build Specification

Build FATRAT, a strength training app organized around evidence-based periodization. The app serves multiple user types — from absolute beginners who just want to stay in shape, to advanced lifters who want a full periodization system. Three user-facing modes (BASIC / INTERMEDIATE / ADVANCED) present the same underlying engine at different levels of complexity. RPE/RIR tracking drives the auto-progression engine for users who want it; simpler effort signals serve users who don't. Aesthetic: dark, intense gym feel — deep blacks (#0a0a0a backgrounds, #1a1a1a cards), red/orange accents (#e53e3e), bold uppercase headers, large tap-friendly controls.

Architecture & Production Path
Target: web-first deployment for a small private user base (self + friends + family), with a possible React Native port later. Optimize for iteration speed and clean separation of concerns.
Stack:

Frontend: Next.js 14 App Router with React + TypeScript. Mobile-first responsive, PWA-capable.
Backend: Next.js API routes — no separate server.
Database: Firestore (Firebase Spark/free tier).
Auth: Firebase Auth, Google sign-in only.
Deployment: Vercel (free tier).

Code organization (critical for future React Native port):

/app — Next.js routes and pages
/components — UI only, no business logic
/lib/periodization — pure functions for progression, deload detection, volume math, e1RM, RPE/RIR logic. Zero React imports. Zero Firestore imports. This is the portable core.
/lib/firestore — all database queries and mutations, isolated from UI
/types — shared TypeScript types

Don't build: payments, email flows, offline sync, push notifications, multi-language support.
Do build: admin-only functionality, pure-function periodization logic, fully unit-testable, with zero UI or DB coupling.

User Modes
The app runs in one of three modes. Mode is per-user, stored on the user profile, and changeable anytime from Settings. Every mode reads/writes the same underlying data model — modes are purely presentational and configurational, never destructive. Switching modes never deletes data.

BASIC — "Just help me work out"
Target user: returning lifters, casual exercisers, beginners who want zero jargon

No periodization vocabulary in the UI. No "mesocycle," "RIR," "MEV," "deload."
Home screen: "Today's Workout" — exercise list, sets, reps, large checkmark buttons.
Effort logging: a 3-button feel scale per exercise ("Easy / Just Right / Hard") — internally mapped to RPE 6 / 7.5 / 9. Can be skipped entirely.
Programs: 3 simple templates ("Full Body 3x/week," "Tone & Maintain," "Get Started").
No volume dashboards, no e1RM charts. Streak counter, total workouts completed, and occasional plain-English progress callouts ("You got stronger on Squat this month!").
Easy weeks auto-inserted every 5–6 weeks without using the word "deload."
Progression: linear add-weight if last session felt easy or just right, hold if hard, reduce if repeatedly hard.

INTERMEDIATE — "Show me I'm progressing"
Target user: returning lifters with some experience, anyone who wants structure but not the full system

Light periodization language. "Training block" instead of "mesocycle." "Easy week" instead of "deload."
Effort logging: simplified 1–5 scale ("Smooth / Solid / Tough / Grinding / Failed"), mapped internally to RPE 6/7/8/9/10.
Home screen shows today's workout plus a simple weekly volume indicator (green/yellow/red per muscle, no MEV/MRV numbers).
Programs: all 6 templates available, with plain-English descriptions (no "PPL 6-day hypertrophy" jargon — "Build Muscle, 6 days/week").
Progression engine active but quiet — suggests load increases, flags easy weeks, doesn't show underlying math.
End-of-block "Recap" view in plain English: "You added 15 lbs to your bench. Great work."

ADVANCED — "Give me the full system"
Target user: experienced lifters, data nerds, anyone who's read about periodization

Full periodization vocabulary: macrocycles, mesocycles, microcycles, RIR targets, MEV/MAV/MRV, e1RM tracking.
Effort logging: full RPE 1–10 scale with RIR equivalence shown.
All overrides available, all charts visible, all parameters editable.
Full feature set as defined below.

Mode Recommendation Logic
After onboarding, the app recommends a mode based on the experience tier and familiarity with periodization terminology. The recommendation is just a default suggestion — the user is free to pick any mode at signup or switch anytime. The signup screen presents all three with brief descriptions; the recommended one is highlighted.

Onboarding & Profile
Initial signup walks through a 6-tier profile setup. Tiers 1–4 are required; tiers 5–6 are skippable. Estimated completion: 3 minutes. All fields editable anytime from Profile Settings.
Tier 1 — Identity & Body

Display name
Date of birth (used for age-based defaults; never shown publicly)
Gender (used for strength baseline calculations)
Height
Current body weight
Units preference (lbs/inches or kg/cm) — applies everywhere in the app

Tier 2 — Experience (drives mode recommendation)

"How long have you been lifting consistently?"

Never or less than 6 months → recommends BASIC
6 months to 2 years → recommends INTERMEDIATE
2+ years → recommends ADVANCED


"How familiar are you with terms like RPE, mesocycle, or progressive overload?"

Not at all → biases toward BASIC
Heard of them, fuzzy → biases toward INTERMEDIATE
I use them regularly → biases toward ADVANCED


Recommended mode shown with one-sentence explanation. User selects final mode (recommendation pre-selected, all options available).

Tier 3 — Goals (drives template selection)

Primary goal (single choice, plain language):

Build muscle / get bigger
Get stronger (lift more weight)
Lose fat / get leaner
Stay in shape / maintain
General fitness / feel better
Sport-specific performance


Secondary goal (optional, same list)
Target date or timeframe (optional): "By summer," "In 6 months," "No deadline"

Tier 4 — Availability & Equipment

Days per week available to train (2–7)
Time available per session (30 / 45 / 60 / 75 / 90+ min)
Equipment access (multi-select):

Full commercial gym
Home gym (barbell + rack)
Dumbbells only
Bodyweight only
Resistance bands
Limited / hotel gym



Tier 5 — Constraints (optional)

Injuries or movements to avoid (free text plus common checklist: lower back, shoulders, knees, wrists, elbows)
Specific lifts to exclude (e.g., "no overhead press")

Tier 6 — Starting Strength Baseline (optional, skippable)

Current best (estimated 1RM or recent heavy set) for: squat / bench / deadlift / overhead press
If skipped: app starts with conservative loads and calibrates from the first 2–3 sessions

Post-Onboarding Confirmation
"Based on your profile, we recommend [MODE] and have set you up with [TEMPLATE]. You can change either of these anytime in Settings."

Body Weight Check-In (all modes)
Optional weekly body weight check-in, prompted once per week on home screen (dismissible). Logged values plot in a profile chart. Never required; never blocks workouts. Available in all modes but more prominent for users whose goal is fat loss or muscle gain.

Cardio Support (all modes)
First-class but lightweight. Users can log cardio sessions alongside strength workouts:

Activity type: treadmill, bike, elliptical, rower, walking, running outdoor, stair climber, swimming, other
Duration (minutes)
Optional: distance, average heart rate, perceived effort (same scale as user's current mode)
Optional: notes

Cardio appears on the Today screen as an additional logged activity (not prescribed by default unless a template includes it). Some templates (e.g., "Lose fat / get leaner") may suggest 2–3 cardio sessions per week. Cardio history shown separately from strength history but in the same chronological log.

Periodization Engine (full ADVANCED model — simplified for lower modes)
Three-tier hierarchy:
Macrocycle (3–12 months)
Long-term goal block. Examples: "Summer Cut," "Powerlifting Meet Prep," "Off-season Hypertrophy." Holds an ordered sequence of mesocycles. Visible by name in ADVANCED; called "Training Plan" in INTERMEDIATE; hidden in BASIC (the user just has "a program").
Mesocycle (4–6 weeks)
Focused training block with one objective. Phase types:

Hypertrophy — 8–15 reps, RPE 7→9 across weeks, 10–20 hard sets per muscle/week
Strength — 3–6 reps, 80–90% 1RM, lower volume, RPE 7→9
Power — moderate load, focus on bar speed, low rep, full recovery
Peaking/Taper — high intensity, low volume, prepares for a max attempt
Deload — ~50% volume, RPE capped at 6, planned recovery

Every mesocycle ends with a deload (or rolls into a low-intensity start of the next phase). Called "Training Block" in INTERMEDIATE; hidden in BASIC.
Microcycle (1 week)
One week within a mesocycle. Defined by a split (PPL, Upper/Lower, Full Body, Bro Split, custom) and assigned lifts/sets/reps per day. Within a mesocycle, microcycles auto-progress week-over-week.
RPE / RIR System
Every set logs effort. The internal representation is always RPE 1–10. The UI maps that to the user's mode:

ADVANCED: raw RPE 1–10 with RIR equivalence
INTERMEDIATE: 5-button scale (Smooth/Solid/Tough/Grinding/Failed → RPE 6/7/8/9/10)
BASIC: 3-button scale (Easy/Just Right/Hard → RPE 6/7.5/9), often skipped

Standard 4-week mesocycle RIR progression (ADVANCED visible, others applied silently):

Week 1: 3 RIR → Week 2: 2 RIR → Week 3: 1 RIR → Week 4: 0–1 RIR → Week 5: deload, RIR 4+, ~50% volume

Progressive Overload Engine
Pure functions in /lib/periodization. Reads logged effort and prior performance, outputs next session's prescription. Supports:

Linear (add weight each week) — BASIC default
Undulating (vary rep ranges within the week) — INTERMEDIATE/ADVANCED
Set-progression (add a set per week from MEV → MRV) — ADVANCED
RIR-based (hold load, push closer to failure each week) — INTERMEDIATE/ADVANCED

The engine has no awareness of mode. Modes simply select which progression scheme is used and how its output is presented.
Deload / Easy Week Detection
Triggered by any of:

Scheduled (end of mesocycle / every 5–6 weeks in BASIC)
Performance trending down 3+ sessions on main lifts
User logs declining readiness (sleep / soreness / motivation) — ADVANCED only

Presented as "Deload" (ADVANCED), "Easy Week" (INTERMEDIATE), or quietly inserted with no special label (BASIC).

Core Features (mode-gated where noted)

Onboarding Wizard — 6-tier profile setup (above). All modes.
Today's Session (home screen) — All modes. The prescriptive heart of the app. Pulls from the active microcycle:

Today's lifts in order
Each lift: prescribed sets × reps + last session's actual loads
Suggested working weight (calculated from prior performance)
User logs actual weight, reps, and effort per set
User can override any prescription (swap exercise, add set, skip)
Cardio activities also appear if scheduled or added ad-hoc


Set Logger — All modes. Same component, different effort scale based on user mode. Weight and rep inputs use steppers (+/-) with long-press for fast scrolling, plus tap-to-type fallback.
Rest Timer — All modes. Auto-starts after logging a set. Phase-appropriate defaults: 60–90s isolation, 2–3 min compound hypertrophy, 3–5 min strength/power. User can set custom defaults. BASIC users see it briefly with skip option; ADVANCED users see full configurability.
Program Templates Library — All modes (subset shown by mode):

BASIC (3): Full Body 3x/week, Tone & Maintain, Get Started
INTERMEDIATE & ADVANCED (6+): Push/Pull/Legs (6-day), Upper/Lower (4-day), Full Body (3-day), 5/3/1-style (4-day), Bro Split (5-day), Powerbuilding hybrid

Selecting a template generates a full program. Users can freely customize: edit any exercise, set count, rep target, rest period — before committing or mid-cycle.
Cycle Builder (ADVANCED only) — Build from scratch: define macrocycle goal + duration, sequence mesocycles (hypertrophy/strength/power/peaking/deload), pick split per mesocycle, assign exercises and starting volumes per microcycle.
Volume Dashboard:

BASIC: hidden
INTERMEDIATE: simple green/yellow/red weekly indicator per muscle group, no numbers
ADVANCED: full hard-sets-per-muscle chart vs. MEV/MAV/MRV thresholds with MRV warning


Progress Tracking:

BASIC: "Personal Bests" screen showing best logged weight per major lift, plus monthly callouts ("You got stronger on Bench!")
INTERMEDIATE: simple line charts for main lifts (weight over time)
ADVANCED: e1RM tracking using averaged Epley + Brzycki formulas (valid 3–10 reps), charted across mesocycles, with RPE overlays


Mesocycle / Block Review:

BASIC: monthly summary card on home screen
INTERMEDIATE: end-of-block "Recap" in plain English
ADVANCED: full Mesocycle Review with total volume, e1RM gains, RPE compliance, suggested adjustments for next block


Body Weight Check-In — All modes. Optional weekly prompt, dismissible, plots in profile chart.
Cardio Logging — All modes. Activity type, duration, optional distance/HR/effort/notes.
Exercise Library — All modes. 50+ exercises tagged by muscle group, equipment (barbell/dumbbell/machine/cable/bodyweight), and movement pattern (compound/isolation, push/pull/hinge/squat/carry). Every prescribed exercise must be swappable from the Today screen with a "Find similar" filter (same muscle group / equipment).
Workout History — All modes. Chronological log of all sessions (strength + cardio), filterable by exercise. BASIC: simple list; ADVANCED: PR highlights, RPE trends, expandable per-set detail.
Streaks & Consistency — All modes. Current streak (consecutive weeks with ≥ planned workouts), total workouts completed, this-week progress bar. Prominent in BASIC, present-but-quiet in ADVANCED.
Settings:


Profile (edit all 6 tiers anytime)
Mode (switch between BASIC/INTERMEDIATE/ADVANCED with a one-screen explanation of what changes)
Units, rest timer defaults, notifications (none for v1)
Data export (CSV/JSON download of full history — important for trust)
Account deletion (required even for friends-only app)


Common Spine (architectural invariants across all modes)
Everything below is true regardless of mode:

Shared domain model. Every user's data — BASIC or ADVANCED — has the same Firestore schema. A BASIC user's session logs are structurally identical to an ADVANCED user's, just with simpler effort values. This enables friction-free mode switching and consistent analytics.
Shared periodization core. /lib/periodization runs for everyone. Modes select progression schemes and presentation, but the engine is mode-agnostic.
Shared components. Set logger, rest timer, exercise library browser, workout history, Today screen — all the same components, configured by mode.
Shared cross-cutting features: auth, profile management, settings, exercise swap, workout notes, data export, account deletion, streak tracking, body weight check-in, cardio logging.
Mode is presentational, not destructive. Switching modes never deletes or alters historical data. A user can downshift to BASIC and upshift back to ADVANCED with full data preserved.


Data Model (Firestore)
users/{userId}
  ├── profile
  │     ├── displayName, dob, sex, height, weight, units
  │     ├── experience, periodizationFamiliarity
  │     ├── primaryGoal, secondaryGoal, targetDate
  │     ├── daysPerWeek, timePerSession, equipment[]
  │     ├── constraints (injuries, excludedLifts)
  │     ├── strengthBaseline (squat/bench/dl/ohp e1RM)
  │     └── mode ("BASIC" | "INTERMEDIATE" | "ADVANCED")
  ├── bodyWeightLog/{date} → { weight, note }
  ├── macrocycles/{macroId}
  │     ├── name, goal, startDate, targetDate, status
  │     └── mesocycles/{mesoId}
  │           ├── phaseType, weeks, progressionScheme, weekIndex
  │           └── microcycles/{microId}
  │                 ├── weekNumber, splitType, status
  │                 └── sessions/{sessionId}
  │                       ├── date, dayOfWeek, completed, notes
  │                       ├── exercises[] (embedded)
  │                       │     ├── exerciseId, name
  │                       │     └── sets[]
  │                       │           { weight, reps, rpe, completed, restSec }
  │                       └── cardio[] (embedded)
  │                             { activityType, duration, distance?, avgHR?, effort?, notes? }
  └── exercises/{exerciseId}    (custom user exercises)

globalExercises/{exerciseId}    (shared library, 50+ exercises)
globalTemplates/{templateId}    (pre-built programs, mode-tagged)
Key principles:

Embed sets inside session documents (one document per session) to stay well under Firestore free tier limits
Effort is always stored as rpe (1–10) regardless of mode — the UI translates display
Mode is a single field on profile; all queries are mode-agnostic
Cardio embedded in sessions, but also queryable across sessions for cardio-only views


Design Specifics

Bottom nav: Today / Plan / History / Profile
Home screen = "Today's Session" with prescribed work and large START button
Plan tab: simple in BASIC (just shows current week), rich in ADVANCED (full mesocycle bar with intensity ramp visualization)
Active set highlighted with red accent; completed sets muted gray with checkmark
PR sets get a flame icon; RPE 9+ (or "Grinding"/"Hard") gets a red glow
Numeric inputs: steppers (+/-) with long-press fast-scroll plus tap-to-type
All section headers BOLD UPPERCASE with letter-spacing
Inter or similar geometric sans-serif; tabular figures for numerical readability
Mode-specific UI complexity hidden behind a single design principle: progressive disclosure — more advanced features appear in the same place, just unlocked as the mode level rises


Sample Data (for first run)
Pre-load with:

3 demo user profiles, one per mode (so you can test each experience):

"Molly" (BASIC) — goal: stay in shape, 3 days/week, 2 weeks of history
"Brian" (INTERMEDIATE) — goal: build muscle, 5 days/week, mid-block, 3 weeks of history
"Zach" (ADVANCED) — goal: build muscle, full macrocycle active, Week 3 of Meso 1 (4-week hypertrophy, deload Week 5), 6 weeks of history with RPE progression


50+ exercises in global library, with sufficient quantity for each equipment type
6 program templates tagged by mode
Realistic load progression and effort values across the history so charts and progression engine have content