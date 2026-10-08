# openGym documentation

Pick the part that matches what you're doing. If you just have a question, try the
[FAQ](FAQ.md) first.

## Using the app

| Guide | Read it when |
|---|---|
| [FAQ](FAQ.md) | You have a quick question: iPhone, cost, where your data goes, AI, the exercise media |
| [Phone app](MOBILE.md) | You want the Android APK or the iPhone options, or to connect the app to your own server |
| [Importing data](DATA_IMPORTS.md) | You're coming from FitNotes, Strong, Hevy or Apple Health, or sharing a plan with someone |
| [AI coach](AI_COACH.md) | Your instance has the coach switched on and you want to know what it sees and can change |
| [Health & food](HEALTH.md) | You want to log sleep, wellbeing and food next to your training |

The [live demo](https://opengym.duarte-santos.ch/demo/) is the real app with example data, nothing
to install.

## Hosting it

| Guide | Read it when |
|---|---|
| [Self-hosting](SELF_HOSTING.md) | You're setting up an instance. Start here: running it, passkeys and HTTPS, users, backups, updates, troubleshooting |
| [HTTPS at home](SELF_HOSTING_HTTPS.md) | You want valid certificates on your LAN without exposing the server to the internet |
| [On a Mac, over Tailscale](SELF_HOSTING_MAC.md) | One person, their own Mac, no domain: reach it from the phone anywhere, Coach on a ChatGPT subscription |
| [Kubernetes](SELF_HOSTING_KUBERNETES.md) | You run a cluster instead of Docker Compose |
| [AI coach](AI_COACH.md) | You're deciding whether to turn the coach on, and with which provider |
| [MCP server](../mcp/README.md) | You want Claude Desktop, Cursor or another AI client to read your training history |
| [Security](../SECURITY.md) | You host it for other people, or want to report a vulnerability |

All settings live in `.env`; [`.env.example`](../.env.example) explains each one, and the
[README](../README.md#quick-start) has the full table.

## Working on the code

| Guide | Read it when |
|---|---|
| [Contributing](../CONTRIBUTING.md) | Before your first pull request: setup, guidelines, what CI checks |
| [CLAUDE.md](../CLAUDE.md) | You want the architecture in one page (written for Claude Code, useful for people too) |
| [HTTP API](API.md) | You're touching routes; the OpenAPI spec is the source of truth |
| [Roadmap](../ROADMAP.md) | You want to know what's planned and where your idea fits |
| [Changelog](../CHANGELOG.md) | You want to know what changed in a release |

Design notes for specific features, kept next to the code they describe:

| Note | Covers |
|---|---|
| [Set types](dev/SET_TYPES.md) | Drop sets and rest-pause: the set-row model and how totals are counted |
| [Workout views](dev/LIST_VIEW.md) | The cards, list and compact layouts of the workout screen |
| [Combine routines](dev/COMBINE_ROUTINES.md) | Spec for running more than one routine in a session |
| [Scoreboard](dev/SCOREBOARD.md) | Wins, the goal line on the exercise card and the monthly quota |
| [A/B plan](dev/AB_PLAN.md) | Nordic curl and Copenhagen built-ins, the 2×40 starter plan, the next session without a schedule |
| [Coach web search](dev/COACH_WEB.md) | Letting the Coach search the web in plans, reviews and chat, search only |
| [Coach chat](dev/COACH_CHAT.md) | The Coach decides whether a message is a question, a plan change or unclear |
| [Coach voice, meals and photos](dev/COACH_VOICE_PHOTO.md) | Dictation in the chat, a meal logged from a message or a photo, and the fix that keeps a waiting proposal |
| [Seasons](dev/SEASONS.md) | Six-week blocks with a max-reps test on four anchor lifts, results, and program changes at the boundary |
| [Strength levels](dev/STRENGTH_LEVELS.md) | Beginner to Elite per lift, relative to body weight, from a model fitted to Strength Level's standards |
| [Health import](dev/HEALTH_IMPORT.md) | Steps and sleep from Apple Health through a Shortcuts automation and a personal key, and a steps goal |
| [Water](dev/WATER.md) | A daily water counter, drinks from the food log counted in, and a water goal |
| [Sugar and fibre](dev/SUGAR_FIBRE.md) | Sugars and fibre per food and meal row, a fibre goal, and sugar shown without a limit |
| [RIR step](dev/RIR_STEP.md) | The last set's reps in reserve sets the next step, and a miss after a short night does not count |
| [Coach assistant](dev/COACH_ASSISTANT.md) | The chat notes a weight, a check-in, water and goals on a card, knows the app's screens and links to them |
| [Coach quality](dev/COACH_QUALITY.md) | The right day and today's routine, the app's exercise names, a plan read before any session, a language check, Opus 5.5 by default |
| [Progress photos](dev/PROGRESS_PHOTOS.md) | A feed of the photos kept with workouts, and two of them compared side by side or with a slider |
| [Warm-ups](dev/WARMUPS.md) | Warm-up and recovery routines run before a workout or on their own, counted for nothing, and five ready-made sets |
| [Rate of gain](dev/GAIN_RATE.md) | The weight trend against a corridor, a calorie step applied to the goal, and a food calibration that pauses itself |
| [Quests](dev/QUESTS.md) | A goal pinned on a lift, a bar from where it started, a forecast as a range of weeks, and a win when it is done |

## Still stuck?

Ask on the [Discord](https://discord.gg/e62jY6fwVb) or in
[Discussions](https://github.com/DuarteSantos8/openGym/discussions). If something in these docs was
wrong or missing, that's worth an issue too.
