# Coach quality: the right day, the app's exercise names, plans read before any session, clean language

Design notes, kept next to the code they describe. See [`COACH_CHAT.md`](COACH_CHAT.md) for the chat
job and [`COACH_ASSISTANT.md`](COACH_ASSISTANT.md) for the app map the chat answers from.

## Why

A week of real Russian chat answers showed the same few faults. Each one has a cause in what the
Coach is given, not only in the model.

- **The wrong weekday.** The weekly plan reaches the model as `getDay()` numbers (`"2": [...]`) and
  "today" as a bare date. Nothing in the chat's rules says that 0 is Sunday, so the model counted
  from Monday and put Tuesday's routine on Wednesday. "Today" was also the server's UTC date, which
  is yesterday for the first hours of a day east of Greenwich.
- **Exercise names translated by the model.** The payload names exercises in English, the model
  translates them on the fly ("barbell bent over row" as a deadlift), and the app shows something
  else.
- **"Nothing to read" for a plan never trained.** With no sessions, the review prompt asks for
  `nochange` and a note that the plan has not been trained yet. That is honest about the history
  but useless about the plan: the volume per muscle, the progression rules and the session length
  can be judged as written.
- **Slips in the language.** A Latin word in a Russian sentence ("stoit"), a word that mixes two
  alphabets ("подхida"), an internal field name in backticks.
- **An older model.** No model was set, so the runtime's default answered (Claude Sonnet 5), and
  the image's Agent SDK was too old for Claude Opus 5.5.

## The day

- **`meta.today`** is the app's own date. Every Coach request from the app sends `today`, its
  local `YYYY-MM-DD`. The server takes it when it is within one day of its own UTC date, and its
  UTC date otherwise. A scheduled review has no app behind it and uses the UTC date.
- **`meta.weekday`**: 0 = Sunday … 6 = Saturday, with **`meta.weekdayName`** in English.
- **`schedule`**, next to `plan` rather than inside it (the validator reads `plan` for changes):
  - `today`: the routines planned for today, as `{ id, name }`, empty for a rest day. The day's
    own choice comes first (`dayPlan`, a rest day included), then the weekly plan, the same order
    the Home screen uses (`effectiveRoutineIds`);
  - `upcoming`: today and the six days after it, each `{ date, weekday, routines }`;
  - `weekly`: false when there is no weekly plan and the routines rotate.
- **The rule, in common.md:** weekday numbers are 0 = Sunday … 6 = Saturday; today is
  `meta.today`; what is planned on a day comes from `schedule`; never work out a weekday from a
  date.

## The names

- **The packs.** The app's exercise-name packs (`frontend/src/exercise-names/*.js`) are generated
  into `api/coach/names/<lang>.js` by `scripts/build-coach-assets.mjs`. CI runs it with
  `--check`, the way it already does for `library-data.js`, so the api build never reaches into
  `frontend/`.
- **Loading.** `api/coach/names.js` loads the pack for the payload's language when a job needs it
  (the exact tag, then the base language) and keeps it.
- **Writing them in.** `payload.build(S, { names })` writes the translated name over the English
  one wherever the payload names a catalogue exercise:
  - the plan;
  - the window's workouts;
  - a debrief's session and the ones before it;
  - the aggregates;
  - the working weights;
  - the library slice.

  A custom exercise keeps the name its owner typed. With no pack, the English stays, as before.
- **The phone's own Coach** (`lib/coach-local.js`) passes the pack the app has already loaded, and
  its own date.

## Reading a plan before any session

- **`volume`** (a review's and a chat's): for each target muscle, the weekly sets, the days that train it and the
  exercises that do, as `{ muscle, sets, days, exercises }`.
  - It is counted from the weekly plan. A plan with no weekly schedule counts one round of its
    routines and says so (`basis: 'rotation'`).
  - The major groups are always listed, a zero included: pectorals, lats, upper back, delts,
    biceps, triceps, quads, hamstrings, glutes, calves, abs.
- **review.md.** With no sessions the answer is still `nochange`, but its `reading` judges the plan
  as written:
  - sets and days per muscle;
  - whether each progression rule fits its exercise (linear on a light isolation lift stalls);
  - the session against `coachProfile.sessionMin`.

  It invents no history.
- **chat.md.** A question about the plan with no sessions logged is answered the same way.

## Language

- **common.md.**
  - Write as a native speaker of `meta.lang` would, in the register the app itself uses (in
    Russian, «ты»).
  - No transliteration, and no word in another alphabet. The exceptions are a name in
    parentheses and the terms the app itself shows (RIR, RPE, 1RM, kg).
  - Name exercises with the names given.
- **`core/lang-check.js`.** `languageIssues(text, lang)` lists what a reader would notice:
  - a word that mixes alphabets;
  - in a language written in another script, a lowercase Latin word between words of that script,
    outside quotes, brackets and parentheses, that is not an allowed term;
  - a span in backticks;
  - an identifier written in camelCase or with a dot inside.
- **The extra round** (`core/pipeline.js`). After an answer passes the validator, its human-readable
  text is checked: `reading`, `summary`, `why`, `notes`, `text`, `question`.
  - With issues, one more round goes out with `language.md`: send the same answer with only these
    fixed.
  - The second answer is taken only when it is valid and has fewer issues. Otherwise the first one
    stands.
  - The round runs at most once and never fails a job.

## The model

- **The SDK.** `@anthropic-ai/claude-agent-sdk` goes to ^0.3.293, which carries Claude Code 2.1.280
  or newer, the first that runs Claude Opus 5.5.
- **The default.** `PROVIDERS.claude.defaultModel` is `claude-opus-5-5`. A model chosen in Admin →
  AI Coach still wins.

## Where it lives

- **`scripts/build-coach-assets.mjs`:** the name packs, written and checked.
- **`api/coach/names/*.js`** (generated) and **`api/coach/names.js`** (the loader).
- **`api/coach/core/payload.js`:**
  - `today` and `names` in `build` (`todayFrom`, `payloadLang`);
  - `meta.weekday`, `meta.weekdayName`;
  - `schedule` and `volume`;
  - the names written in (`localize`), the health slice on the same today.
- **`api/coach/core/lang-check.js`**, **`api/coach/core/pipeline.js`**,
  **`api/coach/prompts/language.md`**.
- **`api/coach/prompts/common.md`, `review.md`, `chat.md`**, and `core/prompts.js` regenerated.
- **`api/coach/routes.js`, `api/coach/jobs.js`:** `today` from the request; the pack for the job.
- **`api/coach/config.js`:** the default model.
- **`api/package.json`, `package-lock.json`:** the SDK.
- **`frontend/src/lib/coach-api.js`:** `today` on every Coach request.
- **`frontend/src/lib/coach-local.js`** and **`frontend/src/lib/i18n-core.js`:** the loaded pack, for
  the phone's own Coach.

## Tests

- **`api/test/lang-check.test.js`:**
  - mixed alphabets;
  - a Latin word in a Russian sentence, and the same word in parentheses, quotes or as an allowed
    term;
  - backticks, camelCase and dotted identifiers;
  - an English answer, and one in another script.
- **`api/test/pipeline-language.test.js`**, with a fake adapter:
  - a clean answer is one call;
  - a slip gets one more call, and the fixed answer is taken;
  - a second answer that is invalid, or no better, leaves the first;
  - an answer that failed the validator goes to the ordinary repair round, not this one.
- **`api/test/payload-quality.test.js`:**
  - the client's date is taken or refused;
  - the weekday;
  - `schedule.today` with a day override and a rest day;
  - `schedule.upcoming`, a legacy one-id weekday, no weekly plan;
  - `volume` from a weekly plan and from a rotation;
  - names in each place, a custom exercise's own name, and no pack.
- **`api/test/coach-quality-job.test.js`:** the name packs load by tag; a chat job through the queue
  and the fixture provider reads the app's day, today's routine and the app's names, and without
  them the server's day and the catalogue's.
- **`api/test/config-migration.test.js`:** the Claude runtime defaults to Opus 5.5; a chosen model
  wins.
- **Generated files.** `node scripts/build-coach-assets.mjs --check`; prompts.test.js keeps passing.
- **Frontend.**
  - `exerciseNamePack` is the loaded pack, and nothing in English or with English names only;
  - the phone's Coach puts the app's date, the pack's names and the schedule in its payload.

## Not in this round

- Names for a language with no pack in the app.
- A model-graded check of the language (only the deterministic one above).
- The direct Anthropic API provider (an API key, not the Agent SDK) keeps its own default model.
- Moving the weekly plan's keys to day names: the plan, the validator and every change type speak
  `getDay()` numbers, and the payload now says what they mean.
