# Coach chat as the app's assistant: logging for you, and finding your way

Design notes, kept next to the code they describe. Builds on [`COACH_CHAT.md`](COACH_CHAT.md) (the
chat job and its replies) and [`COACH_VOICE_PHOTO.md`](COACH_VOICE_PHOTO.md) (the meal card).

## Why

The chat can answer, change the plan and log a meal. Everything else still means finding a
screen:

- a weigh-in;
- the morning's sleep and energy;
- a litre of water after training;
- a new protein goal.

It also cannot say where a setting lives, because it does not know the app's screens.

## What this adds

### The `log` reply

A fifth reply, next to `answer`, `clarify`, `changes` and `meal`. One message may hold several
things to note: "slept 6 hours, low energy, 72.4 this morning, drank a litre".

```json
{ "coach_contract": 1, "reply": "log", "text": "…", "day": "today",
  "weight": 72.4,
  "checkin": { "sleep": 6, "sq": 3, "energy": 2, "stress": 3, "steps": 9000 },
  "water": 1000,
  "goals": { "kcal": 2400, "p": 140, "f": 70, "c": 280, "fib": 30, "steps": 8000, "water": 2000 } }
```

- **At least one part:** a weight, a check-in with at least one field, water, or goals with at
  least one field. Any part may be missing; unknown keys are dropped.
- **`weight`:** in the profile's unit (`meta.unit`): 20–300 kg or 44–660 lb, to one decimal.
- **`checkin`:** the health log's own bounds. Sleep 0–16 h in quarter hours; sleep quality,
  energy and stress whole numbers 1–5; steps 0–200 000.
- **`water`:** millilitres to add to the day's counter, 1–5000.
- **`goals`:**
  - `kcal` 800–6000, `p` 0–500, `f` 0–400 and `c` 0–1000 g;
  - `fib` 5–100 g;
  - `steps` 1000–50 000;
  - `water` 500–10 000 ml.
- **`day`:** `today` or `yesterday`, for the weight, the check-in and the water. Goals have no
  day.
- **`text`:** one or two sentences, at most 300 characters.
- **Out of bounds is refused**, not clamped. The reply goes back for the pipeline's one repair
  round, as a meal with a bad item does.

### The card

The chat shows a "To log" card, like the meal card:

- one line per thing, with what is there now and what it becomes;
  - "Weight 72.8 → 72.4 kg" when that day already has a weigh-in;
  - "Protein goal 130 → 140 g";
  - "Water +1000 ml (now 750 ml)";
- a cross on each line to leave it out;
- today / yesterday for the lines that have a day;
- one **Log** button.

Nothing is written until the person taps it. Then:

- **the weight** replaces that day's weigh-in, or adds one;
- **the check-in** sets only the fields it names, so the rest of the day stays as it was;
- **the water** is added to the counter;
- **the goals** change only the ones named. Calories and macros go into `nutri.goals`, fibre into
  `nutri.fibGoal`, steps into `stepsGoal`, water into `waterGoal`.

After that the card reads "Logged" with what was written.

**Never:** deleting anything, the account, signing in, or any other setting. The contract has no
field for them.

### Finding your way

- **The app map** (`api/coach/prompts/app.md`) goes to the chat with its system prompt. It lists:
  - the screens: what is on each, and how the common tasks are done;
  - the Settings sections and their rows.
- **An answer may carry `open`:** at most two link ids, from a fixed list
  (`api/coach/core/app-links.js`). The chat shows each as a button under the answer, "Open:
  Settings → Health & food". An unknown id is dropped.
- **The links:**
  - the main screens (Home, Plan, Health, Stats, History, Library, Muscles, Structural balance,
    the Coach, the gym check-in);
  - Settings, opened at a section: General, Health & food, Import from Apple Health, During a
    workout, Appearance, Data, Notifications, Equipment, Account.
- **Settings sections get ids,** and Settings scrolls to the one a link names.
- **A test** checks that every link id has a route in `App.jsx`, and that every Settings section
  a link names exists.

## What the Coach reads, and the consent

The Coach starts reading:

- **water:** the day's total in ml, the buttons and the drinks of the food log;
- **sugar and fibre:** in the food totals of each day, when every row of that day had them;
- **targets:** the fibre, steps and water goals, next to the food goals.

This changes what leaves under "Sleep and food", so the consent moves from version 3 to 4:

- **The category text** now names water, sugar and fibre.
- **The app asks once,** the next time the Coach opens.
- **Until then the server leaves the new fields out** (`WATER_CONSENT_VERSION` in
  `api/coach/core/payload.js`), as it does with photos before version 3.

Food names and notes still never leave.

## Where it lives

- **`api/coach/core/log.js`** (new): `validateLog`.
- **`api/coach/core/app-links.js`** (new): the link ids.
- **`api/coach/core/validate.js`:** `validateChat` takes `log` and keeps an answer's `open`.
- **`api/coach/core/pipeline.js`, `api/coach/jobs.js`:** a `log` outcome, and `open` on an answer,
  kept in the history entry like a meal.
- **`frontend/src/lib/coach-local.js`:** the same on a phone with its own key.
- **`api/coach/core/payload.js`:** water, sugar and fibre, the targets, `WATER_CONSENT_VERSION`.
- **`api/coach/core/prompt.js`:** the app map joins the chat's system prompt.
- **`api/coach/prompts/chat.md`, `app.md`, `common.md`:** the reply, the links, the map, the new
  fields; `prompts.js` regenerated.
- **`frontend/src/lib/coach-log.js`** (new): the card's lines and what it writes.
- **`frontend/src/lib/app-links.js`** (new): link id → route, section and label.
- **`frontend/src/views/CoachChat.jsx`:** the card and the link buttons.
- **`frontend/src/views/Settings.jsx`, `frontend/src/components/ui.jsx`:** section ids, and the
  scroll to one.
- **`frontend/src/lib/coach.js`:** `CONSENT_VERSION` 4 and the category text.
- **The language packs:** the strings.
- **`docs/AI_COACH.md`, `docs/HEALTH.md`:** what the chat can do now, and what the Coach reads.

## Tests

- **`api/test`:**
  - `validateLog`: each part's bounds, kg and lb, the day, an empty log refused, extra keys gone;
  - `validateChat`: `log`, and an answer's `open` (known ids only, at most two);
  - the payload: water, sugar, fibre and the targets with consent 4, none of them with 3;
  - a `log` job's outcome in the history;
  - the chat's system prompt carries the app map.
- **`frontend`:**
  - `coach-log.js`: the lines with their before and after, and what a tap writes for each part;
    the day; leaving a line out;
  - `app-links.js`: every id has a route, and every section it names exists in Settings;
  - the card in the chat;
  - the consent asked again at version 4.
- **For real:** a few messages through the Coach on the instance, with nothing written.

## Not in this round

- Editing or deleting past entries from the chat.
- Workouts from the chat: starting one, logging sets, moving a session to another day.
- Settings other than the goals above.
