# RIR step: the last set's reps in reserve sets the next step

Design notes, kept next to the code they describe. See [`SET_TYPES.md`](SET_TYPES.md) for drop
sets and rest-pause, which this leaves alone.

## Why

Progression reads a session by its reps alone (`readSession` in `lib/progression.js`). Every rep in
every set is a hit, anything less is a miss. How hard those reps were never enters it, although
the app has logged effort per set (RIR or RPE) for a long time. Three things follow:

- **An easy session climbs as slowly as a grinding one.** A lift that went 8 × 60 kg with four or
  more reps left gets the same +2.5 kg as one taken to failure. Someone coming back after a break
  regains strength faster than one step a session. They spend weeks on sets far from failure, the
  sets that grow muscle least.
- **A session that only just made it reads as a clean success.** All reps at RIR 0 earn a full
  step. The next session usually misses, and three misses are a deload.
- **A miss after a short night counts like any other.** One bad night takes a lift a third of
  the way to a deload. A bad day should not register as a loss.

## The input: one rating, on the last set

**Where.** Settings → During a workout → "Effort per set". Next to Off / RIR / RPE comes a second
choice, **"Ask on"**: "the last set" (the default) or "every set" (the column as it is today).
Stored as `S.effortScope`, `'last' | 'all'`, default `'last'`. The choice shows only while effort is
on. The default applies to every profile, including one that already rates every set; "every
set" brings its column back.

**The row.** With "the last set", the set rows have no effort column. Ticking the plan's last
work set opens a row under it:

> How many reps were left? 0 · 0.5 · 1 · 2 · 3 · 4+

- **The buttons** are the picker's presets (`EFFORT_PRESETS`), in their colours. On the RPE scale
  they read 10 · 9.5 · 9 · 8 · 7 · 6.
- **A tap** stores the value on the set (`s.rir` or `s.rpe`, as the column does). The row then
  folds into a coloured chip ("RIR 2"); tapping the chip opens the row again.
- **Unticking** the set hides the row. A stored rating stays on the set.
- **The plan's last work set** is the last of the plan's own sets: not a warm-up, and not a set
  added on top (those never move the plan, see `readSession`).
- **Per-side sets** get one row. The rating goes to both sides, so the row's derived rating (the
  harder side) is that value.
- **Supersets:** each exercise has its own last set.
- **No row** for timed or cardio work, nor for an exercise with a drop set or rest-pause (see
  [The rules](#the-rules)).

The rule reads the same set under "every set", so both scopes drive progression the same way.

## The rules

The engine reads the RIR of the plan's last work set (`rirOf`; RPE converts, RPE 8 = RIR 2). The
value falls into one of three zones, with no gaps for a typed value such as 0.75:

- **at the limit:** under 1 (the picker's 0 and 0.5);
- **easy:** 4 or more (the picker's "4+");
- **in range:** everything between.

| Last session | Linear | Double | Bodyweight (climbs reps) |
|---|---|---|---|
| every rep, easy | step × 2 if the doubled step is ≤ 10 % of the weight, else × 1 | at the top of the range: step × 2 under the same cap; below it: aim +2 reps instead of +1 | +2 reps instead of +1 |
| every rep, in range | as today: one step | as today | as today |
| every rep, at the limit | hold the weight | as today (the step already sends the reps back to the bottom) | as today |
| a miss | as today: three in a row → deload | as today | as today |

- **No rating** on the last set: exactly as today.
- **Reps decide success.** A rating never turns a miss into a hit: "4+ left" on a set short of its
  reps is still a miss.
- **The cap.** The doubled step has to be at most 10 % of the working weight (`last.weight`).
  - At 60 kg, 2 × 2.5 = 5 kg (8 %) doubles; at 40 kg it would be 12.5 % and stays one step.
  - A light cable or dumbbell lift, where one step is already a large fraction, never doubles.
- **At the limit holds once.** The hold applies only to the first clean session at a weight. The
  next clean session at that weight takes the step whatever its rating, so someone who rates
  every last set 0 still progresses.
- **Assistance machines** step the other way (less help), as now.
  - Their cap is taken against the work they leave you: body weight minus assistance, from the
    latest weigh-in (`lastBW`).
  - With no weigh-in they never double.
- **"+2 reps"** is two rep steps (`repStep`): unilateral work goes up two reps per side. It is
  capped at the top of the range, as +1 is.
- **Unchanged:**
  - Greyskull (its last set is an AMRAP with its own double jump);
  - timed holds;
  - any exercise with an intensifier (drop set, rest-pause): their last set is meant to go to
    failure, so its rating says nothing about the load;
  - the "plan changed" and "first time in this routine" restarts, and every deload.

## Short nights

A miss on a day after a short night does not count.

- **The night** is the day's health entry: `sleep` in `S.health` for the workout's day
  (`workoutDay`). That is the night that ended that morning (see `lib/health.js`). The Apple
  Health import writes the same field.
- **Short** means under 6 hours.
- **What changes:**
  - `stallCount` runs over the sessions without their short-night misses. Such a miss neither
    counts nor ends a run, so a deload still takes three misses on ordinary nights.
  - The next target is the one the short-night session was given: the weight lifted, and under
    double progression the reps it asked for (`last.target.reps`), not one more than its lowest set.
  - The reason says so (see [What it says](#what-it-says)).
- **No sleep logged** that day: an ordinary miss. A hit after a short night is an ordinary hit.

## The first session

When effort is on and the exercise has no history (`kind: 'first'`), the reason changes. Instead
of "Nothing logged yet — this session sets the baseline." it reads:

> First time: add weight through your warm-ups until {0} reps leave about 2 in reserve — that is
> your working weight.

`{0}` is the plan's reps (the bottom of the range under double progression). With effort off,
the old sentence stays.

## What it says

Every decision has its reason (`why`), the way every prescription already does. Assistance
machines get the same lines with "less help" in place of "more".

- **Linear, easy:**
  - "Every rep with 4+ left — a double step: {0} {1} more."
  - "Every rep with 4+ left — {0} {1} more (a double step would be over 10 %)."
- **Double, easy:**
  - at the top: "Top of the rep range with 4+ left — a double step: {0} {1} more, back to {2}
    reps.";
  - at the top, capped: "Top of the rep range with 4+ left — {0} {1} more, back to {2} reps (a
    double step would be over 10 %).";
  - below the top: "Same weight — 4+ left last time, so aim for {0} reps."
- **Bodyweight, easy:** "Bodyweight — every rep with 4+ left, so go for {0}."
- **At the limit:** "Every rep, nothing left in the tank — the same again, to make it yours."
- **Short night:** "Short night ({0} h) — the same target again; this miss does not count."
- **First session:** the sentence above.

**The help sheet.** The (i) next to "Effort per set" says "nothing else reads the value —
progression and estimated 1RM are unaffected". That is no longer true. It becomes: "Progression
reads the last set's rating: 4+ left takes a bigger step, nothing left holds the weight. Estimated
1RM is unaffected."

**Strings.** The new strings live in their own pack, `lib/effort-i18n.js` and
`lib/effort-i18n.ru.js`, with English as the key, the way `score-i18n.js` keeps the
scoreboard's. `scripts/check-locales.mjs` fails a key that only some of `src/locales/` carry. The
places that show a prescription's reason look it up in the pack first and fall back to `t()`.
The old help sentence goes out of every locale.

## Where it lives

- **`frontend/src/lib/progression.js`:**
  - `readSession` carries the RIR of the plan's last work set;
  - sessions carry `short` (from `S.health`);
  - `stallCount` runs without short-night misses;
  - `nextPrescription` applies the zones;
  - constants `EASY_RIR = 4` (from it up), `LIMIT_RIR = 1` (below it), `MAX_JUMP = 0.1`,
    `SHORT_NIGHT_H = 6` (below it).
- **`frontend/src/lib/history.js`:** `effortScopeOf(S)`.
- **`frontend/src/store/useStore.js`:** `effortScope: 'last'`.
- **`frontend/src/views/Workout.jsx`:** the row under the last set and its chip; no column under
  "the last set".
- **`frontend/src/views/Settings.jsx`:** "Ask on" and the help sheet's sentence.
- **`frontend/src/lib/effort-i18n.js`, `effort-i18n.ru.js`:** the strings and the lookup.
- **`frontend/src/index.css`:** the row and the chip.

## Tests

- **`frontend/src/lib/progression.test.js`:**
  - every cell of the table, for linear, double and bodyweight;
  - the cap: 60 kg doubles, 40 kg does not, a light dumbbell never does;
  - assistance: doubles with a weigh-in that allows it, single without one;
  - no rating behaves as today; a miss rated 4+ is a miss;
  - at the limit holds once, then steps; a typed 0.75 is at the limit, 3.75 in range;
  - RPE: RPE 6 is easy;
  - per-side: the harder side decides;
  - only the plan's last set counts, not a set added on top or a warm-up;
  - Greyskull, timed, drop set and rest-pause are unchanged;
  - short nights:
    - three misses with one short night do not deload;
    - the target repeats;
    - no sleep logged is an ordinary miss;
    - a hit after a short night is a hit;
  - the first-session sentence with effort on and off.
- **Frontend:**
  - the row appears when the plan's last work set is ticked; not on other sets, not under "every
    set";
  - a tap stores `rir` (or `rpe`) and folds into the chip; per-side stores both sides;
  - Settings: "Ask on" switches between the row and the column.

## What it changes elsewhere

With "the last set", the Stats effort card and the muscle map's "Hard" filter see one rated set
per exercise. The hard-set count then shows those sets only, not every set that was hard.

## Not in this round

- Reading every set's rating (an average, a top set): the last set only.
- Load from an estimated 1RM with reps in reserve (Epley + RIR).
- Readiness from anything but sleep: soreness, stress, energy.
- A cut sooner than three misses when the last set was a grind far short of its reps.
- Buttons past 4+ (5, 6, 8).
- Inferring the unrated sets for the hard-set count.
- The Coach: it already reads effort in its reviews; nothing changes there.
