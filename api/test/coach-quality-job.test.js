/* A chat job end to end (docs/dev/COACH_QUALITY.md): the app's own date and language reach the
 * payload the provider reads, with the weekday, today's routine and the app's exercise names in
 * it — through the route, the queue and the fixture provider, without an AI account. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const { namesFor } = await import('../coach/names.js');
const { forcePrivilegeVerdict } = await import('../coach/adapters/spawn.js');

cfg.save({ enabled: true, provider: 'fixture' });
forcePrivilegeVerdict({ ok: true, dropped: false, why: 'pinned by the test suite' });

async function settle(uid, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (!jobs.status(uid).job) return jobs.status(uid);
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error('job never finished');
}
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function profile(uid, today) {
  const wd = new Date(today + 'T12:00:00Z').getUTCDay();
  writeState(DIR, uid, sampleState({
    routines: [{ id: 'up', name: 'Верх A', ex: [{ id: '0025', sets: 3, reps: 8, mode: 'reps' }] }],
    week: { [wd]: ['up'] },
    dayPlan: {}
  }));
}

test('the name packs load by language, the base language standing in, and only for a tag', async () => {
  const ru = await namesFor('ru');
  assert.equal(ru['0025'], 'жим штанги лёжа');
  assert.equal(await namesFor('ru-RU'), ru);
  assert.equal((await namesFor('pt-BR'))['0025'] != null, true);
  assert.equal(await namesFor('en'), null);
  assert.equal(await namesFor('xx'), null);
  assert.equal(await namesFor('../../secret'), null);
  assert.equal(await namesFor(null), null);
});

test('a chat job reads the app\'s day and today\'s routine, and names the exercise the app\'s way', async () => {
  const uid = 'quality-a';
  // The app's date may be a day ahead of the server's UTC one: the app's wins.
  const today = plus(new Date().toISOString().slice(0, 10), 1);
  profile(uid, today);
  jobs.enqueue(uid, { kind: 'chat', lang: 'ru', today, message: 'что сегодня?' });
  await settle(uid);
  const last = jobs.readUser(uid).history.at(-1);
  assert.equal(last.outcome, 'nochange');
  assert.equal(last.reading, `Today is ${NAMES[new Date(today + 'T12:00:00Z').getUTCDay()]} (${today}): Верх A. The plan opens with жим штанги лёжа.`);
});

test('without the app\'s date or a pack, the server\'s day and the catalogue\'s names stand in', async () => {
  const uid = 'quality-b';
  const today = new Date().toISOString().slice(0, 10);
  profile(uid, today);
  jobs.enqueue(uid, { kind: 'chat', lang: 'en', message: "what's on today" });
  await settle(uid);
  const last = jobs.readUser(uid).history.at(-1);
  assert.match(last.reading, new RegExp(`\\(${today}\\): Верх A\\. The plan opens with barbell bench press\\.$`));
});
