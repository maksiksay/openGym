# Warm-ups and recovery: light routines of their own, run before a workout or on their own

Design notes, kept next to the code they describe. Builds on combined sessions
([`COMBINE_ROUTINES.md`](COMBINE_ROUTINES.md)) and the built-in exercises of
[`AB_PLAN.md`](AB_PLAN.md).

## Why

A warm-up today is a few ramp sets on the first lift. The ten minutes before them have no home:

- the shoulder-blade activation before pressing and pulling;
- the hip and ankle work before legs.

The same holds for the light sessions that are not training at all: recovery after a football
game, and ligament, joint and foot work. Logged as ordinary workouts they would count as
training days, set records and fill the muscle map; not logged, they are forgotten.

## What it adds

### A kind of routine: warm-up and recovery

- **The flag:** `routine.kind = 'mobility'`. A routine without it is a training routine, as
  before.
- **What a mobility routine is not part of:** progression, records, wins, the monthly quota,
  seasons, strength levels, the muscle and fatigue maps, structural balance, and the Coach's
  reading of the training. Its exercises are counted by time or by reps.
- **Plan:** they get a section of their own, "Warm-ups and recovery", below the routines, with:
  - **New**, a routine of this kind;
  - **Ready-made**, the built-in sets below.
- **The routine editor:** a mobility routine shows no progression and no deload switch.

### Before a workout, on its own

- **The link:** a training routine may name one mobility routine as its warm-up,
  `routine.warmup = '<id>'`. The editor has a row for it: "Warm-up: none / …".
- **Starting:** a routine with a warm-up starts with it. The session is built from
  `[warm-up, routine]`, its exercises first, as one workout (`lib/session-merge.js`).
  - Two routines sharing a warm-up run it once.
  - The session keeps the training routine's name.
- **Skip warm-up:** the workout screen shows the warm-up block with this button. It drops the
  block's exercises from the session in one tap.
- **The flags on what is logged:**
  - an exercise from a mobility routine is logged with `entry.mobility = true` (and `noProg`),
    frozen at build time like `noProg`, so a routine deleted later still reads right;
  - a workout made of nothing else is saved with `w.mobility = true`.

### On its own

- **Starting one:** a mobility routine starts like any other routine: from Plan, or scheduled on
  a day.
- **What it counts for:** the workout is kept and shown in History with a "Recovery" tag. It
  counts for none of the above, and the monthly quota is only training.

### The ready-made sets (`lib/warmups.js`)

Five sets, each added to the profile as an ordinary, editable mobility routine:

1. **Upper-body warm-up, ~8 min:**
   - bike, 3 min;
   - band pull-apart, 15;
   - scapula push-up, 12;
   - band Y-raise, 12;
   - cable external rotation, 12 a side;
   - open book, 5 a side.
2. **Lower-body warm-up, ~8 min:**
   - bike, 3 min;
   - glute bridge, 12;
   - leg swings, 10 a side;
   - ankle circles, 30 s;
   - calf stretch, 30 s a side;
   - bodyweight squat, 10.
3. **Shoulder blades and posture, ~10 min:**
   - band Y-raise and scapula push-up, 2 × 12 each;
   - band face pull, 2 × 15;
   - incline T-raise, 2 × 10;
   - dead bug, 2 × 8;
   - open book.
4. **Recovery after football, ~15 min:**
   - easy bike, 8 min;
   - hip flexor, hamstring, adductor and calf stretches, 2 × 30–45 s each.
5. **Ligaments, joints and feet, ~12 min:**
   - slow calf raises (3 s down), 2 × 12;
   - single-leg balance, 2 × 30 s a side;
   - short foot, 2 × 30 s;
   - cable external rotation, 2 × 12 a side.

After adding them, a sheet offers to put the upper-body warm-up before the routines that are
mostly upper body, and the lower-body one before the rest. Each choice is a checkbox,
preselected from the routines' exercises.

### Six new built-in exercises (`lib/exercises-extra.js`)

The library has the rest. These six are missing:

| id | name | ru |
|---|---|---|
| 9003 | band pull-apart | разведение резинки |
| 9004 | band face pull | тяга резинки к лицу |
| 9005 | open book (thoracic rotation) | «открытая книга» |
| 9006 | leg swings | махи ногами |
| 9007 | single-leg balance | баланс на одной ноге |
| 9008 | short foot | «короткая стопа» |

Each is added the way 9001 and 9002 were: catalogue terms that exist, muscles, five English
steps, names in the six complete packs, Russian and Portuguese steps.

## Where it lives

- **`frontend/src/lib/warmups.js`** (pure): the sets, `addWarmupSets`, `suggestWarmups`,
  `isMobilityRoutine`, `mobilityEntry`.
- **`frontend/src/lib/session-merge.js`:** the warm-up put first, and the entries flagged.
- **`frontend/src/lib/finish-workout.js`:** `w.mobility`.
- **The readers that count or measure** (quota, scoreboard, history's exercise entries, season,
  strength levels, muscles, recovery, structural balance, insights, the Coach payload): a mobility
  entry or workout is left out.
- **`frontend/src/lib/rotation.js`:** next-up skips mobility routines.
- **`frontend/src/views/Plan.jsx`:** the section and the sheets.
- **`frontend/src/views/RoutineEdit.jsx`:** the warm-up row, and no progression for a mobility
  routine.
- **`frontend/src/views/Workout.jsx`:** the warm-up block and Skip warm-up.
- **History:** the Recovery tag.
- **`frontend/src/lib/exercises-extra.js` and the name and step sources:** the exercises.
- **The Coach's app map:** the section.

## Tests

- **`lib/warmups.test.js`:**
  - every set names existing exercises in valid modes;
  - adding the sets gives routines of the mobility kind;
  - the suggestion picks upper and lower routines.
- **Sessions:** the warm-up comes first and runs once for two routines; its entries are flagged and
  out of progression; skipping it drops them; the name stays the routine's.
- **Counting:** a mobility workout is out of the quota and the wins; a warm-up's sets set no record
  and add no muscle load; next-up skips mobility routines.
- **The exercises:** terms, muscles, names and steps (the existing catalogue and locale tests
  cover them).
- **Views:** the Plan section and the ready-made sheet, the editor's warm-up row, the workout's
  block and Skip warm-up.

## Not in this round

- A timer that runs a whole warm-up hands-free.
- A warm-up chosen per day rather than per routine.
- Mobility sessions in the Coach's view; the app map tells it where they are.
