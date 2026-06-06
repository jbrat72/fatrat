# Plan Wizard — Full Specification

## Overview

The Plan Wizard is a 16-page guided flow that collects user inputs and generates a personalized workout program. Each page's answers constrain and improve the options presented on subsequent pages, so the user is never shown irrelevant or incompatible choices. The wizard should feel like sitting down with an expert trainer for an intake session — intelligent, conversational, and efficient.

The wizard must maintain a running state object that accumulates all user selections and is passed forward through every page. Conditional logic on each page reads from this state to filter, rank, reorder, pre-populate, or hide inputs dynamically.

### Cross-Cutting Design Principles

**Volume model is the single source of truth.** Each muscle's weekly hard-set target is derived from its prioritization tier combined with per-muscle volume landmarks (Israetel-style MEV / MAV / MRV, matching the app's `lib/periodization` values). The tier-to-landmark mapping is: Emphasize → toward MRV, Grow → approximately MAV, Maintain → approximately ½ MEV. This single number drives both the Page 15 volume card and Page 16 exercise generation, and they must reconcile exactly. There are no fixed per-tier set ranges — volume is always landmark-derived.

**Profile data comes from the user's existing FATRAT profile.** Age, biological sex, body weight, and height are not collected in the wizard. They are pulled from the profile and shown read-only where needed. Unit preferences (lbs/kg, ft/cm) come from the profile and are used for display only — there are no unit toggles in the wizard.

**Prioritization tiers match the app's existing model.** The wizard uses the app's tier terminology: Maintain / Grow / Emphasize, plus N/A to drop a muscle entirely. (Grow is the default tier for most muscle groups. N/A removes a muscle from the program. There is no "De-emphasize" tier — a muscle is either Maintain, Grow, Emphasize, or dropped.)

### Wizard-Wide Interaction Rules

- Progress is shown as a top progress bar plus "n / 16" label. No numbered step buttons.
- "Next" is gated until the user has scrolled to the bottom of the page, but ONLY when the page is taller than the viewport and hasn't been scrolled to the bottom yet. Pages that fit on screen are never gated. A page already visited is never re-gated — going Back and returning does not force re-scrolling.
- Selecting an option never scrolls the page back to the top.

---

## Page 1: Welcome & Program Goal

### Purpose
Establish the single most important branching variable for the entire wizard. Every downstream page — training style recommendations, rep ranges, rest periods, cardio inclusion, split options, volume defaults — keys off this selection.

### Inputs

**Program Name** (text input, required)
A user-defined name for this program (e.g., "Summer Cut 2026," "Off-Season Bulk"). Saves the program to the template library. Shown at the top of the page before goal selection.

**Primary Goal** (single select, required)
- Build Muscle (Hypertrophy) — "Maximize muscle size, fullness, and definition."
- Build Strength (Maximal Strength) — "Lift heavier. Build raw, functional strength."
- Transform My Body — "Go from soft to strong. Build muscle, lose fat, and see a different person in the mirror." This is for users who are overweight, undertrained, or both, and want a comprehensive physical transformation. It combines muscle building and fat loss into a single goal because untrained/overfat individuals can do both simultaneously (unlike experienced lean lifters, who must choose one).
- Lean Out & Preserve — "Cut body fat without losing the muscle you've built." This is the traditional recomp/cut for lifters who already have a meaningful muscle base and want to reveal it. The fear here is losing size, not building it.
- General Fitness & Conditioning — "Feel better, move better, build a sustainable routine."
- Athletic Performance — "Train for a sport, event, or physical challenge."

**Secondary Goal** (optional toggle, single select)
Only shown after primary goal is selected. Options exclude the primary goal and any goal that conflicts with the primary. Presented as: "I also want to…"
- …build more muscle (hidden if primary = Build Muscle or Transform)
- …get stronger (hidden if primary = Build Strength)
- …trim down / lose fat (hidden if primary = Transform or Lean Out)
- …improve conditioning

### Conditional Logic
- If primary = **Transform My Body**:
  - Page 6 (Training Style): Boost Full-Body / Minimalist and Powerbuilding to the top. For modifiers, default Volume Framework to Fixed Volume (if Beginner) or Evidence-Based Volume (if Intermediate+), and Periodization to None / Straight Run.
  - Page 7 (Split): Boost Full Body ×3 and Upper/Lower splits to the top. High frequency maximizes protein synthesis for newer lifters.
  - Page 9 (Set & Rep Preferences): Default rep range to Mixed/Undulating — heavy compounds at 5–8 reps (to build strength quickly) and accessories at 10–15 reps (for hypertrophy and metabolic demand). Default set types to Straight Sets + Supersets (time-efficient, keeps heart rate elevated).
  - Page 10 (Rest): Default to Moderate (60–90 sec) or Auto. Shorter rest sustains metabolic demand, which supports fat loss.
  - Page 12 (Cardio): Pre-populate with cardio ON, type = HIIT + LISS Mix, frequency = 3×/week, placement = after lifting or on off-days, duration = 20 min. Cardio is non-negotiable for this goal.
  - Page 13 (Progression): Default to Linear Progression (if Beginner/Novice) or Double Progression (if Intermediate+). These users will progress quickly and linear models capture those gains.
  - Secondary goal "get stronger" is effectively baked in — the program already includes progressive overload on compounds. Do not show it as a secondary option.
- If primary = **Lean Out & Preserve**:
  - Page 6 (Training Style): Maintain whatever base style the user has been following. For modifiers, default Volume Framework to Evidence-Based Volume (calibrating volume precisely prevents both muscle loss and recovery breakdown in a deficit). Discourage Minimum Effective Dose unless paired with HIT.
  - Page 8 (Prioritization): Default all muscle groups to Maintain. Show a note: "During a cut, the goal is to preserve what you have. Emphasizing muscle groups is possible but increases fatigue in a caloric deficit."
  - Page 9 (Set & Rep Preferences): Default rep range to Hypertrophy-Focused (8–12) to maintain mechanical tension on existing muscle. Avoid Endurance/Metabolic as the primary range (high-rep/low-load is less effective at muscle preservation).
  - Page 10 (Rest): Default to Moderate or Auto. Avoid Short rest — recovery is already compromised in a deficit.
  - Page 12 (Cardio): Pre-populate with cardio ON, type = LISS (steady-state is less fatiguing and interferes less with recovery than HIIT during a cut), frequency = 2–3×/week, placement = on off-days or separate sessions, duration = 30 min. Show a note: "During a cut, LISS cardio is generally preferred over HIIT because it's easier to recover from when you're in a caloric deficit."
  - Page 13 (Progression): Default to RPE/RIR-Based Auto-Regulation (the lifter's capacity will fluctuate in a deficit — fixed percentages or linear increases will break down). If Novice, default to Double Progression instead.
  - Page 14 (1RM): Especially important here — the program needs accurate baselines to prescribe loads that maintain intensity without exceeding recovery capacity.
- If primary = **Build Muscle**: Page 12 (Cardio) defaults to No. Page 9 defaults to Hypertrophy-Focused (8–12). Page 10 defaults to Moderate rest (60–90 sec).
- If primary = **Build Strength**: Page 9 (Set & Rep Preferences) defaults to Strength-Focused (3–6). Page 10 (Rest) defaults to Long (2–3 min). Page 6 (Training Style) boosts Powerlifting / Strength and Powerbuilding.
- If primary = **Athletic Performance**: Page 6 (Training Style) boosts Powerbuilding and Powerlifting / Strength. For modifiers, default Periodization Strategy to Block Periodization.
- If primary = **General Fitness & Conditioning**: Page 6 boosts Full-Body / Minimalist. Page 12 defaults cardio ON with LISS + HIIT Mix.

### UX Notes
- Use visual cards or large tap targets, not a dropdown. This is the user's first interaction with the wizard and should feel decisive, not clinical.
- Each goal card should have the one-line subtitle shown above. The subtitles are critical for Transform vs. Lean Out — without them, users won't know which applies to them.
- **Transform vs. Lean Out distinction**: The key differentiator is the user's starting point. Transform is "I don't have much muscle yet and I have fat to lose." Lean Out is "I've built muscle and I want to see it." If user testing shows confusion between these two, consider adding a clarifying sentence under each: Transform — "Best if you're newer to lifting or haven't trained consistently" / Lean Out — "Best if you've been lifting and want to cut without losing size."

---

## Page 2: Training Experience

### Purpose
Gate exercise complexity, volume ceilings, progression model options, and whether to show simplified vs. advanced controls throughout the wizard. A true beginner should never see Myo-Reps or Mechanical Advantage Drop Sets as options. An advanced lifter shouldn't be funneled into linear progression.

### Inputs

**Experience Level** (single select, required)
- True Beginner — Less than 6 months of consistent resistance training
- Novice — 6 to 18 months of consistent training
- Intermediate — 2 to 4 years of consistent training
- Advanced — 5+ years of consistent, structured training

**Current Training Status** (single select, required)
- Currently training consistently
- Returning after a short break (less than 3 months)
- Returning after a long break (3–12 months)
- Returning after an extended layoff (12+ months)
- Starting from scratch / never trained before

### Conditional Logic
- **Beginner + Starting from scratch**: Limit base training style options on Page 6 to Full-Body / Minimalist, Bodybuilding / Hypertrophy (with simplified defaults), Powerlifting / Strength, and Calisthenics. Hide HIT and Powerbuilding. Lock Volume Framework to Fixed Volume and Periodization to None / Straight Run. Limit split options on Page 7 to Full Body only (2–3 days) or Upper/Lower (4 days). On Page 9, hide advanced set types (drop sets, rest-pause, myo-reps, cluster sets, mechanical advantage drop sets). On Page 13, default to Linear Progression and hide Undulating and RPE/RIR options.
- **Beginner + Returning after extended layoff**: Same as above but allow Upper/Lower at 3 days.
- **Novice**: Unlock all base styles except HIT (which requires understanding of true failure). Unlock DUP periodization. Unlock all splits feasible for their day count. Unlock pyramid sets and supersets on Page 9 but keep myo-reps, cluster sets, and MADS hidden.
- **Intermediate**: Unlock everything. Default Page 13 to Double Progression or RPE/RIR.
- **Advanced**: Unlock everything. Surface Block Periodization and DUP prominently on Page 6 modifiers. Default Page 13 to RPE/RIR or Percentage-Based.
- **Returning after any break**: The wizard should add a note on Page 15 (Review) recommending 1–2 ramp-up weeks at reduced intensity before following the program as prescribed. If the break was 12+ months, the experience level should be treated as one tier lower for volume ceiling purposes (e.g., an Intermediate returning after 18 months gets Novice-level volume defaults).

### UX Notes
- Include a short clarifier under each experience level so users self-select accurately: "Consistent means training at least 3x/week with a structured program, not occasional gym visits."

---

## Page 3: Body Profile & Constraints

### Purpose
Surface the user's physical profile data (pulled from their existing FATRAT profile) for context, collect injury flags that trigger exercise substitution logic, and optionally capture aesthetic trouble spots that can bias exercise selection and volume allocation.

### Inputs

**Profile Summary** (read-only display, not editable in wizard)
Show the user's age, biological sex, body weight, and height as a compact "From your profile" card, with an "Edit in profile" link/button that navigates to the profile settings (outside the wizard). These values are used for 1RM estimation on Page 14, body-weight-relative starting weights, bodyweight exercise scaling (e.g., weighted vs. assisted pull-ups), and limb-length considerations in exercise selection. Units (lbs/kg, ft/in/cm) are determined by the profile's unit preference.

**Injuries or Limitations** (multi-select, optional)
- Shoulders (rotator cuff, impingement, labrum)
- Lower Back (disc, chronic pain, SI joint)
- Knees (meniscus, patella, ligament)
- Wrists / Elbows (tendinitis, carpal tunnel)
- Hips (impingement, labrum, bursitis)
- Neck / Upper Spine
- None

**Stubborn Areas You Want to Work On** (multi-select, optional)
"Any areas you'd like extra attention on?"
- Belly fat
- Flat / flabby glutes
- Love handles
- Arm definition
- Thighs
- Chest / pecs
- Calves

This is a soft signal, not a hard override. The program engine uses it to bias volume allocation and exercise selection where it fits the chosen split — e.g., selecting "flat/flabby glutes" might add a glute-focused accessory or nudge the glute tier toward Grow if the user left it at Maintain on Page 8. It does NOT override the user's explicit tier assignments on Page 8.

### Conditional Logic
- **Shoulder flag**: On exercise generation, substitute or remove behind-the-neck presses, upright rows, and any movement requiring extreme shoulder external rotation under load. Prefer landmine press over barbell overhead press. Flag barbell bench press as a potential issue and offer dumbbell or floor press as default.
- **Lower back flag**: Substitute conventional deadlift with trap bar deadlift, Romanian deadlift, or hip hinge machine. Avoid good mornings. Prefer belt squat or leg press over barbell back squat. Remove barbell rows in favor of chest-supported rows.
- **Knee flag**: Reduce or eliminate deep squat variations. Prefer leg press with limited ROM, wall sits, or terminal knee extensions. Remove walking lunges; substitute with reverse lunges or step-ups if tolerated.
- **Wrist/Elbow flag**: Substitute straight barbell curls with EZ-bar or hammer curls. Avoid heavy wrist extension work. Offer neutral-grip pressing alternatives.
- **Hip flag**: Reduce or eliminate deep hip flexion movements. Substitute sumo deadlift with conventional. Limit lunge depth. Prefer hip thrust variations.
- **Age 50+ or 60+** (from profile): Automatically increase default rest periods by 15–30 seconds. Slightly reduce default volume ceiling (e.g., cap at MAV rather than pushing toward MRV). Add a warm-up recommendation note to the generated program.
- **Under 18** (from profile): Add a note about parental guidance and avoiding 1RM testing; default Page 14 to "start me conservative."

### UX Notes
- Injury flags should be presented as checkboxes, not as a dropdown. Allow multiple selections. Consider a brief "tell us more" optional text field for each flagged area so the user can specify (e.g., "left shoulder only — partial tear 2019, fully rehabbed").
- The "Stubborn areas" section should feel casual and optional — it's a nice-to-have input, not a required field. Present it after injuries with lighter visual weight.

---

## Page 4: Schedule & Availability

### Purpose
Establish time constraints that directly determine which training splits are viable on Page 7 and set the boundaries for session volume.

### Inputs

**Days Per Week** (single select, required)
- 2 days
- 3 days
- 4 days
- 5 days
- 6 days
- 7 days

Selector shows just the number (no "days" label on each pill).

**Session Length** (single select, required)
- 30 minutes
- 45 minutes
- 60 minutes
- 75 minutes
- 90+ minutes

**Start Day** (single select, required, default Monday)
- Mon / Tue / Wed / Thu / Fri / Sat / Sun
- Shows a "Starts <date>" preview below the selector (e.g., "Starts Monday, June 8"). The start day is always a training day. Rest day assignment is handled on Page 7 via the Rest Day picker.

**Program Duration** (single select, required)
- 4 weeks
- 6 weeks
- 8 weeks
- 12 weeks
- Ongoing (auto-generate new mesocycles when the current one ends)

### Conditional Logic
- **2 days**: On Page 7, only show Full Body or Upper/Lower splits. On Page 8 (Muscle Prioritization), warn that emphasizing more than 2 muscle groups is difficult with 2 days — the volume has to fit somewhere.
- **3 days**: Unlock Full Body, Push/Pull/Legs (each hit once), and Upper/Lower/Full Body hybrid.
- **4 days**: Unlock Upper/Lower ×2, PPL + repeat day, PHUL-style.
- **5 days**: Unlock PPL + Upper/Lower, Bro Split, PHAT-style.
- **6 days**: Unlock PPL ×2 and Arnold Split.
- **7 days**: Unlock all splits. Show a note: "Training 7 days a week means no dedicated rest days. Make sure your split allows each muscle group adequate recovery time between sessions." On Page 7, the Rest Day picker shows "You train every day — no rest days."
- **30-minute sessions**: Cap total working sets per session at approximately 12–16. On Page 9, discourage long rest periods. On the generated program, favor supersets and giant sets to compress work into available time.
- **90+ minute sessions**: No constraints. Allow full volume expression.
- **Ongoing duration**: On Page 13, show a note explaining that the program will auto-generate a new mesocycle using the same progression model and training style, with a deload at the transition point. The user can re-enter the wizard at any time to change parameters.

### Edge Cases
- If a user selects 2 days + 30-minute sessions + Advanced experience, the wizard should surface a warning: "With 2 short sessions per week, we'll focus on the highest-impact compound movements. Volume per muscle group will be at the minimum effective dose. For faster progress, consider adding a day or extending session length." Allow the user to proceed anyway.

---

## Page 5: Equipment Access

### Purpose
Filter the entire exercise library to only movements the user can actually perform. This is the primary constraint on exercise selection in the generated program.

### Inputs

**Training Environment** (single select, required)
- Commercial Gym (full equipment assumed unless unchecked)
- Home Gym (custom equipment list)
- Garage / Minimal Setup (custom equipment list)
- Bodyweight Only (skip equipment checklist)
- Hotel / Travel (limited: bodyweight + bands + maybe dumbbells)

**Equipment Checklist** (multi-select, shown unless Bodyweight Only is selected)
Pre-filtered by environment — Commercial Gym pre-checks everything; Home Gym and Garage start unchecked. Hotel/Travel pre-checks Bodyweight and Resistance Bands only.

- Barbell & Weight Plates (including standard and/or Olympic)
- Power Rack or Squat Rack
- Dumbbells — Fixed set (full range)
- Dumbbells — Adjustable (limited weight range)
- Kettlebells
- Resistance Bands / Tubes
- Pull-Up Bar
- Cable Machine (single or dual stack)
- Smith Machine
- Leg Press Machine
- Lat Pulldown / Seated Row Machine
- Chest Press / Shoulder Press Machine
- Leg Curl / Leg Extension Machine
- Pec Deck / Fly Machine
- Hack Squat Machine
- Functional Trainer (dual cable crossover)
- Suspension Trainer (TRX or similar)
- Bench — Flat only
- Bench — Adjustable (flat + incline + decline)
- Dip Station / Dip Bars
- EZ Curl Bar
- Trap Bar / Hex Bar
- Landmine Attachment
- Ab Wheel / Ab Roller
- GHD (Glute-Ham Developer)
- Battle Ropes
- Sled / Prowler
- Rowing Machine / Assault Bike / Ski Erg (for cardio/conditioning)

### Conditional Logic
- **Bodyweight Only**: On exercise generation, the entire program uses calisthenics progressions. On Page 6, boost Calisthenics / Bodyweight training style to the top and default Volume Framework to Autoregulated Volume. On Page 14, skip 1RM entry entirely — use bodyweight progression milestones instead (e.g., max push-ups, pull-up count).
- **No Barbell**: Remove all barbell movements from the exercise pool. On Page 14, show 1RM entry only for dumbbell or machine equivalents.
- **No Pull-Up Bar and No Lat Pulldown**: Flag that vertical pull options are severely limited. Suggest resistance band pull-aparts and inverted rows as partial substitutes, but note to the user that lat development will be constrained.
- **No Bench**: Substitute bench press with floor press (if dumbbells available) or push-up progressions.
- **Dumbbells — Adjustable**: On exercise generation, note that weight jumps may be larger than ideal. Add a recommendation for microplates or fractional plates in the program notes.
- **Hotel/Travel**: Auto-suggest shorter sessions, higher rep ranges (to compensate for lighter loads), and circuit-style training.

### UX Notes
- Commercial Gym should have a "select all / deselect all" toggle at the top of the checklist, with everything pre-checked. The user just unchecks what their gym doesn't have.
- Home Gym and Garage should start unchecked so the user builds their list intentionally.
- Consider grouping equipment by category: Free Weights, Machines, Cables, Bodyweight/Accessories, Cardio Equipment.

---

## Page 6: Training Style & Modifiers

### Purpose
Define the structure of the user's training sessions (base training style) and layer on modifiers that govern how volume and periodization are managed across the program. This page replaces a flat "philosophy" list with a two-step selection that separates *what your session looks like* from *how your program is organized over time*.

The distinction matters because these are independent axes. A user can do Bodybuilding-style sessions with evidence-based volume management and block periodization — or Bodybuilding-style sessions with fixed volume and no periodization. The old flat list forced users to choose between options that weren't mutually exclusive (e.g., "Bodybuilding" vs. "Science-Based," when Science-Based is really Bodybuilding with an evidence-based volume framework).

### Inputs

#### Step 1: Base Training Style (single select, required)

"How should your training sessions be structured?"

Each style is presented as a card with a name, one-line description, and a contextual "recommended for you" badge based on prior answers. These are mutually exclusive — you can't structure a session two ways at once.

1. **Powerlifting / Strength**
   - "Heavy compound lifts, low reps, long rest. Performance over aesthetics."
   - Session character: 3–5 primary compound lifts at 1–5 reps, 3–5 min rest, minimal accessory work.
   - Best fit: Build Strength goal, any experience level, barbell access.
   - Downstream defaults: Rep range → Strength-Focused (3–6). Rest → Long (2–3 min). Split → Upper/Lower or Full Body.

2. **Bodybuilding / Hypertrophy**
   - "High volume, multiple angles per muscle, chase the pump. Aesthetics-driven."
   - Session character: 4–6 exercises per muscle group across the week, 8–12 reps, moderate rest, isolation work, intensity techniques.
   - Best fit: Build Muscle goal, Intermediate+ experience, 4+ days/week, 60+ minute sessions.
   - Downstream defaults: Rep range → Hypertrophy-Focused (8–12). Rest → Moderate (60–90 sec). Split → PPL or Bro Split.

3. **High-Intensity Training (HIT / Mentzer-Style)**
   - "One all-out set to failure per exercise. Brief, brutal, then recover."
   - Session character: 4–6 exercises, one working set each taken to absolute muscular failure, extended recovery between sessions (48–72+ hours per muscle group).
   - Best fit: Build Muscle, Transform My Body, or General Fitness. Intermediate+ experience (must understand true failure). Limited session time.
   - Downstream defaults: Rep range → 6–10 (to failure). Rest → N/A (one set per exercise, 1–2 min between exercises). Split → Full Body 2–3×/week. Set types → Straight Sets only (intensity is within the set, not across sets).

4. **Powerbuilding (Strength + Size Hybrid)**
   - "Start heavy with compounds for strength, finish with higher-rep work for size."
   - Session character: 1–2 heavy compounds at 3–5 reps to open the session, then 3–5 accessories at 8–12 reps. Blends both stimulus types within each session.
   - Best fit: Build Muscle + Build Strength combined, Transform My Body, Intermediate+ experience, barbell access.
   - Downstream defaults: Rep range → Mixed (3–5 on main lifts, 8–12 on accessories). Rest → Auto (long for compounds, moderate for accessories). Split → Upper/Lower or PHUL.

5. **Full-Body / Minimalist**
   - "Train every muscle every session. Compound lifts, minimum effective dose, high frequency."
   - Session character: 5–7 compound-focused exercises covering the full body, moderate reps, moderate rest. Efficiency over volume.
   - Best fit: Beginners, Transform My Body, 2–3 days/week, short sessions, General Fitness.
   - Downstream defaults: Rep range → 5–8 (compounds), 10–15 (accessories). Rest → Moderate (90 sec–2 min). Split → Full Body.

6. **Calisthenics / Bodyweight**
   - "Build strength using only your body. Progress by making movements harder, not heavier."
   - Session character: Bodyweight exercises organized by movement pattern (push, pull, squat, hinge, core). Progression is movement difficulty, not load.
   - Best fit: Bodyweight Only equipment selection, any goal, any experience.
   - Downstream defaults: Rep range → Varies by progression level. Rest → 60–90 sec. Split → Full Body or Upper/Lower.
   - **Special behavior**: Exercise progressions replace weight progressions throughout the program. Instead of adding load, the program advances movement difficulty (push-up → diamond push-up → archer push-up → one-arm push-up). This also affects Page 13 (Progression Model) — weight-based progression methods are replaced with movement-progression milestones.

**"Not sure — recommend one for me"** (fallback option)
If selected, the wizard auto-selects based on a priority matrix:
- Beginner + any goal → Full-Body / Minimalist
- Build Strength + barbell access → Powerlifting / Strength
- Build Muscle + 4+ days → Bodybuilding / Hypertrophy
- Build Muscle + 2–3 days → Powerbuilding
- Transform My Body → Full-Body / Minimalist or Powerbuilding (maximize newbie gains + fat loss)
- Lean Out & Preserve → Bodybuilding / Hypertrophy (preserve existing muscle with familiar stimulus)
- Athletic Performance → Powerbuilding or Powerlifting / Strength
- General Fitness → Full-Body / Minimalist
- Bodyweight Only → Calisthenics / Bodyweight
- Short sessions + any goal → HIT or Full-Body / Minimalist

#### Step 2: Volume Framework (single select, required)

"How should we manage your training volume across the program?"

This modifier determines how set counts are prescribed and adjusted over the mesocycle. It is shown after the base style is selected, with a smart default pre-set. The selected volume framework is what the old wizard called "Science-Based" — that label is retired because evidence-based volume management is a modifier that applies to any base style, not a competing style in its own right.

- **Fixed Volume** — Prescribed sets per exercise, consistent across the mesocycle. Simple and predictable. Best for beginners and users who want a straightforward plan.
  - Example: "3 sets of bench press every chest day for 8 weeks."
  - Default for: Beginners, Novice users, Full-Body / Minimalist style.

- **Evidence-Based Volume (MEV → MAV → MRV)** — Start at minimum effective volume, progressively ramp toward maximum recoverable volume across the mesocycle, then deload. This is the framework popularized by researchers like Mike Israetel and educators like Jeff Nippard. It systematically prevents both undertraining and overtraining.
  - Example: "Week 1: 10 sets/week for chest (near MEV). Week 4: 16 sets/week (approaching MRV). Week 5: deload to 6 sets."
  - Default for: Intermediate+ users, Bodybuilding style, Lean Out & Preserve goal.
  - Note: When paired with the Bodybuilding base style, this combination IS what was previously labeled "Science-Based / Evidence-Based" training.

- **Autoregulated Volume** — Adjust set count session-to-session based on performance and fatigue signals. If the user is recovering well and hitting rep targets, add a set. If they're underperforming, drop a set. Requires the user to log workouts and pay attention to performance trends.
  - Example: "Start with 3 sets of squats. If all reps are hit at RPE 7 or below, add a 4th set next session."
  - Default for: Advanced users, RPE/RIR progression model on Page 13.

- **Minimum Effective Dose** — Only the volume needed to stimulate growth. No more. Prioritizes recovery and sustainability over maximal stimulus. Pairs naturally with HIT and Full-Body styles.
  - Example: "2 hard sets per muscle group per session, 2–3 sessions per week = 4–6 sets/week per muscle."
  - Default for: HIT style, Full-Body / Minimalist style, 2-day schedules, 30-minute sessions.

#### Step 3: Periodization Strategy (single select, required)

"How should the program change across weeks?"

This modifier determines whether exercises, rep ranges, and intensity stay constant or cycle through phases. It is shown after the base style is selected, with a smart default pre-set. Periodization was previously listed as a standalone "philosophy" — it's now correctly categorized as a program organization strategy that can layer on top of any base style.

- **None / Straight Run** — Same structure, same exercises, same rep ranges throughout the program. Progression happens via load, reps, or volume (determined by Page 13), not by changing the program structure. Best for short programs (4–6 weeks) and beginners.
  - Default for: Beginners, Novice users, programs ≤ 6 weeks, HIT style.

- **Block Periodization** — Divide the program into distinct phases with different training emphases. Each block typically lasts 2–4 weeks. Exercises and rep ranges may change between blocks.
  - Example: "Weeks 1–3: Hypertrophy block (4×10 at 65%). Weeks 4–6: Strength block (5×5 at 80%). Weeks 7–8: Peaking block (3×3 at 90%)."
  - Default for: Athletic Performance goal, Intermediate+ users, programs ≥ 8 weeks.
  - **Special behavior**: Triggers phase tabs on Page 16 (Exercise Review) since exercises may change between blocks. Also requires a program duration ≥ 6 weeks (can't meaningfully periodize a 4-week program into blocks).

- **Daily Undulating Periodization (DUP)** — Rep ranges and intensity vary session to session within the same week, but exercises stay the same. Each session has a different training emphasis.
  - Example: "Monday: Heavy squats 5×3. Wednesday: Moderate squats 4×8. Friday: Light squats 3×12."
  - Default for: Intermediate+ users, Powerbuilding style, 3+ day schedules.
  - Note: Exercises do NOT change week to week, so Page 16 shows a single repeating week (same as None/Straight Run).

- **Weekly Undulating Periodization** — Rep ranges and intensity vary week to week, but exercises stay the same within each week. The entire week has a consistent emphasis that shifts across the mesocycle.
  - Example: "Week 1: All exercises at 4×10 (hypertrophy). Week 2: All exercises at 5×5 (strength). Week 3: All exercises at 3×8 (power). Repeat."
  - Default for: Intermediate+ users, programs ≥ 6 weeks.

### Conditional Logic

**Base Style filtering by experience:**
- **Beginner**: Show Powerlifting/Strength, Bodybuilding/Hypertrophy (with a note about starting simpler), Full-Body/Minimalist, and Calisthenics. Hide HIT (requires understanding of true failure) and Powerbuilding (hybrid approach is premature). If Bodyweight Only equipment, show only Calisthenics and Full-Body.
- **Novice**: Show all except HIT.
- **Intermediate+**: Show all.

**Volume Framework filtering:**
- **HIT base style**: Lock to Minimum Effective Dose. HIT and Evidence-Based Volume are philosophically incompatible — HIT explicitly rejects the volume paradigm.
- **Beginner**: Hide Autoregulated Volume (requires performance tracking experience). Default to Fixed Volume.
- **Lean Out & Preserve goal**: Boost Evidence-Based Volume (MEV → MAV → MRV) to the top with a note: "During a cut, calibrating volume precisely prevents both muscle loss from undertraining and recovery breakdown from overtraining."

**Periodization Strategy filtering:**
- **Beginner**: Lock to None / Straight Run. Periodization adds complexity beginners don't need.
- **Novice**: Show None and DUP only. Block and Weekly Undulating are premature.
- **Program duration ≤ 4 weeks**: Hide Block Periodization (can't meaningfully divide into blocks).
- **HIT base style**: Default to None / Straight Run (HIT's progression is within-set intensity, not phase cycling).
- **Athletic Performance goal**: Boost Block Periodization to the top.

**Invalid combinations** (gray out with tooltip):
- HIT + Evidence-Based Volume → "HIT rejects the volume paradigm by design. Minimum Effective Dose is the natural fit."
- HIT + Autoregulated Volume → "HIT uses fixed, maximal effort. There's no volume dial to adjust."
- HIT + Block Periodization → "HIT doesn't cycle through phases — intensity is always maximal."
- Calisthenics + Fixed Volume → Not invalid, but show a note: "With bodyweight training, volume often needs to flex as you progress to harder variations. Consider Evidence-Based or Autoregulated."
- Block Periodization + program duration < 6 weeks → "Block periodization needs at least 6 weeks to meaningfully divide into phases."

### UX Notes
- Present Step 1 (Base Style) as large visual cards, same as Page 1. After the user selects a base style, Steps 2 and 3 appear below (or on a smooth scroll-down) with smart defaults already selected. Most users will accept the defaults — the modifiers are there for users who want control.
- Each modifier option should have a one-line description visible by default and an expandable "learn more" section with the example.
- The "Not sure" fallback on Step 1 should also auto-select the modifier defaults. A user who picks "Not sure" wants the entire decision made for them.
- Sort base style cards by fit score. Show a short "Why this fits you" note under each recommended option.
- Steps 2 and 3 should be visually subordinate to Step 1 — smaller cards or a more compact layout — to signal that they're refinements, not primary decisions. For beginners, consider auto-collapsing Steps 2 and 3 with a "Customize advanced settings" expander, since their defaults will be locked or near-locked anyway.

---

## Page 7: Training Split

### Purpose
Determine how muscle groups are distributed across training days. Only splits that are feasible for the user's day count, training style, and goals should be shown.

### Inputs

**Training Split** (single select, required)
Each option should show a visual preview — a mini weekly calendar showing which muscle groups land on which day.

**Available splits by day count:**

**2 days/week:**
- Full Body ×2
- Upper / Lower

**3 days/week:**
- Full Body ×3
- Push / Pull / Legs (each once)
- Upper / Lower / Full Body Hybrid

**4 days/week:**
- Upper / Lower ×2
- Push / Pull / Legs + 1 repeat day (user picks which day repeats)
- PHUL-style (Power Upper / Power Lower / Hypertrophy Upper / Hypertrophy Lower)

**5 days/week:**
- Push / Pull / Legs + Upper / Lower
- Bro Split (Chest / Back / Shoulders / Legs / Arms)
- PHAT-style (2 power days + 3 hypertrophy days)
- Upper / Lower / Push / Pull / Legs

**6 days/week:**
- Push / Pull / Legs ×2
- Arnold Split (Chest+Back / Shoulders+Arms / Legs, repeated)
- Push / Pull / Legs / Upper / Lower + 1 repeat

### Conditional Logic
- **Training Style = Full-Body / Minimalist**: Only show Full Body splits regardless of day count.
- **Training Style = HIT**: Only show Full Body ×2 or Full Body ×3 (HIT demands extended recovery between sessions).
- **Training Style = Bodybuilding / Hypertrophy + 5–6 days**: Boost Bro Split and PPL ×2 to the top.
- **Training Style = Powerbuilding + 4 days**: Boost PHUL to the top.
- **Periodization Strategy = Block Periodization**: Show the standard split options but add a note: "Your exercises and rep ranges will change across phases, but the split structure stays consistent."
- **Goal = Build Strength + 4 days**: Boost Upper/Lower ×2 to the top (maximizes compound frequency).
- **PPL + 1 repeat day (4 days)**: Show a sub-selector asking which day to repeat. Default recommendation: repeat the day containing the user's emphasized muscle groups from Page 8 (if Page 8 comes after, use goal-based defaults — e.g., Build Muscle defaults to repeating Push or Legs).

### Visual Preview
For each split option, show a compact weekly grid starting from the user's selected start day (Page 4):
```
Mon: Push (Chest, Front Delts, Triceps)
Tue: Pull (Back, Rear Delts, Biceps)
Wed: Rest
Thu: Legs (Quads, Hamstrings, Glutes, Calves)
Fri: Rest
Sat: Upper (Chest, Back, Shoulders, Arms)
Sun: Rest
```
The split card's week preview already shows work/rest day assignments. Rest days are auto-distributed for optimal recovery spacing based on the day count and start day.

### Rest Day Picker
After the user selects a split, an inline **Rest Day picker** appears directly below the selected split card. This is a 7-day work/rest strip (Mon–Sun, starting from the user's start day) where the user can tap to toggle rest days.

**Rules:**
- The number of rest days equals 7 minus the selected day count. Marking a new rest day frees the oldest one (swap behavior — the total rest day count is fixed).
- The start day is always a work day and cannot be toggled to rest.
- If the user selected 7 days/week on Page 4, the rest day picker shows a note: "You train every day — no rest days" and is non-interactive.
- The split card's visual preview updates in real time as rest days change.

### UX Notes
- Don't just list split names — many users won't know what "PHUL" means. Each option needs a subtitle explaining the structure: "PHUL — 4 days: 2 power-focused + 2 hypertrophy-focused, hitting upper and lower body twice each."
- The visual preview is essential. A user should be able to look at the preview and immediately understand which muscles they're training on which day.
- The Rest Day picker should NOT render as a duplicate week strip — it is integrated into the split card's existing week preview. One visual, not two.

---

## Page 8: Muscle Group Prioritization

### Purpose
Allow the user to bias volume allocation toward muscle groups they want to grow most, while maintaining minimum effective volume on everything else. This directly drives per-muscle weekly hard-set targets in the generated program via the volume landmark model.

### Inputs

**Prioritization Tiers** (per-muscle row with tier buttons, required)

Each muscle group is shown as a row with an **N/A** button and three tier buttons: **Maintain / Grow / Emphasize**. Each muscle starts in a default tier based on the user's goal and training style. The user can reassign any muscle group. An **"X / 3 emphasized"** counter is shown at the top of the page. Tiers are color-coded.

**Tiers:**
- **N/A** — Removes this muscle from the program entirely. No exercises generated, no volume allocated. Use for muscles the user explicitly does not want to train (e.g., someone who never wants direct calf work).
- **Maintain** — Minimum effective volume (approximately ½ MEV from the app's `lib/periodization` landmarks). The muscle is trained but at the lowest dose needed to prevent regression. Programmed after higher-priority muscles in session order.
- **Grow** — Standard growth volume (approximately MAV from landmarks). The default tier for most muscle groups. This is the "normal" training dose that drives meaningful hypertrophy for the user's experience level.
- **Emphasize** — Maximum volume (toward MRV from landmarks). Programmed first in session and/or hit with extra frequency (e.g., twice in the split instead of once). Maximum of **3** muscle groups in this tier — exceeding 3 is hard-capped.

**Muscle Groups** (matching the app's `TEMPLATE_MUSCLES`):
- Chest
- Back
- Shoulders
- Biceps
- Triceps
- Forearms
- Quads
- Hamstrings
- Glutes
- Calves

Note: Shoulders are NOT split into front/side/rear delts, and back is NOT split into lats/upper back, at any experience level. This keeps the prioritization UI consistent with the app's existing muscle model.

### Volume Derivation (for program generation — not shown to user on this page)
Each muscle's weekly hard-set target is derived from its tier assignment combined with per-muscle volume landmarks from the app's `lib/periodization` module, adjusted for the user's experience level. There are no fixed per-tier set ranges — the landmark values are the single source of truth. The tier-to-landmark mapping is:
- **Emphasize** → toward that muscle's MRV for the user's experience level
- **Grow** → approximately that muscle's MAV
- **Maintain** → approximately ½ that muscle's MEV
- **N/A** → 0 sets

This derived number drives both the Page 15 volume card and Page 16 exercise generation, and they must reconcile exactly.

### Conditional Logic
- **Goal = Build Muscle**: Default all muscle groups to Grow.
- **Goal = Build Strength**: Default Quads, Back, Chest to Emphasize (the powerlifting big three muscles). Default Shoulders, Hamstrings, Triceps to Grow. Default Biceps, Forearms, Calves to Maintain.
- **Goal = Transform My Body**: Default Chest, Back, Quads to Emphasize (big muscle groups that burn the most calories and create the most visible change). Default everything else to Grow. Show a note: "We're prioritizing the muscles that will create the biggest visual transformation and burn the most energy."
- **Goal = Lean Out & Preserve**: Default everything to Grow (even volume distribution preserves existing muscle across the board in a deficit). Show a note: "During a cut, the priority is keeping what you have. You can emphasize 1–2 groups if you want, but be aware that extra volume is harder to recover from in a caloric deficit."
- **Goal = Athletic Performance**: Default Quads, Hamstrings, Glutes to Emphasize. Default Back, Shoulders to Grow. Default Biceps, Forearms, Calves to Maintain.
- **2 days/week or 30-minute sessions**: Warn if more than 2 muscle groups are in Emphasize — there isn't enough session time to meaningfully prioritize more than that.
- **Stubborn areas (from Page 3)**: If a stubborn area maps to a muscle group that's currently set to Grow, show a subtle suggestion to bump it to Emphasize — but do NOT auto-promote. The user's explicit tier assignment always wins. Mapping: belly fat → no muscle mapping (handled by cardio/diet), flat/flabby glutes → Glutes, love handles → no muscle mapping, arm definition → Biceps + Triceps, thighs → Quads + Hamstrings, chest/pecs → Chest, calves → Calves.

### UX Notes
- Each muscle group is a row with an N/A button on the left and Maintain / Grow / Emphasize buttons on the right, matching the app's existing component style.
- The "X / 3 emphasized" counter should update in real time. When the user hits 3 Emphasize selections, the Emphasize button on all remaining muscles should gray out (hard cap, not a warning).

---

## Page 9: Set & Rep Preferences

### Purpose
Define the rep ranges and set execution styles used throughout the program. Defaults are pre-set by training style and goal; this page lets the user override or customize.

### Inputs

**Primary Rep Range** (single select, required)
Pre-selected based on training style. User can override.
- Strength-Focused (3–6 reps) — heavier loads, longer rest, more neural adaptation
- Hypertrophy-Focused (8–12 reps) — moderate loads, moderate rest, maximum mechanical tension in the growth range
- Endurance / Metabolic (12–20 reps) — lighter loads, shorter rest, metabolic stress and muscular endurance
- Mixed / Undulating — varies rep range across exercises or sessions (e.g., heavy compounds at 5 reps, accessories at 12 reps)

**Set Types** (multi-select, required — at least one)
Filtered by experience level (see Page 2 conditional logic). Each set type includes a short in-app explanation.

- **Straight Sets** — Same weight, same reps for every set. The default and simplest approach. *(Available: all levels)*
- **Pyramid Sets** — Increase weight and decrease reps each set (e.g., 12/10/8/6). *(Available: all levels)*
- **Reverse Pyramid Sets** — Start with heaviest set, then reduce weight and increase reps. Maximizes top-end intensity when freshest. *(Available: Novice+)*
- **Supersets (Agonist-Antagonist)** — Pair opposing muscle groups back to back (e.g., bicep curl → tricep extension) with no rest between. Saves time. *(Available: all levels)*
- **Supersets (Same Muscle)** — Pair two exercises for the same muscle group back to back. Maximizes pump and metabolic stress. *(Available: Novice+)*
- **Compound Sets** — Two exercises for the same muscle group performed back-to-back, typically a compound followed by an isolation (e.g., bench press → fly). *(Available: Novice+)*
- **Drop Sets** — Perform a set to failure, immediately reduce weight 20–30%, continue to failure again. Repeat 1–2 more drops. *(Available: Novice+)*
- **Rest-Pause Sets** — Perform a set to near-failure, rest 10–20 seconds, perform additional reps with the same weight. Repeat 1–2 more mini-sets. *(Available: Intermediate+)*
- **Myo-Reps** — One activation set of 12–20 reps to near-failure, followed by multiple mini-sets of 3–5 reps with short (10–15 sec) rest. Extremely time-efficient for hypertrophy. *(Available: Intermediate+)*
- **Cluster Sets** — Break a heavy set into mini-sets of 2–3 reps with 15–30 sec intra-set rest. Allows more total reps at a higher load. *(Available: Intermediate+)*
- **Giant Sets / Tri-Sets** — 3–4 exercises for the same or different muscle groups performed in sequence with no rest between. High metabolic demand. *(Available: Intermediate+)*
- **Mechanical Advantage Drop Sets (MADS)** — Perform an exercise to failure, then immediately switch to a mechanically easier variation of the same movement pattern (e.g., close-grip bench → medium-grip bench → wide-grip bench) without changing weight. *(Available: Advanced)*

**Auto-Vary Toggle** (boolean, optional, default OFF)
"Let the program mix set types across the mesocycle for variety and progressive stimulus."
If ON, the engine will rotate set types week to week — e.g., Week 1 straight sets, Week 2 introduces supersets on accessories, Week 3 adds drop sets on the final set of isolations, Week 4 deload back to straight sets. Only rotates among the set types the user selected above.

### Conditional Logic
- **Training Style = HIT**: Auto-select Straight Sets (one working set). Hide or gray out all multi-set intensity techniques (drop sets, rest-pause, etc.) since HIT uses a single all-out set. Show a note: "HIT uses one working set to absolute failure. Intensity techniques like forced reps and slow negatives are applied within that single set."
- **Training Style = Powerlifting / Strength**: Default to Straight Sets. Boost Cluster Sets visibility for advanced users. Discourage drop sets and myo-reps (not aligned with maximal strength goals).
- **30-minute sessions**: Boost Supersets, Myo-Reps, and Giant Sets to the top of the list with a note: "These set types help you get more work done in less time."
- **Mixed / Undulating rep range selected**: On program generation, use a scheme like main compound lifts at 5 reps, secondary compounds at 8 reps, accessories at 12–15 reps within each session. Or alternate heavy/light days across the week.

### UX Notes
- Set type explanations should be expandable — show the name and one-line description by default, with a "learn more" tap target that expands a full explanation with an example.
- Consider showing a "Recommended for your setup" badge on 2–3 set types based on the combination of training style, goal, experience, and session length.

---

## Page 10: Rest Periods & Tempo

### Purpose
Define rest intervals between sets and, optionally, repetition tempo. These directly affect session duration, training stimulus, and which energy systems are taxed.

### Inputs

**Rest Between Sets** (single select, required)
Pre-selected based on training style and goal. User can override.

- **Short (30–60 seconds)** — Maximizes metabolic stress, keeps heart rate elevated. Best for hypertrophy accessories, conditioning, and fat loss goals. Sessions are shorter.
- **Moderate (60–90 seconds)** — The hypertrophy sweet spot. Enough recovery to maintain performance, short enough to sustain metabolic demand.
- **Long (2–3 minutes)** — Full muscular and neural recovery between sets. Essential for heavy compound strength work (squats, deadlifts, bench at 80%+ 1RM).
- **Auto (program assigns per exercise)** — Compounds get longer rest (2–3 min), isolations get shorter rest (60–90 sec), supersets get minimal rest between exercises and moderate rest between rounds. **This is the recommended default for most users.**

**Tempo Prescription** (optional toggle, default OFF)

If toggled ON, show tempo options:
- **Controlled Eccentrics (3-0-1-0)** — 3-second lowering phase, no pause, 1-second lift, no pause at top. Increases time under tension and mechanical damage.
- **Explosive Concentrics (1-0-X-0)** — 1-second lower, explosive lift. Best for strength and power development.
- **Constant Tension (2-1-2-1)** — 2-second lower, 1-second pause at bottom, 2-second lift, 1-second squeeze at top. Maximizes tension and mind-muscle connection.
- **Program-Varied** — The engine assigns different tempos to different exercises based on their role (compounds get explosive concentrics, isolations get controlled eccentrics).
- **No Tempo Prescribed** — The user lifts at their own natural pace. (This is the default if the toggle stays OFF.)

### Conditional Logic
- **Training Style = HIT**: Default rest to "N/A — one set per exercise" and hide the rest selector. Show a note: "Rest between exercises is 1–2 minutes in HIT, just long enough to set up the next movement." Default tempo to Controlled Eccentrics (4-second negatives are a hallmark of HIT).
- **Training Style = Powerlifting / Strength**: Default rest to Long. Default tempo toggle OFF (tempo prescription is uncommon in powerlifting).
- **Goal = Transform My Body**: Default rest to Moderate or Auto. Boost the tempo toggle visibility with a note: "Adding tempo control increases calorie burn and time under tension."
- **Goal = Lean Out & Preserve or General Fitness**: Default rest to Moderate. For Lean Out, avoid Short rest — recovery is already compromised in a deficit.
- **30-minute sessions + Long rest selected**: Show a warning: "Long rest periods (2–3 min) will significantly reduce the number of exercises you can fit in 30 minutes. We recommend Auto or Moderate rest to stay within your time budget."
- **Auto rest selected**: On program generation, assign rest by exercise category:
  - Primary compound (squat, deadlift, bench, overhead press): 2–3 min
  - Secondary compound (rows, RDL, incline press): 90 sec–2 min
  - Isolation (curls, lateral raises, leg extensions): 60–90 sec
  - Superset pairs: 0 sec between exercises, 60–90 sec between rounds

### UX Notes
- Tempo notation (e.g., "3-0-1-0") will be unfamiliar to most users. Always show the notation alongside a plain-English description. Consider a small animation or diagram showing which number corresponds to which phase of the rep.
- For beginners, keep the tempo toggle OFF by default and don't draw attention to it. It adds complexity they don't need.

---

## Page 11: Core & Abs Strategy

### Purpose
Determine how core/abdominal training is woven into the program. Core work is often an afterthought in program design, but it's critical for stability, injury prevention, and aesthetics. This page ensures it's intentionally programmed.

### Inputs

**Core Integration Method** (single select, required)
The selected method expands inline to reveal its sub-controls. Only one method is expanded at a time.

- **Dedicated Core Block** — Core exercises performed at the end of each designated session.
  - *Expands to:* **Number of exercises per session** (single select): 1–2 / 2–3 / 3–4. Default: 2–3.
  - *Expands to:* **Core Frequency** (single select): Every session / Every other session / 2×/week / 3×/week.
- **Dedicated Core Day** — A separate short session (15–20 min) devoted entirely to core.
  - *Expands to:* **Day picker** — "Which day(s)?" — shows the user's weekly schedule from Page 7 and lets them tap which day(s) the core session lands on. Can be a rest day (core-only session) or attached to a shorter lifting day.
- **Superset Between Main Lifts** — Core exercises performed during rest periods of compound lifts (e.g., plank holds between squat sets). Saves time, keeps heart rate up.
  - *Expands to:* **Core Frequency** (single select): Every session / Every other session / 2×/week / 3×/week.
- **Compound-Only (Indirect)** — No dedicated core exercises. Rely on heavy squats, deadlifts, overhead presses, and other stabilization-demanding compounds to train the core indirectly. Best for experienced lifters who prioritize time on main lifts.
  - *No sub-controls.*
- **None — I'll Handle It Separately** — Core work is excluded from the generated program entirely.
  - *No sub-controls.*

### Conditional Logic
- **Training Style = Full-Body / Minimalist or HIT**: Default to Superset Between Main Lifts (time-efficient, aligns with minimalist approach) or Compound-Only.
- **Training Style = Bodybuilding / Hypertrophy**: Default to Dedicated Core Block (bodybuilders typically train abs directly for development).
- **Goal = Athletic Performance**: Default to Superset Between Main Lifts at 3×/week. Emphasize anti-rotation and anti-extension exercises (Pallof press, dead bugs, ab wheel) over crunches.
- **30-minute sessions**: Hide Dedicated Core Block and Dedicated Core Day (no time budget). Default to Superset Between Main Lifts or Compound-Only.
- **Beginner**: Default to Dedicated Core Block 2×/week with simple exercises (plank, dead bug, bird dog). Avoid advanced core work like hanging leg raises or ab wheel from standing.

### Exercise Selection Logic (for program generation)
The core exercise pool should be categorized by movement pattern:
- Anti-extension: plank, ab wheel, body saw, dead bug
- Anti-rotation: Pallof press, bird dog, single-arm farmer carry
- Anti-lateral-flexion: side plank, suitcase carry
- Flexion: cable crunch, hanging leg raise, reverse crunch
- Rotation: cable woodchop, Russian twist (only if no lower back flag)

The generated program should pull from at least 2–3 categories per session to ensure balanced core development. If the user flagged lower back issues on Page 3, exclude flexion-dominant exercises (crunches, sit-ups) and rotation exercises (Russian twists). Favor anti-extension and anti-rotation work.

### UX Notes
- This is a lower-stakes page — most users will accept the default. Keep it clean and don't overload with explanations.

---

## Page 12: Cardio & Conditioning

### Purpose
Determine whether, how, and how much cardiovascular or conditioning work is included in the program. This page may be pre-populated or even auto-answered based on the goal selected on Page 1.

### Inputs

**Include Cardio in This Program?** (single select, required)
- Yes — include it in my program
- On rest days only — I'll manage it outside the lifting program but plan it around my schedule
- No — I'll skip cardio for this program

*If "No" is selected, skip all remaining inputs on this page and proceed to Page 13.*

**Cardio Type** (multi-select if blending, or single select, required if cardio = Yes)
- **Steady-State (LISS)** — Walking, jogging, cycling, swimming at a consistent moderate pace. Heart rate at 60–70% max. Best for active recovery, general health, and fat oxidation.
- **High-Intensity Interval Training (HIIT)** — Short bursts of all-out effort followed by rest intervals (e.g., 30 sec sprint / 60 sec walk). Time-efficient fat burning, improves VO2 max.
- **LISS + HIIT Mix** — Combine both across the week (e.g., 2 HIIT sessions + 1 LISS session).
- **Conditioning Circuits** — Battle ropes, sled pushes, kettlebell complexes, assault bike intervals. Builds work capacity and muscular endurance alongside cardiovascular fitness.

**Frequency** (single select, required if cardio = Yes)
- 1 session/week
- 2 sessions/week
- 3 sessions/week
- 4 sessions/week
- 5 sessions/week

**Placement** (single select, required if cardio = Yes)
- Before lifting (warm-up / pre-exhaust)
- After lifting (post-workout)
- Separate sessions (different time of day or separate days)
- On off-days (rest days become active recovery or conditioning days)

**Duration Per Session** (single select, required if cardio = Yes)
- 10 minutes
- 15 minutes
- 20 minutes
- 30 minutes
- 45 minutes

### Conditional Logic
- **Goal = Transform My Body**: Pre-populate cardio = Yes, type = HIIT + LISS Mix, frequency = 3×/week, placement = After lifting or On off-days, duration = 20 min. Show a note: "Cardio is a key part of your transformation — it accelerates fat loss while your lifting program builds new muscle."
- **Goal = Lean Out & Preserve**: Pre-populate cardio = Yes, type = LISS (less fatiguing, better for recovery in a deficit), frequency = 2–3×/week, placement = On off-days or separate sessions, duration = 30 min. Show a note: "Steady-state cardio is preferred during a cut — it burns calories without hammering your recovery the way HIIT does."
- **Goal = Build Muscle (pure hypertrophy)**: Default cardio = No. If the user turns it on, show a note: "Keep cardio moderate — excessive cardio can interfere with muscle recovery and growth. We recommend LISS 2×/week on off-days for general health without compromising gains."
- **Goal = Build Strength**: Default cardio = No. Same advisory note if turned on, with additional caution: "High-intensity cardio the day before a heavy squat or deadlift day can impair performance."
- **Goal = Athletic Performance**: Default cardio = Yes, type = Conditioning Circuits or HIIT, frequency = 2–3×/week.
- **HIIT selected + Before lifting placement**: Show a warning: "Doing HIIT before lifting will significantly reduce your strength performance. We recommend placing HIIT after lifting or on separate days."
- **Frequency > days available for cardio**: If the user's lifting days + cardio days exceed 7, warn: "Your schedule doesn't leave enough rest days. Consider placing cardio after lifting sessions instead of on separate days, or reduce cardio frequency."
- **Training Style = HIT**: Show a note: "HIT's low training frequency leaves room for cardio on off-days without overtraining. Consider 2–3 LISS sessions for recovery."

### UX Notes
- If the user selected "No" on the first input, collapse the rest of the page immediately and show a "Next" button. Don't show grayed-out inputs — just skip them.
- The "On rest days only" option should clarify that the program will show recommended cardio activities and durations on rest days but won't generate structured cardio workouts (just guidelines).

---

## Page 13: Progression Model

### Purpose
Define how the program advances over time — how load, volume, and intensity change from week to week and session to session. This is the engine that turns a static workout template into a dynamic training program.

### Inputs

**Progression Type** (single select, required)
Filtered by experience level (see Page 2 conditional logic).

- **Linear Progression** — Add weight every session (e.g., +5 lbs on upper body lifts, +10 lbs on lower body lifts each workout). Simple and effective for beginners who can recover and adapt quickly. *(Available: all levels, recommended for Beginners)*
- **Double Progression** — Work within a rep range (e.g., 3×8–12). When you can complete all sets at the top of the range, increase the weight and drop back to the bottom of the range. Sustainable and self-regulating. *(Available: all levels, recommended for Novice/Intermediate)*
- **Percentage-Based Progression** — Loads prescribed as a percentage of your 1RM or Training Max, increasing by a set percentage each week (e.g., Week 1: 70%, Week 2: 75%, Week 3: 80%, Week 4: deload at 60%). Requires accurate 1RM data. *(Available: Intermediate+)*
- **Undulating / Wave Loading** — Intensity and volume vary session to session or week to week in a planned wave (e.g., heavy Monday / moderate Wednesday / light Friday, or heavy week / moderate week / light week). Prevents accommodation and manages fatigue. *(Available: Intermediate+)*
- **RPE / RIR-Based Auto-Regulation** — Loads are prescribed by effort level rather than fixed percentages. RPE 8 = "could have done 2 more reps." The user adjusts weight each session to hit the target RPE. Most flexible and fatigue-responsive, but requires self-awareness. *(Available: Intermediate+, recommended for Advanced)*

**Deload Protocol** (single select, required)
- **Scheduled Deload** — Automatically reduce volume and/or intensity every Nth week (default: every 4th week). Proactive fatigue management.
  - Sub-option: Deload frequency — Every 3rd week, Every 4th week, Every 5th week, Every 6th week. Default based on experience: Beginners every 4th, Intermediate every 4th–5th, Advanced every 3rd–4th.
  - Sub-option: Deload style — Reduce volume (halve sets, keep weight), Reduce intensity (keep sets, reduce weight 40–50%), or Both.
- **Reactive Deload** — No scheduled deload. The app monitors performance (e.g., if the user fails to hit minimum reps for 2 consecutive sessions on the same lift, suggest a deload). Requires the user to log workouts.
- **No Deload** — Not recommended, but available. Show a note: "Training without deloads increases injury risk and plateau likelihood, especially for programs longer than 4 weeks."

### Conditional Logic
- **Periodization Strategy = Block Periodization (from Page 6)**: Lock progression to Percentage-Based or Undulating (block periodization inherently requires structured load management across phases). Show phase structure: "Your program will cycle through phases with different rep ranges and loads. The progression model governs how load increases within each phase."
- **Periodization Strategy = DUP (from Page 6)**: Boost Undulating / Wave Loading to the top (DUP and undulating progression are natural companions). Also compatible with RPE/RIR.
- **Training Style = HIT**: Default to Double Progression (add a rep each session until you hit the top of the range, then add weight). Linear Progression and Percentage-Based are not aligned with HIT's single-set-to-failure approach.
- **Training Style = Calisthenics / Bodyweight**: Replace weight-based progression with movement-progression milestones. Instead of "add 5 lbs," the progression is "move to the next harder variation when you can complete 3×12 of the current variation."
- **Beginner + Percentage-Based selected**: Show a warning: "Percentage-based progression requires accurate 1RM data, which can be difficult for beginners to establish safely. We recommend Linear or Double Progression for your experience level."
- **Program duration = 4 weeks + Scheduled Deload every 4th week**: This means only 3 training weeks + 1 deload. Show a note: "With a 4-week program and deloads every 4th week, you'll have 3 progressive weeks and 1 deload week. Consider extending to 6–8 weeks for more training volume before the deload."
- **Ongoing program duration + Reactive Deload**: The program auto-generates mesocycles and monitors for stalls. When a deload is triggered, the next week is automatically a deload, and then the following mesocycle begins with slightly adjusted parameters.

### UX Notes
- Each progression type needs a concrete example, not just a description. E.g., "Double Progression example: Week 1 you bench 135 lbs for 3×8. Weeks 2–4 you add reps: 3×9, 3×10, 3×12. Week 5 you increase to 140 lbs and drop back to 3×8."
- The deload section should be collapsible — most beginners and casual users won't know or care about deload protocols. Show a sensible default and let advanced users expand to customize.

---

## Page 14: Strength Baselines (1RM Entry)

### Purpose
Establish starting weights for every primary compound lift in the program. Without this data, the program cannot prescribe meaningful loads. This page dynamically generates input fields based on the lifts that are actually in the user's program (determined by equipment, split, and training style).

### Inputs

**Quick-Action Buttons** (mutually exclusive — selecting one clears the other)

Two shortcut options are shown at the top of the page, before the per-lift inputs:

- **"Start all conservative"** — One-tap action that sets every lift to Option C (conservative body-weight-relative starting weights). All per-lift method choosers update to show "Conservative start." Useful for beginners or returning lifters who want to skip the per-lift decisions entirely.

- **"Add a calibration week to find my 1RM"** — Inserts a Week 0 calibration week before the real program begins. During the calibration week, the user performs ramp-to-1RM testing on each primary compound (generator produces the ramp-up protocol). Real loading begins Week 2 and the program runs one week longer than the selected duration. When this is ON, each lift's input area displays "Calculated during calibration week" instead of the per-lift method chooser. Requires generator support for ramp-to-1RM logic (to be defined).

If neither quick-action is selected, the user configures each lift individually using the per-lift methods below.

**Per-Lift Input Methods** (shown for each primary compound lift, unless a quick-action is active)

**Option A: Known 1RM** (numeric input)
- "I know my one-rep max for this lift."
- Input: weight in the user's profile unit preference (lbs or kg — no toggle in wizard).
- The program uses this directly to calculate working weights (e.g., 70% of 1RM for 3×10).

**Option B: Recent Working Weight** (two numeric inputs)
- "I don't know my 1RM, but I recently lifted this weight for this many reps."
- Input: weight + reps completed.
- The app calculates estimated 1RM using the Epley formula: 1RM = weight × (1 + reps/30). For reps ≤ 5, use the Brzycki formula: 1RM = weight × (36 / (37 - reps)). Display the calculated 1RM to the user for confirmation.
- Show a note: "For best accuracy, use a weight you lifted for 3–8 reps. Estimates from sets of 12+ reps are less reliable."

**Option C: Start Me Conservative** (no input needed)
- "I have no idea — just give me a safe starting point."
- The app assigns a starting weight based on body-weight-relative benchmarks adjusted for experience level and biological sex (from profile).
- Example benchmarks for "conservative start" (these are training weights, not 1RM):
  - Beginner male, 180 lbs: Squat ~95 lbs, Bench ~75 lbs, Deadlift ~115 lbs, OHP ~55 lbs, Row ~75 lbs
  - Beginner female, 140 lbs: Squat ~65 lbs, Bench ~45 lbs, Deadlift ~85 lbs, OHP ~30 lbs, Row ~45 lbs
  - These are intentionally low. The progression model will bring them up quickly.

### Which lifts are shown
Only lifts that are actually in the generated program based on equipment and split. Examples:
- Full gym + Upper/Lower split: Barbell Squat, Barbell Bench Press, Barbell Deadlift, Barbell Overhead Press, Barbell Row
- Home gym with dumbbells only: Dumbbell Goblet Squat, Dumbbell Bench Press, Dumbbell Romanian Deadlift, Dumbbell Overhead Press, Dumbbell Row
- Bodyweight only: Skip this page entirely. Use bodyweight progression milestones instead (e.g., "How many push-ups can you do in one set?" / "Can you do a pull-up? How many?")
- If a user flagged a shoulder injury and the program substituted OHP with landmine press, show landmine press here, not OHP.

### Conditional Logic
- **Bodyweight Only (Page 5)**: Replace this entire page with a bodyweight assessment:
  - "How many push-ups can you do in one set?" (numeric input)
  - "How many pull-ups can you do in one set?" (numeric input, or "I can't do a pull-up yet")
  - "How long can you hold a plank?" (seconds, numeric input)
  - "Can you do a bodyweight squat to full depth?" (yes/no)
  - These answers determine the starting progression level for each movement pattern.
- **Under 18 (Page 3)**: Default all lifts to Option C. Hide Option A. Show a note: "We recommend starting conservative and focusing on form. 1RM testing is not recommended for younger lifters."
- **Returning after long break (Page 2)**: Default all lifts to Option C unless the user has recent data. Show a note: "After a long break, your previous maxes may not be accurate. We recommend starting at 50–60% of your previous working weights and rebuilding."
- **Progression Model = Percentage-Based (Page 13)**: This page becomes critical — the entire program's loading depends on accurate 1RM data. Show a prominent note: "Your program uses percentage-based loading, so accurate 1RM data is important. If you're unsure, use Option B with a recent 3–5 rep set for the best estimate."

### UX Notes
- Show a brief explanation of what 1RM means: "Your one-rep max (1RM) is the heaviest weight you can lift for a single repetition with good form. We use it to calculate your working weights throughout the program."
- For Option B, show the calculated 1RM immediately after the user enters their data, with a "Does this feel right?" confirmation. If the calculated 1RM seems wildly high or low (e.g., a 130 lb female with a calculated 400 lb squat 1RM), flag it: "This estimate seems unusually high — double-check your numbers."
- Units (lbs/kg) are determined by the user's profile preference — there is no unit toggle on this page.

---

## Page 15: Program Review & Generate

### Purpose
Present a full, scannable summary of every choice the user made across the wizard. Allow quick editing of any section by tapping to jump back to the relevant page. Build confidence that the program will be correct before generating it.

### Layout

The review page should be organized in logical sections, each corresponding to a wizard page. Each section shows the user's selections and has a tap-to-edit affordance (pencil icon, "Edit" link, or tappable section header) that navigates back to that specific page.

**Section 1: Goal**
- Primary: Build Muscle
- Secondary: Also trim down

**Section 2: Experience**
- Level: Intermediate
- Status: Currently training

**Section 3: Profile**
- Age: 30–39 | Sex: Male | Weight: 185 lbs
- Injuries: Lower back (flagged)

**Section 4: Schedule**
- Days/week: 4 | Session length: 60 min
- Start day: Monday | Rest days: Wed, Sat, Sun
- Program duration: 8 weeks

**Section 5: Equipment**
- Environment: Commercial Gym
- Key equipment: Barbell, Dumbbells, Cable Machine, Full Machine Circuit, Adjustable Bench

**Section 6: Training Style & Modifiers**
- Style: Powerbuilding
- Volume Framework: Evidence-Based Volume (MEV → MAV → MRV)
- Periodization: None / Straight Run

**Section 7: Split**
- Upper / Lower ×2
- Mon: Upper | Tue: Lower | Thu: Upper | Fri: Lower

**Section 8: Prioritization**
- Emphasize (3/3): Chest, Back, Quads
- Grow: Shoulders, Hamstrings, Glutes, Triceps, Biceps, Forearms
- Maintain: Calves
- N/A: (none)

**Section 9: Sets & Reps**
- Rep range: Mixed (heavy compounds at 5, accessories at 10–12)
- Set types: Straight Sets, Reverse Pyramid, Supersets
- Auto-vary: ON

**Section 10: Rest & Tempo**
- Rest: Auto (per exercise type)
- Tempo: OFF

**Section 11: Core**
- Method: Superset between main lifts
- Frequency: Every session

**Section 12: Cardio**
- Included: Yes
- Type: HIIT | Frequency: 2×/week | Placement: On off-days | Duration: 20 min

**Section 13: Progression**
- Model: Double Progression
- Deload: Scheduled every 4th week, volume reduction

**Section 14: Strength Baselines**
- Squat 1RM: 285 lbs (estimated from 225×8)
- Bench 1RM: 225 lbs (known)
- Deadlift 1RM: 335 lbs (estimated from 275×6)
- OHP 1RM: Start conservative
- Row 1RM: Start conservative

### Derived Previews (calculated, not user-input)
Below the user selections, show computed program characteristics:

- **Volume Per Week Card** — A muscle × week grid showing weekly hard-set targets per muscle group, color-coded by tier. This replaces the old free-text "Estimated weekly volume per muscle group" format. The grid uses the app's existing "Volume per week" card component and reflects the full week structure:
  - An optional **calibration week** column (labeled "Cal") when selected on Page 14, showing approximately 40% of normal volume (ramp-to-1RM testing).
  - **Scheduled deload weeks** (labeled "DL") per the Page 13 deload protocol and frequency, showing approximately 50% of normal volume.
  - For Evidence-Based Volume framework or Block Periodization, load weeks show a ramp — each muscle's volume increases from near MEV toward its tier ceiling across the non-deload weeks.
  - The ~40% (calibration) and ~50% (deload) figures are placeholders pending final ramp/deload math in the generator.
  - Volume numbers in this grid are derived from the volume landmark model (see Cross-Cutting Design Principles) and must exactly match the exercise count × sets generated on Page 16.
- **Estimated session duration** — based on exercise count, set count, rest periods, and tempo. E.g., "Estimated Upper day: 58 min | Estimated Lower day: 62 min"
- **Weekly structure preview** — Mon: Upper (Chest emphasis) | Tue: Lower (Quad emphasis) | Wed: Rest + HIIT | Thu: Upper (Back emphasis) | Fri: Lower (Hamstring/Glute emphasis) | Sat: Rest + HIIT | Sun: Rest

### Generate Button
"Generate My Program" — large, prominent, primary action. On tap, the engine builds the full program: exercise selection, sets, reps, working weights, rest periods, tempo (if applicable), and mesocycle week-over-week structure. Loading state should show a brief progress indicator. The output is Page 16.

### Conditional Logic
- If any section contains a combination that triggers a warning elsewhere in the wizard (e.g., 2 days + 5 emphasized muscle groups), re-display that warning here with a link to the relevant section.
- If 1RM data is missing for any primary compound and the progression model is Percentage-Based, show a prominent warning: "Your program uses percentage-based loading, but some lifts are set to 'start conservative.' The program will use estimated starting weights that may need adjustment in your first week."
- If the calibration week was selected on Page 14, the Volume Per Week card must show the "Cal" column as the first week, and the total program duration shown in Section 4 should reflect the extra week (e.g., "8 weeks + 1 calibration week").

### UX Notes
- This page should be scrollable but not overwhelming. Use collapsible sections if the content gets long.
- Every section must be editable. If the user taps edit on Section 7 (Split), they should go back to Page 7 with all their prior selections intact, make a change, and return to Page 15 with the change reflected.
- The "Generate" button should feel like a moment — the user is about to get their custom program. Don't bury it.

---

## Page 16: Exercise Review & Swap

### Purpose
After the program is generated, present every exercise in the program grouped by training day. Allow the user to swap any exercise for an equivalent alternative before committing to the program. This is the last step before the user starts training.

### Layout

**Default View: Single Repeating Week**
Most programs use a repeating weekly template where exercises stay the same and only load/reps change. In this case, show one **representative load week** (not a deload or calibration week) with each training day as a collapsible section.

```
MONDAY — Upper (Chest Emphasis)
  1. Barbell Bench Press         4×5     [Anchor 🔒]  [Swap]
  2. Incline Dumbbell Press      3×10                  [Swap]
  3. Cable Fly                   3×12                  [Swap]
  4. Barbell Row (superset w/5)  4×5     [Anchor 🔒]  [Swap]
  5. Face Pull (superset w/4)    3×15                  [Swap]
  6. Lateral Raise               3×12                  [Swap]
  7. Tricep Pushdown             3×12                  [Swap]
  ── Core (superset between compounds) ──
  C1. Pallof Press               3×12                  [Swap]
  C2. Dead Bug                   3×10                  [Swap]

TUESDAY — Lower (Quad Emphasis)
  1. Barbell Back Squat          4×5     [Anchor 🔒]  [Swap]
  ...
```

**Multi-Phase View (for Block Periodization only)**
If the user selected Block Periodization as their Periodization Strategy on Page 6 and the program generates distinct exercise lists for different phases, show a tab or phase selector at the top:

```
[Phase 1: Hypertrophy (Weeks 1–4)] [Phase 2: Strength (Weeks 5–6)] [Phase 3: Peak (Weeks 7–8)]
```

Each tab shows the full week of exercises for that phase (representative load week within that phase), and swaps within a phase only affect that phase.

### Exercise Generation Rules

**The generated program must match the chosen split exactly.** If the user selected a Bro Split (Chest / Back / Shoulders / Legs / Arms), the generated days must be Chest / Back / Shoulders / Legs / Arms — not a reinterpretation. Exercises on each day must target the muscle groups assigned to that day by the split.

**Exercises must only use equipment the user selected on Page 5.** If the user has no cable machine, no cable exercises appear. If equipment is very sparse, exercises may repeat across the week only when no other valid movement exists for that muscle group.

**Exercise count is driven by volume, not by a fixed slot count.** Each muscle's weekly hard-set target (derived from the volume landmark model on Page 8) is split across its training days, then divided into exercises at a **default of approximately 3 sets per exercise**. The exercise count is whatever is needed to fill the volume target.

Example: A muscle with a 12-set weekly target trained once per week → 12 sets in one session → **4 exercises × 3 sets**, not 1 exercise × 12 sets or 2 exercises × 6 sets. A muscle with a 12-set weekly target trained twice per week → 6 sets per session → **2 exercises × 3 sets** per session.

The only limit on exercise count is how many equipment-valid exercises exist for that muscle group in the exercise database. Movements repeat only when equipment is very sparse.

**Default 3 sets per exercise** applies to traditional (non-periodized) programs with steady volume. **For periodized blocks (Block Periodization or undulating approaches), sets ramp from 2 → 4 across the block**, with deload weeks dropping back down. The Page 16 representative view shows the mid-block set count.

This explicitly supersedes any interpretation where "number of exercises = number of slots" or where exercise count is fixed per tier.

### Anchor vs. Accessory Distinction

**Anchor Lifts** (marked with a lock icon 🔒 or "Anchor" badge)
These are the primary compound movements that the progression model tracks and loads over time (e.g., Barbell Bench Press, Barbell Squat, Barbell Deadlift). Swapping an anchor has consequences:
- Resets progression tracking for that movement pattern (a new lift starts fresh).
- May affect the loading scheme if the program uses percentage-based progression.
- The swap drawer should show a confirmation: "This is a primary lift your progression is built around. Swapping it will reset your loading for this movement pattern. Continue?"
- Alternatives for anchor lifts should be functionally equivalent (e.g., Barbell Back Squat → Front Squat or Safety Bar Squat, NOT → Leg Press, which is a different movement category).

**Accessory Lifts** (no badge)
These can be freely swapped without friction. No confirmation needed. The swap drawer shows alternatives matched by muscle group, equipment, and movement pattern.

### Swap Drawer

When the user taps "Swap" on any exercise, a bottom sheet or modal opens showing:
- **Current exercise** at the top (for reference)
- **Alternative exercises** listed below, filtered by:
  - Same primary muscle group
  - Available in the user's equipment list
  - Similar movement pattern (pressing → pressing, rowing → rowing, hinge → hinge, isolation → isolation)
  - Appropriate for the user's experience level
- Each alternative shows: exercise name, primary muscle targeted, equipment needed, and a one-line note on why it's a valid substitute (e.g., "Similar chest activation with less shoulder stress").
- Tapping an alternative immediately swaps it in the program and closes the drawer.

### Propagation
- Exercise swaps propagate across all weeks of the mesocycle. If the user swaps Incline Dumbbell Press for Incline Barbell Press on Monday, that swap applies to every Monday for the duration of the program.
- In multi-phase programs, swaps are phase-specific. A swap in Phase 1 does not affect Phase 2.

### Post-Wizard Swap Access
This same swap functionality must also be accessible from within the active program after the wizard is complete. If a user discovers mid-program that an exercise doesn't work for them (e.g., causes pain, equipment is occupied, they just hate it), they should be able to tap any exercise on any workout day and access the same swap drawer with the same filtered alternatives. The swap should propagate to all remaining weeks.

### Finalize Button
"Start My Program" — primary action at the bottom. Locks in the exercise selections and activates the program. The user can still swap exercises post-wizard via the in-workout swap feature, but the wizard flow is complete.

### UX Notes
- Each exercise in the list should be tappable to show a brief description, target muscles, and (ideally) a demo image or video thumbnail. This helps users who aren't familiar with every exercise name.
- The order of exercises within each day reflects the intended workout sequence (compounds first, isolations last, core at the end or superset where specified). Make it clear this order is intentional and part of the program design.
- Consider allowing drag-to-reorder within a day for advanced users who want to adjust exercise order. Show a note: "We've ordered exercises to maximize performance — compounds first when you're freshest. Reordering is fine, but heavy compounds are most effective early in the session."

---

## Wizard State Object (Technical Reference)

The wizard should maintain a state object that accumulates all user selections and is accessible to every page for conditional logic and to the program generation engine. A minimal schema:

```
{
  programName: string,
  goal: { primary: string, secondary: string | null },
  experience: { level: string, status: string },
  profile: { /* read-only from FATRAT profile: age, sex, weightLbs, heightIn, unitPreference */ },
  injuries: string[],
  stubbornAreas: string[],
  schedule: { daysPerWeek: number, sessionMinutes: number, startDay: string, durationWeeks: number | "ongoing" },
  equipment: { environment: string, items: string[] },
  trainingStyle: { baseStyle: string, volumeFramework: string, periodizationStrategy: string },
  split: { type: string, restDays: string[], dayMapping: object },
  prioritization: { [muscleGroup: string]: "n/a" | "maintain" | "grow" | "emphasize" },
  setsAndReps: { repRange: string, setTypes: string[], autoVary: boolean },
  restAndTempo: { restPreference: string, tempoEnabled: boolean, tempoStyle: string | null },
  core: { method: string, frequency: string | null, exerciseCount: string | null, coreDays: string[] | null },
  cardio: { included: string, type: string | null, frequency: number | null, placement: string | null, durationMinutes: number | null },
  progression: { type: string, deloadProtocol: string, deloadFrequency: number | null, deloadStyle: string | null },
  baselines: { quickAction: "conservative" | "calibration" | null, lifts: [{ exercise: string, method: string, value: number | null, reps: number | null, estimated1RM: number | null }] }
}
```

This state object is passed to the program generation engine after Page 15 to produce the full program, and is stored with the user's profile so the wizard can be re-entered with all prior selections intact for future program creation.
