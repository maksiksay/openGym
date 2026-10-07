/* The daily health log: sleep, how the day feels, steps, waist, water. Pure functions over S.
 *
 * S.health is one entry per day, the shape of a weigh-in grown a few fields:
 *
 *   { d: 'YYYY-MM-DD', t: <ms of the last edit>,
 *     sleep?: hours (0…16, quarter hours), sq?: 1…5 sleep quality,
 *     energy?: 1…5, stress?: 1…5, steps?: count, waist?: cm, note?: text,
 *     water?: ml from the water buttons — drinks logged as food are added on reading (waterOn) }
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

export const HEALTH_FIELDS = ['sleep', 'sq', 'energy', 'stress', 'steps', 'waist', 'note', 'water']
export const SCALE_FIELDS = ['sq', 'energy', 'stress']
// What a check-in writes: every field but the water counter, which a tap on a button fills.
export const WELLBEING_FIELDS = HEALTH_FIELDS.filter(k => k !== 'water')
export const WATER_MAX = 10000

// Bounds per field. Out of range is dropped rather than clamped: 25 h of sleep is a typo, and a
// typo stored as 16 would read as data.
const RANGE = { sleep: [0, 16], sq: [1, 5], energy: [1, 5], stress: [1, 5], steps: [0, 200000], waist: [30, 250], water: [0, WATER_MAX] }
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

/** Whether a day's entry holds a check-in — not only water from the buttons, which is no answer
 *  to "how did you sleep?". */
export const hasWellbeing = e => !!e && WELLBEING_FIELDS.some(k => e[k] != null && e[k] !== '')

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

/* ---------- water (docs/dev/WATER.md) ---------- */

/** The daily water goal in ml: the profile's own, or 2 l. */
export const WATER_GOAL_DEFAULT = 2000
export const WATER_GOAL_CHOICES = [1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000]
export const waterGoalOf = S => (Number.isInteger(S?.waterGoal) && S.waterGoal >= 500 && S.waterGoal <= WATER_MAX ? S.waterGoal : WATER_GOAL_DEFAULT)

/** Millilitres of drinks in the food log on a day: a row marked `drink` counts its grams as ml. */
export function drinksOn(meals, d) {
  let ml = 0
  for (const m of list(meals)) if (m && m.d === d && m.drink === true && fin(m.g) && Number(m.g) > 0) ml += Number(m.g)
  return Math.round(ml)
}

/** A day's water in ml: the counter (`taps`), the drinks from the food log (`food`), and both. */
export function waterOn(S, d) {
  const e = healthOn(S?.health, d)
  const taps = e && fin(e.water) ? Number(e.water) : 0
  const food = drinksOn(S?.meals, d)
  return { taps, food, total: taps + food }
}

/**
 * Add `ml` to a day's counter, or take it away with a negative. Never below nothing, and at
 * nothing the field goes: a day without water is unknown, not zero. The food log is never
 * touched. Mutates S.health (call it inside store.update) and returns the counter.
 */
export function addWater(S, d, ml, now = Date.now()) {
  const e = healthOn(S.health, d)
  const cur = e && fin(e.water) ? Number(e.water) : 0
  const next = Math.min(WATER_MAX, Math.max(0, Math.round(cur + (Number(ml) || 0))))
  setHealth(S, d, { water: next > 0 ? next : null }, now)
  return next
}

/** The day's total for a chart, in litres: [{ t, y, d }] of the days that have any water. */
export function waterSeries(S, from = null, to = null) {
  const days = new Set()
  for (const e of list(S?.health)) if (e?.d && fin(e.water) && Number(e.water) > 0) days.add(e.d)
  for (const m of list(S?.meals)) if (m?.d && m.drink === true && Number(m.g) > 0) days.add(m.d)
  return [...days].filter(d => (!from || d >= from) && (!to || d <= to)).sort()
    .map(d => ({ t: new Date(d + 'T12:00:00').getTime(), y: Math.round(waterOn(S, d).total / 10) / 100, d }))
}

/**
 * A day's water against the goal, and the mean of the seven days before it that have any. A day
 * with none is unknown, not zero, so it is left out, as with steps.
 * → { goal, day: { taps, food, total, met }, avg, days }
 */
export function waterSummary(S, iso) {
  const goal = waterGoalOf(S)
  const before = n => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - n); return isoOf(d) }
  const day = waterOn(S, iso)
  const totals = []
  for (let i = 1; i <= 7; i++) {
    const w = waterOn(S, before(i)).total
    if (w > 0) totals.push(w)
  }
  return {
    goal,
    day: { ...day, met: day.total >= goal },
    avg: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
    days: totals.length
  }
}
