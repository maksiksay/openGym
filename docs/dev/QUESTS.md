# Quests and forecasts: a goal on a lift, how far along it is, and when it lands

Design notes, kept next to the code they describe. Builds on the scoreboard's wins
([`SCOREBOARD.md`](SCOREBOARD.md)), the strength levels ([`STRENGTH_LEVELS.md`](STRENGTH_LEVELS.md))
and the season's reading of an assistance machine ([`SEASONS.md`](SEASONS.md)).

## Why

The wins say "better than last time". They do not say where all those sessions are taking you, or
how long the rest of the way is. A goal of your own on a lift, with a bar that fills and a forecast
read from your own trend, turns a run of small wins into a distance you can see shrink:

- **A goal someone chose** pulls harder than one handed to them. So the app suggests and the person
  pins; nothing becomes a quest by itself.
- **A forecast is an estimate from a noisy line.** It is said as a range of weeks, "if the pace
  holds", never as a date.
- **No loss to avoid.** A quest has no deadline and cannot be failed. A flat trend says so and
  makes no forecast; it is not a red mark.

## The quests (`lib/quests.js`, pure)

`S.quests = [{ id, kind, exId, from, base, …target }]`, at most 3 open at once. Whether one is done
is read from the log, like a win, every time it is needed.

| Kind | For | Target | Done when a workout from `from` on has… |
|---|---|---|---|
| `e1rm` | a loaded lift | `value`: an estimated max | a best estimated max ≥ it |
| `set` | a loaded lift, your own | `w` × `r` | a completed work set with ≥ `w` and ≥ `r` reps |
| `reps` | a bodyweight lift | `r`: reps in a set | a set of ≥ `r` reps |
| `level` | a lift with a standard | `level`: the next strength level | a measure at that level for that day's weight |
| `ratio` | barbell bench, squat, deadlift | `ratio` × body weight | an estimated max ≥ that day's weight × `ratio` |
| `unassisted` | an assistance machine | one strict rep | a set with no help, or any set of a bodyweight pull-up or chin-up |

- **The measure** of a workout is what the forecast follows:
  - the best estimated max (`e1rm`, `set`, `level`, `ratio`);
  - the most reps in a set (`reps`, and `level` on a repetition lift);
  - on an assistance machine, the season's `assist`: Epley of body weight less help at the reps.
    The strict rep is that at no help and one rep. Without a weigh-in this kind has no measure yet.
- **`base`:** the measure when the quest was pinned, so the bar starts at 0. A quest pinned before
  any session starts from its first one.
- **The bar:** from `base` to the target, at the best measure of the last 28 days.
- **`from`:** the day it was pinned. An older session never completes it.

## The forecast

- **The line:** least squares through one point per workout, the measure of the last 8 weeks
  (`lib/trend.js`, which the rate of gain uses too).
- **Enough to read:** 4 sessions spanning at least 3 weeks. Below that: how many sessions are still
  needed.
- **Flat:** with the slope at or under 0 there is no forecast, only "no climb yet".
- **The range:** the weeks the gap to the target takes at the slope plus its standard error, and at
  the slope minus it. With the second at or under 0, the range has no upper end ("5+ weeks").
  - The gap is read from the line at the last session, not today: weeks off the bar are not weeks
    of progress.
  - Rounded to whole weeks; equal ends read "about 4 weeks".
  - Past 26 weeks: "more than half a year". A straight line runs fast over months, and the sheet
    says "if the pace holds" every time.

## Suggestions

Read from the plan's exercises that have a session, the season's anchors first, at most 6. None
duplicates an open quest of the same kind on the same exercise.

- **An assistance machine for pull-ups or chin-ups:** the first strict rep (`unassisted`).
- **A lift with a standard,** with a weigh-in: the next level (`level`).
- **Barbell bench, squat, deadlift** under 1, 1.5 or 2 × body weight: that (`ratio`).
- **Any loaded lift:** the next round estimated max above the best of the last 28 days (`e1rm`):
  steps of 5 kg up to 100 kg and 10 kg after it (10 and 20 lb).
- **A bodyweight lift:** the next of 10, 15, 20, 25, 30, 40, 50 reps (`reps`).
- **Your own:** an exercise of the plan and a weight × reps (`set`), or reps for a bodyweight one.

## Done

- **The finish sheet** lists a quest done by that workout among its wins, "Quest done: bench
  ≈1RM 70 kg", and counts it in the Wins tile. Beside it, **Next**: the next suggestion of the same
  kind on that lift, pinned in one tap.
- **Home's and Stats' wins this month** count quests done that month too.
- **A done quest** leaves Home and stays in the sheet's Done list with its day.

## Where it shows

- **Home, a Quests card** after the season's: the open quests with their bar and forecast, and "+"
  for the sheet. With none open and something to suggest, the first suggestion with "Pin".
- **The Quests sheet:** open quests (remove), suggestions (pin), your own (the form), and the
  done ones.
- **Not the Coach,** not in this round.

## Not changed

- **The wins** stay derived from the workouts alone; a quest's win is read beside them.
- **Sync:** `S.quests` is a new list; the newer copy's list wins (`sync-merge.js`'s default). Two
  devices pinning different quests within one conflict window keep the newer device's.

## Where it lives

- **`frontend/src/lib/quests.js`** with its test: measures, done, bars, forecasts, suggestions.
- **`frontend/src/lib/trend.js`:** the least-squares line and its standard error, shared with
  `lib/gain-rate.js`.
- **`frontend/src/lib/quest-i18n.js`, `quest-i18n.ru.js`:** the strings.
- **`frontend/src/sheets-quests.jsx`:** the Home card, the sheet, the finish rows.
- **`frontend/src/views/Home.jsx`, `frontend/src/sheets.jsx`, `frontend/src/views/Stats.jsx`:**
  the card, the finish sheet, the month's wins.
- **`frontend/src/lib/strength-levels.js`:** `workoutMeasure` exported for the level quests.
