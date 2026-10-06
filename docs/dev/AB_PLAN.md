# The A/B plan: two built-in exercises, a 2×40 starter plan, the next session without a schedule

Design notes, kept next to the code they describe. See [`CLAUDE.md`](../../CLAUDE.md) for the
general architecture; this file only covers what this round adds.

## Why

Two sessions a week of about forty minutes is the most a busy person keeps up, and the starter
plans so far are all three or four days. People who also play a sprinting sport want a few
minutes of hamstring and groin work: the Nordic curl and the Copenhagen adduction are the
best-evidenced prevention for the two most common injuries there. The catalogue has neither.
And not everyone trains on fixed weekdays. Without a weekly plan the app knew nothing to start
and had to be told every time which routine came next.

## What this adds

- **Two built-in exercises:** the Nordic hamstring curl and the Copenhagen adduction.
- **A starter plan, "Strength 2×40 (A/B)":** the four anchor lifts (squat, hinge, horizontal
  press, vertical pull) over two forty-minute sessions, both finished with the two exercises
  above. It sets no weekdays.
- **The next session without a schedule** (`lib/rotation.js`): with an empty weekly plan, the
  routine after the one trained last is the one Home, the Start button and the Start screen
  offer.

## Two built-in exercises (`frontend/src/lib/exercises-extra.js`)

| id | `n` | `bp` | `eq` | `tg` | `mg` | `sm` | `primaries` | `secondaries` |
|---|---|---|---|---|---|---|---|---|
| `9001` | nordic hamstring curl | upper legs | body weight | hamstrings | glutes | glutes, calves | hamstring | gluteal, calves |
| `9002` | copenhagen adduction | upper legs | body weight | adductors | obliques | obliques, abs | adductors | obliques, abs, hip-flexors |

### Where they live

- **The rows** live in their own module, appended to `EXDB` by a trailing statement in
  `exercises-data.js`. The upstream line above it stays exactly as shipped. Every reader of the
  catalogue sees them, including the readers that import `exercises-data.js` directly: equipment
  lists, the Coach library builder, the name and instruction builders, and their tests.
- **The ids** sit far above the dataset's (it ends at `5201`).
- **No media.** The rows carry no `img` and no `gif`, so the card shows no media block and lists
  show the placeholder tile, as for any exercise without media.
- **Terms.** Every `bp`, `eq`, `tg`, `mg` and `sm` value already exists in the catalogue, which
  `locale-coverage.test.js` requires.

### Translations

- **Names** are added to the six complete packs, through their JSON sources in
  `scripts/exercise-name-sources/` and the builders:

  | Pack | 9001 | 9002 |
  |---|---|---|
  | ru | нордические сгибания ног | копенгагенское приведение |
  | es | curl nórdico de isquiotibiales | aducción de Copenhague |
  | fr | curl nordique des ischio-jambiers | adduction de Copenhague |
  | it | curl nordico per i femorali | adduzione di Copenaghen |
  | pt-BR | flexão nórdica de isquiotibiais | adução de Copenhague |
  | hu | nordic combhajlítás | koppenhágai adduktorgyakorlat |

  German gets none: body-weight rows stay out of `de.json` by its own rule.
- **Instructions** have five steps in English (`st`), in Russian (`instr/ru.js`, by hand) and
  in Portuguese (Brazil) (`scripts/instruction-sources/pt-BR.json`, then the builder).
  `scripts/build-instructions.mjs` regenerates `instr/ru.js` from the upstream dataset and would
  drop the Russian entries, so that file carries a comment saying so. Every other language falls
  back to the English steps, as it does for any gap.

### Around them

- **Coach.** `api/coach/core/library-data.js` is regenerated (`node scripts/build-coach-assets.mjs`),
  so the Coach can read and propose both exercises and CI's `--check` stays green.
- **Structural Balance.** The ATG Nordic role points at `['9001', '3193']`: the real exercise
  first, the glute-ham raise kept as the fallback it used to stand in as.
- **Library.** The subtitle "{0} exercises with animations" counts the rows that have one, not
  every row.
- **CSV import.** `ALIAS_EX` gains "nordic curl", "nordic hamstring curl", "nordics",
  "copenhagen", "copenhagen plank" and "copenhagen adduction".
- **Hevy.** `hevy-id-map.js` is generated against the Hevy API and is not touched. A Nordic curl
  from Hevy keeps importing as a custom exercise.

## The starter plan (`frontend/src/lib/starter.js`)

A starter routine line grows an optional fourth element, an object merged into the exercise
config: `[id, sets, reps, { repsMin, prog, side }]`. Reps are the routine's usual total, so a
per-side exercise counts both sides: 8–10 per leg is `reps: 20, repsMin: 16`.

| Strength A | | Strength B | |
|---|---|---|---|
| `0043` barbell full squat | 3 × 5, linear | `0085` barbell romanian deadlift | 3 × 6–8, double |
| `0025` barbell bench press | 3 × 6–8, double | `0652` pull-up | 3 × 6, +1 rep per clean session |
| `0027` barbell bent over row | 3 × 8–10, double | `0426` dumbbell standing overhead press | 3 × 6–8, double |
| `0410` dumbbell single leg split squat | 2 × 8–10 per leg, double | `0251` chest dip | 3 × 6, +1 rep per clean session |
| `9001` nordic hamstring curl | 2 × 5, progression off | `9001` nordic hamstring curl | 2 × 5, progression off |
| `9002` copenhagen adduction | 2 × 6 per side, progression off | `9002` copenhagen adduction | 2 × 6 per side, progression off |

- **Pull-ups and dips** are body weight, which climbs in reps whatever the policy, so they start
  at six and gain one rep after every session with all reps done.
- **The two finishers are a dose, not a target**, so their progression is off. The scoreboard
  still counts a session with more.
- **Weights start at 0**, as in every starter plan. The first session's numbers are typed in;
  the goal line works from the second.
- **Routine names** are made in the interface language when the plan is loaded ("Strength A" /
  "Сила A"). Once loaded they are ordinary routines, renamed like any other.
- **No schedule.** The chooser shows "2× a week, on any days" instead of a weekday count, and
  loading asks no question because it occupies no weekday. Existing routines and the weekly
  plan are left alone.
- **Time.** About 38 minutes for A and 33 for B at 90-second rests.

## The next session without a schedule (`frontend/src/lib/rotation.js`)

`nextUp(S, iso = todayISO())` returns a routine or null. A pure helper with its tests.

- **When it is off.** It returns null when any weekday of `S.week` holds a routine, so a weekly
  plan works exactly as before. It also returns null when `S.dayPlan[iso]` is set (rest or a
  routine), because a day marked by hand wins.
- **Candidates.** `S.routines` in their Plan order (drag to reorder), without routines kept out
  of progression (deload, rehab) and without empty ones.
- **Last trained.** Take the latest workout, by `start` and then stored order, whose
  `routineIds` include a candidate. A combined session counts as the candidate in it that comes
  last in Plan order. A workout whose routines were all deleted is skipped for an earlier one.
- **Next.** The candidate after the last trained one, wrapping around. With nothing trained yet,
  the first.

**Where it shows**

| Place | What it does |
|---|---|
| Home | The today row on a day with nothing planned. In place of "Rest day" with a moon it reads **Next up · Strength B** with the routine's glyph and a Start tag, and a tap starts it. A session already done today still shows Done. |
| Tab bar | Start starts it when today has nothing planned, the way it starts today's planned routine. |
| Start screen | A **Next up** card above "Other routines", with the rest below. |

**What it doesn't touch.** The week strip's dots, the push and local reminders (both still
follow weekdays) and the monthly quota, whose auto goal is 8 without a weekly plan.

## Strings

New interface strings go through `tp()` in `lib/plan-i18n.js`, English and Russian, the pattern
`lib/health-i18n.js` and `lib/score-i18n.js` use:

- the plan's name and description;
- the chooser's "2× a week, on any days";
- "Strength A" and "Strength B";
- "Next up".

Exercise names and steps are in the catalogue's own packs (above).

## Tests

- **`lib/rotation.test.js`**:
  - the next after the last, wrapping;
  - the first with nothing trained;
  - off with a weekly plan;
  - a day marked by hand wins;
  - deload and empty routines skipped;
  - a combined session counted by its last routine in Plan order;
  - a deleted routine's workout skipped.
- **`lib/starter.test.js`** (extended): the plan builds two routines with ranges, policies and
  per-side configs, an empty schedule, and `starterPlanDays` returns `[]`.
- **Catalogue**:
  - the two rows exist with unique ids, no media, and their muscles resolve (`musclesOf`);
  - the existing pack tests check the six name packs and the Portuguese (Brazil) instructions
    for completeness.
- **Structural Balance**: the Nordic role's tests move to `9001` with `3193` as the fallback.
- **Views**:
  - Home's next-up row and its start;
  - the tab bar's Start;
  - the Start screen's card;
  - the chooser's new line.
- **Before calling it done**:
  - the whole vitest suite on Node 22;
  - `scripts/check-locales.mjs` and `scripts/check-source-strings.mjs`;
  - `scripts/build-coach-assets.mjs --check`;
  - `npm run build`;
  - a click-through in the browser in English and Russian.

## Not in this round

- A program pasted as text and turned into routines by the Coach
- Percentage and training-max programs (5/3/1, nSuns), AMRAP stages
- Training blocks and seasons
- Reminders that follow the rotation
- Media for the two new exercises
