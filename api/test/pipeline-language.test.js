/* The one extra round for language (docs/dev/COACH_QUALITY.md): an answer the validator accepted
 * but whose text has a slip a reader would notice goes back once, with the slips named. The second
 * answer is taken only when it is valid, of the same kind and better; otherwise the first stands.
 * It never fails a job, and it never follows the ordinary repair round. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { runPipeline } = await import('../coach/core/pipeline.js');

const payload = (lang = 'ru') => ({ coach_contract: 1, plan: { routines: [], week: {} }, library: [], meta: { lang, unit: 'kg' } });
const answer = text => JSON.stringify({ coach_contract: 1, reply: 'answer', text });
const clean = answer('Сегодня по плану отдых, следующая тренировка в пятницу.');
const slip = answer('Сегодня stoit отдых, следующая тренировка в пятницу.');
const fixed = answer('Сегодня стоит отдых, следующая тренировка в пятницу.');

function stub(answers) {
  const calls = [];
  return {
    calls,
    adapter: { spawns: false, async invoke(req) { calls.push(req); return { code: 0, text: answers[calls.length - 1] }; } }
  };
}
const run = (answers, kind = 'chat', lang = 'ru') => {
  const s = stub(answers);
  return runPipeline({ adapter: s.adapter, cfg: {}, kind, payload: payload(lang) }).then(r => ({ r, calls: s.calls }));
};

test('a clean answer is one call', async () => {
  const { r, calls } = await run([clean]);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.match(r.reading, /по плану отдых/);
  assert.equal(r.raw, undefined);
});

test('a slip gets one more round naming it, and the fixed answer is taken', async () => {
  const { r, calls } = await run([slip, fixed]);
  assert.equal(calls.length, 2);
  assert.match(calls[1].prompt, /LANGUAGE CHECK/);
  assert.match(calls[1].prompt, /«stoit»/);
  assert.match(calls[1].prompt, /Сегодня stoit отдых/);
  assert.doesNotMatch(calls[1].prompt, /REPAIR REQUEST/);
  assert.equal(r.ok, true);
  assert.match(r.reading, /Сегодня стоит отдых/);
  assert.equal(r.raw, undefined);
});

test('a second answer that is invalid, no better or of another kind leaves the first', async () => {
  const invalid = await run([slip, '{"coach_contract":1,"reply":"nope"}']);
  assert.equal(invalid.r.ok, true);
  assert.match(invalid.r.reading, /stoit/);
  const same = await run([slip, slip]);
  assert.match(same.r.reading, /stoit/);
  const meal = JSON.stringify({ coach_contract: 1, reply: 'meal', text: 'Записал', items: [{ name: 'овсянка', g: 60, kcal: 220, p: 8, f: 4, c: 38 }] });
  const other = await run([slip, meal]);
  assert.equal(other.r.ok, true);
  assert.equal(other.r.meal, undefined);
  assert.match(other.r.reading, /stoit/);
  assert.equal(other.calls.length, 2);
});

test('an answer the validator refused goes to the ordinary repair round, and nothing follows it', async () => {
  const { r, calls } = await run(['{"coach_contract":1,"reply":"nope"}', slip]);
  assert.equal(calls.length, 2);
  assert.match(calls[1].prompt, /REPAIR REQUEST/);
  assert.equal(r.ok, true);
  assert.match(r.reading, /stoit/);
});

test('a clean answer in English is one call', async () => {
  const { r, calls } = await run([answer('Today is a rest day; your next session is on Friday.')], 'chat', 'en');
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
});

test('a review whose reading names internal fields is sent back once', async () => {
  const review = reading => JSON.stringify({ coach_contract: 1, nochange: true, reading, changes: [] });
  const { r, calls } = await run([review('В `aggregates` пусто: план ещё не тренировали.'), review('В журнале пока пусто: план ещё не тренировали.')], 'review');
  assert.equal(calls.length, 2);
  assert.match(calls[1].prompt, /«aggregates»/);
  assert.equal(r.nochange, true);
  assert.match(r.reading, /В журнале пока пусто/);
});
