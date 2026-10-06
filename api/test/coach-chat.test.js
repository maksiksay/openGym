/* The Coach chat (docs/dev/COACH_CHAT.md): one job reads a typed message and answers it, proposes
   plan changes or asks what was meant. The validator decides what reaches the person; the queue
   and the fixture provider carry the three replies end to end without an AI account. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const payload = await import('../coach/core/payload.js');
const { validateChat } = await import('../coach/core/validate.js');
const { taskOf, buildPromptParts, CHANGE_RULES } = await import('../coach/core/prompt.js');
const { coachRoutes } = await import('../coach/routes.js');
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
const lastOutcome = uid => jobs.readUser(uid).history.at(-1);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const plan = () => payload.build(sampleState(), { handle: 'h', kind: 'chat', message: 'x' }).plan;

test('a chat job is a task of its own, with a prompt of its own', () => {
  assert.equal(taskOf('chat', {}), 'chat');
  const parts = buildPromptParts('chat', { task: 'chat' }, null);
  assert.equal(parts.task, 'chat');
  assert.match(parts.system, /"reply"/);
  assert.match(parts.system, /clarify/);
  // the change set's rules are the review's own, not a copy
  assert.ok(CHANGE_RULES.startsWith('### Allowed change types'), 'review.md still has the section chat.md borrows');
  assert.ok(parts.system.endsWith(CHANGE_RULES));
  assert.match(parts.system, /\| `swap-exercise` \|/);
});

test('an answer becomes the Coach\'s message, with its sources under it', () => {
  const r = validateChat({
    coach_contract: 1, reply: 'answer', text: 'About 1.6 g of protein per kg a day.',
    sources: [
      { title: 'Morton 2018', url: 'https://bjsm.bmj.com/content/52/6/376' },
      { title: 'evil', url: 'javascript:alert(1)' },
      { title: 'no scheme', url: 'example.org/x' },
      { url: 'http://example.org/untitled' },
    ],
  }, plan());
  assert.equal(r.ok, true);
  assert.equal(r.nochange, true);
  assert.match(r.reading, /^About 1\.6 g of protein per kg a day\.\n\n/);
  assert.match(r.reading, /Morton 2018 — https:\/\/bjsm\.bmj\.com\/content\/52\/6\/376/);
  assert.match(r.reading, /http:\/\/example\.org\/untitled — http:\/\/example\.org\/untitled/);
  assert.doesNotMatch(r.reading, /javascript:|no scheme/);
});

test('an answer is clipped, and keeps at most five sources', () => {
  const sources = Array.from({ length: 9 }, (_, i) => ({ title: 'S' + i, url: `https://example.org/${i}` }));
  const r = validateChat({ reply: 'answer', text: 'x'.repeat(5000), sources }, plan());
  assert.equal(r.ok, true);
  assert.equal(r.reading.split('\n').filter(l => l.includes('https://example.org/')).length, 5);
  assert.ok(r.reading.length <= 4000);
});

test('a clarifying question is a message too, and needs its text', () => {
  const r = validateChat({ reply: 'clarify', text: 'Change what: a routine, or one exercise?' }, plan());
  assert.deepEqual(r, { ok: true, nochange: true, reading: 'Change what: a routine, or one exercise?' });
  assert.equal(validateChat({ reply: 'clarify', text: '  ' }, plan()).ok, false);
  assert.equal(validateChat({ reply: 'answer' }, plan()).ok, false);
});

test('changes are judged by the review validator, as a review\'s would be', () => {
  const p = plan();
  const rid = p.routines[0].id;
  const exId = p.routines[0].ex[0].id;
  const good = validateChat({
    reply: 'changes', summary: 'One more set.',
    changes: [{ id: 'c1', type: 'sets', target: { routineId: rid, exId }, before: 3, after: 4, why: 'Ready for it.' }],
  }, p);
  assert.equal(good.ok, true);
  assert.ok(good.proposal, 'a proposal, not a message');
  const bad = validateChat({
    reply: 'changes', summary: 'x',
    changes: [{ id: 'c1', type: 'add-exercise', target: { routineId: rid }, after: { id: 'not-a-real-exercise', sets: 3, reps: 10 }, why: 'x' }],
  }, p);
  assert.equal(bad.ok, false);
});

test('anything that is not one of the three replies fails, to the one repair round', () => {
  assert.equal(validateChat({ reply: 'chat', text: 'hi' }, plan()).ok, false);
  assert.equal(validateChat({ text: 'hi' }, plan()).ok, false);
  assert.equal(validateChat(null, plan()).ok, false);
  assert.equal(validateChat('hi', plan()).ok, false);
});

test('the payload carries the message and the last eight turns, and what a review reads', () => {
  const chat = [];
  for (let i = 0; i < 12; i++) chat.push({ id: 'm' + i, at: i, role: i % 2 ? 'coach' : 'user', kind: i % 2 ? 'nochange' : 'text', text: 'turn ' + i + ' ' + 'y'.repeat(600) });
  chat.push({ id: 'card', at: 99, role: 'coach', kind: 'applied', text: 'Applied' });
  const S = sampleState({
    coach: { ...sampleState().coach, consent: { agreedAt: new Date().toISOString(), version: 2 }, chat },
    meals: [{ id: 'f1', d: '2026-07-20', name: 'Secret oatmeal', kcal: 300, p: 10, f: 5, c: 50 }],
    health: [{ d: '2026-07-20', sleep: 7, note: 'private note' }],
  });
  const p = payload.build(S, { handle: 'h', kind: 'chat', message: 'How much protein should I eat?' });
  assert.equal(p.task, 'chat');
  assert.equal(p.message, 'How much protein should I eat?');
  assert.equal(p.conversation.length, 8);
  assert.deepEqual(p.conversation.map(c => c.who), ['user', 'coach', 'user', 'coach', 'user', 'coach', 'user', 'coach']);
  assert.match(p.conversation[0].text, /^turn 4 /);
  assert.ok(p.conversation.every(c => c.text.length <= 500));
  assert.ok(p.window && p.library && p.plan, 'the review slices are there');
  const json = JSON.stringify(p);
  assert.ok(!json.includes('Secret oatmeal'), 'no food names');
  assert.ok(!json.includes('private note'), 'no notes');
});

test('the conversation marks where a photo was, and what a meal card counted', () => {
  const chat = [
    { id: 'a', at: 1, role: 'user', kind: 'text', text: '', photo: true },
    { id: 'b', at: 2, role: 'coach', kind: 'meal', text: 'Read off the photo.', status: 'added', meal: { items: [{ name: 'Buckwheat', g: 200 }, { name: 'Chicken', g: 150.4 }] } },
    { id: 'c', at: 3, role: 'user', kind: 'text', text: 'And the bread?', photo: true },
    { id: 'd', at: 4, role: 'coach', kind: 'meal', text: '', status: 'open', meal: { items: [{ name: 'Bread', g: 40 }] } },
    { id: 'e', at: 5, role: 'coach', kind: 'applied', text: 'Applied' },
  ];
  const p = payload.build(sampleState({ coach: { ...sampleState().coach, chat } }), { handle: 'h', kind: 'chat', message: 'Thanks' });
  assert.deepEqual(p.conversation, [
    { who: 'user', text: '[photo]' },
    { who: 'coach', text: 'Read off the photo. [meal card: Buckwheat 200 g, Chicken 150 g; added to the food log]' },
    { who: 'user', text: 'And the bread? [photo]' },
    { who: 'coach', text: '[meal card: Bread 40 g; not added yet]' },
  ]);
});

test('a chat reads the whole twelve weeks, where a review reads only what came after the last one', () => {
  const S = sampleState({
    workouts: [10, 40].map(n => ({ ...sampleState().workouts[0], id: 'w' + n, d: daysAgo(n) })),
  });
  S.coach.lastReview = { at: daysAgo(20) + 'T12:00:00.000Z' };
  const review = payload.build(S, { handle: 'h', kind: 'review' });
  const chat = payload.build(S, { handle: 'h', kind: 'chat', message: 'How is my training going?' });
  assert.equal(review.window.workouts.length, 1);
  assert.equal(chat.window.workouts.length, 2);
  assert.equal('message' in review, false);
});

test('a review keeps its shorter memory of the conversation', () => {
  const chat = Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, at: i, role: 'user', kind: 'text', text: 'line ' + i + ' ' + 'y'.repeat(600) }));
  const p = payload.build(sampleState({ coach: { ...sampleState().coach, chat } }), { handle: 'h', kind: 'review' });
  assert.equal(p.conversation.length, payload.CONVERSATION_LINES);
  assert.ok(p.conversation.every(c => c.text.length <= payload.CONVERSATION_CHARS));
});

test('a chat payload carries the proposal still waiting, bounded', () => {
  const waiting = {
    id: 'p1', kind: 'review', planHash: 'h', summary: 'S'.repeat(900),
    changes: [
      { id: 'c1', type: 'sets', target: { routineId: 'r1', exId: '0001' }, before: 3, after: 4, why: 'w'.repeat(500) },
      { id: 'c2', type: 'add-exercise', target: { routineId: 'r1' }, before: null, after: { id: '0002', sets: 3, reps: 10, pad: 'z'.repeat(1000) }, why: 'x' },
    ],
  };
  const p = payload.build(sampleState(), { handle: 'h', kind: 'chat', message: 'Why?', waiting });
  assert.equal(p.waiting.kind, 'review');
  assert.equal(p.waiting.summary.length, 600);
  assert.deepEqual(p.waiting.changes[0], { type: 'sets', target: { routineId: 'r1', exId: '0001', weekday: null }, before: 3, after: 4, why: 'w'.repeat(300) });
  assert.ok(p.waiting.changes[1].after.startsWith('{"id":"0002"') && p.waiting.changes[1].after.length <= 200);
  assert.equal('planHash' in p.waiting, false);
  assert.equal('waiting' in payload.build(sampleState(), { handle: 'h', kind: 'review', waiting }), false, 'only a chat reads it');
  assert.equal('waiting' in payload.build(sampleState(), { handle: 'h', kind: 'chat', message: 'x', waiting: { kind: 'create', bundle: {} } }), false);
});

test('a question asked while a review waits is answered, and the review keeps waiting', async () => {
  const uid = 'u-chat-waiting';
  writeState(DIR, uid, sampleState({ workouts: [{ ...sampleState().workouts[0], d: daysAgo(3) }] }));
  jobs.enqueue(uid, { kind: 'review' });
  const first = await settle(uid);
  assert.equal(first.pending?.kind, 'review');
  jobs.enqueue(uid, { kind: 'chat', message: 'Why one more set?' });
  const s = await settle(uid);
  assert.equal(s.pending?.id, first.pending.id, 'still the same proposal');
  assert.equal(lastOutcome(uid).outcome, 'nochange');
  assert.match(lastOutcome(uid).reading, /a waiting review \(1 changes\)/);
});

test('a review that finds nothing to change still clears the proposal waiting', async () => {
  const uid = 'u-review-supersedes';
  writeState(DIR, uid, sampleState({ workouts: [{ ...sampleState().workouts[0], d: daysAgo(3) }] }));
  jobs.enqueue(uid, { kind: 'review' });
  assert.ok((await settle(uid)).pending);
  writeState(DIR, uid, sampleState({ workouts: [] }));
  jobs.enqueue(uid, { kind: 'review' });
  const s = await settle(uid);
  assert.equal(lastOutcome(uid).outcome, 'nochange');
  assert.equal(s.pending, null);
});

test('a chat may search the web like the other consultations', () => {
  assert.ok(jobs.webOptionsFor({ webSearch: true, provider: 'claude' }, 'chat').web);
  assert.deepEqual(jobs.webOptionsFor({ webSearch: false, provider: 'claude' }, 'chat'), {});
});

test('end to end: a question gets an answer in the chat, with its sources', async () => {
  const uid = 'u-chat-answer';
  const chat = [
    { id: 'a', at: 1, role: 'user', kind: 'text', text: 'Hi' },
    { id: 'b', at: 2, role: 'coach', kind: 'nochange', text: 'Hi! What would you like to know?' },
  ];
  writeState(DIR, uid, sampleState({ coach: { ...sampleState().coach, chat } }));
  jobs.enqueue(uid, { kind: 'chat', message: 'How much protein should I eat?' });
  const s = await settle(uid);
  const last = lastOutcome(uid);
  assert.equal(last.kind, 'chat');
  assert.equal(last.outcome, 'nochange');
  assert.match(last.reading, /How much protein should I eat\?/);
  assert.match(last.reading, /I can see 2 earlier lines/);
  assert.match(last.reading, /https:\/\/example\.org\/protein/);
  assert.doesNotMatch(last.reading, /javascript:/);
  assert.equal(s.pending, null, 'an answer applies nothing');
});

test('end to end: a request to change the plan comes back as a proposal', async () => {
  const uid = 'u-chat-changes';
  writeState(DIR, uid, sampleState());
  jobs.enqueue(uid, { kind: 'chat', message: 'Please add a set to my first exercise' });
  const s = await settle(uid);
  assert.ok(s.pending, 'a proposal waits for the person');
  assert.equal(s.pending.kind, 'review', 'shown, applied and kept as a review\'s');
  assert.equal(s.pending.changes.length, 1);
  assert.deepEqual([s.pending.changes[0].type, s.pending.changes[0].after], ['sets', 4]);
  assert.equal(lastOutcome(uid).kind, 'chat');
});

test('end to end: an unclear message gets a question back', async () => {
  const uid = 'u-chat-clarify';
  writeState(DIR, uid, sampleState());
  jobs.enqueue(uid, { kind: 'chat', message: 'change it' });
  await settle(uid);
  const last = lastOutcome(uid);
  assert.equal(last.outcome, 'nochange');
  assert.match(last.reading, /\?$/);
});

test('POST /api/coach/chat queues a chat job with the message, clipped', async () => {
  const uid = 'u-chat-route';
  writeState(DIR, uid, sampleState());
  const routes = coachRoutes({
    json: (res, status, body) => { res.status = status; res.body = body; },
    readBody: async req => req.body || {},
    readSession: () => ({ id: uid }),
    requireAdmin: () => false,
  });
  const res = {};
  await routes['POST /api/coach/chat']({ body: { message: 'How much protein? ' + 'z'.repeat(9000), lang: 'ru' } }, res);
  assert.equal(res.status, 202, JSON.stringify(res.body));
  assert.ok(res.body.job?.id);
  await settle(uid);
  assert.equal(lastOutcome(uid).kind, 'chat');
  assert.match(lastOutcome(uid).reading, /You asked \(1000 characters\): "How much protein\? z/, 'clipped to the admin\'s message length');
  const empty = {};
  await routes['POST /api/coach/chat']({ body: { message: '   ' } }, empty);
  assert.equal(empty.status, 400);
});
