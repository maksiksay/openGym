/* The daily health log: sleep, how the day feels, steps, waist. Pure functions over S.
 *
 * S.health is one entry per day, the shape of a weigh-in grown a few fields:
 *
 *   { d: 'YYYY-MM-DD', t: <ms of the last edit>,
 *     sleep?: hours (0…16, quarter hours), sq?: 1…5 sleep quality,
 *     energy?: 1…5, stress?: 1…5, steps?: count, waist?: cm, note?: text }
 *
 * Every field is optional — a morning check-in writes sleep and energy, an evening one steps,
 * and a day may only ever get a waist measurement. Two devices filling different fields of the
 * same day keep both (mergeHealth): a phone check-in and the Shortcuts import of the step count
 * should not cost each other their half.
 *
 * `sleep` is the night that ended on the morning of `d`: the check-in is made after waking,
 * and the night belongs to the day it powered. That is also how the Coach reads it next to a
 * workout on `d`.
 */

import { weekKey, isoOf } from './format.js'
import { workoutVolume } from './history.js'

const list = v => (Array.isArray(v) ? v : [])
const fin = v => v != null && v !== '' && Number.isFinite(Number(v))

export const HEALTH_FIELDS = ['sleep', 'sq', 'energy', 'stress', 'steps', 'waist', 'note']
export const SCALE_FIELDS = ['sq', 'energy', 'stress']

// Bounds per field. Out of range is dropped rather than clamped: 25 h of sleep is a typo, and a
// typo stored as 16 would read as data.
const RANGE = { sleep: [0, 16], sq: [1, 5], energy: [1, 5], stress: [1, 5], steps: [0, 200000], waist: [30, 250] }
const NOTE_MAX = 500

/** One field's value cleaned, or undefined when it is not a value worth storing. */
export function cleanField(k, v) {
  if (k === 'note') {
    const s = typeof v === 'string' ? v.trim().slice(0, NOTE_MAX) : ''
    return s || undefined
  }
  if (!RANGE[k] || !fin(v)) return undefined
  const n = Number(v)
  const [lo, hi] = RANGE[k]
  if (n < lo || n > hi) return undefined
  if (k === 'sleep') return Math.round(n * 4) / 4
  if (k === 'waist') return Math.round(n * 10) / 10
  return Math.round(n)
}

/** The entry for a day, or null. */
export const healthOn = (health, d) => list(health).find(e => e && e.d === d) || null

/**
 * Write fields into a day's entry, creating it when needed. A field set to null (or to anything
 * cleanField refuses) is removed. Removing the last field removes the day. Mutates S.health
 * (call it inside store.update) and returns the entry, or null when the day is now empty.
 */
export function setHealth(S, d, patch, now = Date.now()) {
  if (!Array.isArray(S.health)) S.health = []
  let e = S.health.find(x => x && x.d === d)
  if (!e) { e = { d }; S.health.push(e) }
  for (const [k, v] of Object.entries(patch || {})) {
    if (!HEALTH_FIELDS.includes(k)) continue
    const c = cleanField(k, v)
    if (c === undefined) delete e[k]; else e[k] = c
  }
  e.t = now
  if (!HEALTH_FIELDS.some(k => e[k] !== undefined)) {
    S.health = S.health.filter(x => x !== e)
    return null
  }
  S.health.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  return e
}

/**
 * Two copies of the log, one log. Days are united; a day both copies have is merged field by
 * field, the entry edited later supplying every field it has and the other filling the rest.
 * The known limit is the one sync-merge.js names for every list: a field cleared on one device
 * inside the conflict window comes back from the other.
 */
export function mergeHealth(a = [], b = []) {
  const byDay = new Map()
  for (const e of [...list(a), ...list(b)]) {
    if (!e || typeof e !== 'object' || !e.d) continue
    const cur = byDay.get(e.d)
    if (!cur) { byDay.set(e.d, { ...e }); continue }
    const [older, newer] = (Number(e.t) || 0) > (Number(cur.t) || 0) ? [cur, e] : [e, cur]
    const out = { ...older }
    for (const k of Object.keys(newer)) if (newer[k] !== undefined && newer[k] !== null) out[k] = newer[k]
    out.t = Math.max(Number(older.t) || 0, Number(newer.t) || 0)
    byDay.set(e.d, out)
  }
  return [...byDay.values()].sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0))
}

/** The entries between two days (inclusive), oldest first. */
export const healthBetween = (health, from, to) =>
  list(health).filter(e => e?.d && (!from || e.d >= from) && (!to || e.d <= to)).sort((a, b) => (a.d < b.d ? -1 : 1))

/** One field over time, for a chart: [{ t, y, d }] of the days that have it. */
export function healthSeries(health, field, from = null, to = null) {
  return healthBetween(health, from, to)
    .filter(e => fin(e[field]))
    .map(e => ({ t: new Date(e.d + 'T12:00:00').getTime(), y: Number(e[field]), d: e.d }))
}

/** Mean of a field over the entries that have it, or null. */
export function meanOf(entries, field) {
  const xs = list(entries).filter(e => fin(e?.[field])).map(e => Number(e[field]))
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
}

/**
 * The last `days` days up to and including `today`: the mean of each numeric field and how many
 * days had it. What the Home card and the Coach read — a single night says little.
 */
export function recentAverages(health, today, days = 7) {
  const end = new Date(today + 'T12:00:00')
  const start = new Date(end); start.setDate(end.getDate() - (days - 1))
  const from = isoOf(start)
  const rows = healthBetween(health, from, today)
  const out = { from, to: today, days }
  for (const k of ['sleep', 'sq', 'energy', 'stress', 'steps']) {
    const m = meanOf(rows, k)
    out[k] = m == null ? null : Math.round(m * 10) / 10
    out[k + 'N'] = rows.filter(e => fin(e[k])).length
  }
  return out
}

/** Week by week, newest first: the means of sleep, energy, stress and steps. */
export function weeklyHealth(health, ws) {
  const weeks = new Map()
  for (const e of list(health)) {
    if (!e?.d) continue
    const key = weekKey(e.d, ws)
    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key).push(e)
  }
  return [...weeks.keys()].sort().reverse().map(key => {
    const rows = weeks.get(key)
    const out = { key, n: rows.length }
    for (const k of ['sleep', 'sq', 'energy', 'stress', 'steps']) {
      const m = meanOf(rows, k)
      out[k] = m == null ? null : Math.round(m * 10) / 10
    }
    return out
  })
}

/**
 * Sleep the night before each workout next to how the session went — the pairing the person
 * actually wants to see ("do I lift worse after a short night?"). [{ d, sleep, energy, vol }]
 * for every workout day that has a sleep entry.
 */
export function sleepVsTraining(health, workouts) {
  const byDay = new Map(list(health).filter(e => e?.d).map(e => [e.d, e]))
  const out = []
  for (const w of list(workouts)) {
    const h = w?.d && byDay.get(w.d)
    if (!h || !fin(h.sleep)) continue
    const vol = Number.isFinite(w.vol) ? w.vol : workoutVolume(w)
    out.push({ d: w.d, sleep: Number(h.sleep), energy: fin(h.energy) ? Number(h.energy) : null, vol: Math.round(vol) })
  }
  return out
}

/* ---------- the steps goal (docs/dev/HEALTH_IMPORT.md) ---------- */

/** The daily steps goal: the profile's own, or 8,000, the low end of 8,000–10,000 a day. */
export const STEPS_GOAL_DEFAULT = 8000
export const STEPS_GOAL_CHOICES = [5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000]
export const stepsGoalOf = S => (Number.isInteger(S?.stepsGoal) && S.stepsGoal >= 1000 && S.stepsGoal <= 50000 ? S.stepsGoal : STEPS_GOAL_DEFAULT)

/**
 * Steps against the goal, seen on `iso`: yesterday's count (the last whole day, which the morning
 * import brings) and the average of the seven days before `iso` that have a count. A day without
 * one is unknown, not zero, so it is left out of the average.
 */
export function stepsSummary(S, iso) {
  const goal = stepsGoalOf(S)
  const before = n => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - n); return isoOf(d) }
  const counts = []
  for (let i = 1; i <= 7; i++) {
    const e = healthOn(S?.health, before(i))
    if (e && fin(e.steps)) counts.push(Number(e.steps))
  }
  const y = healthOn(S?.health, before(1))
  return {
    goal,
    yesterday: y && fin(y.steps) ? { d: before(1), steps: Number(y.steps), met: Number(y.steps) >= goal } : null,
    avg: counts.length ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : null,
    days: counts.length
  }
}
