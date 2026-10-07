// Strength levels (docs/dev/STRENGTH_LEVELS.md): where a lift stands against the standards for the
// lifter's sex and body weight, from beginner to elite. Pure; the numbers are read from the log, the
// standards from lib/strength-standards.js.
import { STANDARDS } from './strength-standards.js'
import { entriesForExercise, metricRowsForEntry, workoutDay } from './history.js'
import { bestSetOf } from './onerm.js'
import { isAssisted } from './exercises.js'
import { isSideSet, isWarmupRow } from './workout-model.js'
import { todayISO } from './format.js'

export const LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite']
/** How many lifters each level is stronger than, in per cent. */
export const LEVEL_PCT = [5, 20, 50, 80, 95]
/** How far back a level reads: twelve weeks, so it says how strong someone is now. */
export const LEVEL_WINDOW_DAYS = 84
export const LB_TO_KG = 0.45359237

const list = v => (Array.isArray(v) ? v : [])
const BY_ID = new Map(Object.entries(STANDARDS).flatMap(([lift, s]) => s.ids.map(id => [id, lift])))
const daysBefore = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

/** The standard an exercise is measured against, or null. An assisted exercise has none. */
export function standardOf(exId) {
  const lift = BY_ID.get(String(exId)) || null
  return lift && !isAssisted({ id: String(exId) }) ? lift : null
}
export const isRepsLift = lift => STANDARDS[lift]?.unit === 'reps'

/** A lift's five thresholds for `sex` ('male' or 'female') at a body weight in kilograms. */
export function thresholdsFor(lift, sex, bwKg) {
  const s = STANDARDS[lift]
  if (!s || !(bwKg > 0)) return null
  const p = sex === 'female' ? s.F : s.M
  return p.t.map((t, i) => t * Math.pow(bwKg / p.ref, p.b[i]))
}

/**
 * Where `value` stands among `thresholds`: the level (−1 below the first, 0 to 4), the next
 * threshold and what is left to it, and how far it has come from the last one (0 to 1).
 */
export function levelOf(value, thresholds) {
  if (!(value > 0) || !Array.isArray(thresholds)) return null
  let level = -1
  thresholds.forEach((t, i) => { if (value >= t) level = i })
  const next = level + 1 < thresholds.length ? thresholds[level + 1] : null
  const from = level >= 0 ? thresholds[level] : 0
  return {
    level,
    next,
    toNext: next == null ? 0 : next - value,
    toward: next == null ? 1 : Math.max(0, Math.min(1, (value - from) / (next - from)))
  }
}

/** The body weight on a day, in the profile's unit and in kg: the last weigh-in on or before it,
 *  else the first one after. Null without any. */
export function bodyweightOn(S, iso = todayISO()) {
  const ws = list(S?.bodyweight).filter(b => b && Number(b.w) > 0 && typeof b.d === 'string').sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  if (!ws.length) return null
  const hit = ws.filter(b => b.d <= iso).at(-1) || ws[0]
  const w = Number(hit.w)
  return { w, d: hit.d, kg: S?.unit === 'lb' ? w * LB_TO_KG : w }
}

/** What one workout says of a lift: the best estimated max of a loaded one, or the most reps in a
 *  set of a repetition one. In the profile's unit. */
function workoutMeasure(workout, exId, lift) {
  let best = null
  for (const entry of entriesForExercise(workout, exId)) {
    if (isRepsLift(lift)) {
      for (const s of metricRowsForEntry(entry, 'reps')) {
        if (!s || isWarmupRow(s) || isSideSet(s) || s.done !== true) continue
        const r = Math.round(Number(s.r) || 0)
        if (r > 0 && (!best || r > best.value)) best = { kind: 'reps', value: r, r, w: Number(s.w) || 0 }
      }
    } else {
      const b = bestSetOf(entry)
      if (b && b.est > 0 && (!best || b.est > best.value)) best = { kind: 'e1rm', value: Math.round(b.est * 10) / 10, w: b.w, r: b.r }
    }
  }
  return best
}

/**
 * A measure's level on a day: a loaded lift's estimated max (`e1rm`) or a repetition lift's reps,
 * held against the thresholds for the profile's sex and its body weight that day. The thresholds
 * come back in the profile's unit, so they read beside the measure. Null without a standard, a
 * weigh-in or a measure of the right kind.
 */
export function measureLevel(S, exId, measure, iso = todayISO()) {
  const lift = standardOf(exId)
  if (!lift || !measure) return null
  const reps = isRepsLift(lift)
  if (measure.kind !== (reps ? 'reps' : 'e1rm')) return null
  const bw = bodyweightOn(S, iso)
  if (!bw) return null
  const sex = S?.body === 'female' ? 'female' : 'male'
  const kg = thresholdsFor(lift, sex, bw.kg)
  const thresholds = reps || S?.unit !== 'lb' ? kg : kg.map(x => x / LB_TO_KG)
  const at = levelOf(measure.value, thresholds)
  if (!at) return null
  return { exId: String(exId), lift, reps, perHand: !!STANDARDS[lift].perHand, sex, bw, measure, date: iso, thresholds, ...at }
}

/** An exercise's level now: its best measure in the window, on the day it was made. */
export function exerciseLevel(S, exId, { iso = todayISO(), days = LEVEL_WINDOW_DAYS } = {}) {
  const lift = standardOf(exId)
  if (!lift) return null
  const from = daysBefore(iso, days)
  let best = null, at = null
  for (const w of list(S?.workouts)) {
    const d = workoutDay(w)
    if (!d || d < from || d > iso) continue
    const m = workoutMeasure(w, exId, lift)
    if (m && (!best || m.value > best.value)) { best = m; at = d }
  }
  return best ? measureLevel(S, exId, best, at) : null
}

/** Every lift with a standard trained in the window, the highest level first. */
export function strengthLevels(S, opts = {}) {
  const ids = new Set()
  for (const w of list(S?.workouts)) for (const e of list(w?.entries)) if (e?.id != null && standardOf(e.id)) ids.add(String(e.id))
  return [...ids].map(id => exerciseLevel(S, id, opts)).filter(Boolean)
    .sort((a, b) => b.level - a.level || b.toward - a.toward)
}
