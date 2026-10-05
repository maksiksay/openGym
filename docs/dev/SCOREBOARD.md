# Scoreboard: wins, the goal line and the monthly quota

Design notes for the scoreboard round, kept next to the code they describe. See
[`CLAUDE.md`](../../CLAUDE.md) for the general architecture; this file only covers what this
round adds.

## Why

Training that is not compared with anything feels like no progress, whatever is happening on the
bar. The log already holds every number needed to say "better than last time", but the workout
card spreads it over three lines and never names the one number to beat. The finish sheet
reports only a heavier top set or a better estimated 1RM, which a lifter past the first months
reaches a few times a year. And the only frequency signal is a week streak: one missed week and
it is gone, so it rewards fear of losing it rather than the training.

This round gives every exercise one number to beat, counts many more kinds of progress as wins,
and swaps the streak for a monthly quota where a missed session costs nothing.

## What this adds

- **The goal line** on the exercise card: the number to beat today, and last time beside it.
  It replaces the plan line, the "Last time" line and the progression line.
- **Live feedback**: a chip on the card once today beats last time or sets a record, and a mark
  on every ticked set that beats the same set last time.
- **Wins**: six kinds, derived from the history (`lib/scoreboard.js`). Nothing new is stored on
  a workout.
- **The finish sheet** lists the wins and the month's quota instead of PRs only.
- **The quota** (`lib/quota.js`): training days this calendar month against a goal, on Home in
  place of the week streak, and on Stats.
- **History** shows the win count and the win chips in place of the PR badge.

## Wins (`frontend/src/lib/scoreboard.js`)

### Reading one exercise in one workout

- Every entry of the exercise in the workout counts (a combined day can hold it twice). The
  metric mode is the last occurrence's (`metricModeForEntry`), and the rows are the completed
  work rows in that mode (`metricRowsForEntry`) across those occurrences. This is the rule
  `exerciseHistory` already uses.
- Warm-ups never count. Cardio is not scored in this round.
- Each completed row is one *item*: `{ w, r }` in reps mode, `{ w, sec }` in time mode. A
  per-side row gives one item per completed side. Drops and rest-pause bursts are not items, but
  drops count towards volume (`completedVolumeOf`), and a rest-pause row's `r` is already its
  total.
- The top load is `bestWeightForEntry` over the merged rows. It handles assistance machines
  (less help is better), per-side rows and legacy `topW` records.
- A bodyweight exercise is `isBw(entry.target || { id })`.

Workouts are read in ascending `start` order, with the day at noon when `start` is missing, and
in stored order on a tie. This is the `startOf` rule from `exercise-history.js`.

### The six kinds

| Kind | Mode | Rule |
|---|---|---|
| `beat` | reps, time | Better than last time; see below |
| `weight` | reps | The top load beats the best before it (`beatsWeight`), and that best is above 0 |
| `reps` | reps | Some item `(w, r)` has items before it at a load at least as hard, and `r` is above all of their reps |
| `e1rm` | reps | `bestSetOf(...).est` is above the best estimate before it (Epley, at most 12 reps). Never on an assistance machine |
| `volume` | reps | A loaded exercise uses the sum of `completedVolumeOf`; a bodyweight exercise uses the sum of reps. Either has to beat the best session before it, and that best is above 0 |
| `hold` | time | The longest hold is longer than the longest before it, and that one is above 0 |

**At least as hard** means the same load, or a load that `beatsWeight` ranks above it: heavier
in general, less help on an assistance machine.

An item at a load never lifted before has nothing at that load to beat. So a new heaviest set
is a `weight` record, not a `reps` record. With an unloaded bodyweight exercise every load is 0,
and `reps` becomes "most reps in one set, ever".

**One win is one exercise in one workout** that earned at least one kind. The kinds show as
chips beside it; they do not add to the count. "Wins this month" is the number of such
exercises in workouts dated this month.

### Baseline and exclusions

- **First session.** The first session of an exercise in a mode earns nothing; it sets every
  baseline. Each record kind needs a value of its own kind before it, so the first loaded
  session of a bodyweight exercise is no `weight` record.
- **Imported workouts** (`id` starting `iw`: the CSV and Hevy imports) raise every baseline and
  serve as last time, but earn nothing. This is the rule `rebuildPrHistory` keeps for `prs`, so
  a year of imported history does not sprout wins nobody earned in the app.
- **Excluded entries** (`entryExcluded`: a deload or rehab routine, or "Not counted for
  progression" from the ⋯ menu) earn no `beat` and are never last time for a later session,
  which is the `lastEntryFor` rule. They still raise the record baselines and can set a record.

### `beat`: better than last time

**Last time** is the latest earlier session of the exercise in the same mode that is not
excluded. A session from the same routine slot (`entryRoutineId`) is preferred; otherwise any
routine counts. This is `lastEntryFor` applied at that point in the history.

**Reps mode.** Compare the top loads first.

- **Harder top load** than last time (`beatsWeight`) is a beat with delta `{ w }`. On an
  assistance machine the delta is the help taken away.
- **Same top load**: compare only the items at that load.
  - More reps in total is a beat with delta `{ r }`.
  - Otherwise, the weakest item has more reps than last time's weakest, with at least as many
    items, is a beat with delta `{ weak }`.
- **Anything else** is no beat: a lighter top load (a deload), the same numbers, or fewer sets.

An unloaded bodyweight exercise falls through to the same-load branch at 0.

The weakest-item branch exists for double progression. Its aim lifts the weakest set and may
lower the others (10·9·8 → 9·9·9), the engine itself counts that as progress rather than a stall
(`stallCount`), and doing exactly what the card asked must count as a win. The rule reads
numbers only, never the prescription. Finished workouts do not keep `plan`, so this is the only
way the live chip, the finish sheet and the history can always agree.

**Time mode** applies the same rule to seconds:

- a longer longest hold gives `{ sec }`;
- otherwise, more seconds in total gives `{ sec }`;
- otherwise, a longer weakest hold with at least as many holds gives `{ weakSec }`.

**Per-set marks** compare work set *i* today with work set *i* last time. Warm-ups are skipped;
per-side rows compare L with L and R with R. Only ticked rows get a mark, and only in two cases:

- a harder load, marked `+Δ` in the unit (`−Δ` of help on an assistance machine);
- the same load with more reps, marked `+Δ`.

In time mode it is the longer hold, marked `+Δ s`.

### Shape and caching

- **`winsTimeline(workouts)`** returns a `Map` from workout key (`w.id`, or `legacySyncKey(w)`
  for an id-less legacy record) to `[{ id, beat?, records }]`. `records` holds any of
  `weight: { v, prev }`, `reps: { w, r, prev }`, `e1rm: { v, prev }`, `volume: { v, prev, unit:
  'load' | 'reps' }` and `hold: { v, prev }`. Only exercises with a win are listed.
- **Caching.** The store clones the whole state on every update, so the array's identity changes
  on every tap. The timeline is therefore memoized on a signature of the history instead: each
  workout's key, `start` and edit stamp `_ts`, plus the profile's unit. Editing, moving or
  deleting a saved workout, or a sync that brings one in, changes the signature. The unit is in
  it because a kg ↔ lb switch converts every logged weight without stamping the workouts, and
  the record values would otherwise read in the old unit. So the call is
  `winsTimeline(workouts, unit)`.
- **`liveWins(history, entry)`** gives the same answer for a session in progress, read against
  the history before it (`sessionHistory`). The card chip uses it.
- **`setMark(prevItem, item, exId, mode)`** gives the per-set mark.
- **`goalOf(entry, last)`** gives the goal line's numbers and its delta from last time.
- **`winCount(list)`** and **`monthWins(workouts, month)`** give the counts.

All of these are pure, with no store access.

## The goal line (`views/Workout.jsx`)

The line comes from `entry.target`, the routine's config with the prescription's weight, reps,
seconds and sets applied when the session was built (`buildPlannedEntry`). It is uniform per
set. Typing another weight into a row does not move it.

**Line 1, the goal.** It reads one of these, depending on the exercise and the prescription:

| Case | Line 1 |
|---|---|
| Loaded | `🎯 Beat: 60 kg × 8 · 8 · 8` |
| Bodyweight | `🎯 Beat: 12 · 12 · 12`, or `+10 kg × 8 · 8 · 8` with a belt |
| Per-side | each side's count (half the target's total reps), with the "per side" wording |
| Timed | `🎯 Beat: 0:45 · 0:45 · 0:45` |
| `plan.kind === 'first'`, or no last time | `🎯 First time — this sets your baseline` |
| `plan.kind === 'deload'` | `↓ Deload: 54 kg × 8 · 8 · 8`, with the engine's reason, in the warn style as now |

- Tapping the line opens the progression settings, as the old progression line did.
- The engine's reason (`plan.why`) becomes the line's tooltip and accessible label.

**Line 2, last time.** The date and sets of last time, or of the best set when `S.logRef ===
'best'`. After them comes the goal's delta from last time, using the `beat` rule with the goal
in place of today: `28.09: 8 · 8 · 7 → +1 rep`. With no positive delta there is no arrow.
Tapping the line toggles last time and best set, as now.

**Where it shows**

- Cards show both lines. The list (dense) view shows line 1 only, where the plan line used to be.
- Cardio keeps its old "Last time" line and gets no goal.
- A freestyle exercise has no `plan`. Its target comes from `freestyleConfig` (last time's
  shape), and its line reads the same way.
- While editing a saved workout there is no prescription, so only line 2 shows, and neither the
  chip nor the marks do.

**The chip** sits in the card header beside ⋯ and comes from `liveWins`. Any record gives
`🏆 Record`. Otherwise a beat gives `✓ +1 rep`, `✓ +2.5 kg` or `✓ +1 on the weakest set`.
Otherwise there is no chip.

## The finish sheet (`sheets.jsx`, `FinishSummary`)

The finished workout's wins come from the timeline over the saved history. A workout logged
into the past is therefore judged against the history before its own date.

- **Tiles**: Duration · Volume · Sets · **Wins**. The wins tile shows the count, or `—`.
- **The win list** has one line per exercise:
  `🏆 Squat — +1 rep · reps 60×9 · volume 1,240 kg`. The chips are:
  - the beat delta;
  - `weight 62.5 kg`;
  - `reps 60×9`;
  - `e1RM 75 kg`;
  - `volume 1,240 kg`, or `volume 46 reps` for a bodyweight exercise;
  - `hold 1:05`.

  The list replaces the "New PR:" and "Best estimated 1RM:" lines.
- **The quota line**: `October: 4 of 8`, or `October's quota met ✓ — 8 of 8`.
- **No wins**: the sheet says `Session banked — 4 of 8 in October.` There is no red and no
  "worse than".
- `w.prs` is still written exactly as before. The Coach payload, the MCP server, the Admin view
  and the imports read it.
- The body map, the media section and "Nice!" are unchanged.

## History (`sheets.jsx`)

- The row badge `{n} PR` becomes `🏆 n`, the win count from the timeline. It is hidden at 0.
- In the workout detail, an exercise's `PR` tag becomes its win chips.
- Older history gets its wins as well, because they are derived. Imported workouts are the
  exception.

## The quota (`frontend/src/lib/quota.js`)

- **The setting.** `S.monthGoal` is `null` for auto, or an integer from 1 to 31. It defaults to
  `null` in the store's `DEF` and syncs like any scalar setting: the copy with the newer `_ts`
  wins.
- **Auto goal.** The number of weekdays in `S.week` that hold a routine, times 4. A combined day
  counts once. With no plan the goal is 8.
- **Done** is the number of distinct days `w.d` in the calendar month (local time) with a
  workout of any kind: planned, freestyle, deload, a single set, logged into the past, or
  imported.
- **`monthQuota(S, iso)`** returns `{ month: 'YYYY-MM', done, goal, auto, met, extra,
  prevDone }`, where `met` is `done >= goal`, `extra` is `max(0, done - goal)` and `prevDone` is
  the previous calendar month's count.
- **The Home card** replaces the week-streak card, and tapping it opens the calendar sheet as
  before:
  - Line 1: `October · 3 of 8`, then a row of dots: one per goal day, the done ones filled, and
    extra days beyond the goal in the accent colour. Above 16 the dots become a thin bar.
  - Line 2: `Wins: 14 · September: 7`, starting with `Quota met ✓ ·` once met. Last month is
    shown as a count only. The goal may have changed since, and a past month is not judged
    against today's goal.
  - There is no pace verdict and no "behind".
- **Stats.** The "This month" tile reads `3 / 8`. The "Week streak" tile becomes "Wins this
  month".
- **Settings → General** gets "Training days a month": a number stepper (1–31) and an "Auto — n
  from your plan" option.
- `streakWeeks` stays in `history.js` (tests and the demo copy name it), but nothing renders it.

## Strings

New strings go through `ts()` in `lib/score-i18n.js`, with the Russian pack in
`lib/score-i18n.ru.js`. This is the `health-i18n.js` pattern, and the plural helper is imported
from there. English is the key. Every other language shows English until the strings move into
`src/locales/` with their translations, so `scripts/check-locales.mjs` stays green.

## Tests

- **`lib/scoreboard.test.js`**:
  - every kind;
  - the first session;
  - imported history as baseline only;
  - excluded entries;
  - assistance machines;
  - per-side rows;
  - bodyweight with and without a belt;
  - drop-set volume;
  - rest-pause totals;
  - the same exercise twice on a combined day;
  - mixed modes;
  - chronology with backfilled and moved sessions;
  - the routine slot's last time, with its fallback;
  - the weakest-set beat (10·9·8 → 9·9·9) and the non-beats (the same numbers, fewer sets, a
    deload);
  - per-set marks;
  - `goalOf` for first, deload, loaded, bodyweight, per-side and timed;
  - the memo invalidating on an edit stamp.
- **`lib/quota.test.js`**:
  - month boundaries;
  - two workouts on one day;
  - the auto goal (a combined day once, no plan → 8);
  - a manual goal;
  - the previous month;
  - extra days.
- **View tests**:
  - the Home card in place of the streak;
  - the finish sheet's win list and its no-wins line;
  - the goal line for first, deload and normal;
  - the history badge;
  - the existing tests that assert "week streak" or "PR", updated.
- **Before calling it done**:
  - `npm test`;
  - `node scripts/check-locales.mjs`;
  - `node scripts/check-source-strings.mjs`;
  - `npm run build`;
  - a full workout clicked through in the browser.

## Not in this round

- Autoregulation on RPE
- Strength levels against bodyweight
- Training blocks with a test day
- Distance and sprint modes
- Cardio wins
- Wins in the Coach payload or the MCP server
- Quota reminders
- Translations beyond English and Russian
