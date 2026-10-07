# Water: a daily counter, drinks from the food log, and a goal

Design notes, kept next to the code they describe. See [`docs/HEALTH.md`](../HEALTH.md) for the
health log and the food log this builds on.

## Why

Water was the one daily intake the health log did not count. It comes in two ways:

- **A glass or a bottle:** a tap on Home, nothing to look up.
- **A drink already logged as food:** a coffee with milk, a glass of kefir. It should not have
  to be counted twice.

## The counter

- **`water`:** millilitres, a new field of the day's health entry (`S.health`), next to sleep and
  steps. It holds what the buttons added.
  - Bounds 0–10 000 ml, whole millilitres (`cleanField`).
  - Merged field by field like the others (`mergeHealth`). The known limit: two devices adding to
    the same day inside one sync window keep the total of the device that wrote last.
- **The buttons:** +250 and +500 ml, and −250 once the counter holds something.
  - The counter never goes below nothing, and at 0 the field goes: a day without water is
    unknown, not zero.
- **Not a check-in.** A day whose entry holds only water has not been checked in (`hasWellbeing`):
  Home still asks how you slept, and the Health screen still offers the check-in.

## Drinks from the food log

A food can be a drink, `drink: true`:

- **Built-in foods** (`lib/foods-base.js`):
  - New: water, tea without sugar, black coffee, cola zero.
  - Already there, now marked: milk, kefir, orange juice, cola, latte, cappuccino.
  - **Beer and wine are not drinks here.** Alcohol does not count towards water, though its
    calories still do.
- **Own foods:** a switch in the food form, "A drink — count it as water".
  - A drink with no energy and no macros (water, black coffee) is a valid food (`validFood`).
  - A drink's values are per 100 ml, and its usual portion is in ml.
- **Open Food Facts** (`lib/off.js`): a product in `en:beverages` and not in
  `en:alcoholic-beverages` comes as a drink. The switch undoes it.
- **The AI lookup and the Coach's meal card** may mark an item `drink: true`, optional in both
  contracts (`api/coach/core/food.js`). The prompts say when: a drink without alcohol.

A meal row made from a drink carries `drink: true`:

- It is set when the row is logged, like its numbers, and never looked up again. Marking a food
  as a drink later does not reach the rows logged before, the way correcting a label does not.
- Its portion is in ml, and 1 ml is taken as 1 g. Milk and juice are within a few percent of
  that.

## The day's water

`waterOn(S, d)` → `{ taps, food, total }`:

- `taps` is the counter;
- `food` is the sum of that day's drink rows;
- `total` is both.

Deleting a drink row takes its water away with it. −250 and the exact amount change the counter
only, never the food log.

## The goal

- **The setting:** `S.waterGoal`, millilitres, 2 000 by default (null reads as 2 000). Choices
  1.5–4 l, in Settings → Health & food, next to the steps goal.
- **No streaks and no red.** The goal draws a line and earns a ✓; a day under it is just a day.

## Where it shows

- **Home, the health card:** "1.25 of 2 l", a ✓ once the goal is reached, and the three buttons.
- **The Health screen, a Water card for the day shown:**
  - the total against the goal, as a bar;
  - the split, when some came from food: "Buttons 1,000 ml · from food 300 ml";
  - the three buttons, so a past day can be filled in too;
  - the exact amount: tapping the number opens a sheet for the counter;
  - the average of the seven days before it that have any water.
- **The six-week trends:** a "Water a day, l" chart with the goal line. It ends yesterday, as the
  food charts do: today's total is still growing.
- **MCP:** `get_health_log` gains `water` per day (total and the part from food), its average
  and the goal. It runs on the person's own machine.
- **The Coach:** not this round. Its consent screen lists what it reads (sleep, energy, stress,
  steps); water joins it with the Coach-assistant work.

## Where it lives

- **`frontend/src/lib/health.js`:** `water` in `HEALTH_FIELDS` and its range, `hasWellbeing`,
  `WATER_GOAL_DEFAULT`, `WATER_GOAL_CHOICES`, `waterGoalOf`, `drinksOn`, `waterOn`, `addWater`,
  `waterSeries`, `waterSummary`.
- **`frontend/src/lib/nutrition.js`:** `mealRow` and `repeatRow` carry `drink`; `validFood` lets
  a drink be all zeros.
- **`frontend/src/lib/foods-base.js`:** the drink flag, the four new drinks, `baseAsFood`.
- **`frontend/src/lib/off.js`:** `categories_tags`, and the drink flag from them.
- **`api/coach/core/food.js`:** `drink` in `FOOD_SCHEMA`, `validateFood` and `validateMeal`.
- **`api/coach/prompts/food.md`, `chat.md`:** when to mark a drink; `prompts.js` regenerated.
- **`frontend/src/sheets-health.jsx`:** ml for drinks in the portion, row and food sheets; the
  switch; drinks kept from Open Food Facts; the water amount sheet.
- **`frontend/src/views/Home.jsx`:** the water row on the health card.
- **`frontend/src/views/Health.jsx`:** the Water card, the chart, `hasWellbeing`.
- **`frontend/src/views/Settings.jsx`:** the water goal.
- **`frontend/src/lib/coach-meal.js`, `frontend/src/views/CoachChat.jsx`:** a meal card's drink
  keeps its flag and reads in ml.
- **`frontend/src/components/Icon.jsx`:** `drop`.
- **`frontend/src/store/useStore.js`:** `waterGoal: null`.
- **`frontend/src/lib/health-i18n.ru.js`:** the strings.
- **`mcp/src/tools.js`:** water in `get_health_log`.
- **`docs/HEALTH.md`:** the water section.

## Tests

- **`lib/health.test.js`:**
  - the field: bounds, rounding, merge;
  - `addWater`: adds, takes away, never below nothing, the field gone at 0, other fields kept;
  - `waterOn`: the counter plus drink rows, food rows that are not drinks left out;
  - `waterSummary`: today against the goal, the average over the days that have any;
  - `waterSeries`: days with buttons, food or both;
  - `hasWellbeing`: water alone is not a check-in.
- **`lib/nutrition.test.js`:** a drink's rows carry the flag, a repeat keeps it, a zero drink is
  a valid food; the built-in drinks are marked, beer and wine are not.
- **`lib/off.test.js`:** a beverage comes as a drink, an alcoholic one does not.
- **`api/test`:** `validateFood` and `validateMeal` keep `drink: true` and drop anything else.
- **Views:** Home's row and buttons; the Health screen's Water card; the goal in Settings.
- **`mcp`:** water in `get_health_log`.

## Not in this round

- Water from Apple Health.
- Hydration factors per drink (coffee at 0.8 and the like): a drink counts in full.
- Fluid ounces: millilitres and litres only.
