import type { ExerciseDefinition } from '@/types';

/**
 * Global exercise library — broad coverage across every muscle group and
 * equipment type. Names + tags only — no media yet. Users layer their own
 * favorites, hidden flags, and custom exercises on top (see UserExercisePrefs).
 */
export const GLOBAL_EXERCISES: ExerciseDefinition[] = [
  // ---- Chest ----
  { id: 'bench-press-barbell', name: 'Barbell Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps','shoulders'], equipment: 'barbell', patterns: ['compound','push'] },
  { id: 'bench-press-incline-barbell', name: 'Incline Barbell Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['shoulders','triceps'], equipment: 'barbell', patterns: ['compound','push'] },
  { id: 'bench-press-dumbbell', name: 'Dumbbell Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps','shoulders'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'bench-press-incline-dumbbell', name: 'Incline Dumbbell Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['shoulders','triceps'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'bench-press-decline-barbell', name: 'Decline Barbell Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'barbell', patterns: ['compound','push'] },
  { id: 'bench-press-smith', name: 'Smith Machine Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps','shoulders'], equipment: 'smith', patterns: ['compound','push'] },
  { id: 'chest-press-machine', name: 'Machine Chest Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'machine', patterns: ['compound','push'] },
  { id: 'chest-fly-cable', name: 'Cable Chest Fly', primaryMuscle: 'chest', equipment: 'cable', patterns: ['isolation','push'] },
  { id: 'chest-fly-dumbbell', name: 'Dumbbell Chest Fly', primaryMuscle: 'chest', equipment: 'dumbbell', patterns: ['isolation','push'] },
  { id: 'cable-crossover', name: 'Cable Crossover', primaryMuscle: 'chest', equipment: 'cable', patterns: ['isolation','push'] },
  { id: 'pec-deck', name: 'Pec Deck', primaryMuscle: 'chest', equipment: 'machine', patterns: ['isolation','push'] },
  { id: 'pushup', name: 'Push-up', primaryMuscle: 'chest', secondaryMuscles: ['triceps','core'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'pushup-incline', name: 'Incline Push-up', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'band-chest-press', name: 'Band Chest Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'band', patterns: ['compound','push'] },

  // ---- Back ----
  { id: 'deadlift', name: 'Deadlift', primaryMuscle: 'back', secondaryMuscles: ['hamstrings','glutes'], equipment: 'barbell', patterns: ['compound','hinge','pull'] },
  { id: 'rack-pull', name: 'Rack Pull', primaryMuscle: 'back', secondaryMuscles: ['hamstrings','glutes'], equipment: 'barbell', patterns: ['compound','hinge','pull'] },
  { id: 'pull-up', name: 'Pull-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },
  { id: 'chin-up', name: 'Chin-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },
  { id: 'inverted-row', name: 'Inverted Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'weight-reps' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'cable', patterns: ['compound','pull'] },
  { id: 'pulldown-machine', name: 'Machine Pulldown', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'machine', patterns: ['compound','pull'] },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', primaryMuscle: 'back', equipment: 'cable', patterns: ['isolation','pull'] },
  { id: 'row-barbell', name: 'Barbell Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'barbell', patterns: ['compound','pull'] },
  { id: 'row-pendlay', name: 'Pendlay Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'barbell', patterns: ['compound','pull'] },
  { id: 'row-dumbbell', name: 'One-Arm Dumbbell Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'dumbbell', patterns: ['compound','pull'] },
  { id: 'row-cable-seated', name: 'Seated Cable Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'cable', patterns: ['compound','pull'] },
  { id: 'row-machine', name: 'Machine Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'machine', patterns: ['compound','pull'] },
  { id: 'row-t-bar', name: 'T-Bar Row', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'barbell', patterns: ['compound','pull'] },
  { id: 'face-pull', name: 'Face Pull', primaryMuscle: 'back', secondaryMuscles: ['shoulders'], equipment: 'cable', patterns: ['isolation','pull'] },
  { id: 'band-pull-apart', name: 'Band Pull-Apart', primaryMuscle: 'back', secondaryMuscles: ['shoulders'], equipment: 'band', patterns: ['isolation','pull'] },
  { id: 'shrug-barbell', name: 'Barbell Shrug', primaryMuscle: 'back', equipment: 'barbell', patterns: ['isolation','pull'] },
  { id: 'shrug-dumbbell', name: 'Dumbbell Shrug', primaryMuscle: 'back', equipment: 'dumbbell', patterns: ['isolation','pull'] },

  // ---- Shoulders ----
  { id: 'ohp-barbell', name: 'Overhead Press (Barbell)', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'barbell', patterns: ['compound','push'] },
  { id: 'ohp-dumbbell', name: 'Seated Dumbbell Press', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'ohp-smith', name: 'Smith Machine Shoulder Press', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'smith', patterns: ['compound','push'] },
  { id: 'shoulder-press-machine', name: 'Machine Shoulder Press', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'machine', patterns: ['compound','push'] },
  { id: 'arnold-press', name: 'Arnold Press', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'kettlebell-press', name: 'Kettlebell Overhead Press', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'kettlebell', patterns: ['compound','push'] },
  { id: 'lateral-raise-dumbbell', name: 'Dumbbell Lateral Raise', primaryMuscle: 'shoulders', equipment: 'dumbbell', patterns: ['isolation'] },
  { id: 'lateral-raise-cable', name: 'Cable Lateral Raise', primaryMuscle: 'shoulders', equipment: 'cable', patterns: ['isolation'] },
  { id: 'lateral-raise-machine', name: 'Machine Lateral Raise', primaryMuscle: 'shoulders', equipment: 'machine', patterns: ['isolation'] },
  { id: 'lateral-raise-band', name: 'Band Lateral Raise', primaryMuscle: 'shoulders', equipment: 'band', patterns: ['isolation'] },
  { id: 'front-raise-dumbbell', name: 'Dumbbell Front Raise', primaryMuscle: 'shoulders', equipment: 'dumbbell', patterns: ['isolation'] },
  { id: 'rear-delt-fly-dumbbell', name: 'Rear Delt Fly', primaryMuscle: 'shoulders', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'rear-delt-fly-machine', name: 'Reverse Pec Deck', primaryMuscle: 'shoulders', equipment: 'machine', patterns: ['isolation','pull'] },
  { id: 'upright-row-cable', name: 'Cable Upright Row', primaryMuscle: 'shoulders', equipment: 'cable', patterns: ['compound','pull'] },

  // ---- Biceps ----
  { id: 'curl-barbell', name: 'Barbell Curl', primaryMuscle: 'biceps', equipment: 'barbell', patterns: ['isolation','pull'] },
  { id: 'curl-ez-bar', name: 'EZ-Bar Curl', primaryMuscle: 'biceps', equipment: 'barbell', patterns: ['isolation','pull'] },
  { id: 'curl-dumbbell', name: 'Dumbbell Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'curl-incline-dumbbell', name: 'Incline Dumbbell Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'hammer-curl', name: 'Hammer Curl', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'], equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'concentration-curl', name: 'Concentration Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'curl-cable', name: 'Cable Curl', primaryMuscle: 'biceps', equipment: 'cable', patterns: ['isolation','pull'] },
  { id: 'preacher-curl', name: 'Preacher Curl', primaryMuscle: 'biceps', equipment: 'machine', patterns: ['isolation','pull'] },
  { id: 'curl-band', name: 'Band Curl', primaryMuscle: 'biceps', equipment: 'band', patterns: ['isolation','pull'] },

  // ---- Triceps ----
  { id: 'tricep-pushdown-cable', name: 'Cable Triceps Pushdown', primaryMuscle: 'triceps', equipment: 'cable', patterns: ['isolation','push'] },
  { id: 'tricep-pushdown-rope', name: 'Rope Triceps Pushdown', primaryMuscle: 'triceps', equipment: 'cable', patterns: ['isolation','push'] },
  { id: 'skull-crusher', name: 'Skull Crusher', primaryMuscle: 'triceps', equipment: 'barbell', patterns: ['isolation','push'] },
  { id: 'overhead-tricep-dumbbell', name: 'Overhead Triceps Extension', primaryMuscle: 'triceps', equipment: 'dumbbell', patterns: ['isolation','push'] },
  { id: 'overhead-tricep-cable', name: 'Cable Overhead Extension', primaryMuscle: 'triceps', equipment: 'cable', patterns: ['isolation','push'] },
  { id: 'tricep-kickback', name: 'Triceps Kickback', primaryMuscle: 'triceps', equipment: 'dumbbell', patterns: ['isolation','push'] },
  { id: 'tricep-extension-machine', name: 'Machine Triceps Extension', primaryMuscle: 'triceps', equipment: 'machine', patterns: ['isolation','push'] },
  { id: 'close-grip-bench', name: 'Close-Grip Bench Press', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], equipment: 'barbell', patterns: ['compound','push'] },
  { id: 'dip', name: 'Dip', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'bench-dip', name: 'Bench Dip', primaryMuscle: 'triceps', equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'tricep-band-pushdown', name: 'Band Triceps Pushdown', primaryMuscle: 'triceps', equipment: 'band', patterns: ['isolation','push'] },

  // ---- Forearms ----
  { id: 'wrist-curl-cable', name: 'Cable Wrist Curl', primaryMuscle: 'forearms', equipment: 'cable', patterns: ['isolation'] },
  { id: 'wrist-curl-dumbbell', name: 'Dumbbell Wrist Curl', primaryMuscle: 'forearms', equipment: 'dumbbell', patterns: ['isolation'] },
  { id: 'reverse-wrist-curl', name: 'Reverse Wrist Curl', primaryMuscle: 'forearms', equipment: 'dumbbell', patterns: ['isolation'] },
  { id: 'reverse-curl', name: 'Reverse Curl', primaryMuscle: 'forearms', secondaryMuscles: ['biceps'], equipment: 'barbell', patterns: ['isolation','pull'] },
  { id: 'farmer-carry', name: "Farmer's Carry", primaryMuscle: 'forearms', secondaryMuscles: ['core'], equipment: 'dumbbell', patterns: ['carry'], metric: 'weight-time' },
  { id: 'wrist-roller', name: 'Wrist Roller', primaryMuscle: 'forearms', equipment: 'cable', patterns: ['isolation'] },

  // ---- Quads / Legs ----
  { id: 'squat-back-barbell', name: 'Back Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes','hamstrings'], equipment: 'barbell', patterns: ['compound','squat'] },
  { id: 'squat-front-barbell', name: 'Front Squat', primaryMuscle: 'quads', secondaryMuscles: ['core'], equipment: 'barbell', patterns: ['compound','squat'] },
  { id: 'squat-smith', name: 'Smith Machine Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'smith', patterns: ['compound','squat'] },
  { id: 'hack-squat', name: 'Hack Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'machine', patterns: ['compound','squat'] },
  { id: 'leg-press', name: 'Leg Press', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'machine', patterns: ['compound','squat'] },
  { id: 'leg-extension', name: 'Leg Extension', primaryMuscle: 'quads', equipment: 'machine', patterns: ['isolation'] },
  { id: 'lunge-dumbbell', name: 'Walking Lunge', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','lunge'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','lunge'] },
  { id: 'split-squat-static', name: 'Static Split Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','lunge'] },
  { id: 'step-up', name: 'Dumbbell Step-up', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','lunge'] },
  { id: 'goblet-squat', name: 'Goblet Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','squat'] },
  { id: 'sissy-squat', name: 'Sissy Squat', primaryMuscle: 'quads', equipment: 'bodyweight', patterns: ['isolation','squat'], metric: 'reps' },

  // ---- Hamstrings ----
  { id: 'rdl-barbell', name: 'Romanian Deadlift', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes','back'], equipment: 'barbell', patterns: ['compound','hinge'] },
  { id: 'rdl-dumbbell', name: 'Dumbbell RDL', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','hinge'] },
  { id: 'single-leg-rdl', name: 'Single-Leg RDL', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','hinge'] },
  { id: 'good-morning', name: 'Good Morning', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes','back'], equipment: 'barbell', patterns: ['compound','hinge'] },
  { id: 'leg-curl-seated', name: 'Seated Leg Curl', primaryMuscle: 'hamstrings', equipment: 'machine', patterns: ['isolation'] },
  { id: 'leg-curl-lying', name: 'Lying Leg Curl', primaryMuscle: 'hamstrings', equipment: 'machine', patterns: ['isolation'] },
  { id: 'nordic-curl', name: 'Nordic Hamstring Curl', primaryMuscle: 'hamstrings', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },

  // ---- Glutes ----
  { id: 'hip-thrust', name: 'Hip Thrust', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'barbell', patterns: ['compound','hinge'] },
  { id: 'hip-thrust-machine', name: 'Machine Hip Thrust', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'machine', patterns: ['compound','hinge'] },
  { id: 'glute-bridge', name: 'Glute Bridge', primaryMuscle: 'glutes', equipment: 'bodyweight', patterns: ['isolation','hinge'], metric: 'reps' },
  { id: 'cable-pull-through', name: 'Cable Pull-Through', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'cable', patterns: ['compound','hinge'] },
  { id: 'cable-kickback', name: 'Cable Glute Kickback', primaryMuscle: 'glutes', equipment: 'cable', patterns: ['isolation'] },
  { id: 'hip-abduction-machine', name: 'Hip Abduction Machine', primaryMuscle: 'glutes', equipment: 'machine', patterns: ['isolation'] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings','core'], equipment: 'kettlebell', patterns: ['compound','hinge'] },

  // ---- Calves ----
  { id: 'calf-raise-standing', name: 'Standing Calf Raise', primaryMuscle: 'calves', equipment: 'machine', patterns: ['isolation'] },
  { id: 'calf-raise-seated', name: 'Seated Calf Raise', primaryMuscle: 'calves', equipment: 'machine', patterns: ['isolation'] },
  { id: 'calf-raise-leg-press', name: 'Leg Press Calf Raise', primaryMuscle: 'calves', equipment: 'machine', patterns: ['isolation'] },
  { id: 'calf-raise-dumbbell', name: 'Dumbbell Calf Raise', primaryMuscle: 'calves', equipment: 'dumbbell', patterns: ['isolation'] },
  { id: 'calf-raise-smith', name: 'Smith Machine Calf Raise', primaryMuscle: 'calves', equipment: 'smith', patterns: ['isolation'] },

  // ---- Core ----
  { id: 'plank', name: 'Plank', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'time' },
  { id: 'side-plank', name: 'Side Plank', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'time' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'cable-crunch', name: 'Cable Crunch', primaryMuscle: 'core', equipment: 'cable', patterns: ['isolation'] },
  { id: 'pallof-press', name: 'Pallof Press', primaryMuscle: 'core', equipment: 'cable', patterns: ['isolation'] },
  { id: 'russian-twist', name: 'Russian Twist', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'bicycle-crunch', name: 'Bicycle Crunch', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'dead-bug', name: 'Dead Bug', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'decline-situp', name: 'Decline Sit-up', primaryMuscle: 'core', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },

  // ---- Neck ----
  { id: 'neck-curl', name: 'Neck Curl', primaryMuscle: 'neck', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'neck-extension', name: 'Neck Extension', primaryMuscle: 'neck', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },

  // ---- Bodyweight options for shoulders / biceps / forearms / calves ----
  { id: 'pike-pushup', name: 'Pike Push-up', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'handstand-pushup-wall', name: 'Wall Handstand Push-up', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'inverted-curl', name: 'Inverted Curl', primaryMuscle: 'biceps', secondaryMuscles: ['back'], equipment: 'bodyweight', patterns: ['isolation','pull'], metric: 'reps' },
  { id: 'doorway-curl', name: 'Doorway Curl', primaryMuscle: 'biceps', equipment: 'bodyweight', patterns: ['isolation','pull'], metric: 'reps' },
  { id: 'dead-hang', name: 'Dead Hang', primaryMuscle: 'forearms', equipment: 'bodyweight', patterns: ['isolation'], metric: 'time' },
  { id: 'towel-hang', name: 'Towel Hang', primaryMuscle: 'forearms', equipment: 'bodyweight', patterns: ['isolation'], metric: 'time' },
  { id: 'calf-raise-bodyweight', name: 'Bodyweight Calf Raise', primaryMuscle: 'calves', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },
  { id: 'calf-raise-single-leg', name: 'Single-Leg Calf Raise', primaryMuscle: 'calves', equipment: 'bodyweight', patterns: ['isolation'], metric: 'reps' },

  // ---- Push-up variations (bodyweight) ----
  { id: 'pushup-wide', name: 'Wide Push-up', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'pushup-military', name: 'Military Push-up', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'pushup-diamond', name: 'Diamond Push-up', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'pushup-decline', name: 'Decline Push-up', primaryMuscle: 'chest', secondaryMuscles: ['shoulders','triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },
  { id: 'pushup-archer', name: 'Archer Push-up', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'bodyweight', patterns: ['compound','push'], metric: 'reps' },

  // ---- Pull-up variations (bodyweight) ----
  { id: 'pullup-wide', name: 'Wide-Grip Pull-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },
  { id: 'pullup-neutral', name: 'Neutral-Grip Pull-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },
  { id: 'pullup-commando', name: 'Commando Pull-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },
  { id: 'pullup-archer', name: 'Archer Pull-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },
  { id: 'pullup-negative', name: 'Negative Pull-up', primaryMuscle: 'back', secondaryMuscles: ['biceps'], equipment: 'bodyweight', patterns: ['compound','pull'], metric: 'reps' },

  // ---- Additions from a TRX-style chart (rotating presses, partials, swimmers, lunges, etc.) ----
  { id: 'chest-press-rotating-dumbbell', name: 'Rotating Dumbbell Chest Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps','shoulders'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'skull-crusher-single-arm', name: 'Single-Arm Skull Crusher', primaryMuscle: 'triceps', equipment: 'dumbbell', patterns: ['isolation','push'] },
  { id: 'row-wide-grip-dumbbell', name: 'Wide-Grip Dumbbell Row', primaryMuscle: 'back', secondaryMuscles: ['shoulders'], equipment: 'dumbbell', patterns: ['compound','pull'] },
  { id: 'pullover-dumbbell', name: 'Dumbbell Pullover', primaryMuscle: 'back', secondaryMuscles: ['chest'], equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'reverse-fly-dumbbell', name: 'Reverse Fly', primaryMuscle: 'back', secondaryMuscles: ['shoulders'], equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'curl-wide-dumbbell', name: 'Wide Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'y-raise-dumbbell', name: 'Y Raise', primaryMuscle: 'shoulders', secondaryMuscles: ['back'], equipment: 'dumbbell', patterns: ['isolation'] },
  { id: 'swimmers', name: 'Swimmers', primaryMuscle: 'back', secondaryMuscles: ['shoulders'], equipment: 'bodyweight', patterns: ['isolation','pull'], metric: 'reps' },
  { id: 'upright-row-dumbbell', name: 'Dumbbell Upright Row', primaryMuscle: 'shoulders', secondaryMuscles: ['back'], equipment: 'dumbbell', patterns: ['compound','pull'] },
  { id: 'goblet-squat-sumo', name: 'Sumo Goblet Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', patterns: ['compound','squat'] },
  { id: 'lunge-side-dumbbell', name: 'Side Lunge', primaryMuscle: 'quads', secondaryMuscles: ['glutes','hamstrings'], equipment: 'dumbbell', patterns: ['compound','lunge'] },
  { id: 'lunge-reverse-dumbbell', name: 'Reverse Lunge', primaryMuscle: 'quads', secondaryMuscles: ['glutes','hamstrings'], equipment: 'dumbbell', patterns: ['compound','lunge'] },
  { id: 'squat-pulse-bodyweight', name: 'Pulse Squat', primaryMuscle: 'quads', equipment: 'bodyweight', patterns: ['isolation','squat'], metric: 'reps' },

  // ---- Additional dumbbell/bodyweight variants for the TRX-chart movements ----
  { id: 'bench-press-decline-dumbbell', name: 'Decline Dumbbell Bench Press', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'skull-crusher-dumbbell', name: 'Dumbbell Skull Crusher', primaryMuscle: 'triceps', equipment: 'dumbbell', patterns: ['isolation','push'] },
  { id: 'triceps-press-dumbbell', name: 'Dumbbell Triceps Press', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], equipment: 'dumbbell', patterns: ['compound','push'] },
  { id: 'curl-top-half-dumbbell', name: 'Top-Half Dumbbell Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'curl-bottom-half-dumbbell', name: 'Bottom-Half Dumbbell Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation','pull'] },
  { id: 'deadlift-dumbbell', name: 'Dumbbell Deadlift', primaryMuscle: 'back', secondaryMuscles: ['hamstrings','glutes'], equipment: 'dumbbell', patterns: ['compound','hinge','pull'] },
  { id: 'lunge-side-bodyweight', name: 'Bodyweight Side Lunge', primaryMuscle: 'quads', secondaryMuscles: ['glutes','hamstrings'], equipment: 'bodyweight', patterns: ['compound','lunge'], metric: 'reps' },
  { id: 'lunge-reverse-bodyweight', name: 'Bodyweight Reverse Lunge', primaryMuscle: 'quads', secondaryMuscles: ['glutes','hamstrings'], equipment: 'bodyweight', patterns: ['compound','lunge'], metric: 'reps' },
];
