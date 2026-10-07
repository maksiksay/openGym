/* Steps and sleep from Apple Health (docs/dev/HEALTH_IMPORT.md).
 *
 * A Shortcuts automation on the phone sends yesterday's steps and last night's sleep every morning,
 * with a personal import key in its Authorization header. The key can do that one thing and nothing
 * else: it reads nothing and is never a session. Like a device link's code it is random and kept
 * only as a SHA-256, so a copy of db.json holds no key that works; one per profile, a new one
 * replacing the old.
 *
 * Pure bookkeeping on `db.importKeys`, and the import itself on a state object; the routes, the
 * throttle, the audit and the write are server.js's. */
import crypto from 'node:crypto';

export const IMPORT_KEY_PREFIX = 'ogh_';
const KEY_MAX = 100;
// How far the phone's "today" may be from the server's, either way: a time zone and a late run
// fit inside two days; a mistyped year writing a day nobody will ever look at does not.
export const TODAY_SLACK_DAYS = 2;
export const BACKFILL_MAX_DAYS = 14;
export const BACKFILL_WINDOW_DAYS = 60;

export const makeImportKey = () => IMPORT_KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
export const hashImportKey = key => crypto.createHash('sha256').update('opengym-health-import:' + String(key || '').trim()).digest('hex');

const keys = db => (Array.isArray(db.importKeys) ? db.importKeys : (db.importKeys = []));

/** A new key for the profile, replacing its old one. → { key }; the key is returned once, never stored. */
export function createImportKey(db, userId, now = Date.now()) {
  const key = makeImportKey();
  db.importKeys = keys(db).filter(k => k && k.userId !== userId);
  db.importKeys.push({ userId, h: hashImportKey(key), created: now, lastUsed: null, last: null });
  return { key };
}

/** The profile's key gone. → whether there was one. */
export function revokeImportKey(db, userId) {
  const before = keys(db).length;
  db.importKeys = keys(db).filter(k => k && k.userId !== userId);
  return db.importKeys.length !== before;
}

/** What the Settings screen may know: whether there is a key, and how it was last used. */
export function importKeyStatus(db, userId) {
  const k = keys(db).find(x => x && x.userId === userId);
  return k ? { exists: true, created: k.created, lastUsed: k.lastUsed || null, last: k.last || null } : { exists: false };
}

/** The profile a key belongs to, or null. */
export function userOfImportKey(db, key) {
  if (typeof key !== 'string' || !key.startsWith(IMPORT_KEY_PREFIX) || key.length > KEY_MAX) return null;
  const h = Buffer.from(hashImportKey(key));
  const rec = keys(db).find(k => k && typeof k.h === 'string' && k.h.length === h.length && crypto.timingSafeEqual(Buffer.from(k.h), h));
  return rec ? rec.userId : null;
}

/** The last import, kept on the key for the Settings screen. */
export function noteImport(db, userId, wrote, now = Date.now()) {
  const k = keys(db).find(x => x && x.userId === userId);
  if (k) { k.lastUsed = now; k.last = wrote.slice(0, BACKFILL_MAX_DAYS); }
}

/* ---------- the import ---------- */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dayNum = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const isoOf = n => new Date(n * 864e5).toISOString().slice(0, 10);
const realDay = iso => typeof iso === 'string' && ISO.test(iso) && isoOf(dayNum(iso)) === iso;

// The health log's own bounds and rounding (frontend/src/lib/health.js cleanField). Outside them is
// refused rather than clamped: 25 hours of sleep is a mistake in the Shortcut, not a short night.
const RANGE = { steps: [0, 200000], sleep: [0, 16] };
// A phone in a Russian locale sends "7,25" and "8 123"; both are numbers.
function number(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim()) return Number(v.trim().replace(/[\s  ]/g, '').replace(',', '.'));
  return NaN;
}
/** One field cleaned: { value } | { error } | null when it was not sent. */
function field(k, v) {
  if (v == null || v === '') return null;
  const n = number(v);
  if (!Number.isFinite(n)) return { error: `${k} must be a number` };
  const [lo, hi] = RANGE[k];
  if (n < lo || n > hi) return { error: `${k} must be between ${lo} and ${hi}` };
  return { value: k === 'sleep' ? Math.round(n * 4) / 4 : Math.round(n) };
}
/** Sleep from `sleep` (hours) or `sleepMinutes`. */
function sleepOf(o) {
  if (o.sleep != null && o.sleep !== '') return field('sleep', o.sleep);
  if (o.sleepMinutes == null || o.sleepMinutes === '') return null;
  const n = number(o.sleepMinutes);
  return Number.isFinite(n) ? field('sleep', n / 60) : { error: 'sleepMinutes must be a number' };
}

/**
 * Write an import into `S.health`. The morning shape is `{ today, steps?, sleep? | sleepMinutes? }`:
 * the steps are yesterday's, and the sleep is the night that ended this morning, which the log
 * files under `today`. `{ days: [{ d, steps?, sleep? }] }` fills several days at once. Each field is
 * set on its day with `t = now`, the clock the log's field-by-field merge goes by, so a check-in made
 * on the phone keeps its own fields. → { ok: true, wrote } | { ok: false, error }.
 */
export function applyHealthImport(S, body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'send a JSON object' };
  const serverDay = dayNum(new Date(now).toISOString().slice(0, 10));
  const writes = [];
  if (Array.isArray(body.days)) {
    if (!body.days.length || body.days.length > BACKFILL_MAX_DAYS) return { ok: false, error: `days must hold 1 to ${BACKFILL_MAX_DAYS} days` };
    for (const [i, day] of body.days.entries()) {
      if (!day || typeof day !== 'object' || !realDay(day.d)) return { ok: false, error: `days[${i}].d must be a date, YYYY-MM-DD` };
      const ago = serverDay - dayNum(day.d);
      if (ago > BACKFILL_WINDOW_DAYS || ago < -1) return { ok: false, error: `days[${i}].d must be within the last ${BACKFILL_WINDOW_DAYS} days` };
      const steps = field('steps', day.steps);
      const sleep = sleepOf(day);
      for (const f of [steps, sleep]) if (f?.error) return { ok: false, error: `days[${i}]: ${f.error}` };
      if (steps) writes.push({ d: day.d, steps: steps.value });
      if (sleep) writes.push({ d: day.d, sleep: sleep.value });
    }
  } else {
    const steps = field('steps', body.steps);
    const sleep = sleepOf(body);
    for (const f of [steps, sleep]) if (f?.error) return { ok: false, error: f.error };
    if (!steps && !sleep) return { ok: false, error: 'nothing to write: send steps, sleep or sleepMinutes, with today' };
    if (!realDay(body.today)) return { ok: false, error: 'today must be the phone\'s date, YYYY-MM-DD' };
    if (Math.abs(dayNum(body.today) - serverDay) > TODAY_SLACK_DAYS) return { ok: false, error: 'today is too far from the server\'s date' };
    if (steps) writes.push({ d: isoOf(dayNum(body.today) - 1), steps: steps.value });
    if (sleep) writes.push({ d: body.today, sleep: sleep.value });
  }
  if (!writes.length) return { ok: false, error: 'nothing to write' };
  if (!Array.isArray(S.health)) S.health = [];
  for (const { d, ...fields } of writes) {
    let e = S.health.find(x => x && x.d === d);
    if (!e) { e = { d }; S.health.push(e); }
    Object.assign(e, fields);
    e.t = now;
  }
  S.health.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { ok: true, wrote: writes };
}
