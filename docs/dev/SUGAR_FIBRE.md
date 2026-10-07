# Sugar and fibre in the food log

Design notes, kept next to the code they describe. See [`docs/HEALTH.md`](../HEALTH.md) for the
food log this extends.

## Why

The food log counts calories, protein, fat and carbohydrate. Two more numbers say a lot about
the same meals:

- **Fibre** is the one most people are short of, and like protein it has a goal worth reaching.
- **Sugar** is worth seeing next to it.

Vitamins and minerals are deliberately not here. Their data is sparse on labels, rough for
home cooking, and tracking everything is the habit the health notes argue against.

## The numbers

- **On a food:** two optional values per 100 g, `sug` (sugars) and `fib` (fibre).
- **On a meal row:** the portion's own, computed when it is logged, like its calories and macros.
  A row never looks its food up again (`lib/nutrition.js`).
- **Unknown is not zero.** A row without them adds nothing to the day's sum, and the day says how
  many of its rows had them: "from 5 of 7 entries".
- **Rows logged before this change** keep what they had. The log does not rewrite the past; a
  built-in food logged again brings its values.

### Where they come from

- **Built-in foods** (`lib/foods-base.js`): all 155, rounded reference values in the range of
  USDA FoodData Central (public domain) and the usual composition tables. For the prepared
  dishes they are typical makes.
- **Open Food Facts:** `sugars_100g` and `fiber_100g` from the label.
- **Own foods:** two optional fields in the food form, "Sugar, g" and "Fibre, g".
- **The AI lookup and the Coach's meal card:** optional `sug` and `fib` in both contracts
  (`api/coach/core/food.js`). The prompts ask for them from the label or reference values, with 0
  for a food that has none (kefir's fibre is 0, not unknown), and leave them out only when
  unknown.
- **A quick entry:** none. It is the totals as eaten, and nobody knows a business lunch's fibre.

### Checks

- Both are 0–100 g per 100 g.
- Sugars are part of carbohydrate, so `sug` may not exceed `c` (half a gram of slack for
  rounding). Fibre has no such check: on an EU label it is counted outside carbohydrate.
- In the food form a broken pair is refused, as broken macros are. From Open Food Facts or the
  Coach, an inconsistent sugar figure is dropped and the rest is kept.

## The goals

- **Fibre:** 30 g a day unless changed (`S.nutri.fibGoal`, null reads as 30), in the Goals sheet
  next to calories and macros. 30 g is the UK recommendation for adults; the EU's adequate
  intake is 25 g.
- **Sugar:** no limit. Labels give total sugars, fruit and milk included, while the WHO's limit
  is for free sugars only; a limit on the total would read a banana and a glass of kefir as a
  failure.

## Where it shows

- **The Health screen, the Food card:**
  - a fibre bar against the goal, like protein's;
  - a sugar line with no bar;
  - "Sugar and fibre: from 5 of 7 entries" when some rows lack them.
- **Last 7 days:** "fibre 22 g a day · sugar 48 g a day", over the days that have them.
- **The portion sheet:** "sugar 12 g · fibre 3 g" for the portion, when the food has them.
- **Home** is unchanged: calories and protein.
- **MCP:** `get_health_log` gains sugar and fibre per day, how many rows had them, the fibre goal
  and the averages.
- **The Coach:** not this round. Its consent screen lists what it reads; sugar and fibre join the
  daily food totals with the Coach-assistant work, together with water.

## Where it lives

- **`frontend/src/lib/nutrition.js`:** `portion`, `totals`, `mealRow`, `repeatRow` and
  `validFood` with `sug` and `fib`; `FIBRE_GOAL_DEFAULT`, `fibreGoalOf`.
- **`frontend/src/lib/foods-base.js`:** the values of every built-in food, and `baseAsFood`.
- **`frontend/src/lib/off.js`:** sugars and fibre from the label.
- **`api/coach/core/food.js`:** `sug` and `fib` in `FOOD_SCHEMA`, `validateFood`, `validateMeal`.
- **`api/coach/prompts/food.md`, `chat.md`:** when to give them; `prompts.js` regenerated.
- **`frontend/src/sheets-health.jsx`:** the food form's fields, the portion line, the Goals
  sheet's fibre goal, a row's new portion rescaling them, Open Food Facts foods keeping them.
- **`frontend/src/views/Health.jsx`:** the Food card and the week card.
- **`frontend/src/lib/health-i18n.ru.js`:** the strings.
- **`mcp/src/tools.js`:** sugar and fibre in `get_health_log`.
- **`docs/HEALTH.md`:** the food section.

## Tests

- **`lib/nutrition.test.js`:**
  - a portion, a row and a repeat carry them, scaled;
  - the day's sums and how many rows had them;
  - `validFood`: sugar above carbohydrate refused, fibre free of it;
  - every built-in food has both, within bounds, sugar not above carbohydrate;
  - the fibre goal: the profile's own, or 30.
- **`lib/off.test.js`:** read from the label; an impossible sugar figure dropped.
- **`api/test`:** both contracts keep good values and drop bad ones.
- **Views:** the Food card's fibre bar, sugar line and coverage; the week line.
- **`mcp`:** sugar and fibre in `get_health_log`.

## Not in this round

- Vitamins, minerals, salt, saturated fat.
- Added sugar apart from total sugar: labels outside the US do not give it.
- A fibre or sugar chart over time.
