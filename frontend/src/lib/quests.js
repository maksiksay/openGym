/* Quests (docs/dev/QUESTS.md): a goal pinned on a lift, the bar from where it started, a forecast
 * from the last weeks' trend, and suggestions read from the plan. Pure.
 *
 * Only the quests themselves are stored, in S.quests: `{ id, kind, exId, from, base, …target }`.
 * Whether one is done, and by which workout, is read from the log every time it is needed, the way
 * a win is (lib/scoreboard.js): an edited or deleted session can never leave a quest done that the
 * history no longer supports.
 */
import { todayISO, uid } from './format.js'
import { EXIDX, isAssisted, isLoadedEq } from './exercises.js'
import { entriesForExercise, metricRowsForEntry, workoutDay, isBw } from './history.js'
import { bestSetOf, FORMULAS } from './onerm.js'
import { isSideSet, isWarmupRow } from './workout-model.js'
import { standardOf, isRepsLift, thresholdsFor, workoutMeasure, measureLevel, exerciseLevel, bodyweightOn, LEVELS, LB_TO_KG } from './strength-levels.js'
import { workoutKey } from './scoreboard.js'
import { anchorIds, currentSeason } from './season.js'
import { fitLine, dayIndex } from './trend.js'

export const MAX_OPEN = 3
export const FORECAST_DAYS = 56      // the sessions a forecast is read from
export const MIN_SESSIONS = 4
export const MIN_SPAN_DAYS = 21
export const BAR_DAYS = 28           // the bar stands at the best of these
export const MAX_WEEKS = 26
export const REPS_STEPS = [5, 10, 15, 20, 25, 30, 40, 50]
/** Barbell bench, squat and deadlift, and the multiple of body weight each is suggested at. */
export const RATIOS = { '0025': 1, '0043': 1.5, '0032': 2 }
/** After the first strict pull-up, the bodyweight pull-up it leads to. */
export const PULL_UP = '0652'
export const KINDS = ['e1rm', 'set', 'reps', 'level', 'ratio', 'unassisted']

const list = v => (Array.isArray(v) ? v : [])
const ISO = /^\d{4}-\d{2}-\d{2}$/
const isoPlus = (iso, n) => new Date((dayIndex(iso) + n) * 864e5).toISOString().slice(0, 10)
const r1 = v => Math.round(v * 10) / 10
const sexOf = S => (S?.body === 'female' ? 'female' : 'male')
const chronological = ws => list(ws).filter(w => workoutDay(w)).slice()
  .sort((a, b) => (workoutDay(a) < workoutDay(b) ? -1 : workoutDay(a) > workoutDay(b) ? 1 : (a.start || 0) - (b.start || 0)))

// A pull-up or chin-up done with body weight alone: what the first strict rep is, logged as its
// own exercise. A scapular pull-up, a dip on the same cage or a leg curl on a pull-up machine is not.
let strict = null
const strictPullIds = () => strict || (strict = new Set(Object.values(EXIDX)
  .filter(e => e?.eq === 'body weight' && /\b(pull-?ups?|chin-?ups?)\b/i.test(e.n || '') && !/scapular|dip|leg curl|pulldown/i.test(e.n || ''))
  .map(e => String(e.id))))
/** Whether an exercise is an assistance machine for pull-ups or chin-ups. */
export const isAssistedPull = id => isAssisted(String(id)) && /\b(pull-?ups?|chin-?ups?)\b/i.test(EXIDX[String(id)]?.n || '')

/* ---------------------------------- measures ---------------------------------- */

// The completed work sets of an exercise in a workout, a per-side row's sides each a set.
function itemsOf(workout, exId) {
  const out = []
  for (const entry of entriesForExercise(workout, exId)) {
    for (const s of metricRowsForEntry(entry, 'reps')) {
      if (!s || isWarmupRow(s)) continue
      const parts = isSideSet(s) ? [s.sides?.L, s.sides?.R].filter(p => p?.done === true) : s.done === true ? [s] : []
      for (const p of parts) {
        const r = Math.round(Number(p.r) || 0)
        if (r > 0) out.push({ w: Number(p.w) || 0, r })
      }
    }
  }
  return out
}

/**
 * What one workout says toward a quest, in its own terms: the best estimated max, the most reps in
 * a set, a level's own measure, or on an assistance machine Epley of body weight less help. Null
 * when the workout did not train it, or an assistance machine has no weigh-in to read it against.
 */
export function questMeasure(S, q, workout) {
  if (q.kind === 'reps') {
    const items = itemsOf(workout, q.exId)
    return items.length ? Math.max(...items.map(i => i.r)) : null
  }
  if (q.kind === 'level') return workoutMeasure(workout, q.exId)?.value ?? null
  if (q.kind === 'unassisted') {
    const bw = bodyweightOn(S, workoutDay(workout))?.w
    if (!(bw > 0)) return null
    let best = null
    for (const i of itemsOf(workout, q.exId)) {
      if (bw - i.w > 0) best = Math.max(best ?? 0, FORMULAS.epley(bw - i.w, i.r))
    }
    return best == null ? null : r1(best)
  }
  let best = null
  for (const e of entriesForExercise(workout, q.exId)) {
    const b = bestSetOf(e)
    if (b && b.est > 0) best = Math.max(best ?? 0, b.est)
  }
  return best
}

/**
 * The number a quest aims at on `iso`, in the measure's terms. A level, a multiple of body weight
 * and the strict rep move with the body weight of the day; without a weigh-in they are null.
 */
export function questTarget(S, q, iso = todayISO()) {
  if (q.kind === 'e1rm') return q.value
  if (q.kind === 'set') return q.r === 1 ? q.w : r1(FORMULAS.epley(q.w, q.r))
  if (q.kind === 'reps') return q.r
  const bw = bodyweightOn(S, iso)
  if (!bw) return null
  if (q.kind === 'ratio') return r1(bw.w * q.ratio)
  if (q.kind === 'unassisted') return r1(FORMULAS.epley(bw.w, 1))
  if (q.kind === 'level') {
    const lift = standardOf(q.exId)
    const th = lift ? thresholdsFor(lift, sexOf(S), bw.kg) : null
    if (!th || th[q.level] == null) return null
    const t = th[q.level]
    return isRepsLift(lift) ? Math.ceil(t) : r1(S?.unit === 'lb' ? t / LB_TO_KG : t)
  }
  return null
}

/** Whether a workout completes a quest. */
function completes(S, q, workout) {
  const d = workoutDay(workout)
  if (q.kind === 'set') return itemsOf(workout, q.exId).some(i => i.w >= q.w && i.r >= q.r)
  if (q.kind === 'unassisted') {
    if (itemsOf(workout, q.exId).some(i => i.w <= 0)) return true
    for (const id of strictPullIds()) if (itemsOf(workout, id).length) return true
    return false
  }
  if (q.kind === 'level') {
    const m = workoutMeasure(workout, q.exId)
    const lv = m ? measureLevel(S, q.exId, m, d) : null
    return !!lv && lv.level >= q.level
  }
  const v = questMeasure(S, q, workout)
  const t = questTarget(S, q, d)
  return v != null && t != null && v >= t - 1e-9
}

/* ---------------------------------- the quests ---------------------------------- */

const questsOf = S => list(S?.quests).filter(q => q && KINDS.includes(q.kind) && q.exId != null && ISO.test(q.from || ''))

/** The workout that completed a quest, the first from its day on: { d, key }, or null. */
export function questDone(S, q) {
  for (const w of chronological(S?.workouts)) {
    const d = workoutDay(w)
    if (d < q.from) continue
    if (completes(S, q, w)) return { d, key: workoutKey(w) }
  }
  return null
}

/** The quests still open, in the order they were pinned. */
export const openQuests = S => questsOf(S).filter(q => !questDone(S, q))

/** The quests done, the latest first, each with its `done`. */
export const doneQuests = S => questsOf(S).map(q => ({ ...q, done: questDone(S, q) })).filter(q => q.done)
  .sort((a, b) => (a.done.d < b.done.d ? 1 : a.done.d > b.done.d ? -1 : 0))

/** The quests a workout completed, for its finish sheet. */
export function questsDoneBy(S, workout) {
  const key = workoutKey(workout)
  return questsOf(S).filter(q => questDone(S, q)?.key === key)
}

/** How many quests were done in `month` ('YYYY-MM'), wins of their own for the month's count. */
export const questWinsIn = (S, month) => doneQuests(S).filter(q => q.done.d.startsWith(month + '-')).length

// The best measure of the days from `from` to `iso`.
function bestBetween(S, q, from, iso) {
  let best = null
  for (const w of list(S?.workouts)) {
    const d = workoutDay(w)
    if (!d || d < from || d > iso) continue
    const v = questMeasure(S, q, w)
    if (v != null) best = Math.max(best ?? v, v)
  }
  return best
}

/** The best measure of the last 28 days: where the bar stands, and the base a pinned quest starts at. */
export const recentBest = (S, q, iso = todayISO()) => bestBetween(S, q, isoPlus(iso, -(BAR_DAYS - 1)), iso)

/**
 * The bar: { target, best, base, toward }, `toward` from 0 at the base to 1 at the target, null
 * with nothing to read yet. A quest pinned before any session starts at its first one.
 */
export function questBar(S, q, iso = todayISO()) {
  const target = questTarget(S, q, iso)
  const best = recentBest(S, q, iso)
  let base = Number.isFinite(q.base) ? q.base : null
  if (base == null) {
    for (const w of chronological(S?.workouts)) {
      if (workoutDay(w) < q.from) continue
      const v = questMeasure(S, q, w)
      if (v != null) { base = v; break }
    }
  }
  if (target == null || best == null || base == null) return { target, best, base, toward: null }
  const toward = target > base ? Math.max(0, Math.min(1, (best - base) / (target - base))) : best >= target ? 1 : 0
  return { target, best, base, toward }
}

/**
 * The forecast, by `kind`:
 * - `weeks` with `lo` and `hi` (null: no upper end), at the slope plus and minus its error;
 * - `close`: the line is there already, a good session away;
 * - `far`: more than half a year at this pace;
 * - `flat`: no climb, so no forecast;
 * - `data`: too few sessions in the last 8 weeks (`missing`);
 * - `weigh`: the target needs a weigh-in.
 */
export function questForecast(S, q, iso = todayISO()) {
  const target = questTarget(S, q, iso)
  if (target == null) return { kind: 'weigh' }
  const from = isoPlus(iso, -(FORECAST_DAYS - 1))
  const pts = []
  for (const w of chronological(S?.workouts)) {
    const d = workoutDay(w)
    if (d < from || d > iso) continue
    const v = questMeasure(S, q, w)
    if (v != null) pts.push({ x: dayIndex(d), y: v })
  }
  const span = pts.length ? pts.at(-1).x - pts[0].x : 0
  if (pts.length < MIN_SESSIONS || span < MIN_SPAN_DAYS) return { kind: 'data', missing: Math.max(1, MIN_SESSIONS - pts.length) }
  const fit = fitLine(pts)
  if (!fit || !(fit.slope > 0)) return { kind: 'flat' }
  // From the line at the last session, not today: weeks off the bar are not weeks of progress.
  const gap = target - fit.at(pts.at(-1).x)
  if (gap <= 0) return { kind: 'close' }
  const perWeek = fit.slope * 7, seWeek = fit.se * 7
  const lo = Math.max(1, Math.round(gap / (perWeek + seWeek)))
  if (lo > MAX_WEEKS) return { kind: 'far' }
  const slow = perWeek - seWeek
  const hiRaw = slow > 0 ? Math.round(gap / slow) : null
  const hi = hiRaw == null || hiRaw > MAX_WEEKS ? null : Math.max(lo, hiRaw)
  return { kind: 'weeks', lo, hi, perWeek }
}

/* ---------------------------------- pinning ---------------------------------- */

/** A quest pinned from a template ({ kind, exId, …target }); false with 3 open already. */
export function pinQuest(s, tpl, iso = todayISO()) {
  if (openQuests(s).length >= MAX_OPEN || !tpl || !KINDS.includes(tpl.kind)) return false
  const base = recentBest(s, tpl, iso)
  const q = { id: uid(), ...tpl, exId: String(tpl.exId), from: iso, ...(base != null ? { base } : {}) }
  s.quests = [...list(s.quests), q]
  return q
}

/** A quest taken off, open or done. */
export function dropQuest(s, id) {
  s.quests = list(s.quests).filter(q => q?.id !== id)
}

/* ---------------------------------- suggestions ---------------------------------- */

// The plan's exercises with a session behind them, the season's anchors first.
function trainedPlanIds(S) {
  const plan = []
  for (const r of list(S?.routines)) for (const e of list(r?.ex)) if (e?.id != null && !plan.includes(String(e.id))) plan.push(String(e.id))
  const season = currentSeason(S)
  const anchors = season ? anchorIds(season).map(String).filter(id => plan.includes(id)) : []
  const trained = id => list(S?.workouts).some(w => itemsOf(w, id).length)
  return [...anchors, ...plan.filter(id => !anchors.includes(id))].filter(trained)
}

const stepOf = (S, best) => (S?.unit === 'lb' ? (best < 220 ? 10 : 20) : (best < 100 ? 5 : 10))
const nextRound = (S, best) => { const step = stepOf(S, best); return Math.floor(best / step + 1e-9) * step + step }

// What could come next on one exercise, best first.
function ideasFor(S, id, iso) {
  const out = []
  if (isAssisted(id)) {
    if (isAssistedPull(id)) out.push({ kind: 'unassisted', exId: id })
    return out
  }
  if (isBw({ id })) {
    const best = recentBest(S, { kind: 'reps', exId: id }, iso) ?? 0
    const r = REPS_STEPS.find(x => x > best)
    if (r) out.push({ kind: 'reps', exId: id, r })
    return out
  }
  if (!isLoadedEq(id)) return out
  const best = recentBest(S, { kind: 'e1rm', exId: id }, iso)
  if (best == null) return out
  const bw = bodyweightOn(S, iso)
  if (RATIOS[id] && bw && best < bw.w * RATIOS[id]) out.push({ kind: 'ratio', exId: id, ratio: RATIOS[id] })
  if (standardOf(id) && bw) {
    const lv = exerciseLevel(S, id, { iso })
    const level = lv ? lv.level + 1 : 0
    if (level < LEVELS.length) out.push({ kind: 'level', exId: id, level })
  }
  out.push({ kind: 'e1rm', exId: id, value: nextRound(S, best) })
  return out
}

const sameQuest = (a, b) => a.kind === b.kind && String(a.exId) === String(b.exId)

/** Up to `limit` quests to pin: one per exercise first, the season's anchors leading, then more. */
export function questSuggestions(S, iso = todayISO(), limit = 6) {
  const open = openQuests(S)
  const per = trainedPlanIds(S).map(id => ideasFor(S, id, iso).filter(t => !open.some(q => sameQuest(q, t))))
  const out = []
  for (let round = 0; out.length < limit && per.some(x => x.length > round); round++) {
    for (const ideas of per) if (ideas[round] && out.length < limit) out.push(ideas[round])
  }
  return out
}

/** The step after a quest done: the next of its kind on the same lift, or null. */
export function nextQuest(S, q, iso = todayISO()) {
  if (q.kind === 'unassisted') return { kind: 'reps', exId: PULL_UP, r: REPS_STEPS[0] }
  if (q.kind === 'reps') { const r = REPS_STEPS.find(x => x > q.r); return r ? { kind: 'reps', exId: q.exId, r } : null }
  if (q.kind === 'level') return q.level + 1 < LEVELS.length ? { kind: 'level', exId: q.exId, level: q.level + 1 } : null
  const best = Math.max(recentBest(S, { kind: 'e1rm', exId: q.exId }, iso) ?? 0, questTarget(S, q, iso) ?? 0)
  return best > 0 ? { kind: 'e1rm', exId: q.exId, value: nextRound(S, best) } : null
}
