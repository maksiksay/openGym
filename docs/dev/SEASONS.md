# Seasons: six-week blocks with a test at the end

Design notes, kept next to the code they describe. See [`SCOREBOARD.md`](SCOREBOARD.md) for wins
and the monthly quota, which this sits beside.

## Why

The gym has no end. A sport has fixtures and a season, while training on its own is an endless
treadmill, and "no progress felt" follows from it. The fix is a finish line:

- **Run six-week blocks with a test at the end.** A result, then a deliberate week off or a change
  of accessories. Six weeks is a commitment a busy person can sign.
- **Change the program only at a block's boundary.** The change is the new season, and novelty is
  scheduled rather than suppressed.
- **Four anchor lifts survive every change:** a squat pattern, a hinge, a horizontal press and a
  vertical pull. They keep the numbers comparable across programs. Everything else is free.

Upstream plans "Programmes & phases" for v1.3.11 (routines grouped into blocks over weeks). This
is a thin layer over the plan as it stands, so the two can be joined later.

## What a season is

`S.seasons` is a list. Each season holds only its own definition:

```js
{ id, n: 1, start: '2026-10-09', weeks: 6,
  anchors: { squat: '1004', hinge: '1009', press: '0025', pull: '0017' },   // an id, or null
  closed: null | { at: '2026-11-21', next: 'rest' | 'now' } }
```

- Everything else is worked out from the log when it is needed: the week, each anchor's starting
  value, its best so far, its test, and the results. Nothing about a season is stored twice.
- The current season is the last one that is not `closed`. It may start in the future: that is
  the week off between two seasons.
- Week `k` is days `7(k−1)` to `7k−1` after `start`. The test week is the last one; the season ends
  after day `7·weeks − 1`.
- Sync between devices: the newer copy's list wins whole, like other settings. A season changes
  rarely, and only by an explicit tap.

## Anchors

At the start, four slots are filled from the plan: the best match in the routines for each pattern,
read off the exercise's name (`suggestAnchors`).

| Slot | Matches, in order of preference |
|---|---|
| `squat` | a squat; then a leg press, a lunge or a split squat |
| `hinge` | a deadlift (Romanian and stiff-leg ones first); then a good morning, a hip thrust, a glute bridge, a swing or a back extension |
| `press` | a flat bench press; then any bench press, a floor press, a chest press or a push-up |
| `pull` | a pull-up or a chin-up; then a pulldown |

- Any slot can be changed to any exercise in the plan, or left empty.
- The next season starts with the same anchors. A slot whose exercise left the plan says so.

### What an anchor is measured in

The measure is read from one workout, the way the scoreboard reads it (`readExercise`):

- **A loaded exercise:** the best estimated one-rep max (`e1rm`).
- **Body weight, a band, or an assistance machine:** the most reps in one set.
- **A timed exercise:** the longest hold.

## The test

**When it happens.** During the test week, when a session starts (`beginWorkout`, a past workout
logged into that week, or a routine added mid-session), the last work set of each anchor in it is
marked as the test: `test: true` on the set row.

- An anchor is marked once. One already tested in the season, or already marked in this session,
  is not marked again.
- One not trained that week stays untested.

**What it asks.** As many reps as there are, at the working weight, with one or two left in the
tank (or the longest hold for a timed exercise). The workout screen says so above the set.

**What it does not change.** Progression reads the set like any other.

**How it is scored.** An anchor's test is the measure of its test set. Without one, the best of
the test week stands in, marked as such.

## On Home

### No season

A card offers a season: "Start a season — six weeks, a test at the end". It opens the start sheet:

- the start date, today by default;
- the four anchor slots, pre-filled;
- a line on what happens.

### A season in its first five weeks

A card reads "Season 1 · week 3 of 6 · test from 13 Nov". Each anchor shows week 1 → its best so
far. An anchor not yet logged in the season says so.

### The test week

The card reads "Test week". Each anchor shows tested ✓ (and its value) or not yet. A line says the
anchors' last set is the test.

### The week off

The card reads "Week off · Season 2 starts on …", with **Start now** (moves the start to today).

### Over

When every anchor with an exercise is tested, or the last day has passed, the card reads "Season 1
is over" and opens the results.

## The results, and the boundary

The results sheet holds:

- **each anchor:** week 1 → test, with the change in its unit and in per cent;
- **sessions** logged in the season;
- **wins and records** (the scoreboard's) in the season.

It closes the season with one of two buttons, either of which starts the next season with the same
anchors:

- **Week off, then Season 2:** the next season starts seven days after today.
- **Season 2 now:** the next season starts today.

Below them, **Change the program** opens the starter plans, and says that a plan file or the Coach
work too. The anchors carry over, and the next season's sheet shows a slot whose exercise is gone.

**Past seasons** are listed in the season sheet, each with its results.

## The rule, kept softly

While a season runs (not in its week off, not before it starts), three actions that replace the
plan ask first. They are:

- loading a starter plan;
- importing a plan file;
- importing a plan the Coach built.

The question is: "Season 1 runs until 18 Nov. By your own rule the program changes at the boundary,
and accessories can change any time. Change the plan now?". It has **Change it** and **Keep the
season's plan**. Nothing is ever blocked; editing a routine is never asked about.

## The Coach

Payloads for a review, a chat and a plan carry `season`:

```js
{ n, week, weeks, testWeek, anchors: [ids], until }
```

It is computed in `payload.js` from `S.seasons`, a few lines that repeat `lib/season.js`'s
arithmetic, since the core cannot import the frontend.

`common.md` tells the model:

- keep the anchors in the plan;
- leave a whole new program for the boundary;
- accessories may change any time;
- in the test week, leave the anchors' sets and reps alone.

## Where it lives

- **`frontend/src/lib/season.js`** (pure, with `season.test.js`): `SEASON_WEEKS`,
  `suggestAnchors`, `currentSeason`, `seasonState`, `anchorMeasure`, `anchorProgress`,
  `markTests`, `seasonResults`, `startSeason`, `closeSeason`, `swapGuard`.
- **`frontend/src/lib/season-i18n.js`** and `.ru.js`: `tsn()`, the health-i18n pattern.
- **`frontend/src/store/useStore.js`**: `seasons: []` in `DEF`.
- **`frontend/src/sheets.jsx`**: `markTests` in `beginWorkout`, in the logging of a past workout and
  in a routine added mid-session; the guard in `loadStarterPlan` and the plan import.
- **`frontend/src/views/CoachChat.jsx`**: the guard on importing a Coach plan.
- **`frontend/src/sheets-season.jsx`**: the start sheet, the season sheet (results, past seasons)
  and the guard's question.
- **`frontend/src/views/Home.jsx`**: the season card, above the quota card.
- **`frontend/src/views/Workout.jsx`**: the test line above a test set.
- **`api/coach/core/payload.js`** (`season`) and `api/coach/prompts/common.md`.

## Tests

- **`season.test.js`:**
  - weeks and the test week at the edges (day 0, day 34/35, the last day, after it);
  - the week off;
  - anchor suggestions from a plan, including none;
  - the three measures;
  - the starting value, the best so far, and the test (test set, and the fallback);
  - `markTests`: only in the test week, only the last work set, once per anchor and per session,
    never a warm-up;
  - results;
  - closing either way;
  - the guard's three states.
- **Session start:** a session started in the test week carries the test flag; one started
  before it does not.
- **Home:** the card in each state.
- **The workout screen:** the test line.
- **The guard:** loading a starter plan mid-season asks; in the week off it does not.
- **The payload:** `season` is present, bounded, and absent without a season.
- **In a browser:** a seeded profile in week 3, in the test week, and over (en and ru).

## Not in this round

- Season boundaries on the charts.
- Strength levels relative to body weight: the next item on the list.
- A dedicated test day.
- Lighter loads in the week off.
- A season length other than six weeks: `weeks` is stored, so it can come later.
