/* The chat as the app's assistant (docs/dev/COACH_ASSISTANT.md): a weight, a check-in, water and
   goals read from a message for a card that writes them on a tap, and answers that link to places
   in the app from a fixed list. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const { validateLog } = await import('../coach/core/log.js');
const { APP_LINKS, cleanOpen } = await import('../coach/core/app-links.js');
const { validateChat } = await import('../coach/core/validate.js');
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

test('a log keeps what is sane in each part and drops keys it does not know', () => {
  const r = validateLog({ text: '  Noted.  ', day: 'yesterday', weight: '72,44', checkin: { sleep: 6.1, sq: 4, energy: '2', steps: 9000.4, mood: 'meh' },
    water: 1000, goals: { p: 140.2, fib: 32, water: 2500, bench: 100 }, deleteEverything: true });
  assert.deepEqual(r, { ok: true, log: { text: 'Noted.', day: 'yesterday', weight: 72.4, checkin: { sleep: 6, sq: 4, energy: 2, steps: 9000 }, water: 1000, goals: { p: 140, fib: 32, water: 2500 } } });
  assert.equal(validateLog({ water: 250, day: 'tomorrow' }).log.day, 'today');
});

test('a weight is read in the profile\'s unit', () => {
  assert.equal(validateLog({ weight: 160 }, { unit: 'lb' }).log.weight, 160);
  assert.equal(validateLog({ weight: 160 }, { unit: 'kg' }).ok, true);   // a heavy lifter in kg
  assert.match(validateLog({ weight: 400 }, { unit: 'kg' }).errors[0], /in kg, 20 to 300/);
  assert.match(validateLog({ weight: 30 }, { unit: 'lb' }).errors[0], /in lb, 44 to 660/);
});

test('out of bounds is refused, not clamped, and the error names the field', () => {
  assert.match(validateLog({ checkin: { sleep: 20 } }).errors[0], /checkin\.sleep/);
  assert.match(validateLog({ checkin: { energy: 3.5 } }).errors[0], /whole number/);
  assert.match(validateLog({ water: 9000 }).errors[0], /water/);
  assert.match(validateLog({ goals: { kcal: 300 } }).errors[0], /goals\.kcal/);
  assert.match(validateLog({ goals: { steps: 100000 } }).errors[0], /goals\.steps/);
  assert.equal(validateLog({ checkin: 'tired' }).ok, false);
});

test('a log with nothing in it goes back, pointing at answer', () => {
  assert.match(validateLog({ text: 'Hi' }).errors[0], /reply "answer"/);
  assert.equal(validateLog({ checkin: { mood: 'meh' } }).ok, false);
  assert.equal(validateLog(null).ok, false);
});

test('the chat hands a log reply to the log validator, with the profile\'s unit', () => {
  const r = validateChat({ coach_contract: 1, reply: 'log', weight: 160 }, { routines: [] }, { unit: 'lb' });
  assert.deepEqual(r, { ok: true, log: { text: '', day: 'today', weight: 160 } });
  assert.equal(validateChat({ coach_contract: 1, reply: 'log' }, { routines: [] }).ok, false);
});

test('an answer links to two known places at most, each once', () => {
  const r = validateChat({ coach_contract: 1, reply: 'answer', text: 'There.', open: ['settings.health', 'nowhere', 'settings.health', 'health', 'stats'] }, { routines: [] });
  assert.deepEqual(r.open, ['settings.health', 'health']);
  assert.equal('open' in validateChat({ coach_contract: 1, reply: 'answer', text: 'There.', open: 'settings' }, { routines: [] }), false);
  assert.equal('open' in validateChat({ coach_contract: 1, reply: 'clarify', text: 'Which?', open: ['settings'] }, { routines: [] }), false);
  assert.deepEqual(cleanOpen(['home', 3, null]), ['home']);
  assert.ok(APP_LINKS.includes('settings.import'));
});

test('end to end: a note comes back as a log card, an answer with its links, and a waiting review keeps waiting', async () => {
  const uid = 'u-log';
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  writeState(DIR, uid, sampleState({ workouts: [{ ...sampleState().workouts[0], d: daysAgo(3) }] }));
  jobs.enqueue(uid, { kind: 'review' });
  const review = (await settle(uid)).pending;
  assert.equal(review?.kind, 'review');

  jobs.enqueue(uid, { kind: 'chat', message: 'slept 6 hours, weigh 72.4, drank a litre' });
  let s = await settle(uid);
  assert.equal(s.pending?.id, review.id, 'a log is not a proposal');
  assert.equal(s.last.outcome, 'log');
  assert.equal(s.last.reading, 'Noted: the weight, the night and the water.');
  assert.deepEqual(s.last.log, { text: 'Noted: the weight, the night and the water.', day: 'today', weight: 72.4, checkin: { sleep: 6, energy: 2 }, water: 1000, goals: { p: 140 } });

  jobs.enqueue(uid, { kind: 'chat', message: 'where is the water goal?' });
  s = await settle(uid);
  assert.equal(s.last.outcome, 'nochange');
  assert.deepEqual(s.last.open, ['settings.health', 'health']);
  assert.equal(s.pending?.id, review.id);
});

test('the chat\'s system prompt carries the app map with every link id, and only the chat\'s does', async () => {
  const { buildPromptParts } = await import('../coach/core/prompt.js');
  const { PROMPTS } = await import('../coach/core/prompts.js');
  assert.match(buildPromptParts('chat', {}).system, /# The app map/);
  for (const kind of ['review', 'debrief', 'create']) assert.doesNotMatch(buildPromptParts(kind, {}).system, /# The app map/, kind);
  for (const id of APP_LINKS) assert.ok(PROMPTS.app.includes('`' + id + '`'), id);
});
