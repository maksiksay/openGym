# Coach chat: voice, meals and photos

Design notes, kept next to the code they describe. See [`COACH_CHAT.md`](COACH_CHAT.md) for the
chat job this builds on, and [`docs/HEALTH.md`](../HEALTH.md) for the food log.

## Why

On a phone, typing is the friction: between sets, or after a meal. Three things remove it:

- dictating a message instead of typing it;
- telling the Coach what you ate and getting it into the food log, without searching for each
  food;
- sending a photo of the plate instead of describing it.

The food log already has search, barcodes, Open Food Facts and an AI lookup by name. It has no
way to log a whole meal in one go, and "Photo of a plate → estimate" is on HEALTH.md's *Not yet*
list.

## First, a fix: a question no longer costs the waiting proposal

Found while designing this. With a proposal waiting (a review's change set, say), a message in
the chat went wrong:

- **On the server**, the message cleared the proposal. An answer ends the job as `nochange`, and
  `nochange` clears `pending`.
- **On a phone with its own key**, the proposal stayed, but the chat showed nothing. The thread
  writes the Coach's reply only when no proposal is waiting.

Now:

- **The proposal stays.** A `chat` job that answers or asks back leaves `pending` as it is. A
  review that finds nothing to change still clears it, since that review supersedes the
  proposal.
- **The reply always reaches the thread.** The thread writes it from how the run ended
  (`last.outcome`), not from whether a proposal waits. A provider with no `last` (the demo) keeps
  the old rule.
- **The Coach sees the proposal.** The payload of a `chat` job carries it as `waiting`: its kind,
  summary and changes, bounded. "Why fewer sets?" then has something to read. A `changes` reply
  replaces the waiting proposal, and the prompt says so.

## Voice

- **The button.** A microphone button sits in the composer. Tap it and speak: the words appear in
  the box as they are recognized. Tap again, or pause, to stop. Nothing is sent on its own; the
  person reads the text and sends it.
- **The recognizer is the browser's own.** It is the Web Speech API (`SpeechRecognition` /
  `webkitSpeechRecognition`), in the app's language.
  - Nothing new is installed.
  - No audio passes through this server.
  - On an iPhone it is Apple's recognition, the same as the keyboard's dictation.
- **Where there is no recognizer** (Firefox, an app shell's web view) there is no button. The
  keyboard's own dictation still works there.
- **Permission.** The first tap asks for the microphone. A refusal says where to allow it.
- `frontend/src/lib/speech.js`: `canDictate()`, `speechLang(lang)`, and
  `dictate({ lang, onText, onEnd })`, which returns `stop()`.

## Meals: the `meal` reply

This is the chat's fourth reply. A message, or a photo, about food someone ate gets a meal card
instead of a text answer:

```json
{ "coach_contract": 1, "reply": "meal", "text": "…", "slot": "l", "day": "today",
  "items": [{ "name": "…", "g": 200, "kcal": 110, "p": 4.2, "f": 1.1, "c": 21.3, "confidence": "typical" }] }
```

The fields:

- **`items`**: one item per food.
  - `g` is the portion as eaten.
  - `kcal`, `p`, `f` and `c` are per 100 g of the food as eaten. This is the shape `S.foods` and
    the AI lookup already use: a portion is `nutrition.portion`, and changing the grams rescales
    it.
- **`confidence`** is one of:
  - `label`: a label is readable;
  - `typical`: a standard food and a stated amount;
  - `estimate`: an amount judged from a photo or a vague description.
- **`slot`** (`b`, `l`, `d` or `s`) and **`day`** (`today` or `yesterday`) are given only when the
  message says so. Otherwise the card picks the slot by the time of day, and today.
- **`text`** says what was counted and what was assumed, for example "dressing counted as a
  tablespoon of oil".

`validateChat` hands a `meal` reply to `validateMeal` (`api/coach/core/food.js`), which checks:

- one to twelve items, each with a name and 1–3000 g;
- per-100 g values within a label's bounds, with kcal agreeing with the macros. These are the
  checks `validateFood` makes, shared between the two;
- `slot` and `day` from their lists, or dropped;
- `text` up to 300 characters.

The job's outcome is `meal`. The job's history entry keeps the validated meal, as a `nochange`
keeps its reading, so the client gets it as `last.meal`. It does not use `pending`, so a meal card
never replaces a waiting proposal, and several cards can sit in the thread.

### The card

The thread stores the card as a chat line: `{ role: 'coach', kind: 'meal', text, meal, status }`.

- **Contents.** Each item shows its grams (editable) and its kcal, with the total kcal and macros
  below. The meal slot and the day (today or yesterday) can be changed.
- **Add** writes one row per item into `S.meals`, as `mealRow({ food, g, d, slot, src: 'ai' })`,
  and marks the line `added`. A row from the card is an ordinary meal row; `src: 'ai'` marks it
  as an estimate.
- **Not now** marks the line `dismissed`.
- **After either**, the card folds into one line. Nothing is logged without the tap.
- **With food tracking off**, or the Health module off, the card shows the numbers and says where
  tracking is switched on. It has no Add.

## Photos

### On the device

- A camera button in the composer opens the camera or the photo library
  (`<input type="file" accept="image/*">`).
- The photo is decoded and re-encoded on the device (`lib/coach-photo.js`, with
  `lib/media-ingest.js`'s helpers), to at most 1280 px on the longest side. What leaves is a new
  JPEG or WebP: none of the original file's metadata (where and with what it was taken) goes
  with it.
- It shows as a thumbnail above the box until it is sent or removed.

### On its way

- It goes with the message: `POST /api/coach/chat` with `photo: { type, data }`, base64-encoded.
- The route accepts JPEG, PNG or WebP, checked on the bytes, up to 1.5 MB.

### Not kept

- The job holds the photo in memory and hands it to the provider with the prompt. The payload
  carries only `photo: true`.
- The photo is never written to a file, the job's history, the chat or the synced state. The
  thread shows the message with a camera mark.
- The conversation the next message carries says where a photo was (`[photo]`) and what a meal
  card counted, with whether it was added, so "and the bread?" has something to point at.
- The Claude runtime runs with `persistSession: false`, in a temporary home that is removed after
  the job.

### Who can see it

- Two providers can see an image, both on the server and on a phone with its own key:
  - **Claude**, through the Agent SDK. The prompt goes as one streamed user message holding the
    image and the text.
  - **The Anthropic API**, with an image block before the text.
- `publicConfig` reports `vision`. With any other provider there is no camera button, and a photo
  sent anyway is refused.

### What it can be

A photo needn't be food: a machine, a set-up, a label. The Coach answers as usual. A nutrition
label is read into a meal item with `confidence: label`.

### Consent

A photo is a new kind of data leaving the server, so it gets a category of its own. The category
is `photos`, described as: "Photos you attach — a photo you attach to a message, for that message
only; it is not kept".

- The consent version moves to 3, and everyone is asked again, once.
- A profile that has answered the questions before goes back to its chat once it agrees. Before
  this, a profile asked again walked the whole questionnaire and ended on a request for a fresh
  plan.
- Until then a photo is refused.
- Text, voice and meals need nothing new: a meal is what the person wrote.

## Where it lives

### API

- **`api/coach/jobs.js`**:
  - a `chat` answer keeps `pending`;
  - the outcome `meal`;
  - `waiting` passed to the payload;
  - the photo on the in-memory job;
  - a photo is refused without `vision` or without consent version 3;
  - `invokeOpts.image`.
- **`api/coach/core/payload.js`**: `waiting`, bounded; `photo: true`.
- **`api/coach/core/validate.js`**: `validateChat` handles `meal`.
- **`api/coach/core/food.js`**: `validateMeal`, with the per-100 g checks shared with
  `validateFood`.
- **`api/coach/core/pipeline.js`**: returns `{ ok, meal }`.
- **`api/coach/prompts/chat.md`**: the `meal` reply, `waiting`, and photos.
- **`api/coach/adapters/claude.js`**: `promptWithImage`; `vision: true`.
- **`api/coach/core/adapters/http.js` and `anthropic.js`**: `image` becomes an image block;
  `vision: true`.
- **`api/coach/config.js`**: `visionCapable`; `publicConfig().vision`.
- **`api/coach/core/categories.js`**: `photos`.
- **`api/coach/routes.js`**: `photo` on `POST /api/coach/chat`. In `api/openapi.yaml`.
- **`api/coach/fixture-cli.mjs`**: a `meal` reply for a message about eating, or a photo.

### Frontend

- **`frontend/src/lib/`**:
  - `speech.js`;
  - `coach-meal.js`, pure: a card's rows for `S.meals`;
  - `coach-photo.js`: the photo drawn again on the device, as base64;
  - `coach-api.js`: `sendChat(message, photo)`;
  - `coach-local.js`: `waiting`, the photo, the `meal` outcome;
  - `coach.js`: the `photos` category text; `CONSENT_VERSION` 3;
  - `coach-i18n.js` (en, ru).
- **`frontend/src/views/CoachChat.jsx`**:
  - the microphone and camera buttons, and the attachment;
  - the meal card;
  - the reply written from the run's outcome.
- **`frontend/src/views/CoachIntake.jsx`**: agreeing again goes back to the chat.
- **`frontend/src/components/Icon.jsx`**: `mic`.

## Tests

### API

- A `chat` answer with a review waiting keeps the review, and its payload carries `waiting`.
- `validateMeal`: bounds, kcal against macros, at most twelve items, `slot` and `day`.
- A `meal` end to end through the fixture: `last.meal`.
- The photo on the route:
  - its type, checked on the bytes;
  - its size;
  - refused with a provider that has no `vision`;
  - refused before consent version 3.
- The adapters: the shape of Claude's streamed message; Anthropic's body with an image.
- The disclosure lists `photos`.

### Frontend

- `speech.js` with a fake recognizer.
- The microphone shows only where there is a recognizer.
- A reply is written when a run ends, even with a proposal waiting.
- The meal card:
  - change the grams, then Add: the rows land in `S.meals`;
  - Not now;
  - tracking off: no Add.
- A photo goes with the message, and the thread keeps only its mark.
- The consent screen lists photos, and a profile asked again goes back to its chat.
- `CoachChat.demo-failure.test.jsx` loads the demo module before it starts timing a request. On a
  cold cache it used to fail more often than it passed.

### For real, on the instance

- "Ate 200 g of buckwheat and 150 g of chicken breast" gets a meal card.
- A photo of a plate gets a meal card.
- A question asked while a review waits is answered, and the review is still there.
- Voice is tried by the person on their own phone.

## Not in this round

- Images for the OpenAI, Gemini and OpenAI-compatible providers.
- Keeping the photo in the thread.
- Sending the message on its own after dictation, or sending a voice note (audio) instead of
  text.
- Adding a meal's foods to `S.foods`, the person's own food list. The card logs portions only.
