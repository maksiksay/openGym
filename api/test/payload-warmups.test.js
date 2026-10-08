/* Warm-ups and recovery (docs/dev/WARMUPS.md): the Coach reads training only. A session of
   warm-up or recovery work alone is no session for it, and a warm-up run before a workout leaves
   it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, sampleState } from './helpers.mjs';

tempData();
const payload = await import('../coach/core/payload.js');

test('a review reads the training and none of the warm-up or recovery work', () => {
  const base = sampleState();
  const training = base.workouts[0];
  const S = sampleState({
    workouts: [
      { ...training, entries: [{ id: '3021', target: { sets: 1, reps: 12 }, sets: [{ w: 0, r: 12, done: true }], mobility: true, noProg: true, rid: 'w' }, ...training.entries] },
      { id: 'rec', d: '2026-07-21', name: 'Recovery', start: 2000, end: 2000 + 15 * 60000, mobility: true, prs: [],
        entries: [{ id: '1511', target: { sets: 2, sec: 40 }, sets: [{ sec: 40, done: true }], mobility: true, noProg: true }] },
    ]
  });
  const p = payload.build(S, { handle: 'h'.repeat(16), kind: 'review' });
  assert.equal(p.window.workouts.length, 1);
  assert.deepEqual(p.window.workouts[0].entries.map(e => e.id), ['0001']);
  assert.ok(!JSON.stringify(p).includes('"3021"'));
  assert.ok(!JSON.stringify(p).includes('"1511"'));
});

test('a state with no warm-ups is read exactly as before', () => {
  const S = sampleState();
  assert.deepEqual(payload.build(S, { handle: 'h'.repeat(16), kind: 'review' }).window, payload.build(sampleState(), { handle: 'h'.repeat(16), kind: 'review' }).window);
});
