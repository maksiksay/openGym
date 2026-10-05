/* The Coach as a food lookup: "I ate X and nothing in the app knows X" → per-100 g values.
 *
 * A separate, much smaller contract than the plan jobs. Nothing comes back that could change a
 * plan or a log: the answer is a candidate food, shown to the person with how sure the model is,
 * and saved into their own food list only after they have looked at it (sheets-health.jsx).
 * What leaves the server is the query and the language — no training data, no profile.
 *
 * Shared by the server (jobs.foodLookup) and, like the rest of core/, importable by the phone.
 */
import { PROMPTS } from './prompts.js';
import { CONTRACT } from './payload.js';

export const FOOD_QUERY_MAX = 200;
const CONFIDENCE = ['label', 'typical', 'estimate'];

export const FOOD_SCHEMA = {
  type: 'object',
  properties: {
    coach_contract: { type: 'integer' },
    found: { type: 'boolean' },
    name: { type: 'string' },
    brand: { type: 'string' },
    kcal: { type: 'number' },
    p: { type: 'number' },
    f: { type: 'number' },
    c: { type: 'number' },
    srv: { type: 'number' },
    confidence: { type: 'string', enum: CONFIDENCE },
    note: { type: 'string' }
  },
  required: ['found', 'note']
};

/** The query as it may be sent: a single line, trimmed and bounded. */
export const cleanQuery = q => String(q || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FOOD_QUERY_MAX);

/** System and user parts, the split every HTTPS provider takes. */
export function buildFoodPrompt(query, lang = 'en') {
  const payload = { coach_contract: CONTRACT, task: 'food', meta: { lang: String(lang || 'en').slice(0, 16) }, query: cleanQuery(query) };
  return {
    system: PROMPTS.food,
    user: '## Payload\n\n```json\n' + JSON.stringify(payload) + '\n```\n'
  };
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const r1 = n => Math.round(n * 10) / 10;

/**
 * The model's answer, checked. Returns { ok: true, food } | { ok: true, found: false, note }
 * | { ok: false, errors }. Bounds are those of a real label; an energy figure far from what the
 * macros imply is refused rather than shown, because a number the person is asked to trust has
 * to at least be internally consistent.
 */
export function validateFood(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, errors: ['the answer is not an object'] };
  if (v.coach_contract !== undefined && v.coach_contract !== CONTRACT) return { ok: false, errors: [`coach_contract must be ${CONTRACT}`] };
  const note = str(v.note, 300);
  if (v.found === false) return { ok: true, found: false, note };
  if (v.found !== true) return { ok: false, errors: ['`found` must be true or false'] };
  const errors = [];
  const name = str(v.name, 120);
  if (!name) errors.push('`name` is required');
  const kcal = num(v.kcal), p = num(v.p), f = num(v.f), c = num(v.c);
  for (const [k, x, hi] of [['kcal', kcal, 900], ['p', p, 100], ['f', f, 100], ['c', c, 100]]) {
    if (x == null) errors.push(`\`${k}\` must be a number`);
    else if (x < 0 || x > hi) errors.push(`\`${k}\` must be between 0 and ${hi} per 100 g`);
  }
  if (p != null && f != null && c != null && p + f + c > 100.5) errors.push('protein, fat and carbs add up to more than 100 g per 100 g');
  if (kcal != null && p != null && f != null && c != null) {
    const implied = 4 * p + 9 * f + 4 * c;
    if (Math.abs(kcal - implied) > Math.max(25, implied * 0.25)) errors.push(`kcal ${kcal} does not match the macros (about ${Math.round(implied)})`);
  }
  if (!CONFIDENCE.includes(v.confidence)) errors.push('`confidence` must be label, typical or estimate');
  if (errors.length) return { ok: false, errors };
  const srv = num(v.srv);
  const brand = str(v.brand, 60);
  return {
    ok: true,
    food: {
      name, ...(brand ? { brand } : {}),
      kcal: Math.round(kcal), p: r1(p), f: r1(f), c: r1(c),
      ...(srv && srv > 0 && srv <= 2000 ? { srv: Math.round(srv) } : {}),
      confidence: v.confidence, note
    }
  };
}
