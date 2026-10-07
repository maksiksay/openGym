# Progress photos: a feed of the photos kept with workouts, and two of them compared

Design notes, kept next to the code they describe. Builds on the photos and videos a logged
workout already keeps (`frontend/src/components/WorkoutMedia.jsx`, `lib/workout-media.js`).

## Why

A workout already takes up to six photos or videos: on the finish screen and in its detail sheet
in History. Each one can only be seen inside its own workout. Progress is what changes between
them, and there is nowhere to look at that.

## What it adds

### The Progress screen (`/progress`)

- **Getting there:** a "Progress photos" card on Stats, with the latest photo and how many there
  are.
- **The feed:**
  - every photo of every logged workout, newest day first;
  - a day's photos together, under its date and the body weight of that day;
  - the weight is the nearest weigh-in within a week, marked ≈ when it is not that day's.
- **Videos stay out.** They are form checks, not progress.
- **A tap** opens the workout's own viewer at that photo. Removing a photo there removes it from
  the workout.
- **Add photos:** pick one of the last workouts, and its photos section opens in a sheet, with the
  same Add tile, limits and sync as everywhere else.
- **With no photos yet,** the screen says where photos come from: the finish screen, a workout in
  History, or Add photos here.

### Compare

- **What it shows:** two photos, by default the first and the latest.
- **Changing one:** tap "Change" under a side, then tap a photo in the feed.
- **Two layouts:**
  - **Side by side.**
  - **Slider:** the two laid over each other, a handle moving the line between them.
- **Under each photo:** its date, the weight and the waist of that day (nearest within a week,
  ≈ when not that day).
- **The summary:** "84 days · −2.1 kg · −3 cm waist". The weight is in the profile's unit, and a
  part with nothing to compare is left out.

### Not changed

- **Where the files live:** the device's media store and, signed in, the person's own server,
  exactly as a workout's photos do now. That means the server's media quota (`MEDIA_QUOTA_MB`,
  200 MB by default) and its nightly backup.
- **Where they never go:** the Coach's payloads, MCP, plan files and "Copy as text" never read a
  workout's `media`. Only the zip backup carries the files.

## Where it lives

- **`frontend/src/lib/progress-photos.js`** (pure): `progressPhotos`, `bodyOn`, `comparison`,
  `photoWorkouts`.
- **`frontend/src/views/Progress.jsx`:** the screen.
- **`frontend/src/views/Stats.jsx`:** the card.
- **`frontend/src/App.jsx`:** the route.
- **`frontend/src/lib/progress-i18n.js`, `progress-i18n.ru.js`:** the strings.
- **`frontend/src/index.css`:** the feed, the compare layouts, the slider.
- **The Coach's app map** (`api/coach/prompts/app.md`, `core/app-links.js`,
  `frontend/src/lib/app-links.js`): the screen and a `progress` link id.

## Tests

- **`lib/progress-photos.test.js`:**
  - photos only, newest first, each with its workout and its index there;
  - the weight and the waist of a day: exact, nearest within a week (≈), and none beyond it;
  - the comparison: the days between and the deltas, a part left out when either side lacks it.
- **`views/Progress.test.jsx`:**
  - the feed's days and weights;
  - the empty screen;
  - compare's defaults, changing a side, and the slider;
  - Add photos opening a workout's section.
- **The app links:** `progress` has its route.

## Not in this round

- Poses (front, side, back). The person chose plain photos.
- A camera guide over the last photo.
- Photos on a day without a workout.
