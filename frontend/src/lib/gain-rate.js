/* The rate of gain (docs/dev/GAIN_RATE.md): the weight trend of the last weeks held against a
 * corridor for what the person is after, the calorie step when it falls outside, and the food
 * calibration of two or three weeks that ends in a pause. Pure: every function reads S, or changes
 * the draft it is handed, on the day it is given.
 *
 * Only `S.nutri.kcalAt` and `S.nutri.calib` are stored. Everything else is read from the weigh-ins,
 * the waist and the meals already in the log, each time it is needed.
 */
import { todayISO } from './format.js'
import { splitGoals } from './nutrition.js'
import { fitLine } from './trend.js'

export const WINDOW_DAYS = 28        // the weigh-ins a rate is read from
export const MIN_WEIGH_INS = 4       // on different days
export const MIN_SPAN_DAYS = 14      // from the first of them to the last
export const WAIT_DAYS = 14          // after a calorie change, before the next is judged
export const KCAL_PER_KG = 7700
export const STEP_MIN = 100
export const STEP_MAX = 300
/** Per cent of body weight a week. */
export const CORRIDORS = { gain: [0.25, 0.5], keep: [-0.2, 0.2], lose: [-1, -0.5] }
export const CALIB_DAYS = [14, 21]
export const CALIB_MIN_LOGGED = 10   // logged days a maintenance estimate needs
export const CALIB_MIN_SPAN = 10     // the weigh-ins' span inside a calibration's own days
export const BREAKFAST_G_PER_KG = 0.4

const LB_TO_KG = 0.45359237
const KEEP_WITHIN_KG = 0.5
const ISO = /^\d{4}-\d{2}-\d{2}$/
const list = v => (Array.isArray(v) ? v : [])
const isDay = v => typeof v === 'string' && ISO.test(v)
const dayNum = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5) }
export const isoPlus = (iso, n) => new Date((dayNum(iso) + n) * 864e5).toISOString().slice(0, 10)
const toKg = (S, w) => (S?.unit === 'lb' ? w * LB_TO_KG : w)
const weighIns = S => list(S?.bodyweight).filter(b => b && isDay(b.d) && Number(b.w) > 0)
const kcalAtOf = S => (isDay(S?.nutri?.kcalAt) ? S.nutri.kcalAt : null)

/* ---------------------------------- the trend ---------------------------------- */

/**
 * The weigh-ins' trend: least squares through them, one point a day (a day weighed twice counts
 * once, at its mean). By default the last 28 days up to `today`, none before the last calorie
 * change; `range` ({ from, to, minSpan }) reads other days instead.
 *
 * Not enough → { enough: false, n, missing, readyOn }: `missing` weigh-ins short of 4, and with
 * those there, `readyOn` the first day their span could reach the minimum.
 * Enough → { enough: true, n, first, last, mean, now, perWeek, sePerWeek, rate, rateSE }: the slope
 * a week in the profile's unit, its standard error, both again in per cent of the mean weight
 * (`rate`, `rateSE`), and `now` the line's weight on the last weigh-in.
 */
export function weightTrend(S, today = todayISO(), range = null) {
  const to = range?.to || today
  let from = range?.from || isoPlus(to, -(WINDOW_DAYS - 1))
  const kcalAt = kcalAtOf(S)
  if (!range && kcalAt && kcalAt > from) from = kcalAt
  const minSpan = range?.minSpan ?? MIN_SPAN_DAYS
  const byDay = new Map()
  for (const b of weighIns(S)) {
    if (b.d < from || b.d > to) continue
    const e = byDay.get(b.d) || { sum: 0, n: 0 }
    e.sum += Number(b.w); e.n++
    byDay.set(b.d, e)
  }
  const pts = [...byDay].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, e]) => ({ d, x: dayNum(d), y: e.sum / e.n }))
  const n = pts.length
  const base = { from, to, n, first: pts[0]?.d || null, last: pts.at(-1)?.d || null }
  const span = n ? pts.at(-1).x - pts[0].x : 0
  if (n < MIN_WEIGH_INS || span < minSpan) {
    return { ...base, enough: false, missing: Math.max(0, MIN_WEIGH_INS - n), readyOn: n && span < minSpan ? isoPlus(base.first, minSpan) : null }
  }
  const { slope, se, my, at } = fitLine(pts)
  return {
    ...base, enough: true, mean: my, now: at(pts.at(-1).x),
    perWeek: slope * 7, sePerWeek: se * 7, rate: (slope * 7) / my * 100, rateSE: (se * 7) / my * 100,
  }
}

/* ---------------------------------- the corridor ---------------------------------- */

/**
 * What the person is after. A goal weight decides while one is set: gain below it, lose above it,
 * keep within 0.5 kg of it (`now` is the trend's weight, else the last weigh-in). Without one, the
 * Goals sheet's goal; null with neither.
 */
export function directionOf(S, trend = null) {
  const target = Number(S?.targetW)
  const last = weighIns(S).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).at(-1)
  const now = trend?.enough ? trend.now : last ? Number(last.w) : null
  if (target > 0 && now > 0) {
    const gap = toKg(S, target - now)
    return Math.abs(gap) <= KEEP_WITHIN_KG ? 'keep' : gap > 0 ? 'gain' : 'lose'
  }
  const goal = S?.nutri?.body?.goal
  return goal === 'gain' || goal === 'keep' || goal === 'lose' ? goal : null
}

// Outside the corridor only when the whole error band is: a reading inside the noise is no reason
// to change what you eat.
const sideOf = (trend, corridor) =>
  trend.rate + trend.rateSE < corridor[0] ? 'low' : trend.rate - trend.rateSE > corridor[1] ? 'high' : 'in'

/**
 * The calorie change toward the corridor's middle, kcal a day, positive for more food: the gap in
 * kg a week × 7,700 kcal a kg, a seventh of it, rounded to 50 and held between 100 and 300 either
 * way. Coarse on purpose: what a kilo holds depends on what it is made of, and the next reading
 * comes two weeks later anyway.
 */
export function kcalStep(S, trend, corridor) {
  const mid = (corridor[0] + corridor[1]) / 2
  const raw = toKg(S, ((mid - trend.rate) / 100) * trend.mean) * KCAL_PER_KG / 7
  const size = Math.min(STEP_MAX, Math.max(STEP_MIN, Math.round(Math.abs(raw) / 50) * 50))
  return raw < 0 ? -size : size
}

/**
 * The reading Home and the Rate sheet show, by `kind`:
 * - `wait`: the calorie goal changed less than 14 days ago (`since`, `until`);
 * - `data`: too few weigh-ins yet (the trend's `missing` and `readyOn`);
 * - `rate`: a trend with no direction to hold it against;
 * - `in`, `low`, `high`: against the corridor, with `step` for the last two.
 */
export function gainVerdict(S, today = todayISO()) {
  const trend = weightTrend(S, today)
  const direction = directionOf(S, trend)
  const corridor = direction ? CORRIDORS[direction] : null
  const base = { trend, direction, corridor }
  const kcalAt = kcalAtOf(S)
  if (kcalAt && kcalAt <= today && today < isoPlus(kcalAt, WAIT_DAYS)) return { ...base, kind: 'wait', since: kcalAt, until: isoPlus(kcalAt, WAIT_DAYS) }
  if (!trend.enough) return { ...base, kind: 'data' }
  if (!corridor) return { ...base, kind: 'rate' }
  const kind = sideOf(trend, corridor)
  return kind === 'in' ? { ...base, kind } : { ...base, kind, step: kcalStep(S, trend, corridor) }
}

/**
 * A step applied to the calorie goal: the calories, and carbohydrate by the same energy (step ÷ 4
 * g) where it has a goal; protein and fat stay. Stamps `kcalAt`. False with no calorie goal.
 */
export function applyKcalStep(s, step, today = todayISO()) {
  const g = s?.nutri?.goals
  if (!(Number(g?.kcal) > 0) || !Number.isFinite(step) || !step) return false
  const goals = { ...g, kcal: Math.max(0, Math.round(g.kcal + step)) }
  if (Number(g.c) > 0) goals.c = Math.max(0, Math.round(g.c + step / 4))
  s.nutri = { ...s.nutri, goals, kcalAt: today }
  return true
}

/**
 * The calorie goal set to `kcal`: as a step from the one there is, or, with none, new goals split
 * the Goals sheet's way when there is a weight to split by. Stamps `kcalAt`.
 */
export function setKcalGoal(s, kcal, today = todayISO(), weightKg = null) {
  const g = s?.nutri?.goals
  if (Number(g?.kcal) > 0) return g.kcal === kcal ? false : applyKcalStep(s, kcal - g.kcal, today)
  const goals = weightKg > 0 ? splitGoals(kcal, weightKg) : { kcal, p: null, f: null, c: null }
  s.nutri = { ...(s.nutri || {}), goals, kcalAt: today }
  return true
}

/** The waist over a trend's days, first and last measure: { from, to, delta } or null under two. */
export function waistOver(S, from, to) {
  const xs = list(S?.health).filter(e => e && isDay(e.d) && Number.isFinite(e.waist) && e.d >= from && e.d <= to)
    .sort((a, b) => (a.d < b.d ? -1 : 1))
  if (xs.length < 2) return null
  return { from: xs[0].d, to: xs.at(-1).d, delta: Math.round((xs.at(-1).waist - xs[0].waist) * 10) / 10 }
}

/* ---------------------------------- the food calibration ---------------------------------- */

const calibOf = S => {
  const c = S?.nutri?.calib
  return c && isDay(c.from) && CALIB_DAYS.includes(c.days) ? c : null
}
/** A calibration's last day. */
export const calibEnd = c => isoPlus(c.from, c.days - 1)

/** A calibration from `today`, of 14 or 21 days. Tracking resumes if it was paused. */
export function startCalibration(s, days = CALIB_DAYS[0], today = todayISO()) {
  s.nutri = { ...(s.nutri || {}), paused: false, calib: { from: today, days: CALIB_DAYS.includes(days) ? days : CALIB_DAYS[0] } }
}

/** The calibration given up before its end. */
export function dropCalibration(s) {
  if (!s?.nutri?.calib) return
  const { calib, ...rest } = s.nutri
  s.nutri = rest
}

/**
 * Where a calibration stands: { from, days, end, day, over, logged, kcal, p, pb, pPerKg, pbTarget,
 * result }, or null with none.
 * - A logged day has meals in at least two slots: one with only a snack written down would pull
 *   every average down.
 * - `kcal`, `p` and `pb` (breakfast protein) are the means of the logged days, null with none; a
 *   logged day with nothing at breakfast counts as 0 there, which is the point of looking.
 * - `pPerKg` and `pbTarget` (0.4 g/kg) need a weigh-in.
 */
export function calibrationView(S, today = todayISO()) {
  const c = calibOf(S)
  if (!c) return null
  const end = calibEnd(c)
  const upTo = today < end ? today : end
  const byDay = new Map()
  for (const m of list(S?.meals)) {
    if (!m || !isDay(m.d) || m.d < c.from || m.d > upTo) continue
    if (!byDay.has(m.d)) byDay.set(m.d, [])
    byDay.get(m.d).push(m)
  }
  const days = [...byDay.values()].filter(ms => new Set(ms.map(m => m.slot)).size >= 2)
  const sum = (ms, k, slot) => ms.reduce((s, m) => s + (slot && m.slot !== slot ? 0 : Number(m[k]) || 0), 0)
  const mean = f => (days.length ? Math.round(days.reduce((s, ms) => s + f(ms), 0) / days.length) : null)
  const p = mean(ms => sum(ms, 'p'))
  const last = weighIns(S).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).at(-1)
  const kg = last ? toKg(S, Number(last.w)) : null
  return {
    from: c.from, days: c.days, end,
    day: Math.min(c.days, Math.max(1, dayNum(today) - dayNum(c.from) + 1)),
    over: today > end, logged: days.length,
    kcal: mean(ms => sum(ms, 'kcal')), p, pb: mean(ms => sum(ms, 'p', 'b')),
    pPerKg: kg && p != null ? Math.round((p / kg) * 10) / 10 : null,
    pbTarget: kg ? Math.round(BREAKFAST_G_PER_KG * kg) : null,
    result: c.result || null,
  }
}

/** Whether a calibration's last day has gone by and it is still open. */
export function calibrationDue(S, today = todayISO()) {
  const c = calibOf(S)
  return !!c && !c.result && today > calibEnd(c)
}

/** A calibration over: food tracking pauses, and its summary stays in `calib.result`. */
export function endCalibration(s, today = todayISO()) {
  if (!calibrationDue(s, today)) return false
  const v = calibrationView(s, today)
  s.nutri = { ...s.nutri, paused: true, calib: { ...s.nutri.calib, result: { at: today, logged: v.logged, kcal: v.kcal, p: v.p, pb: v.pb } } }
  return true
}

/**
 * What a closed calibration says the calories should be: the logged average, moved by the step
 * rule against the weight trend over its own days. { eaten, rate, direction, corridor, inside,
 * kcal }, or null without 10 logged days, a trend over its days or a direction.
 */
export function maintenanceEstimate(S) {
  const c = calibOf(S)
  const r = c?.result
  if (!r || !(r.logged >= CALIB_MIN_LOGGED) || !(r.kcal > 0)) return null
  const trend = weightTrend(S, null, { from: c.from, to: calibEnd(c), minSpan: CALIB_MIN_SPAN })
  if (!trend.enough) return null
  const direction = directionOf(S, trend)
  const corridor = direction ? CORRIDORS[direction] : null
  if (!corridor) return null
  const inside = sideOf(trend, corridor) === 'in'
  const kcal = inside ? r.kcal : Math.round((r.kcal + kcalStep(S, trend, corridor)) / 50) * 50
  return { eaten: r.kcal, rate: trend.rate, direction, corridor, inside, kcal }
}
