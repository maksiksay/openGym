/* A note for the person's own log, read from a chat message (docs/dev/COACH_ASSISTANT.md): a
 * weight, a check-in, water and goals — "slept 6 hours, 72.4 this morning, drank a litre". Nothing
 * in it is written until the person taps Log on the card the app shows; this only checks that what
 * the card would offer is sane. Out of bounds is refused, not clamped: the pipeline's one repair
 * round asks again, the way a meal with a bad item does. There is no field for anything else —
 * deleting, the account, other settings — so no answer can ask for one.
 *
 * Shared by the server and, like the rest of core/, importable by the phone. */

export const LOG_TEXT_MAX = 300;
const DAYS = ['today', 'yesterday'];
// Body weight in the profile's unit (meta.unit).
const WEIGHT = { kg: [20, 300], lb: [44, 660] };
// The health log's own bounds (frontend/src/lib/health.js cleanField).
const CHECKIN = { sleep: [0, 16], sq: [1, 5], energy: [1, 5], stress: [1, 5], steps: [0, 200000] };
const SCALES = ['sq', 'energy', 'stress'];
// Millilitres added to the day's water counter.
const WATER = [1, 5000];
// What the goals may be set to: calories and macros (nutri.goals), fibre (nutri.fibGoal), steps
// (stepsGoal), water in ml (waterGoal) — the bounds each of those settings reads.
const GOALS = { kcal: [800, 6000], p: [0, 500], f: [0, 400], c: [0, 1000], fib: [5, 100], steps: [1000, 50000], water: [500, 10000] };

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v
  : typeof v === 'string' && v.trim() && Number.isFinite(Number(v.trim().replace(',', '.'))) ? Number(v.trim().replace(',', '.')) : null);
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const given = v => v != null && v !== '';
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** Returns { ok: true, log: { text, day, weight?, checkin?, water?, goals? } } | { ok: false, errors }. */
export function validateLog(v, { unit = 'kg' } = {}) {
  if (!isObj(v)) return { ok: false, errors: ['the answer is not an object'] };
  const errors = [];
  const out = {};
  const u = unit === 'lb' ? 'lb' : 'kg';

  if (given(v.weight)) {
    const w = num(v.weight);
    const [lo, hi] = WEIGHT[u];
    if (w == null || w < lo || w > hi) errors.push(`\`weight\` must be the body weight in ${u}, ${lo} to ${hi}`);
    else out.weight = Math.round(w * 10) / 10;
  }

  if (given(v.checkin)) {
    if (!isObj(v.checkin)) errors.push('`checkin` must be an object');
    else {
      const c = {};
      for (const [k, [lo, hi]] of Object.entries(CHECKIN)) {
        if (!given(v.checkin[k])) continue;
        const n = num(v.checkin[k]);
        if (n == null || n < lo || n > hi) errors.push(`\`checkin.${k}\` must be ${lo} to ${hi}`);
        else if (SCALES.includes(k) && !Number.isInteger(n)) errors.push(`\`checkin.${k}\` must be a whole number from 1 to 5`);
        else c[k] = k === 'sleep' ? Math.round(n * 4) / 4 : Math.round(n);
      }
      if (Object.keys(c).length) out.checkin = c;
    }
  }

  if (given(v.water)) {
    const n = num(v.water);
    if (n == null || n < WATER[0] || n > WATER[1]) errors.push(`\`water\` must be the millilitres to add, ${WATER[0]} to ${WATER[1]}`);
    else out.water = Math.round(n);
  }

  if (given(v.goals)) {
    if (!isObj(v.goals)) errors.push('`goals` must be an object');
    else {
      const g = {};
      for (const [k, [lo, hi]] of Object.entries(GOALS)) {
        if (!given(v.goals[k])) continue;
        const n = num(v.goals[k]);
        if (n == null || n < lo || n > hi) errors.push(`\`goals.${k}\` must be ${lo} to ${hi}`);
        else g[k] = Math.round(n);
      }
      if (Object.keys(g).length) out.goals = g;
    }
  }

  if (errors.length) return { ok: false, errors };
  if (!('weight' in out) && !out.checkin && !('water' in out) && !out.goals) {
    return { ok: false, errors: ['a log needs at least one of weight, checkin, water or goals — to say something without logging anything, reply "answer"'] };
  }
  return { ok: true, log: { text: str(v.text, LOG_TEXT_MAX), day: DAYS.includes(v.day) ? v.day : 'today', ...out } };
}
