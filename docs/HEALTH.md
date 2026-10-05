# Health & food

A module on top of the training log: a daily check-in (sleep, energy, stress, steps, waist, a
note) and a food log with calories and macros. It lives on the **Health** screen, with a card on
Home, and is switched in **Settings → Health & food**. Everything syncs like the rest of the
profile and stays in `./data/state-<user>.json`.

## The daily check-in

One entry per day (`S.health`, `frontend/src/lib/health.js`). `sleep` is the night that ended on
the morning of that day — the night that powered that day's session. Every field is optional,
and two devices filling different fields of one day keep both (`mergeHealth`).

## Food

- **Built-in basics** — about 150 everyday foods in English and Russian, per 100 g
  (`frontend/src/lib/foods-base.js`): grains, meat, fish, dairy, vegetables, fruit, a few dishes.
- **Your foods** — anything you add by hand or pick from Open Food Facts lands in `S.foods`, with
  its barcode, so it is found locally and offline next time.
- **Open Food Facts** — name search and barcode lookup straight from the device
  (`frontend/src/lib/off.js`). Free, no key; community data, so a product may be missing.
- **Barcode** — the camera (ZXing in the browser, the native detector where there is one), a
  photo, or typing the digits.
- **Quick entry** — a meal with no label: just the totals.
- **AI search** — with the AI Coach set up, *Find it with AI* asks the provider for the food's
  values per 100 g (`POST /api/coach/food`). With the Anthropic provider the model may use
  Anthropic's web search to read a real label. The answer comes with how sure it is (*from the
  label*, *typical values*, *rough estimate*) and is saved only after you have checked it in the
  food form. Only the query and the language are sent.

Each meal row keeps its own numbers, computed when it was logged, so correcting a food later
never rewrites past days.

### Reading it

The screen leads with the **average of the last seven logged days** against the goals, not a
red or green verdict on today. A day with no entries is unknown, never zero. Counting can be
**paused** at any time without losing the log or the goals. Goals can be worked out from age,
height, weight, activity and goal (Mifflin–St Jeor, protein 1.8 g/kg) or typed in.

## The Coach

The consent screen gains a sixth category, *Sleep and food*, and the consent version moves to 2,
so everyone is asked again. Until then no health data leaves. With consent, a debrief carries the
week before the session and a review its window (at most twelve weeks): per day sleep, sleep
quality, energy, stress and steps, and per day the food **totals** with the goals. Never the
names of foods, never the notes, never the waist. The prompts treat it as context — a short night
explains a weak session; it is not a reason to change the plan on its own.

## MCP

`get_health_log` (see `mcp/README.md`) gives a local assistant the full log, including notes and,
with `detail: true`, every food eaten — it runs on your machine against your own data directory.

## Settings worth knowing

| Variable | What it does | Default |
|---|---|---|
| `COACH_FOOD_DAILY` | AI food lookups per profile per day | `40` |
| `COACH_FOOD_WEB` | `0` stops offering Anthropic web search on a food lookup | on |

## Not yet

- Apple Health / Shortcuts import of steps and sleep (an ingest endpoint with a personal token).
- Photo of a plate → estimate.
- A Telegram bot for the morning check-in and the post-workout debrief.
- Translations beyond English and Russian: the module's strings sit in
  `frontend/src/lib/health-i18n*.js` until they move into `src/locales/`.
