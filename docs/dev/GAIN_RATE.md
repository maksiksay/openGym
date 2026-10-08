# Rate of gain: the weight trend against a corridor, a calorie step, and a food calibration

Design notes, kept next to the code they describe. See [`docs/HEALTH.md`](../HEALTH.md) for the
weigh-ins, the food log and the goals this builds on.

## Why

A weigh-in says where you are. It does not say whether you are eating the right amount for what
you are after, and that is the question a lifter on a lean gain or a cut actually has:

- **The number worth following is the trend,** not the last weigh-in. From one morning to the next,
  water, salt and the last meal move the scale by more than a month of tissue does.
- **One calorie direction at a time.** A small surplus or a small deficit, held long enough to show,
  then one small correction. Swinging between the two is the commonest reason a year shows nothing.
- **No daily weigh-ins and no counting for good.** Two or three weigh-ins a week are enough for a
  trend. Logging food for two or three weeks teaches the eye what a day of eating looks like; after
  that, the counting itself becomes the problem.

## The trend (`lib/gain-rate.js`, pure)

- **The window:** the weigh-ins of the last 28 days, none before the last calorie change
  (`S.nutri.kcalAt`, below).
- **Enough to read:** at least 4 weigh-ins on different days, spanning at least 14 days. Below
  that the reading is `data`, with how many weigh-ins are still missing.
- **The line:** least squares through every weigh-in of the window, its slope per week and that
  slope's standard error.
  - **Why a line, not the week means** (`weeklyWeights`): with two or three weigh-ins a week, one
    week's mean is still noisy. A line through all of them uses every one, and its error says how
    much to trust it.
  - A weigh-in before a workout counts like any other. The same time of day keeps the line
    straighter, and the sheet says so.
- **The rate:** the slope as a share of the window's mean weight, per cent a week. Per cent works
  in kg and lb alike.

## The corridor

**The direction:**

1. **A goal weight** (`S.targetW`) decides while one is set: gain below it, lose above it, keep once
   within 0.5 kg (1 lb) of it.
2. **Without one,** the Goals sheet's goal (`S.nutri.body.goal`: lose, keep, gain).
3. **Without either,** the rate is shown with no verdict.

**The corridors, per cent of body weight a week:**

| Direction | Corridor |
|---|---|
| gain | +0.25 … +0.5 |
| keep | −0.2 … +0.2 |
| lose | −0.5 … −1.0 |

The gain corridor is the usual one for a lean gain, faster than an experienced lifter's and slow
enough to keep most of it muscle.

## The verdict

- **`in`:** the rate is inside the corridor, or its error band (±1 standard error) overlaps it.
  Inside the noise is not a reason to change anything.
- **`low` / `high`:** the whole error band is below or above the corridor.
- **`wait`:** less than 14 days since the last calorie change. A change shows on the scale as
  water and glycogen first; judging it in its first week reads that as tissue.
- **`data`:** not enough weigh-ins yet.

## The calorie step

- **Its size:** the gap between the rate and the corridor's middle, in kg a week, times 7,700 kcal
  per kg, a seventh of that a day. Rounded to 50, and never under 100 or over 300 kcal.
  - Deliberately coarse. The energy in a kilo gained or lost depends on what it is made of, and
    the step is checked again two weeks later anyway.
- **With a calorie goal** (`S.nutri.goals.kcal`): "Goal 2,600 → 2,800 kcal", and **Apply**.
  - Apply changes the calories and moves carbohydrate by the same energy (step ÷ 4 g). Protein and
    fat stay where they are.
- **Without one:** "About 200 kcal more a day", and a link to the Goals sheet.
- **`S.nutri.kcalAt`:** the day the calorie goal last changed, stamped by Apply and by any edit of
  the calories in the Goals sheet. The trend reads only from it on, and the next step waits 14
  days after it.

## The food calibration

From the Health screen's food section, **Calibrate: 2 weeks** (or 3):

- **The start:** `S.nutri.calib = { from, days }`, and food tracking resumes if it was paused.
- **During it,** a card at the top of the food section:
  - **The days:** day 5 of 14, and how many of them are logged.
  - **The averages** over the logged days: calories and protein, the protein also per kg of body
    weight when there is a weigh-in.
  - **Breakfast protein,** its average against about 0.4 g per kg. Protein at breakfast is the
    habit worth taking away: it is the meal where a day's protein usually falls short.
  - **A logged day** has meals in at least two slots. A day with only a snack written down would
    pull every average down.
- **Its end,** the first time the app runs after the last day:
  - food tracking pauses (`S.nutri.paused`), the way the pause button does;
  - the summary is kept (`S.nutri.calib.result`): days logged, calories, protein, breakfast
    protein.
- **The paused card** shows that summary above "Resume tracking".
- **The maintenance estimate.** With a trend over the same days and at least 10 logged days, the
  paused card also says what the person's own data says: "On 2,500 kcal your weight moved +0.1 %
  a week. For the corridor, about 2,700 kcal".
  - The trend there is read from the calibration's own days: 4 weigh-ins spanning at least 10 of
    them, since 14 cannot fit inside a two-week calibration.
  - It is the logged average, moved by the same step rule.
  - **Make it my goal** sets the calories that way and stamps `kcalAt`, with protein at 1.8 g/kg and
    fat at 0.8 g/kg (`suggestGoals`' split) when there are no goals yet.

## Where it shows

- **Home, the body-weight card:** one line under the goal, colour-coded.
  - With a reading: "+0.3 % a week · on track", "+0.1 % a week · slow: about 200 kcal more a day".
  - Without enough weigh-ins: "2 more weigh-ins for a rate".
  - No push and no reminder. The existing weigh-in question before a workout already brings two or
    three a week.
- **A tap on the line** opens the Rate sheet:
  - the rate, its corridor and the verdict in words;
  - the weigh-ins it read and since when;
  - the calorie step with Apply, or the link to the Goals sheet;
  - the waist over the same window when it was measured twice or more, shown without a verdict.
- **The Health screen:** the calibration card above the food day while one runs, the offer to
  start one below it otherwise, and the summary on the paused card.

## Not changed

- **No new data:** weigh-ins, waist and meals are read where they already are. Only `S.nutri`
  grows: `kcalAt` and `calib`. As a settings object it syncs from the newer copy (`sync-merge.js`).
- **No reminders:** nothing asks for a weigh-in beyond the question before a workout that exists
  today.
- **The Coach:** not in this round. Its payload already carries the weight series and the goals.

## Where it lives

- **`frontend/src/lib/gain-rate.js`** (pure) with its test: `weightTrend`, `directionOf`,
  `gainVerdict`, `kcalStep`, `applyKcalStep`, `setKcalGoal`, `waistOver`, and the calibration's
  `startCalibration`, `dropCalibration`, `calibrationView`, `calibrationDue`, `endCalibration`,
  `maintenanceEstimate`.
- **`frontend/src/lib/nutrition.js`:** `splitGoals`, the Goals sheet's macro split on its own.
- **`frontend/src/lib/gain-i18n.js`, `gain-i18n.ru.js`:** the strings.
- **`frontend/src/sheets-gain.jsx`:** the Home line, the Rate sheet and the calibration's cards.
- **`frontend/src/views/Home.jsx`:** the line on the body-weight card.
- **`frontend/src/views/Health.jsx`:** the calibration card, the summary on the paused card.
- **`frontend/src/sheets-health.jsx`:** the Goals sheet stamps `kcalAt`.
- **`frontend/src/App.jsx`:** the calibration ending on the first run after its last day.
