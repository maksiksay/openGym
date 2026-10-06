# Coach chat: the Coach decides what a message is

Design notes, kept next to the code they describe. See [`docs/AI_COACH.md`](../AI_COACH.md) for
the Coach and [`COACH_WEB.md`](COACH_WEB.md) for its web search.

## Why

A message typed into the Coach chat used to become one of two jobs.

- While a new plan was pending, or there was no plan yet, it refined the plan.
- Otherwise it became a review with the message as its note.

Both prompts and both answer shapes are about the training plan. A question about calories and
macros, sleep or recovery therefore came back as a training review. There was no job that simply
answers. A person should not have to tell the Coach what kind of message they sent: the Coach
reads it and answers, changes the plan, or asks what they meant.

## What this adds

### The `chat` job

Every message typed in the chat goes to a new job kind, `chat`, with two exceptions:

- while a newly created plan is pending;
- while there is no plan at all.

In both cases the message still refines the plan, as before. The context there is unambiguous.

For each message, the model picks one of three replies:

| `reply` | When | What the person gets |
|---|---|---|
| `answer` | a question: nutrition (calories, protein, fat, carbohydrate), sleep, recovery, habits, technique, a program | a text answer in their language, using their data where it helps, sources named when it searched |
| `changes` | a request to change the plan | a change set, exactly like a review's: the same change types, validated by the review validator, shown as a proposal the person applies |
| `clarify` | the message is ambiguous, or something needed is missing | one short question back |

### Memory of the conversation

The payload already carried the last six lines of the chat (`conversation`: `who` and `text`,
240 characters each) for a review or a plan. A `chat` job reads more of it: the last eight
lines, 500 characters each. A clarifying question can then be answered in the next message, and
"the second one" means something. The message being sent is not among them; it rides in
`message`.

### What the model reads

What a review reads, with the message on top:

- the plan;
- the training window with its aggregates, over the whole twelve weeks rather than since the
  last review: a question is about the training as it stands;
- body weight;
- daily check-ins and food totals against the goals;
- the intake answers;
- the library slice for swaps;
- `message`, the text just sent;
- `conversation`.

No food names and no notes, as everywhere. These are the categories the person has already
agreed to, so the consent does not change.

### Unchanged

- The buttons stay as they were: review my training, debrief the last session, build a fresh plan,
  improve one routine.
- Web search: `chat` joins the consultation jobs (`WEB_KINDS`).

## The answer contract

```json
{ "coach_contract": 1, "reply": "answer",  "text": "…", "sources": [{ "title": "…", "url": "https://…" }] }
{ "coach_contract": 1, "reply": "clarify", "text": "…" }
{ "coach_contract": 1, "reply": "changes", "summary": "…", "changes": [ … ] }
```

`validateChat` (`api/coach/core/validate.js`):

- **`answer` and `clarify`** become `{ ok, nochange: true, reading }`. This is the path a review that
  changes nothing already takes into the chat, so the client shows it as the Coach's message.
  - The text may be up to 3000 characters.
  - At most five sources are kept, and only `http(s)` URLs. They are written under the text as
    `title — url` lines.
- **`changes`** goes to `validateReview` against the plan and comes out as the same proposal a
  review makes. A `changes` reply with no changes in it fails.
- **Anything else** fails, and gets the pipeline's one repair round like any unusable answer.

The proposal waits as `pending` with kind `review`: the app shows, applies, logs and reverts it
exactly as a review's. The job itself is `chat` in the history.

An `answer` or a `clarify` leaves a proposal that was already waiting where it is, and the
payload shows it to the model as `waiting` ([`COACH_VOICE_PHOTO.md`](COACH_VOICE_PHOTO.md)).

## Where it lives

- `api/coach/prompts/chat.md`, then `node scripts/build-coach-assets.mjs` (`prompts.js`).
- `api/coach/core/prompt.js`: kind `chat` → task `chat`. The system prompt is `common.md`,
  `chat.md`, and then `review.md` from its table of change types on (`CHANGE_RULES`), so the
  rules for a change set exist once.
- `api/coach/core/payload.js`: kind `chat` builds the review slice plus `message` and
  `conversation`.
- `api/coach/core/pipeline.js`: kind `chat` → `validateChat`.
- `api/coach/core/schemas.js`: no strict schema for `chat`. The three reply shapes do not fit one
  schema, so the HTTP providers use their plain JSON mode for it.
- `api/coach/jobs.js`: `enqueue` takes `kind: 'chat'` with `message`; `WEB_KINDS` gains `chat`;
  a proposal is stored with kind `review`; the history keeps a reading of up to 5000 characters,
  an answer with its sources.
- The web search note (`CONSULT_WEB_NOTE`) says sources go into `sources` where a reply has
  that field.
- `api/coach/warmup.js`: for a local model, the `chat` prefix is warmed last, so the one live
  slot holds the kind every typed message uses.
- `api/coach/routes.js`: `POST /api/coach/chat` with `{ message, lang }`. A blank message is a
  400. The message is clipped to the admin's message length, like a review note. In
  `api/openapi.yaml`.
- `frontend/src/lib/coach-api.js`: `sendChat(message)`, server or phone-local
  (`coach-local.js` `localChat`), as the other requests are. The demo build has no model to
  answer with, so a message there still gets its canned review.
- `frontend/src/views/CoachChat.jsx`: `send()` uses it whenever the refine path does not apply.
  The typing bubble says "Reading your message…". URLs in the Coach's messages are links
  (`lib/links.js`, http(s) only), opened outside the app.

## Tests

- **`validateChat`:**
  - the three replies;
  - `answer` with sources (`javascript:` and plain-text URLs dropped, at most five, text clipped);
  - `clarify` with no text fails;
  - `changes` passes through the review validator (an unknown exercise fails, a valid change set
    becomes a proposal);
  - an unknown `reply` fails.
- **Payload:**
  - `chat` carries `message` and the last eight turns, clipped;
  - no food names and no notes;
  - the review slices are present.
- **Pipeline:** a fixture `answer` reaches the chat as a reading, and a `changes` answer becomes a
  pending proposal.
- **Route:** `POST /api/coach/chat` enqueues a `chat` job with the message.
- **Web:** `webOptionsFor(cfg, 'chat')` searches when the switch is on.
- **Client:** with a plan and nothing pending, a typed message goes to `chat`; with a pending
  new plan, it still refines; on a phone with its own key, `localChat` runs the same core. URLs
  in the Coach's messages are links, `javascript:` never.
- **Prompts:** `build-coach-assets.mjs --check`; the chat prompt ends with the review's change
  rules.
- **For real on the instance:** a question about protein gets an answer, a "swap the bench for
  dumbbells" gets a proposal, and "change it" with nothing to go on gets a clarifying question.
