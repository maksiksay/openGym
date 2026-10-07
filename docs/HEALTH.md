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

## Steps and sleep from Apple Health

A Shortcuts automation on the iPhone can send yesterday's step count and last night's sleep every
morning, so neither has to be typed ([`dev/HEALTH_IMPORT.md`](dev/HEALTH_IMPORT.md)).

- **Settings → Import from Apple Health → Make a key.** This shows the address and a personal key,
  once. The key can only add steps and sleep to its owner's log: it reads nothing and is not a
  sign-in. **New key** replaces it and **Turn off** removes it. Settings shows the last import.
- **The Shortcut** posts `{ "today": "YYYY-MM-DD", "steps": …, "sleep": … }` to
  `/api/health/import`, with `Authorization: Bearer <key>`.
  - The steps are yesterday's, and the sleep is the night that ended this morning, which the log
    files under today.
  - `sleepMinutes` works in place of `sleep`, and a decimal comma is fine.
- **The automation** runs it every morning: Time of Day, 09:00, Run Immediately. **How to set up
  the Shortcut** in Settings walks through every action.
- **Reaching the server.** When the automation runs, the phone has to reach the server. With
  Tailscale, keep it connected or turn on VPN On Demand.
- **Merging.** An imported day is merged field by field with whatever the phone holds, like any
  other edit, so a morning check-in keeps its own fields.

## The steps goal

8,000 steps a day unless changed (**Settings → Health & food → Steps goal**). Home's health card
says yesterday's count against it and the week's average over the days that have a count; the
Health screen draws it on the steps chart.

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

- A Telegram bot for the morning check-in and the post-workout debrief.
- Weight, heart rate and HRV from Apple Health, and Android's Health Connect.

A photo of a plate is no longer on this list: in the Coach chat it becomes a meal card for the
food log ([`dev/COACH_VOICE_PHOTO.md`](dev/COACH_VOICE_PHOTO.md)).
- Translations beyond English and Russian: the module's strings sit in
  `frontend/src/lib/health-i18n*.js` until they move into `src/locales/`.
