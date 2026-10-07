// Seasons (docs/dev/SEASONS.md): six-week blocks with a test at the end, on four anchor lifts that
// survive every change of program. Only a season's definition is stored, in S.seasons; its week,
// what the anchors did and its results are read from the log here, every time they are needed,
// the way the scoreboard reads its wins.
import { todayISO, uid } from './format.js'
import { workoutDay } from './history.js'
import { EXIDX } from './exercises.js'
import { readExercise, winsTimeline, workoutKey } from './scoreboard.js'
import { isWarmupRow } from './workout-model.js'

export const SEASON_WEEKS = 6
export const ANCHOR_SLOTS = ['squat', 'hinge', 'press', 'pull']

const list = v => (Array.isArray(v) ? v : [])
const ISO = /^\d{4}-\d{2}-\d{2}$/
const dayNum = iso => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 864e5)
}
export const isoPlus = (iso, n) => new Date((dayNum(iso) + n) * 864e5).toISOString().slice(0, 10)

/* ---------------------------------- which season, which week ---------------------------------- */

/** The season in force: the last one not closed, which may not have started yet (the week off). */
export const currentSeason = S => list(S?.seasons).filter(s => s && !s.closed && ISO.test(s.start)).at(-1) || null

/** The seasons already over, oldest first. */
export const pastSeasons = S => list(S?.seasons).filter(s => s && s.closed && ISO.test(s.start))

const weeksOf = season => (Number.isInteger(season?.weeks) && season.weeks > 0 ? season.weeks : SEASON_WEEKS)
/** The first day of the test week, and the season's last day. */
export const testFrom = season => isoPlus(season.start, 7 * (weeksOf(season) - 1))
export const lastDay = season => isoPlus(season.start, 7 * weeksOf(season) - 1)

/** The anchors' exercise ids, in slot order, without the empty slots. */
export const anchorIds = season => ANCHOR_SLOTS.map(k => season?.anchors?.[k]).filter(Boolean)

/** The workouts dated inside a season, in date order. */
export function seasonWorkouts(S, season, upTo = lastDay(season)) {
  const end = upTo < lastDay(season) ? upTo : lastDay(season)
  return list(S?.workouts)
    .filter(w => { const d = workoutDay(w); return d && d >= season.start && d <= end })
    .sort((a, b) => (workoutDay(a) < workoutDay(b) ? -1 : workoutDay(a) > workoutDay(b) ? 1 : (a.start || 0) - (b.start || 0)))
}

/**
 * Where the person stands on `iso`:
 * - `none`: no season;
 * - `upcoming`: the next season has not started (the week off);
 * - `running`: weeks 1 to 5;
 * - `test`: the last week, with an anchor still to test;
 * - `over`: every anchor tested, or the last day gone. The season waits to be closed.
 */
export function seasonState(S, iso = todayISO()) {
  const season = currentSeason(S)
  if (!season) return { phase: 'none', season: null }
  const weeks = weeksOf(season)
  const from = testFrom(season)
  const end = lastDay(season)
  const day = dayNum(iso) - dayNum(season.start)
  const base = { season, weeks, testFrom: from, end }
  if (day < 0) return { ...base, phase: 'upcoming', week: 0, daysToStart: -day }
  const week = Math.min(weeks, Math.floor(day / 7) + 1)
  if (iso > end) return { ...base, phase: 'over', week }
  if (iso < from) return { ...base, phase: 'running', week, daysToTest: dayNum(from) - dayNum(iso) }
  const ids = anchorIds(season)
  const tested = testedIds(S, season)
  if (ids.length && ids.every(id => tested.has(id))) return { ...base, phase: 'over', week }
  return { ...base, phase: 'test', week }
}

/* ---------------------------------- the anchors ---------------------------------- */

// Read off the exercise's English name, best match first in each slot (docs/dev/SEASONS.md).
const PATTERNS = {
  squat: [/\bsquat\b/, /leg press|lunge/],
  hinge: [/romanian deadlift|stiff[- ]legg?e?d? deadlift|\bdeadlift\b/, /good morning|hip thrust|glute bridge|swing|back extension|hyperextension/],
  press: [/^(barbell |dumbbell |smith )?bench press$/, /bench press|floor press|chest press|push-?up/],
  pull: [/pull-?up|chin-?up/, /pull-?down/],
}
const tierOf = (name, slot) => PATTERNS[slot].findIndex(re => re.test(name))

/**
 * The four slots filled from the plan: each takes the best match among the routines' exercises,
 * the earliest one on a tie. A previous season's anchor stays while the plan still has it.
 */
export function suggestAnchors(routines, previous = null) {
  const inPlan = []
  for (const r of list(routines)) for (const e of list(r?.ex)) if (e?.id != null && !inPlan.includes(String(e.id))) inPlan.push(String(e.id))
  const out = {}
  const taken = new Set()
  for (const slot of ANCHOR_SLOTS) {
    const prev = previous?.[slot]
    if (prev && inPlan.includes(String(prev))) { out[slot] = String(prev); taken.add(String(prev)); continue }
    let best = null
    for (const id of inPlan) {
      if (taken.has(id)) continue
      const name = String(EXIDX[id]?.n || '').toLowerCase()
      const tier = name ? tierOf(name, slot) : -1
      if (tier >= 0 && (!best || tier < best.tier)) best = { id, tier }
    }
    out[slot] = best ? best.id : null
    if (best) taken.add(best.id)
  }
  return out
}

/** Which slots' exercises are no longer anywhere in the plan. */
export function anchorsOutOfPlan(routines, anchors) {
  const inPlan = new Set(list(routines).flatMap(r => list(r?.ex).map(e => String(e?.id))))
  return ANCHOR_SLOTS.filter(k => anchors?.[k] && !inPlan.has(String(anchors[k])))
}

/**
 * What one workout says about an anchor, in its own unit: the best estimated one-rep max of a
 * loaded exercise (`e1rm`), the most reps in a set of one done with body weight, a band or an
 * assistance machine (`reps`), or the longest hold of a timed one (`sec`). Null when it was not
 * trained, or is cardio.
 */
export function anchorMeasure(workout, exId) {
  const read = readExercise(workout, exId)
  if (!read) return null
  if (read.mode === 'time') return read.longest > 0 ? { kind: 'sec', value: read.longest } : null
  if (read.mode !== 'reps') return null
  if (!read.bw && read.volUnit !== 'reps' && read.e1rm && read.e1rm.est > 0) {
    return { kind: 'e1rm', value: Math.round(read.e1rm.est * 10) / 10, w: read.e1rm.w, r: read.e1rm.r }
  }
  const top = list(read.items).reduce((b, i) => (!b || i.r > b.r || (i.r === b.r && i.w > b.w) ? i : b), null)
  return top && top.r > 0 ? { kind: 'reps', value: top.r, w: top.w, r: top.r } : null
}

/** The same, from the test set alone. */
function testMeasure(workout, exId) {
  const marked = list(workout?.entries).some(en => String(en?.id) === String(exId) && list(en.sets).some(s => s?.test === true && s.done === true))
  if (!marked) return null
  const only = {
    ...workout,
    entries: list(workout.entries).map(en => (String(en?.id) === String(exId) ? { ...en, sets: list(en.sets).filter(s => s?.test === true) } : en))
  }
  return anchorMeasure(only, exId)
}

const better = (a, b) => (!b || (a && a.kind === b.kind && a.value > b.value) ? a : b)

/** The anchors tested in a season: a test set logged and ticked in its test week. */
export function testedIds(S, season) {
  const from = testFrom(season)
  const ids = new Set(anchorIds(season).map(String))
  const out = new Set()
  for (const w of seasonWorkouts(S, season)) {
    if (workoutDay(w) < from) continue
    for (const en of list(w.entries)) {
      if (ids.has(String(en?.id)) && list(en.sets).some(s => s?.test === true && s.done === true)) out.add(String(en.id))
    }
  }
  return out
}

/**
 * One anchor across a season up to `iso`: where it started (`base`: the best of week 1, or the
 * first time it was trained when week 1 missed it, `late`), its best so far, and its test — the
 * test set, or the best of the test week standing in for one (`fallback`).
 */
export function anchorProgress(S, season, exId, iso = todayISO()) {
  const ws = seasonWorkouts(S, season, iso)
  const week2 = isoPlus(season.start, 7)
  const from = testFrom(season)
  let base = null, late = false, best = null, test = null, testWeekBest = null
  for (const w of ws) {
    const m = anchorMeasure(w, exId)
    if (!m) continue
    const d = workoutDay(w)
    if (d < week2) base = better(m, base)
    else if (!base) { base = m; late = true }
    best = better(m, best)
    if (d >= from) {
      testWeekBest = better(m, testWeekBest)
      const t = testMeasure(w, exId)
      if (t && !test) test = t
    }
  }
  const fallback = !test && !!testWeekBest
  return { exId: String(exId), base, late, best, test: test || testWeekBest, tested: !!test, fallback }
}

/** How far `to` is from `from`, in their unit and in per cent; null across units. */
export function change(from, to) {
  if (!from || !to || from.kind !== to.kind) return null
  const delta = Math.round((to.value - from.value) * 10) / 10
  return { kind: to.kind, delta, pct: from.value > 0 ? Math.round((to.value / from.value - 1) * 100) : null }
}

/** A season's results: each anchor from week 1 to its test, the sessions, the wins and records. */
export function seasonResults(S, season, iso = lastDay(season)) {
  const anchors = ANCHOR_SLOTS.filter(k => season.anchors?.[k]).map(slot => {
    const p = anchorProgress(S, season, season.anchors[slot], iso)
    return { slot, ...p, change: change(p.base, p.test) }
  })
  const ws = seasonWorkouts(S, season, iso)
  const timeline = winsTimeline(list(S?.workouts))
  let wins = 0, records = 0
  for (const w of ws) {
    for (const win of timeline.get(workoutKey(w)) || []) {
      wins++
      if (win.records && Object.keys(win.records).length) records++
    }
  }
  return { anchors, sessions: ws.length, wins, records }
}

/* ---------------------------------- the test sets ---------------------------------- */

/**
 * A session being started on `iso`, in the test week: the last work set of each anchor still to
 * test is marked `test: true`. Once per anchor: not one already tested this season, nor one marked
 * earlier in the same session (`inSession`, the entries already in it). Anything else is returned
 * as it came.
 */
export function markTests(S, entries, iso = todayISO(), inSession = []) {
  const st = seasonState(S, iso)
  if (st.phase !== 'test') return entries
  const ids = new Set(anchorIds(st.season).map(String))
  const done = testedIds(S, st.season)
  for (const en of list(inSession)) if (list(en?.sets).some(s => s?.test === true)) done.add(String(en.id))
  return list(entries).map(en => {
    const id = String(en?.id)
    if (!ids.has(id) || done.has(id)) return en
    const sets = list(en.sets)
    let at = -1
    sets.forEach((s, i) => { if (s && !isWarmupRow(s)) at = i })
    if (at < 0) return en
    done.add(id)
    return { ...en, sets: sets.map((s, i) => (i === at ? { ...s, test: true } : s)) }
  })
}

/* ---------------------------------- starting and closing ---------------------------------- */

const cleanAnchors = a => Object.fromEntries(ANCHOR_SLOTS.map(k => [k, a?.[k] != null && a[k] !== '' ? String(a[k]) : null]))

/** A new season from `start`, numbered after the last one. */
export function startSeason(s, { start = todayISO(), anchors } = {}) {
  const all = list(s.seasons)
  const last = all.at(-1)
  const season = { id: uid(), n: (Number(last?.n) || 0) + 1, start: ISO.test(start) ? start : todayISO(), weeks: SEASON_WEEKS, anchors: cleanAnchors(anchors), closed: null }
  s.seasons = [...all.filter(x => x && x.closed), season]
  return season
}

/**
 * The season over: closed on `iso`, and the next one begun with the same anchors, a week later
 * (`rest`) or today (`now`).
 */
export function closeSeason(s, id, next = 'now', iso = todayISO()) {
  const season = list(s.seasons).find(x => x && x.id === id && !x.closed)
  if (!season) return null
  season.closed = { at: iso, next: next === 'rest' ? 'rest' : 'now' }
  return startSeason(s, { start: next === 'rest' ? isoPlus(iso, 7) : iso, anchors: season.anchors })
}

/** The week off cut short: the coming season starts on `iso`. */
export function startNow(s, id, iso = todayISO()) {
  const season = list(s.seasons).find(x => x && x.id === id && !x.closed)
  if (season && season.start > iso) season.start = iso
}

/** The season in force given up: it goes, and the one before stays closed as it was. */
export function dropSeason(s, id) {
  s.seasons = list(s.seasons).filter(x => !(x && x.id === id && !x.closed))
}

/** The anchors of the season in force changed. */
export function setAnchors(s, id, anchors) {
  const season = list(s.seasons).find(x => x && x.id === id && !x.closed)
  if (season) season.anchors = cleanAnchors(anchors)
}

/**
 * Whether replacing the whole plan on `iso` would happen mid-season: the season and its last day
 * while one runs (its test week included), null before it starts, after it, or with none.
 */
export function swapGuard(S, iso = todayISO()) {
  const st = seasonState(S, iso)
  return st.phase === 'running' || st.phase === 'test' ? { season: st.season, until: st.end } : null
}
