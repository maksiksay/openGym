/* What the Coach is given so it cannot get the day, the names or an untrained plan wrong
 * (docs/dev/COACH_QUALITY.md): the app's own date and the weekday, what is planned today and in the
 * next days, the plan's weekly volume per muscle, and the app's exercise names. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, sampleState } from './helpers.mjs';

tempData();
const payload = await import('../coach/core/payload.js');
const { LIB_BY_ID } = await import('../coach/core/library.js');
const { handleFor } = await import('../coach/handle.js');

const handle = handleFor('uid-quality');
const utc = () => new Date().toISOString().slice(0, 10);
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekdayOf = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const BENCH = '0025', LATERAL = '0334', ROW = '0027';
const twoDays = (over = {}) => sampleState({
  routines: [
    { id: 'up', name: 'Верх', ex: [{ id: BENCH, sets: 4, reps: 8, mode: 'reps' }, { id: LATERAL, sets: 3, reps: 15, mode: 'reps' }] },
    { id: 'back', name: 'Спина', ex: [{ id: ROW, sets: 3, reps: 10, mode: 'reps' }] }
  ],
  week: { 2: ['up'], 5: ['up', 'back'] },
  dayPlan: {},
  ...over
});

test('the app\'s own date is today when it is within a day of the server\'s', () => {
  const S = sampleState();
  for (const d of [utc(), plus(utc(), 1), plus(utc(), -1)]) {
    assert.equal(payload.build(S, { handle, kind: 'chat', message: 'hi', today: d }).meta.today, d);
  }
  for (const bad of [plus(utc(), 3), '2026-02-31', 'tomorrow', 20261007, null]) {
    assert.equal(payload.build(S, { handle, kind: 'chat', message: 'hi', today: bad }).meta.today, utc(), String(bad));
  }
});

test('the weekday is given, as a number from Sunday and as a name', () => {
  const today = plus(utc(), 1);
  const p = payload.build(sampleState(), { handle, kind: 'review', today });
  assert.equal(p.meta.weekday, weekdayOf(today));
  assert.equal(p.meta.weekdayName, NAMES[weekdayOf(today)]);
});

test('the schedule says what is planned today and in the six days after it', () => {
  const today = utc();
  const p = payload.build(twoDays(), { handle, kind: 'chat', message: 'что сегодня?', today });
  assert.equal(p.schedule.weekly, true);
  assert.equal(p.schedule.upcoming.length, 7);
  p.schedule.upcoming.forEach((day, i) => {
    assert.equal(day.date, plus(today, i));
    assert.equal(day.weekday, weekdayOf(day.date));
    const want = day.weekday === 2 ? ['up'] : day.weekday === 5 ? ['up', 'back'] : [];
    assert.deepEqual(day.routines.map(r => r.id), want, day.date);
  });
  assert.deepEqual(p.schedule.today, p.schedule.upcoming[0].routines);
  const tue = p.schedule.upcoming.find(d => d.weekday === 2);
  assert.deepEqual(tue.routines, [{ id: 'up', name: 'Верх' }]);
});

test('a day\'s own choice wins over the weekly plan, a rest day included', () => {
  const today = utc();
  const S = twoDays({ dayPlan: { [today]: 'rest', [plus(today, 1)]: 'back' } });
  const p = payload.build(S, { handle, kind: 'chat', message: 'что сегодня?', today });
  assert.deepEqual(p.schedule.today, []);
  assert.deepEqual(p.schedule.upcoming[1].routines.map(r => r.id), ['back']);
});

test('a legacy weekday holding one id, and a plan with no weekly schedule, both read right', () => {
  const today = utc();
  const legacy = payload.build(twoDays({ week: { 1: 'back' } }), { handle, kind: 'chat', message: 'x', today });
  legacy.schedule.upcoming.forEach(d => assert.deepEqual(d.routines.map(r => r.id), d.weekday === 1 ? ['back'] : []));
  const none = payload.build(twoDays({ week: {} }), { handle, kind: 'chat', message: 'x', today });
  assert.equal(none.schedule.weekly, false);
  assert.deepEqual(none.schedule.today, []);
});

test('the plan\'s weekly volume per muscle, from the weekly schedule', () => {
  const p = payload.build(twoDays(), { handle, kind: 'review', today: utc() });
  assert.equal(p.volume.basis, 'week');
  const of = m => p.volume.muscles.find(x => x.muscle === m);
  const pecs = LIB_BY_ID.get(BENCH).tg, delts = LIB_BY_ID.get(LATERAL).tg, back = LIB_BY_ID.get(ROW).tg;
  assert.deepEqual([of(pecs).sets, of(pecs).days], [8, 2]);
  assert.deepEqual([of(delts).sets, of(delts).days], [6, 2]);
  assert.deepEqual([of(back).sets, of(back).days], [3, 1]);
  assert.deepEqual(of(pecs).exercises, [LIB_BY_ID.get(BENCH).n]);
  // the major groups are always there, a zero included
  for (const m of ['pectorals', 'lats', 'upper back', 'delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs']) {
    assert.ok(of(m), m);
  }
  assert.deepEqual([of('quads').sets, of('quads').days, of('quads').exercises], [0, 0, []]);
});

test('with no weekly schedule the volume counts one round of the routines', () => {
  const p = payload.build(twoDays({ week: {} }), { handle, kind: 'review', today: utc() });
  assert.equal(p.volume.basis, 'rotation');
  assert.equal(p.volume.muscles.find(x => x.muscle === LIB_BY_ID.get(BENCH).tg).sets, 4);
});

test('the app\'s exercise names are written in wherever the payload names an exercise', () => {
  const names = { [BENCH]: 'жим штанги лёжа', [LATERAL]: 'махи гантелями в стороны', '0001': 'скручивания' };
  const S = twoDays({
    customEx: [{ id: 'c1', n: 'Мой тренажёр', bp: 'chest' }],
    workouts: [{ id: 'w1', d: plus(utc(), -2), name: 'Верх', entries: [{ id: BENCH, target: { sets: 4, reps: 8, weight: 60 }, sets: [{ w: 60, r: 8, done: true }] }] }]
  });
  const english = LIB_BY_ID.get(BENCH).n;
  const p = payload.build(S, { handle, kind: 'review', today: utc(), names });
  assert.equal(p.plan.routines[0].ex[0].name, 'жим штанги лёжа');
  assert.equal(p.window.workouts[0].entries[0].name, 'жим штанги лёжа');
  assert.equal(p.aggregates.exercises.find(e => e.id === BENCH).name, 'жим штанги лёжа');
  assert.equal(p.library.find(e => e.id === BENCH).n, 'жим штанги лёжа');
  assert.equal(p.library.find(e => e.id === 'c1').n, 'Мой тренажёр');
  assert.deepEqual(p.volume.muscles.find(x => x.muscle === LIB_BY_ID.get(BENCH).tg).exercises, ['жим штанги лёжа']);
  // the shared catalogue itself is untouched
  assert.equal(LIB_BY_ID.get(BENCH).n, english);
  const plain = payload.build(S, { handle, kind: 'review', today: utc() });
  assert.equal(plain.plan.routines[0].ex[0].name, english);
  assert.equal(plain.library.find(e => e.id === BENCH).n, english);
});

test('a debrief\'s session and the ones before it get the names too', () => {
  const names = { [BENCH]: 'жим штанги лёжа' };
  const w = d => ({ id: 'w' + d, d, name: 'Верх', entries: [{ id: BENCH, target: { sets: 1, reps: 8 }, sets: [{ w: 60, r: 8, done: true }] }] });
  const S = twoDays({ workouts: [w(plus(utc(), -9)), w(plus(utc(), -2))] });
  const p = payload.build(S, { handle, kind: 'debrief', workoutId: 'w' + plus(utc(), -2), today: utc(), names });
  assert.equal(p.session.entries[0].name, 'жим штанги лёжа');
  assert.equal(p.previous[0].entries[0].name, 'жим штанги лёжа');
});

test('a name from outside is cut like any other, and only strings count', () => {
  const long = 'ж'.repeat(500);
  const p = payload.build(twoDays(), { handle, kind: 'review', today: utc(), names: { [BENCH]: long, [LATERAL]: 42 } });
  assert.ok(p.plan.routines[0].ex[0].name.length <= 80);
  assert.equal(p.plan.routines[0].ex[1].name, LIB_BY_ID.get(LATERAL).n);
});
