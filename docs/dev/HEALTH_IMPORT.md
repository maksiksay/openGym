# Health import: steps and sleep from Apple Health, and a steps goal

Design notes, kept next to the code they describe. See [`docs/HEALTH.md`](../HEALTH.md) for the
health log this writes into.

## Why

The daily log is only as good as its entries, and typing the step count and the night's sleep
every morning is exactly the chore that stops. An iPhone already has both numbers, in Health. A
Shortcuts automation can send them every morning, with no app open and nothing typed.

The health log was built for this from the start. A day is merged field by field, the later edit
supplying the fields it has (`mergeHealth`), so a check-in on the phone and the import of the same
day never cost each other their half.

## The import key

**Where.** Settings → Health & food → "Import from Apple Health".

**Create a key.** This shows, once:

- the address to send to;
- the key, with a copy button for each.

**Storage.** Only a SHA-256 of the key is stored, in `db.importKeys` (`{ userId, h, created,
lastUsed, last }`), the way device-link codes are.

- One key per profile; a new one replaces the old.
- **Turn off** removes it.
- Creating and removing a key go to the audit log.

**What it can do.** One thing only: add steps and sleep to its owner's log.

- It reads nothing.
- It is not a session: `readSession` never accepts it, and the import route accepts nothing else.

**Status.** Settings shows the key's state and the last import: "8 Oct, 09:00 · 8,123 steps ·
slept 7 h 15 min".

## The route

`POST /api/health/import`, with `Authorization: Bearer <key>` (a Bearer request passes the CSRF
check as the paired app's does: a browser never adds one by itself).

```json
{ "today": "2026-10-08", "steps": 8123, "sleep": 7.25 }
```

### The fields

- **`today`** is the phone's date, `YYYY-MM-DD`.
  - Yesterday's steps go into the day before it.
  - The night's sleep goes into `today` itself: in the log, `sleep` is the night that ended on
    the morning of its day.
  - `today` is required with `steps` or `sleep`, and has to be within two days of the server's
    date, so a mistyped year cannot write a day nobody will look at.
- **`steps`:** a count; **`sleep`:** hours; or `sleepMinutes` in place of `sleep`. Each is
  optional, but at least one is needed.
  - Numbers may come as strings with a decimal comma ("7,25"), which a phone in a Russian locale
    sends.
  - Bounds and rounding are the log's own (`cleanField`): steps 0–200 000, sleep 0–16 h in
    quarter hours. Anything outside is refused with a 400, not clamped.
  - A sleep of 0 counts as none sent. It is what a Shortcut adds up when Health holds no sleep
    (an iPhone with no watch or sleep app, its only samples "In Bed"). Filed, it made every
    night a short one, and the RIR step leaves a short night's miss out of the deload count
    (`docs/dev/RIR_STEP.md`). Sent alone, it is a 400 that says so.
- **`days`** may come instead of the rest, for backfill: `[{ d, steps?, sleep? }]`, at most 14
  days, each within the last 60.

### Writing it

The state file is read, the fields are set on their days with `t` = now (the merge's clock), the
revision goes up, and the file is written the way `PUT /api/data` writes it, with the cache
evicted.

- A phone with unsynced edits gets a 409 on its next push and merges, as with any other device.
- No state file yet (an account that never opened the app) is a 409 that says so.

### Limits and the answer

- **Rate:** 30 requests an hour per key (`rate-limit.js`), then a 429.
- **The answer** says what was written, so the Shortcut can show it:
  `{ ok: true, wrote: [{ d, steps }, { d, sleep }] }`.

## The Shortcut

A step-by-step recipe, in the app's Settings and in `docs/HEALTH.md`:

1. **Steps.** Find Health Samples, Steps, start date yesterday → Calculate Statistics, Sum.
2. **Sleep.** Find Health Samples, Sleep Analysis, start date in the last 1 day, value is not "In
   Bed" and not "Awake" → Get Details: Duration → Calculate Statistics, Sum → convert to hours.
3. **The date.** Current Date → Format Date, custom `yyyy-MM-dd`.
4. **Sending.** Get Contents of URL: POST, header `Authorization: Bearer <key>`, request body JSON
   with `today` (text), `steps` and `sleep` (numbers).
5. **When.** An automation, every day at 09:00, set to run immediately.

The phone has to reach the server when it runs. With Tailscale, that means Tailscale's VPN is on,
or set to connect on demand.

## The steps goal

- **The setting:** `S.stepsGoal`, a number of steps a day, 8 000 by default (the low end of
  8 000–10 000 a day for everyday activity). It is set in Settings → Health & food.
- **Home, the health card:** "Yesterday 8,123 steps ✓ · 7 days: 7,900 on average of 8,000". A
  day without steps is unknown, not zero, so the average is over the days that have them.
- **The Health screen:** the steps chart draws the goal as a line.

## Where it lives

- **`api/health-import.js`** (pure bookkeeping, tested): `createImportKey`, `revokeImportKey`,
  `importKeyStatus`, `userOfImportKey`, `noteImport`, `applyHealthImport`. It is on the
  Dockerfile's `COPY` line like every root-level module.
- **The audit events:** `auth.import.create` and `auth.import.revoke`, labelled in
  `frontend/src/lib/audit.js`.
- **`api/server.js`:**
  - `GET`, `POST` and `DELETE /api/health/import-key` (signed in);
  - `POST /api/health/import` (the key);
  - the rate limit;
  - the audit lines.
- **`api/openapi.yaml`:** the four operations.
- **`frontend/src/views/Settings.jsx`:** the import section and the steps goal.
- **`frontend/src/views/Home.jsx`:** the steps line on the health card.
- **`frontend/src/views/Health.jsx`:** the goal line on the steps chart.
- **`frontend/src/lib/health.js`:** `stepsGoalOf`, `stepsSummary`.
- **`frontend/src/lib/health-i18n.ru.js`:** the strings.
- **`frontend/src/store/useStore.js`:** `stepsGoal: null` (null reads as 8 000).
- **`docs/HEALTH.md`:** the import, the recipe, and the "Not yet" list brought up to date.

## Tests

- **`api/test/health-import.test.js`:**
  - **keys:** created, hashed, replaced, revoked, found;
  - **`applyHealthImport`:**
    - the dates: steps go to yesterday, sleep to today;
    - the bounds and the commas;
    - `sleepMinutes`;
    - `days`, and its limits;
    - a `today` too far from now;
    - nothing to write;
    - a day's other fields kept;
  - **the routes, on a spawned server:**
    - a session creates and reads the key;
    - the key imports, and the state's revision goes up;
    - a wrong key is a 401;
    - the key is not a session;
    - the rate limit.
- **Frontend:**
  - `stepsSummary` (yesterday, the average over the days that have steps, the goal);
  - the Home line;
  - the Settings section: creating a key shows it once, and the status.

## Not in this round

- Body weight, heart rate and HRV from Health.
- An Android equivalent (Health Connect).
- A Telegram bot.
- Nutrition calibration.
