import type {
  UserProfile,
  Mesocycle,
  Microcycle,
  WorkoutSession,
  ExerciseEntry,
  SetEntry,
  BodyWeightEntry,
} from '@/types';

/** Today is computed at first-seed time so calendars line up with the real date. */
const TODAY = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

function isoOffset(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dow(daysOffset: number): 0|1|2|3|4|5|6 {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + daysOffset);
  return d.getDay() as 0|1|2|3|4|5|6;
}

function mkSet(i: number, w: number, reps: number, rpe?: number): SetEntry {
  return { setIndex: i, weightKg: w, reps, rpe, completed: true };
}

/* ============================================================
 * MOLLY — BASIC user, 2 weeks of history
 * ========================================================== */
const MOLLY_ID = 'demo-molly';
const mollyProfile: UserProfile = {
  userId: MOLLY_ID,
  displayName: 'Molly',
  dob: '1992-04-11',
  sex: 'female',
  heightCm: 165,
  weightKg: 64,
  units: 'imperial',
  experience: 'lt6mo',
  periodizationFamiliarity: 'none',
  primaryGoal: 'maintain',
  daysPerWeek: 3,
  timePerSessionMin: 45,
  equipment: ['commercial-gym'],
  mode: 'BASIC',
  createdAt: isoOffset(-21) + 'T08:00:00Z',
  updatedAt: isoOffset(-1) + 'T08:00:00Z',
};

const mollyMeso: Mesocycle = {
  id: 'molly-meso-1',
  userId: MOLLY_ID,
  name: 'Stay In Shape',
  goal: 'maintain',
  startDate: isoOffset(-14),
  phaseType: 'hypertrophy',
  weeks: 6,
  progressionScheme: 'linear',
  weekIndex: 2,
  status: 'active',
  microcycleIds: ['molly-micro-1','molly-micro-2','molly-micro-3'],
};
const mollyMicros: Microcycle[] = [
  { id: 'molly-micro-1', mesocycleId: 'molly-meso-1', userId: MOLLY_ID, weekNumber: 1, splitType: 'full-body', status: 'completed', sessionIds: ['molly-s1','molly-s2','molly-s3'] },
  { id: 'molly-micro-2', mesocycleId: 'molly-meso-1', userId: MOLLY_ID, weekNumber: 2, splitType: 'full-body', status: 'completed', sessionIds: ['molly-s4','molly-s5','molly-s6'] },
  { id: 'molly-micro-3', mesocycleId: 'molly-meso-1', userId: MOLLY_ID, weekNumber: 3, splitType: 'full-body', status: 'active',    sessionIds: ['molly-s7'] },
];

function mollyFullBody(date: string, dayOfWeek: 0|1|2|3|4|5|6, id: string, completed: boolean, squatW: number, benchW: number, rowW: number, rpe: number): WorkoutSession {
  const exercises: ExerciseEntry[] = [
    {
      exerciseId: 'goblet-squat', name: 'Goblet Squat', muscle: 'quads',
      prescribedSets: 3, prescribedRepsLow: 10, prescribedRepsHigh: 12,
      sets: [mkSet(0, squatW, 12, rpe), mkSet(1, squatW, 12, rpe), mkSet(2, squatW, 10, rpe + 0.5)],
    },
    {
      exerciseId: 'bench-press-dumbbell', name: 'Dumbbell Bench Press', muscle: 'chest',
      prescribedSets: 3, prescribedRepsLow: 10, prescribedRepsHigh: 12,
      sets: [mkSet(0, benchW, 12, rpe), mkSet(1, benchW, 11, rpe), mkSet(2, benchW, 10, rpe + 0.5)],
    },
    {
      exerciseId: 'row-dumbbell', name: 'One-Arm Dumbbell Row', muscle: 'back',
      prescribedSets: 3, prescribedRepsLow: 10, prescribedRepsHigh: 12,
      sets: [mkSet(0, rowW, 12, rpe), mkSet(1, rowW, 12, rpe), mkSet(2, rowW, 11, rpe)],
    },
  ];
  return { id, userId: MOLLY_ID, microcycleId: 'molly-micro-1', mesocycleId: 'molly-meso-1', date, dayOfWeek, completed, exercises, cardio: [] };
}

const mollySessions: WorkoutSession[] = [
  mollyFullBody(isoOffset(-13), dow(-13), 'molly-s1', true, 9, 8, 9, 7),
  mollyFullBody(isoOffset(-11), dow(-11), 'molly-s2', true, 9, 8, 9, 7),
  mollyFullBody(isoOffset(-9),  dow(-9),  'molly-s3', true, 11, 9, 11, 7.5),
  mollyFullBody(isoOffset(-6),  dow(-6),  'molly-s4', true, 11, 9, 11, 7),
  mollyFullBody(isoOffset(-4),  dow(-4),  'molly-s5', true, 11, 10, 11, 7.5),
  mollyFullBody(isoOffset(-2),  dow(-2),  'molly-s6', true, 13, 10, 13, 7.5),
  // Today (or near-today) — pending
  { ...mollyFullBody(isoOffset(0), dow(0), 'molly-s7', false, 13, 10, 13, 0), exercises: mollyFullBody(isoOffset(0), dow(0), 'molly-s7', false, 13, 10, 13, 7).exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, completed: false, rpe: undefined })) })) },
];

const mollyBW: BodyWeightEntry[] = [
  { date: isoOffset(-14), weightKg: 64.5 },
  { date: isoOffset(-7),  weightKg: 64.2 },
  { date: isoOffset(-1),  weightKg: 64.0 },
];

/* ============================================================
 * BRIAN — INTERMEDIATE user, ~3 weeks of history
 * ========================================================== */
const BRIAN_ID = 'demo-brian';
const brianProfile: UserProfile = {
  userId: BRIAN_ID,
  displayName: 'Brian',
  dob: '1987-10-22',
  sex: 'male',
  heightCm: 180,
  weightKg: 85,
  units: 'imperial',
  experience: '6mo-2yr',
  periodizationFamiliarity: 'fuzzy',
  primaryGoal: 'build-muscle',
  daysPerWeek: 5,
  timePerSessionMin: 60,
  equipment: ['commercial-gym'],
  strengthBaseline: { squat: 130, bench: 95, deadlift: 160, overheadPress: 60 },
  mode: 'INTERMEDIATE',
  createdAt: isoOffset(-40) + 'T08:00:00Z',
  updatedAt: isoOffset(-1) + 'T08:00:00Z',
};

const brianMeso: Mesocycle = {
  id: 'brian-meso-1',
  userId: BRIAN_ID,
  name: 'Build Muscle — Spring',
  goal: 'build-muscle',
  startDate: isoOffset(-21),
  phaseType: 'hypertrophy',
  weeks: 5,
  progressionScheme: 'rir-based',
  weekIndex: 2,
  status: 'active',
  microcycleIds: ['brian-micro-1','brian-micro-2','brian-micro-3','brian-micro-4','brian-micro-5'],
};
// Anchor week 3 on today's week so "today" always lands in the current micro.
const BRIAN_TODAY_DOW = TODAY.getDay(); // 0..6, Sun=0
const BRIAN_TODAY_MON_IDX = BRIAN_TODAY_DOW === 0 ? 6 : BRIAN_TODAY_DOW - 1; // 0..6, Mon=0
const BRIAN_WEEK1_MON_OFFSET = -BRIAN_TODAY_MON_IDX - 14; // Monday of week 1 (two weeks before current)
const BRIAN_DAY_INDICES = [1, 3, 5]; // Tue, Thu, Sat from a Monday

function brianOffset(week: number, dayIdx: number): number {
  return BRIAN_WEEK1_MON_OFFSET + (week - 1) * 7 + dayIdx;
}

const brianMicros: Microcycle[] = [
  { id: 'brian-micro-1', mesocycleId: 'brian-meso-1', userId: BRIAN_ID, weekNumber: 1, splitType: 'PPL', status: 'completed', targetRIR: 3, sessionIds: [] },
  { id: 'brian-micro-2', mesocycleId: 'brian-meso-1', userId: BRIAN_ID, weekNumber: 2, splitType: 'PPL', status: 'completed', targetRIR: 2, sessionIds: [] },
  { id: 'brian-micro-3', mesocycleId: 'brian-meso-1', userId: BRIAN_ID, weekNumber: 3, splitType: 'PPL', status: 'active',    targetRIR: 1, sessionIds: [] },
  { id: 'brian-micro-4', mesocycleId: 'brian-meso-1', userId: BRIAN_ID, weekNumber: 4, splitType: 'PPL', status: 'draft',     targetRIR: 0, sessionIds: [] },
  { id: 'brian-micro-5', mesocycleId: 'brian-meso-1', userId: BRIAN_ID, weekNumber: 5, splitType: 'PPL', status: 'draft',     targetRIR: 3, sessionIds: [] }, // deload
];

function brianPush(date: string, dow: 0|1|2|3|4|5|6, id: string, microId: string, mesoId: string, weekNum: number, completed: boolean, weightBoost = 0): WorkoutSession {
  const bench = 80 + weekNum * 2.5 + weightBoost;
  const ohp = 45 + weekNum * 1.5 + weightBoost;
  const rpe = 7 + weekNum * 0.5;
  return {
    id, userId: BRIAN_ID, microcycleId: microId, mesocycleId: mesoId,
    date, dayOfWeek: dow, completed,
    exercises: [
      { exerciseId: 'bench-press-barbell', name: 'Barbell Bench Press', muscle: 'chest', prescribedSets: 3, prescribedRepsLow: 6, prescribedRepsHigh: 8,
        sets: completed
          ? [mkSet(0, bench, 8, rpe), mkSet(1, bench, 7, rpe + 0.5), mkSet(2, bench, 6, rpe + 1)]
          : [{setIndex:0,weightKg:bench,reps:undefined,completed:false},{setIndex:1,weightKg:bench,reps:undefined,completed:false},{setIndex:2,weightKg:bench,reps:undefined,completed:false}],
      },
      { exerciseId: 'ohp-dumbbell', name: 'Seated Dumbbell Press', muscle: 'shoulders', prescribedSets: 3, prescribedRepsLow: 8, prescribedRepsHigh: 10,
        sets: completed
          ? [mkSet(0, ohp, 10, rpe), mkSet(1, ohp, 9, rpe + 0.5), mkSet(2, ohp, 8, rpe + 1)]
          : [{setIndex:0,weightKg:ohp,reps:undefined,completed:false},{setIndex:1,weightKg:ohp,reps:undefined,completed:false},{setIndex:2,weightKg:ohp,reps:undefined,completed:false}],
      },
      { exerciseId: 'tricep-pushdown-cable', name: 'Cable Triceps Pushdown', muscle: 'triceps', prescribedSets: 3, prescribedRepsLow: 10, prescribedRepsHigh: 12,
        sets: completed
          ? [mkSet(0, 30, 12, rpe), mkSet(1, 30, 12, rpe), mkSet(2, 30, 11, rpe + 0.5)]
          : [{setIndex:0,weightKg:30,reps:undefined,completed:false},{setIndex:1,weightKg:30,reps:undefined,completed:false},{setIndex:2,weightKg:30,reps:undefined,completed:false}],
      },
    ],
    cardio: [],
  };
}

const brianSessions: WorkoutSession[] = [];
{
  let sid = 1;
  for (let week = 1; week <= 5; week++) {
    for (const dayIdx of BRIAN_DAY_INDICES) {
      const off = brianOffset(week, dayIdx);
      // Mark one in week 2 (Thu) as skipped — past date, scheduled but not completed.
      const isSkipped = week === 2 && dayIdx === 3;
      // Completed if past and not skipped; today and future remain incomplete (planned).
      const completed = off < 0 && !isSkipped;
      const id = `brian-s${sid++}`;
      brianSessions.push(brianPush(isoOffset(off), dow(off), id, `brian-micro-${week}`, 'brian-meso-1', week, completed));
    }
  }
}
// Off-day cardio: a Wednesday (dayIdx=2) extra run in week 2 — shows as blue (logged on a non-program day).
{
  const off = brianOffset(2, 2);
  brianSessions.push({
    id: 'brian-cardio-extra',
    userId: BRIAN_ID,
    microcycleId: 'brian-micro-2',
    mesocycleId: 'brian-meso-1',
    date: isoOffset(off),
    dayOfWeek: dow(off),
    completed: true,
    completedAt: isoOffset(off) + 'T07:30:00Z',
    exercises: [],
    cardio: [{ activityType: 'treadmill', durationMin: 30, distanceKm: 4.5, avgHR: 145 }],
  });
}
for (const m of brianMicros) {
  m.sessionIds = brianSessions.filter((s) => s.microcycleId === m.id).map((s) => s.id);
}

// Resolve the active week from the seeded session dates rather than hard-coding
// it. The active microcycle is the first week that still has a session dated
// today or later; every earlier week is completed, every later week is a draft.
// A static "week 3 is active" snapshot goes stale otherwise — e.g. on a Sunday,
// once that week's Tue/Thu/Sat sessions are all in the past, it would leave a
// fully-completed week marked active and the Today screen with nothing to show.
{
  const todayStr = isoOffset(0);
  const firstCurrentIdx = brianMicros.findIndex((m) =>
    brianSessions.some((s) => s.microcycleId === m.id && s.date >= todayStr),
  );
  const activeIdx = firstCurrentIdx >= 0 ? firstCurrentIdx : brianMicros.length - 1;
  brianMicros.forEach((m, i) => {
    m.status = i < activeIdx ? 'completed' : i === activeIdx ? 'active' : 'draft';
  });
  brianMeso.weekIndex = activeIdx;
}

// ============================================================
// Previous completed mesos — give Brian some history to flip through
// in the History dropdown.
// ============================================================

// brian-meso-prev1 — "Foundation" — 5wk hypertrophy, finished just before current block.
// brian-meso-prev2 — "Strength Test" — 4wk strength, finished just before that.
const brianPrev1Weeks = 5;
const brianPrev2Weeks = 4;
const BRIAN_PREV1_WEEK1_MON_OFFSET = BRIAN_WEEK1_MON_OFFSET - brianPrev1Weeks * 7;
const BRIAN_PREV2_WEEK1_MON_OFFSET = BRIAN_PREV1_WEEK1_MON_OFFSET - brianPrev2Weeks * 7;

const brianMesoPrev1: Mesocycle = {
  id: 'brian-meso-prev1',
  userId: BRIAN_ID,
  name: 'Foundation',
  goal: 'build-muscle',
  startDate: isoOffset(BRIAN_PREV1_WEEK1_MON_OFFSET),
  phaseType: 'hypertrophy',
  weeks: brianPrev1Weeks,
  progressionScheme: 'rir-based',
  weekIndex: brianPrev1Weeks - 1,
  status: 'completed',
  microcycleIds: Array.from({ length: brianPrev1Weeks }, (_, i) => `brian-prev1-micro-${i + 1}`),
};
const brianMesoPrev2: Mesocycle = {
  id: 'brian-meso-prev2',
  userId: BRIAN_ID,
  name: 'Strength Test',
  goal: 'build-strength',
  startDate: isoOffset(BRIAN_PREV2_WEEK1_MON_OFFSET),
  phaseType: 'strength',
  weeks: brianPrev2Weeks,
  progressionScheme: 'rir-based',
  weekIndex: brianPrev2Weeks - 1,
  status: 'completed',
  microcycleIds: Array.from({ length: brianPrev2Weeks }, (_, i) => `brian-prev2-micro-${i + 1}`),
};

function buildBrianPastMeso(opts: {
  mesoId: string;
  microIdPrefix: string;
  week1MonOffset: number;
  weeks: number;
  rirs: number[];
  weightBoost: number;
}): { micros: Microcycle[]; sessions: WorkoutSession[] } {
  const micros: Microcycle[] = [];
  const sessions: WorkoutSession[] = [];
  let sid = 1;
  for (let week = 1; week <= opts.weeks; week++) {
    const microId = `${opts.microIdPrefix}-${week}`;
    micros.push({
      id: microId,
      mesocycleId: opts.mesoId,
      userId: BRIAN_ID,
      weekNumber: week,
      splitType: 'PPL',
      status: 'completed',
      targetRIR: opts.rirs[week - 1],
      sessionIds: [],
    });
    for (const dayIdx of BRIAN_DAY_INDICES) {
      const off = opts.week1MonOffset + (week - 1) * 7 + dayIdx;
      const id = `${opts.microIdPrefix}-s${sid++}`;
      sessions.push(brianPush(isoOffset(off), dow(off), id, microId, opts.mesoId, week, true, opts.weightBoost));
    }
  }
  for (const m of micros) {
    m.sessionIds = sessions.filter((s) => s.microcycleId === m.id).map((s) => s.id);
  }
  return { micros, sessions };
}

const brianPrev1Build = buildBrianPastMeso({
  mesoId: 'brian-meso-prev1',
  microIdPrefix: 'brian-prev1-micro',
  week1MonOffset: BRIAN_PREV1_WEEK1_MON_OFFSET,
  weeks: brianPrev1Weeks,
  rirs: [3, 2, 1, 0, 3], // deload last week
  weightBoost: -5,       // a bit lighter than the current block
});
const brianPrev2Build = buildBrianPastMeso({
  mesoId: 'brian-meso-prev2',
  microIdPrefix: 'brian-prev2-micro',
  week1MonOffset: BRIAN_PREV2_WEEK1_MON_OFFSET,
  weeks: brianPrev2Weeks,
  rirs: [3, 2, 1, 0],
  weightBoost: -10,
});

const brianPrev1Micros = brianPrev1Build.micros;
const brianPrev1Sessions = brianPrev1Build.sessions;
const brianPrev2Micros = brianPrev2Build.micros;
const brianPrev2Sessions = brianPrev2Build.sessions;

const brianBW: BodyWeightEntry[] = [
  { date: isoOffset(-21), weightKg: 84.0 },
  { date: isoOffset(-14), weightKg: 84.6 },
  { date: isoOffset(-7),  weightKg: 85.0 },
  { date: isoOffset(0),   weightKg: 85.2 },
];

/* ============================================================
 * ZACH — ADVANCED user, full macrocycle in progress
 * ========================================================== */
const ZACH_ID = 'demo-zach';
const zachProfile: UserProfile = {
  userId: ZACH_ID,
  displayName: 'Zach',
  dob: '1995-02-08',
  sex: 'male',
  heightCm: 178,
  weightKg: 88,
  units: 'imperial',
  experience: '2yr-plus',
  periodizationFamiliarity: 'fluent',
  primaryGoal: 'build-muscle',
  daysPerWeek: 5,
  timePerSessionMin: 75,
  equipment: ['commercial-gym'],
  strengthBaseline: { squat: 180, bench: 130, deadlift: 220, overheadPress: 80 },
  mode: 'ADVANCED',
  advancedTerminology: true,
  createdAt: isoOffset(-90) + 'T08:00:00Z',
  updatedAt: isoOffset(-1) + 'T08:00:00Z',
};

const zachMeso1: Mesocycle = {
  id: 'zach-meso-1',
  userId: ZACH_ID,
  name: 'Off-season Hypertrophy',
  goal: 'build-muscle',
  startDate: isoOffset(-42),
  phaseType: 'hypertrophy',
  weeks: 5,
  progressionScheme: 'rir-based',
  weekIndex: 2,
  status: 'active',
  microcycleIds: ['zach-micro-1','zach-micro-2','zach-micro-3'],
};
const zachMeso2: Mesocycle = {
  id: 'zach-meso-2',
  userId: ZACH_ID,
  name: 'Off-season Hypertrophy II',
  goal: 'build-muscle',
  startDate: isoOffset(-7),
  phaseType: 'hypertrophy',
  weeks: 5,
  progressionScheme: 'rir-based',
  weekIndex: 0,
  status: 'draft',
  microcycleIds: [],
};
const zachMicros: Microcycle[] = [
  { id: 'zach-micro-1', mesocycleId: 'zach-meso-1', userId: ZACH_ID, weekNumber: 1, splitType: 'PPL', status: 'completed', targetRIR: 3, sessionIds: [] },
  { id: 'zach-micro-2', mesocycleId: 'zach-meso-1', userId: ZACH_ID, weekNumber: 2, splitType: 'PPL', status: 'completed', targetRIR: 2, sessionIds: [] },
  { id: 'zach-micro-3', mesocycleId: 'zach-meso-1', userId: ZACH_ID, weekNumber: 3, splitType: 'PPL', status: 'active',    targetRIR: 1, sessionIds: [] },
];

function zachPull(date: string, dow: 0|1|2|3|4|5|6, id: string, microId: string, weekNum: number, completed: boolean): WorkoutSession {
  const row = 90 + weekNum * 2.5;
  const lat = 70 + weekNum * 2;
  const curl = 14 + weekNum * 0.5;
  const rpe = 7 + weekNum * 0.5;
  return {
    id, userId: ZACH_ID, microcycleId: microId, mesocycleId: 'zach-meso-1',
    date, dayOfWeek: dow, completed,
    exercises: [
      { exerciseId: 'row-barbell', name: 'Barbell Row', muscle: 'back', prescribedSets: 4, prescribedRepsLow: 6, prescribedRepsHigh: 8, prescribedRIR: Math.max(0, 3 - (weekNum-1)),
        sets: completed
          ? [mkSet(0,row,8,rpe), mkSet(1,row,8,rpe), mkSet(2,row,7,rpe+0.5), mkSet(3,row,6,rpe+1)]
          : [0,1,2,3].map(i => ({setIndex:i,weightKg:row,reps:undefined,completed:false})),
      },
      { exerciseId: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'back', prescribedSets: 3, prescribedRepsLow: 8, prescribedRepsHigh: 10,
        sets: completed
          ? [mkSet(0,lat,10,rpe), mkSet(1,lat,10,rpe), mkSet(2,lat,9,rpe+0.5)]
          : [0,1,2].map(i => ({setIndex:i,weightKg:lat,reps:undefined,completed:false})),
      },
      { exerciseId: 'curl-dumbbell', name: 'Dumbbell Curl', muscle: 'biceps', prescribedSets: 3, prescribedRepsLow: 10, prescribedRepsHigh: 12,
        sets: completed
          ? [mkSet(0,curl,12,rpe), mkSet(1,curl,11,rpe+0.5), mkSet(2,curl,10,rpe+1)]
          : [0,1,2].map(i => ({setIndex:i,weightKg:curl,reps:undefined,completed:false})),
      },
    ],
    cardio: [],
  };
}

const zachSessions: WorkoutSession[] = [
  zachPull(isoOffset(-20), dow(-20), 'zach-s1', 'zach-micro-1', 1, true),
  zachPull(isoOffset(-18), dow(-18), 'zach-s2', 'zach-micro-1', 1, true),
  zachPull(isoOffset(-13), dow(-13), 'zach-s3', 'zach-micro-2', 2, true),
  zachPull(isoOffset(-11), dow(-11), 'zach-s4', 'zach-micro-2', 2, true),
  zachPull(isoOffset(-6),  dow(-6),  'zach-s5', 'zach-micro-3', 3, true),
  zachPull(isoOffset(-4),  dow(-4),  'zach-s6', 'zach-micro-3', 3, true),
  zachPull(isoOffset(0),   dow(0),   'zach-s7', 'zach-micro-3', 3, false),
];
zachMicros[0]!.sessionIds = ['zach-s1','zach-s2'];
zachMicros[1]!.sessionIds = ['zach-s3','zach-s4'];
zachMicros[2]!.sessionIds = ['zach-s5','zach-s6','zach-s7'];

const zachBW: BodyWeightEntry[] = [
  { date: isoOffset(-42), weightKg: 86.5 },
  { date: isoOffset(-28), weightKg: 87.0 },
  { date: isoOffset(-14), weightKg: 87.6 },
  { date: isoOffset(0),   weightKg: 88.0 },
];

/* ============================================================ */
export const DEMO_USERS: UserProfile[] = [mollyProfile, brianProfile, zachProfile];
export const DEMO_MESOCYCLES: Mesocycle[] = [mollyMeso, brianMesoPrev2, brianMesoPrev1, brianMeso, zachMeso1, zachMeso2];
export const DEMO_MICROCYCLES: Microcycle[] = [...mollyMicros, ...brianPrev2Micros, ...brianPrev1Micros, ...brianMicros, ...zachMicros];
export const DEMO_SESSIONS: WorkoutSession[] = [...mollySessions, ...brianPrev2Sessions, ...brianPrev1Sessions, ...brianSessions, ...zachSessions];
export const DEMO_BODYWEIGHT: Record<string, BodyWeightEntry[]> = {
  [MOLLY_ID]: mollyBW,
  [BRIAN_ID]: brianBW,
  [ZACH_ID]: zachBW,
};

export const DEMO_USER_IDS = { MOLLY: MOLLY_ID, BRIAN: BRIAN_ID, ZACH: ZACH_ID };
