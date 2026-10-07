/* The health category: what of the daily log and the food reaches a payload, and when. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, sampleState } from './helpers.mjs';

tempData();
const payload = await import('../coach/core/payload.js');
const { DATA_CATEGORIES } = await import('../coach/core/categories.js');

const consent2 = { consent: { agreedAt: new Date().toISOString(), version: 2 }, profile: { goal: 'muscle', daysPerWeek: 3, equipment: ['dumbbell'] } };
const withHealth = (over = {}) => sampleState({
  coach: consent2,
  health: [
    { d: '2026-07-19', t: 1, sleep: 5.5, sq: 2, energy: 2, stress: 4, steps: 4000, note: 'fight with landlord', waist: 82.123 },
    { d: '2026-07-20', t: 2, sleep: 8, energy: 5 },
    { d: '2026-01-01', t: 3, sleep: 7 },
  ],
  meals: [
    { id: 'm1', d: '2026-07-19', t: 1, slot: 'l', name: 'secret pizza', g: 300, kcal: 750, p: 30, f: 27, c: 96 },
    { id: 'm2', d: '2026-07-19', t: 2, slot: 'd', name: 'salad', g: 200, kcal: 160, p: 2, f: 14, c: 8 },
  ],
  nutri: { on: true, paused: false, goals: { kcal: 2600, p: 145, f: 75, c: 330 } },
  ...over,
});

test('health is a named category the consent screen lists', () => {
  assert.ok(DATA_CATEGORIES.includes('health'));
});

test('a debrief carries the week before the session: daily numbers and food totals, never names or notes', () => {
  const p = payload.build(withHealth(), { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.deepEqual(p.health.days, [
    { d: '2026-07-19', sleep: 5.5, sq: 2, energy: 2, stress: 4, steps: 4000 },
    { d: '2026-07-20', sleep: 8, energy: 5 },
  ]);
  assert.deepEqual(p.health.food, [{ d: '2026-07-19', kcal: 910, p: 32, f: 41, c: 104 }]);
  assert.deepEqual(p.health.goals, { kcal: 2600, p: 145, f: 75, c: 330 });
  assert.equal(p.health.foodTracking, 'on');
  const text = JSON.stringify(p);
  for (const leak of ['pizza', 'salad', 'landlord', '82.123']) assert.ok(!text.includes(leak), leak);
});

test('nothing health-related without the second consent, or with the module off', () => {
  const v1 = payload.build(withHealth({ coach: { ...consent2, consent: { ...consent2.consent, version: 1 } } }), { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.equal('health' in v1, false);
  const off = payload.build(withHealth({ healthOn: false }), { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.equal('health' in off, false);
});

test('a review reads the window, capped at twelve weeks', () => {
  const p = payload.build(withHealth(), { handle: 'h'.repeat(16), kind: 'review' });
  assert.ok(p.health);
  assert.ok(p.health.days.every(d => d.d >= p.health.from));
  assert.ok(!p.health.days.some(d => d.d === '2026-01-01'));
});

test('junk in the log is bounded, not passed through', () => {
  const S = withHealth({ health: [{ d: '2026-07-20', sleep: 99, energy: 7, steps: -5, sq: 'x' }, { d: 'nope', sleep: 7 }], meals: [] });
  const p = payload.build(S, { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.equal('health' in p, false);
});

test('a paused tracker says so', () => {
  const p = payload.build(withHealth({ nutri: { on: true, paused: true, goals: null } }), { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.equal(p.health.foodTracking, 'paused');
  assert.equal(p.health.goals, null);
});

test('with tracking off or paused, no food and no goals leave — only the check-ins', () => {
  for (const nutri of [{ on: false, goals: { kcal: 2600 } }, { on: true, paused: true, goals: { kcal: 2600 } }]) {
    const p = payload.build(withHealth({ nutri }), { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
    assert.deepEqual(p.health.food, []);
    assert.equal(p.health.goals, null);
    assert.ok(p.health.days.length > 0);
  }
});

test('today\'s food is left out: the day is not over', () => {
  const today = new Date().toISOString().slice(0, 10);
  const S = withHealth({
    workouts: [{ id: 'w2', d: today, name: 'Full body A', entries: [] }],
    meals: [{ id: 'x', d: today, t: 1, kcal: 500, p: 20, f: 10, c: 60 }],
    health: [{ d: today, t: 1, sleep: 7 }],
  });
  const p = payload.build(S, { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w2' });
  assert.deepEqual(p.health.food, []);
  assert.equal(p.health.days[0].sleep, 7);
});

// docs/dev/COACH_ASSISTANT.md: water, sugar and fibre, and the targets, with the fourth consent only.
test('with the fourth consent: the day\'s water, sugar and fibre on full days, and the targets', () => {
  const consent4 = { ...consent2, consent: { ...consent2.consent, version: 4 } };
  const S = withHealth({
    coach: consent4,
    health: [
      { d: '2026-07-19', t: 1, sleep: 5.5, water: 1000 },
      { d: '2026-07-20', t: 2, energy: 5 },
    ],
    meals: [
      { id: 'm1', d: '2026-07-19', t: 1, slot: 'b', name: 'secret kefir', g: 250, kcal: 100, p: 7, f: 2, c: 10, sug: 10, fib: 0, drink: true },
      { id: 'm2', d: '2026-07-19', t: 2, slot: 'l', name: 'oats', g: 80, kcal: 293, p: 10, f: 5, c: 49, sug: 1, fib: 8 },
      { id: 'm3', d: '2026-07-18', t: 3, slot: 'l', name: 'orange juice', g: 300, kcal: 135, p: 2, f: 0, c: 31, sug: 25, drink: true },
      { id: 'm4', d: '2026-07-18', t: 4, slot: 'd', name: 'business lunch', g: 0, kcal: 700, p: 30, f: 30, c: 70 },
    ],
    nutri: { on: true, paused: false, goals: { kcal: 2600, p: 145, f: 75, c: 330 }, fibGoal: 35 },
    stepsGoal: 9000,
  });
  const p = payload.build(S, { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.deepEqual(p.health.days, [
    { d: '2026-07-18', water: 300 },                          // only juice that day: water, nothing else
    { d: '2026-07-19', sleep: 5.5, water: 1250 },             // the buttons and the kefir
    { d: '2026-07-20', energy: 5 },
  ]);
  assert.deepEqual(p.health.food, [
    { d: '2026-07-18', kcal: 835, p: 32, f: 30, c: 101 },     // a quick entry without them: no sugar or fibre for the day
    { d: '2026-07-19', kcal: 393, p: 17, f: 7, c: 59, sug: 11, fib: 8 },
  ]);
  assert.deepEqual(p.health.targets, { steps: 9000, water: 2000, fib: 35 });
  for (const leak of ['kefir', 'juice', 'lunch']) assert.ok(!JSON.stringify(p).includes(leak), leak);
});

test('before the fourth consent, none of them leave', () => {
  const consent3 = { ...consent2, consent: { ...consent2.consent, version: 3 } };
  const S = withHealth({ coach: consent3, health: [{ d: '2026-07-19', t: 1, sleep: 7, water: 1000 }],
    meals: [{ id: 'm1', d: '2026-07-19', t: 1, slot: 'b', name: 'oats', g: 80, kcal: 293, p: 10, f: 5, c: 49, sug: 1, fib: 8, drink: false }] });
  const p = payload.build(S, { handle: 'h'.repeat(16), kind: 'debrief', workoutId: 'w1' });
  assert.deepEqual(p.health.days, [{ d: '2026-07-19', sleep: 7 }]);
  assert.deepEqual(p.health.food, [{ d: '2026-07-19', kcal: 293, p: 10, f: 5, c: 49 }]);
  assert.equal('targets' in p.health, false);
});
