/* A meal read from the chat (docs/dev/COACH_VOICE_PHOTO.md): what someone ate, item by item,
   checked like a food lookup's values, and handed to the client as a card rather than a
   proposal, so it never takes the place of one that is waiting. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const { validateMeal, MEAL_ITEMS_MAX } = await import('../coach/core/food.js');
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
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const buckwheat = { name: 'Гречка отварная', g: 200, kcal: 110, p: 4.2, f: 1.1, c: 21.3, confidence: 'typical' };
const chicken = { name: 'Куриная грудка', g: 150.4, kcal: 165, p: 31, f: 3.6, c: 0, confidence: 'typical' };

test('a meal is its items as portions with per-100 g values, and its slot and day when given', () => {
  const r = validateMeal({ text: 'Counted as you said.', slot: 'd', day: 'yesterday', items: [buckwheat, chicken] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.meal, {
    text: 'Counted as you said.', slot: 'd', day: 'yesterday',
    items: [
      { name: 'Гречка отварная', g: 200, kcal: 110, p: 4.2, f: 1.1, c: 21.3, confidence: 'typical' },
      { name: 'Куриная грудка', g: 150, kcal: 165, p: 31, f: 3.6, c: 0, confidence: 'typical' },
    ],
  });
});

test('a slot or a day it does not know is dropped, and a confidence it does not know is an estimate', () => {
  const r = validateMeal({ slot: 'brunch', day: 'tomorrow', items: [{ ...buckwheat, confidence: 'sure' }] });
  assert.equal(r.ok, true);
  assert.equal(r.meal.slot, null);
  assert.equal(r.meal.day, 'today');
  assert.equal(r.meal.items[0].confidence, 'estimate');
  assert.equal(r.meal.text, '');
});

test('a meal with nothing in it, or too much, goes back for repair', () => {
  assert.equal(validateMeal({ items: [] }).ok, false);
  assert.equal(validateMeal({}).ok, false);
  assert.equal(validateMeal(null).ok, false);
  const many = Array.from({ length: MEAL_ITEMS_MAX + 1 }, () => buckwheat);
  assert.match(validateMeal({ items: many }).errors[0], /at most 12 items/);
});

test('each item is checked like a label, and the error names the item', () => {
  const r = validateMeal({ items: [buckwheat, { name: '', g: 0, kcal: 50, p: 30, f: 10, c: 5 }, { name: 'Oil', g: 10, kcal: 1200, p: 0, f: 100, c: 0 }] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /^items\[1\]: `name` is required/.test(e)));
  assert.ok(r.errors.some(e => /^items\[1\]: `g` must be the grams eaten/.test(e)));
  assert.ok(r.errors.some(e => /^items\[1\]: kcal 50 does not match the macros/.test(e)));
  assert.ok(r.errors.some(e => /^items\[2\]: `kcal` must be between 0 and 900/.test(e)));
  assert.ok(!r.errors.some(e => e.startsWith('items[0]')));
});

test('the chat hands a meal reply to the meal validator', () => {
  const r = validateChat({ coach_contract: 1, reply: 'meal', text: 'Counted.', items: [buckwheat] }, { routines: [] });
  assert.equal(r.ok, true);
  assert.equal(r.meal.items[0].name, 'Гречка отварная');
  assert.equal(validateChat({ coach_contract: 1, reply: 'meal', items: [] }, { routines: [] }).ok, false);
});

test('end to end: "I ate…" comes back as a meal card, and a waiting review keeps waiting', async () => {
  const uid = 'u-meal';
  writeState(DIR, uid, sampleState({ workouts: [{ ...sampleState().workouts[0], d: daysAgo(3) }] }));
  jobs.enqueue(uid, { kind: 'review' });
  const review = (await settle(uid)).pending;
  assert.equal(review?.kind, 'review');
  jobs.enqueue(uid, { kind: 'chat', message: 'I ate 200 g of buckwheat and a chicken breast for lunch' });
  const s = await settle(uid);
  assert.equal(s.pending?.id, review.id, 'a meal is not a proposal');
  assert.equal(s.last.outcome, 'meal');
  assert.equal(s.last.kind, 'chat');
  assert.equal(s.last.reading, 'Counted as you said; the oil is my guess.');
  assert.deepEqual(s.last.meal.items.map(i => [i.name, i.g]), [['Buckwheat, boiled', 200], ['Chicken breast, cooked', 150], ['Sunflower oil', 10]]);
  assert.equal(s.last.meal.slot, 'l');
});
