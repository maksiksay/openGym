/* The season in a Coach payload (docs/dev/SEASONS.md): the week, the test week, the week off, and
   the anchor lifts the model is asked to keep — bounded like everything else that reaches a prompt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleState } from './helpers.mjs';

const payload = await import('../coach/core/payload.js');
const season = (over = {}) => ({ id: 's', n: 1, start: '2026-10-05', weeks: 6, anchors: { squat: '0043', hinge: null, press: '0025', pull: '0017' }, closed: null, ...over });

test('a season in progress: its week, the test week, and its anchors', () => {
  assert.deepEqual(payload.seasonSlice({ seasons: [season()] }, '2026-10-20'), { n: 1, weeks: 6, anchors: ['0043', '0025', '0017'], week: 3, testWeek: false, until: '2026-11-15' });
  assert.equal(payload.seasonSlice({ seasons: [season()] }, '2026-11-09').testWeek, true);
  assert.equal(payload.seasonSlice({ seasons: [season()] }, '2026-11-15').week, 6);
});

test('the week off before a season, and a season past its last day', () => {
  assert.deepEqual(payload.seasonSlice({ seasons: [season({ start: '2026-10-25', n: 2 })] }, '2026-10-20'), { n: 2, weeks: 6, anchors: ['0043', '0025', '0017'], weekOff: true, startsInDays: 5 });
  assert.deepEqual(payload.seasonSlice({ seasons: [season()] }, '2026-11-16'), { n: 1, weeks: 6, anchors: ['0043', '0025', '0017'], over: true });
});

test('no season, a closed one, or a broken one sends nothing; odd fields are bounded', () => {
  assert.equal(payload.seasonSlice({}, '2026-10-20'), null);
  assert.equal(payload.seasonSlice({ seasons: [season({ closed: { at: '2026-11-15', next: 'now' } })] }, '2026-10-20'), null);
  assert.equal(payload.seasonSlice({ seasons: [season({ start: 'soon' })] }, '2026-10-20'), null);
  const odd = payload.seasonSlice({ seasons: [season({ weeks: 99, n: 'x'.repeat(50), anchors: { press: 'y'.repeat(500), pull: { evil: 1 } } })] }, '2026-10-20');
  assert.equal(odd.weeks, 6);
  assert.equal(odd.n, null);
  assert.deepEqual(odd.anchors.map(a => typeof a === 'string' ? a.length : a), [payload.ID_MAX]);
});

test('every payload kind carries the season, and none does without one', () => {
  const S = sampleState({ seasons: [season({ start: new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10) })] });
  for (const kind of ['create', 'review', 'debrief', 'chat']) {
    const p = payload.build(S, { handle: 'h', kind, message: 'x' });
    assert.equal(p.season.week, 2, kind);
  }
  assert.equal('season' in payload.build(sampleState(), { handle: 'h', kind: 'review' }), false);
});
