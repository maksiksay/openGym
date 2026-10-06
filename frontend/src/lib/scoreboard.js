// What a session did better than before, read back from the history: the wins behind the goal
// line, the finish sheet, the history badges and the monthly count (docs/dev/SCOREBOARD.md).
//
// Nothing here is stored. Every win is derived from the workouts as they are now, so an edit, a
// move, a deleted session or a sync that brings one in can never leave a win behind that the
// history no longer supports. The `prs` list a workout carries is upstream's and is left alone.
import { metricEntriesForExercise, bestWeightForEntry, entryExcluded, entryRoutineId, isBw, isPerSide, modeOf } from './history.js'
import { isSideSet, completedVolumeOf, isWarmupRow } from './workout-model.js'
import { beatsWeight, isAssisted } from './exercises.js'
import { bestSetOf } from './onerm.js'
import { legacySyncKey } from './workout-date.js'

/** The key a workout is known by here: its id, or the day-and-start key sync gives a record from
 *  before ids. */
export const workoutKey = w => (w?.id != null ? String(w.id) : legacySyncKey(w))

// The CSV and Hevy imports file every session under an `iw` id. Those sessions are real history,
// so they raise the bar and they are last time for the next session, but nothing was earned here:
// the same reason rebuildPrHistory never hands them a PR badge.
const isImported = w => typeof w?.id === 'string' && w.id.startsWith('iw')

const startOf = w => (Number.isFinite(w?.start) ? w.start : new Date((w?.d || '') + 'T12:00:00').getTime())
const num = v => Number(v) || 0
// A difference of two loads, kept off the float noise that a kg ↔ lb conversion leaves behind.
const round2 = v => Math.round(v * 100) / 100
const chronological = list => list.map((w, i) => [w, i]).sort((a, b) => startOf(a[0]) - startOf(b[0]) || a[1] - b[1]).map(([w]) => w)

// One exercise from occurrences that share a mode (metricEntriesForExercise's shape): every
// completed work row of them, and the numbers the wins are judged on. Each completed side of a
// per-side row is a set of its own, the way bestSetOf reads it. Drops count towards volume only,
// and a rest-pause row's `r` is already its total. Cardio is not scored.
function readOccurrences(exId, same, { excluded = false, rids = [] } = {}) {
  if (!same.length) return null
  const mode = same[0].mode
  if (mode !== 'reps' && mode !== 'time') return null
  const rows = same.flatMap(o => o.rows)
  const merged = { ...same[same.length - 1].entry, sets: rows }
  if (mode === 'time') {
    const items = rows.filter(s => s?.done === true && num(s.sec) > 0).map(s => ({ w: num(s.w), sec: num(s.sec) }))
    if (!items.length) return null
    const secs = items.map(i => i.sec)
    return { id: exId, mode, rows, items, top: 0, longest: Math.max(...secs), totalSec: secs.reduce((a, b) => a + b, 0), excluded, rids }
  }
  const items = []
  for (const s of rows) {
    const parts = isSideSet(s) ? [s.sides.L, s.sides.R].filter(p => p?.done === true) : s?.done === true ? [s] : []
    for (const p of parts) if (num(p.r) > 0) items.push({ w: num(p.w), r: num(p.r) })
  }
  // A record from before rows carried their load still has its top weight (topW).
  const top = bestWeightForEntry(merged)
  if (!items.length && !(top > 0)) return null
  const bw = isBw({ ...(merged.target || {}), id: exId })
  // Tonnage on an assistance machine is the help you were given, which grows as you get weaker;
  // like a bodyweight exercise, its volume is the reps.
  const byReps = bw || isAssisted(exId)
  const vol = byReps ? items.reduce((a, i) => a + i.r, 0) : rows.reduce((a, s) => a + completedVolumeOf(s), 0)
  return { id: exId, mode, rows, items, top, bw, vol, volUnit: byReps ? 'reps' : 'load', e1rm: bestSetOf(merged), excluded, rids }
}

const sameMode = occurrences => {
  if (!occurrences.length) return []
  const mode = occurrences[occurrences.length - 1].mode
  return occurrences.filter(o => o.mode === mode)
}

/**
 * One exercise in one workout, or null when nothing of it counts. A combined day can hold the
 * same exercise twice; both occurrences are read together, in the mode of the last one, the rule
 * exerciseHistory uses. `excluded` is true only when every occurrence is kept out of progression,
 * and `rids` are the routine slots it was trained in.
 */
export function readExercise(workout, exId) {
  const same = sameMode(metricEntriesForExercise(workout, exId))
  if (!same.length) return null
  const excluded = same.every(o => entryExcluded(workout, o.entry))
  const rids = [...new Set(same.map(o => entryRoutineId(workout, o.entry)).filter(rid => rid != null))]
  return readOccurrences(exId, same, { excluded, rids })
}

/**
 * Did `cur` beat `last`? The delta that says how, or null.
 *
 * Reps: a harder top load (less help on an assistance machine) is `{ w }`. At the same top load
 * the sets at that load decide: more reps in total is `{ r }`, else a stronger weakest set with
 * at least as many sets is `{ weak }`. That last branch is double progression's own idea of
 * progress (10·9·8 → 9·9·9), so doing what the card asked counts. Timed holds read the same way
 * in seconds: the longest hold, then the total, then the weakest.
 */
export function compareReads(cur, last, exId) {
  if (!cur || !last || cur.mode !== last.mode) return null
  if (cur.mode === 'time') {
    if (cur.longest > last.longest) return { sec: cur.longest - last.longest }
    if (cur.totalSec > last.totalSec) return { sec: cur.totalSec - last.totalSec }
    const weak = Math.min(...cur.items.map(i => i.sec))
    const lastWeak = Math.min(...last.items.map(i => i.sec))
    return cur.items.length >= last.items.length && weak > lastWeak ? { weakSec: weak - lastWeak } : null
  }
  if (beatsWeight(exId, cur.top, last.top)) return { w: round2(cur.top - last.top) }
  if (cur.top !== last.top) return null
  const atTop = read => read.items.filter(i => i.w === read.top)
  const a = atTop(cur)
  const b = atTop(last)
  if (!a.length || !b.length) return null
  const total = list => list.reduce((s, i) => s + i.r, 0)
  if (total(a) > total(b)) return { r: total(a) - total(b) }
  const weak = Math.min(...a.map(i => i.r))
  const lastWeak = Math.min(...b.map(i => i.r))
  return a.length >= b.length && weak > lastWeak ? { weak: weak - lastWeak } : null
}

/** The mark beside one ticked set: harder than the same set last time `{ w }`, more reps at the
 *  same load `{ r }`, a longer hold `{ sec }`; null otherwise. */
export function setMark(prev, cur, exId, mode = 'reps') {
  if (!prev || !cur || cur.done !== true || prev.done !== true) return null
  if (mode === 'time') {
    const d = num(cur.sec) - num(prev.sec)
    return d > 0 ? { sec: d } : null
  }
  if (!(num(cur.r) > 0)) return null
  if (beatsWeight(exId, num(cur.w), num(prev.w))) return { w: round2(num(cur.w) - num(prev.w)) }
  if (num(cur.w) === num(prev.w) && num(cur.r) > num(prev.r)) return { r: num(cur.r) - num(prev.r) }
  return null
}

/**
 * The marks for an entry's rows, one per row (null for a warm-up and for a set with nothing to
 * show). Work set i is held against work set i last time; a per-side row against a per-side row,
 * L with L and R with R, as `{ L, R }`.
 */
export function rowMarks(last, entry) {
  const rows = entry?.sets || []
  const mode = modeOf({ ...(entry?.target || {}), id: entry?.id })
  if (!last || last.mode !== mode) return rows.map(() => null)
  let k = 0
  return rows.map(s => {
    if (isWarmupRow(s)) return null
    const prev = last.rows[k++]
    if (!prev) return null
    if (isSideSet(s) !== isSideSet(prev)) return null
    if (!isSideSet(s)) return setMark(prev, s, entry.id, mode)
    const L = setMark(prev.sides.L, s.sides.L, entry.id, mode)
    const R = setMark(prev.sides.R, s.sides.R, entry.id, mode)
    return L || R ? { L, R } : null
  })
}

// One exercise's baselines as the history is walked forwards: the bests of each kind, and the
// last counting session per routine slot and overall. `judge` reads a session against them
// without changing them; `add` folds it in.
function tracker(exId) {
  const assisted = isAssisted(exId)
  const state = {}
  const lastBy = new Map()
  const lastAny = new Map()
  // A load at least as hard as `w`: the same, or heavier (less help on an assistance machine).
  const hardEnough = (w2, w) => w2 === w || beatsWeight(exId, w2, w)
  // On an assistance machine a 0 is a row with no help typed in, not a set done without any.
  const counts = it => !assisted || it.w > 0

  const lastFor = (mode, rids = []) => {
    for (const rid of rids) {
      const read = lastBy.get(mode + '|' + rid)
      if (read) return read
    }
    return lastAny.get(mode) || null
  }

  function judge(read) {
    // The first session in a mode only sets the baselines.
    const s = state[read.mode]
    if (!s) return null
    const records = {}
    if (read.mode === 'time') {
      if (s.longest > 0 && read.longest > s.longest) records.hold = { v: read.longest, prev: s.longest }
    } else {
      if (s.top > 0 && beatsWeight(exId, read.top, s.top)) records.weight = { v: read.top, prev: s.top }
      // More reps than anyone did at this load or a harder one. A load never lifted before has
      // nothing to beat: that is a weight record. Of several, the hardest load is reported.
      let rep = null
      for (const it of read.items) {
        if (!counts(it)) continue
        let prior = -1
        for (const [w2, r2] of s.loads) if (r2 > prior && hardEnough(w2, it.w)) prior = r2
        if (prior < 0 || it.r <= prior) continue
        if (!rep || beatsWeight(exId, it.w, rep.w) || (it.w === rep.w && it.r > rep.r)) rep = { w: it.w, r: it.r, prev: prior }
      }
      if (rep) records.reps = rep
      if (read.e1rm && s.est > 0 && read.e1rm.est > s.est) records.e1rm = { v: read.e1rm.est, prev: s.est, w: read.e1rm.w, r: read.e1rm.r }
      const prevVol = s.vol[read.volUnit] || 0
      if (prevVol > 0 && read.vol > prevVol) records.volume = { v: round2(read.vol), prev: round2(prevVol), unit: read.volUnit }
    }
    // A session kept out of progression (a deload, a rehab block) is lighter on purpose.
    const beat = read.excluded ? null : compareReads(read, lastFor(read.mode, read.rids), exId)
    if (!beat && !Object.keys(records).length) return null
    return beat ? { beat, records } : { records }
  }

  function add(read) {
    let s = state[read.mode]
    if (!s) s = state[read.mode] = read.mode === 'time' ? { longest: 0 } : { top: 0, loads: new Map(), est: 0, vol: {} }
    if (read.mode === 'time') s.longest = Math.max(s.longest, read.longest)
    else {
      if (read.top > 0 && beatsWeight(exId, read.top, s.top)) s.top = read.top
      for (const it of read.items) if (counts(it) && !(s.loads.get(it.w) >= it.r)) s.loads.set(it.w, it.r)
      if (read.e1rm && read.e1rm.est > s.est) s.est = read.e1rm.est
      s.vol[read.volUnit] = Math.max(s.vol[read.volUnit] || 0, read.vol)
    }
    // Not last time for anyone: the `lastEntryFor` rule.
    if (!read.excluded) {
      lastAny.set(read.mode, read)
      for (const rid of read.rids) lastBy.set(read.mode + '|' + rid, read)
    }
  }

  return { judge, add, lastFor }
}

const exerciseIds = w => [...new Set((w?.entries || []).map(e => e?.id).filter(id => id != null && id !== ''))]

// Keyed by the history array itself. The store never edits one in place (every update clones the
// state), so a new array is the only way the history changes, and the same array always has the
// same answer. A History list asking once per row, or a screen rendering again, costs one lookup.
const memo = new WeakMap()
const EMPTY = new Map()

/**
 * The wins of every workout, in a Map from workoutKey to `[{ id, beat?, records }]`: only the
 * exercises that won something, and only workouts with at least one. `records` holds any of
 * `weight { v, prev }`, `reps { w, r, prev }`, `e1rm { v, prev, w, r }`,
 * `volume { v, prev, unit: 'load' | 'reps' }` and `hold { v, prev }`.
 */
export function winsTimeline(workouts) {
  if (!Array.isArray(workouts)) return EMPTY
  const cached = memo.get(workouts)
  if (cached) return cached
  const map = new Map()
  const trackers = new Map()
  for (const w of chronological(workouts)) {
    const imported = isImported(w)
    const won = []
    for (const id of exerciseIds(w)) {
      const read = readExercise(w, id)
      if (!read) continue
      let tr = trackers.get(id)
      if (!tr) trackers.set(id, (tr = tracker(id)))
      if (!imported) {
        const win = tr.judge(read)
        if (win) won.push({ id, ...win })
      }
      tr.add(read)
    }
    if (won.length) map.set(workoutKey(w), won)
  }
  memo.set(workouts, map)
  return map
}

/** The wins of one workout, `[]` when it has none. */
export const winsOf = (workouts, w) => winsTimeline(workouts).get(workoutKey(w)) || []

/** How many exercises won something in the workouts dated in `month` ('YYYY-MM'). */
export function monthWins(workouts, month) {
  const map = winsTimeline(workouts)
  let n = 0
  for (const w of workouts || []) if (String(w?.d || '').startsWith(month)) n += (map.get(workoutKey(w)) || []).length
  return n
}

// The target as a session of its own, to measure it against last time the way a logged one is.
function goalRead(g, exId) {
  if (g.mode === 'time') {
    const items = Array.from({ length: g.sets }, () => ({ w: g.weight, sec: g.sec }))
    return { id: exId, mode: 'time', items, top: 0, longest: g.sec, totalSec: g.sec * g.sets }
  }
  const perSet = g.perSide ? [g.reps / 2, g.reps / 2] : [g.reps]
  const items = []
  for (let i = 0; i < g.sets; i++) for (const r of perSet) items.push({ w: g.weight, r })
  return { id: exId, mode: 'reps', items, top: g.weight }
}

/**
 * The goal line of a planned exercise: what to beat today and how far past last time that is.
 *
 * The numbers are `entry.target` as the session built it, the routine's config with the
 * prescription applied, the same for every set; typing another weight into a row does not move
 * them. `kind` is 'first' (nothing to beat yet), 'deload' (lighter on purpose), 'plain' (kept out
 * of progression) or 'goal'; only a goal has a delta. Null for cardio.
 */
export function goalOf(entry, last) {
  const target = { ...(entry?.target || {}), id: entry?.id }
  const mode = modeOf(target)
  if (mode !== 'reps' && mode !== 'time') return null
  const plan = entry?.plan
  const workRows = (entry?.sets || []).filter(s => !isWarmupRow(s)).length
  const g = {
    mode,
    sets: Math.max(1, num(target.sets) || workRows || 1),
    weight: num(target.weight),
    reps: num(target.reps),
    sec: num(target.sec),
    perSide: mode === 'reps' && isPerSide(target),
    bw: mode === 'reps' && isBw(target),
    why: plan?.why || null,
  }
  if (entry?.noProg === true) return { ...g, kind: 'plain', delta: null }
  if (plan?.kind === 'first' || !last) return { ...g, kind: 'first', delta: null }
  if (plan?.kind === 'deload') return { ...g, kind: 'deload', delta: null }
  return { ...g, kind: 'goal', delta: compareReads(goalRead(g, entry.id), last, entry.id) }
}

/**
 * An exercise of the running session against the history before it (`sessionHistory`): last
 * time (a read, or null), the goal line, and the win so far (`{ beat?, records }`, or null). The
 * same judgement the timeline gives the workout once it is saved. `rid` is the routine slot.
 */
export function scoreExercise(history, entry, rid = entry?.rid) {
  const exId = entry?.id
  const tr = tracker(exId)
  for (const w of chronological(history?.workouts || [])) {
    const read = readExercise(w, exId)
    if (read) tr.add(read)
  }
  const mode = modeOf({ ...(entry?.target || {}), id: exId })
  const rids = rid != null ? [rid] : []
  const last = mode === 'reps' || mode === 'time' ? tr.lastFor(mode, rids) : null
  const cur = readOccurrences(exId, sameMode(metricEntriesForExercise({ entries: [entry] }, exId)), { excluded: entry?.noProg === true, rids })
  return { last, goal: goalOf(entry, last), live: cur ? tr.judge(cur) : null }
}
