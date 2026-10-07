# Strength levels

Design notes, kept next to the code they describe. See [`SEASONS.md`](SEASONS.md) for the
anchor lifts, whose results now carry a level.

## Why

A one-rep max on its own says little: is 80 kg on the bench a lot? It depends on the lifter's
body weight. Strength standards answer that question with named levels relative to body weight,
which makes "getting stronger" a ladder with rungs.

## The levels

There are five, after Strength Level's percentiles of its lifters:

| Level | | Stronger than |
|---|---|---|
| `beginner` | Beginner | 5% of lifters |
| `novice` | Novice | 20% |
| `intermediate` | Intermediate | 50% |
| `advanced` | Advanced | 80% |
| `elite` | Elite | 95% |

Below the first threshold, the level is "not yet beginner".

## The standards (`lib/strength-standards.js`)

**Coverage.** 23 lifts:

- **Barbell:** bench press, squat, deadlift, standing and seated overhead press, bent-over row,
  incline bench press, front squat, Romanian deadlift, curl, close-grip bench press and shrug.
- **Dumbbell, per dumbbell:** bench press, shoulder press, curl, row and goblet squat.
- **Machine:** sled leg press and lat pulldown.
- **Repetitions at body weight:** pull-ups, chin-ups, dips and push-ups.

Each lift maps to the library exercises it stands for: the high-bar squat and the full squat for
the squat, the chest and triceps dips for dips, and so on. Strength Level also has a hip thrust,
which the library has no exercise for.

**The model.** For each lift, sex and level, a threshold at a reference body weight (80 kg for
men, 60 kg for women) and an exponent:

```
threshold(bw) = t_ref · (bw / ref) ^ b
```

- **Where the numbers come from.** The parameters were fitted to Strength Level's published
  tables, by least squares in log space over the rows at 60–120 kg for men and 50–90 kg for women.
- **How close it is.** Against those tables the model is off by a few kilograms at most (up to
  8 kg on the leg press, at the ends of the range) and by one to three reps, and it is closest
  near the reference weight.
- **What is in the repository.** Only the model: 23 lifts × 2 sexes × 5 levels × (threshold,
  exponent). Strength Level's tables themselves are not copied in.
- **Credit.** The source is named in the code and on screen.

**Units.** The model is in kilograms, with the barbell's weight included and dumbbells counted
per dumbbell, as Strength Level gives them. A profile in pounds is converted both ways.

## What a lift is measured by

- **The window.** The last twelve weeks, so a level says how strong someone is now.
- **A loaded lift:** the best estimated one-rep max (`onerm.js`, `bestSetOf`) of a work set.
- **A repetition lift:** the most reps in one work set.
- **Body weight:** the last weigh-in on or before the day the lift was measured; failing that, the
  first one after it. With no weigh-in at all, there are no levels.
- **Sex:** `S.body`, as in Settings.
- **No level** for an exercise that is not one of the 23, or an assisted one.

## On screen

### Stats: the "Strength levels" card

The card sits below Structural balance.

- **The header** names the body weight it reads from, and the sex.
- **One row per lift** trained in the window, the highest level first. Each row has:
  - the exercise;
  - the level's name;
  - a bar of five segments, filled to the level, with the current one filled by how far it is
    towards the next;
  - "to Advanced: +12 kg" (or "+3 reps"), or "Elite" at the top.
- **Tapping a row** opens a sheet with:
  - the measure, with the set it came from;
  - the five thresholds at this body weight, with the lifter's place marked;
  - a line naming the source.
- **With no weigh-in,** the card says levels are read against body weight, with a **Log weight**
  button.
- **With no lift that has a standard** trained in the window, it lists which lifts have one.

### Season results

Each anchor with a standard shows its level in week 1 and at the test, for example "Novice →
Intermediate", with the arrow when it went up.

## Where it lives

- **`frontend/src/lib/strength-standards.js`:** the fitted model and the exercise ids per lift.
- **`frontend/src/lib/strength-levels.js`** (pure, with tests): `LEVELS`, `standardOf(exId)`,
  `thresholdsFor(lift, sex, bwKg)`, `bodyweightOn(S, iso)`, `levelOf(value, thresholds)`,
  `exerciseLevel(S, exId, …)`, `strengthLevels(S, …)`, `measureLevel(S, exId, measure, iso)`.
- **`frontend/src/lib/level-i18n.js`** and `.ru.js`: `tlv()`.
- **`frontend/src/components/StrengthLevels.jsx`:** the card and its sheet.
- **`frontend/src/views/Stats.jsx`:** the card.
- **`frontend/src/sheets-season.jsx`:** the level in an anchor's results.

## Tests

- **The model** against a handful of Strength Level's own rows, within a tolerance: the bench
  press at 70 and 100 kg for men, the squat at 60 kg for women, pull-ups at 80 kg for men.
- **`levelOf`:** below the first threshold, on a threshold, between thresholds, past Elite, and
  the share of the way to the next.
- **Units:** pounds in, pounds out.
- **Measures:**
  - a loaded lift's best e1RM in the window, an older one left out;
  - a repetition lift's most reps;
  - warm-ups left out;
  - an assisted exercise has no level.
- **Body weight on a day:** before, after, and none.
- **The card:** a level row, the no-weigh-in state, the empty state.
- **The season results:** an anchor's level, before and after.

## Not in this round

- One overall rank.
- Age-adjusted standards.
- Lifts Strength Level has and the library does not.
- The Coach reading the levels.
