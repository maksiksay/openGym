import { describe, it, expect } from 'vitest'
import {
  readExercise, compareReads, setMark, rowMarks, winsTimeline, monthWins, scoreExercise, goalOf, workoutKey,
} from './scoreboard.js'

const DAY = 86400000
const T0 = Date.UTC(2026, 0, 5, 10)
const iso = i => new Date(T0 + i * DAY).toISOString().slice(0, 10)

const set = (w, r, done = true) => ({ w, r, done })
const warm = (w, r) => ({ w, r, done: true, phase: 'warmup' })
const hold = (sec, done = true) => ({ sec, w: 0, done })
const side = (L, R) => ({ sides: { L: { ...L, done: L.done !== false }, R: { ...R, done: R.done !== false } }, w: Math.max(L.w, R.w), r: L.r + R.r, done: L.done !== false && R.done !== false })
const ex = (id, rows, extra = {}) => ({ id, target: { mode: 'reps' }, sets: rows, ...extra })
const W = (i, entries, extra = {}) => ({ id: 'w' + i, d: iso(i), start: T0 + i * DAY, routineIds: ['A'], entries, ...extra })
const bench = (i, rows, extra) => W(i, [ex('bench', rows)], extra)

const winsOf = (list, i, id = 'bench') => (winsTimeline(list).get('w' + i) || []).find(x => x.id === id) || null
const kinds = (list, i, id) => {
  const win = winsOf(list, i, id)
  return win ? [...(win.beat ? ['beat'] : []), ...Object.keys(win.records)].sort() : []
}

describe('reading one exercise in one workout', () => {
  it('keeps completed work rows only and reads their numbers', () => {
    const r = readExercise(bench(0, [warm(40, 8), set(60, 8), set(60, 7), set(100, 5, false)]), 'bench')
    expect(r.mode).toBe('reps')
    expect(r.items).toEqual([{ w: 60, r: 8 }, { w: 60, r: 7 }])
    expect(r.top).toBe(60)
    expect(r.vol).toBe(900)
    expect(r.volUnit).toBe('load')
    expect(r.e1rm.est).toBe(76)
  })

  it('is null for an exercise the workout did not train, or trained only as cardio', () => {
    expect(readExercise(bench(0, [set(60, 5)]), 'squat')).toBeNull()
    expect(readExercise(bench(0, [set(60, 5, false)]), 'bench')).toBeNull()
    const run = W(0, [{ id: 'run', target: { mode: 'cardio' }, sets: [{ min: 20, speed: 9, done: true }] }])
    expect(readExercise(run, 'run')).toBeNull()
  })

  it('merges the same exercise done twice on a combined day', () => {
    const w = W(0, [ex('bench', [set(60, 5)], { rid: 'A' }), ex('bench', [set(40, 10)], { rid: 'B' })], { routineIds: ['A', 'B'] })
    const r = readExercise(w, 'bench')
    expect(r.items).toEqual([{ w: 60, r: 5 }, { w: 40, r: 10 }])
    expect(r.vol).toBe(700)
    expect(r.rids).toEqual(['A', 'B'])
  })

  it('takes the routine of a session saved before entries carried their own', () => {
    expect(readExercise(bench(0, [set(60, 5)]), 'bench').rids).toEqual(['A'])
  })
})

describe('wins over the history', () => {
  it('gives the first session of an exercise nothing: it sets the baseline', () => {
    const list = [bench(0, [set(60, 5), set(60, 5), set(60, 5)])]
    expect(winsTimeline(list).size).toBe(0)
  })

  it('counts a heavier session as a beat, a weight record, an e1RM record and a volume record', () => {
    const list = [bench(0, [set(60, 5), set(60, 5), set(60, 5)]), bench(1, [set(62.5, 5), set(62.5, 5), set(62.5, 5)])]
    expect(kinds(list, 1)).toEqual(['beat', 'e1rm', 'volume', 'weight'])
    const win = winsOf(list, 1)
    expect(win.beat).toEqual({ w: 2.5 })
    expect(win.records.weight).toEqual({ v: 62.5, prev: 60 })
    expect(win.records.e1rm).toMatchObject({ v: 72.9, prev: 70 })
    expect(win.records.volume).toEqual({ v: 937.5, prev: 900, unit: 'load' })
  })

  it('counts one more rep at the same weight as a beat, and as a record only where it is one', () => {
    const list = [bench(0, [set(60, 8), set(60, 8), set(60, 7)]), bench(1, [set(60, 8), set(60, 8), set(60, 8)])]
    expect(kinds(list, 1)).toEqual(['beat', 'volume'])
    expect(winsOf(list, 1).beat).toEqual({ r: 1 })
  })

  it('sets a rep record at a weight lifted before, never at a new heaviest one', () => {
    const list = [bench(0, [set(60, 8)]), bench(1, [set(65, 5)]), bench(2, [set(60, 9)])]
    // 65 × 5 is a new heaviest set: a weight record, and nothing at 65 to beat for reps
    expect(kinds(list, 1)).toEqual(['beat', 'weight'])
    // 60 × 9: nobody did 9 at 60 or heavier. Lighter than last time, so no beat
    expect(kinds(list, 2)).toEqual(['e1rm', 'reps', 'volume'])
    expect(winsOf(list, 2).records.reps).toEqual({ w: 60, r: 9, prev: 8 })
  })

  it('counts lifting the weakest set as a beat: double progression asks for exactly that', () => {
    // 10·9·8 → 9·9·9: the same 27 reps, the weakest set one higher, as many sets
    const list = [bench(0, [set(60, 10), set(60, 9), set(60, 8)]), bench(1, [set(60, 9), set(60, 9), set(60, 9)])]
    expect(kinds(list, 1)).toEqual(['beat'])
    expect(winsOf(list, 1).beat).toEqual({ weak: 1 })
  })

  it('gives no beat for the same numbers, fewer sets, or a lighter top set', () => {
    const base = bench(0, [set(60, 10), set(60, 9), set(60, 8)])
    expect(kinds([base, bench(1, [set(60, 10), set(60, 9), set(60, 8)])], 1)).toEqual([])
    expect(kinds([base, bench(1, [set(60, 10), set(60, 10)])], 1)).toEqual([])
    expect(kinds([base, bench(1, [set(55, 9), set(55, 9), set(55, 9)])], 1)).toEqual([])
  })

  it('leaves warm-ups out of the baseline', () => {
    const list = [bench(0, [warm(100, 1), set(60, 5)]), bench(1, [set(62.5, 5)])]
    expect(winsOf(list, 1).records.weight).toEqual({ v: 62.5, prev: 60 })
  })

  it('gives an excluded entry its records but no beat, and never makes it last time', () => {
    const list = [
      bench(0, [set(60, 5), set(60, 5), set(60, 5)]),
      W(1, [ex('bench', [set(70, 5), set(70, 5), set(70, 5)], { noProg: true })]),
      bench(2, [set(62.5, 5), set(62.5, 5), set(62.5, 5)]),
    ]
    expect(kinds(list, 1)).toEqual(['e1rm', 'volume', 'weight'])
    // judged against session 0, not the excluded 70s
    expect(kinds(list, 2)).toEqual(['beat'])
    expect(winsOf(list, 2).beat).toEqual({ w: 2.5 })
    // a whole session kept out of progression reads the same way
    const whole = [bench(0, [set(60, 5)]), bench(1, [set(70, 5)], { excludeFromProgression: true })]
    expect(winsOf(whole, 1).beat).toBeUndefined()
  })

  it('lets imported history set the baseline and serve as last time, without earning anything', () => {
    const imported = [{ ...bench(0, [set(60, 5)]), id: 'iw0' }, { ...bench(1, [set(62.5, 5)]), id: 'iw1' }]
    expect(winsTimeline(imported).size).toBe(0)
    const after = [...imported, bench(2, [set(60, 5)]), bench(3, [set(65, 5)])]
    // 60 after an imported 62.5: no record, lighter than last time
    expect(kinds(after, 2)).toEqual([])
    expect(kinds(after, 3)).toEqual(['beat', 'e1rm', 'volume', 'weight'])
    expect(winsOf(after, 3).records.weight.prev).toBe(62.5)
  })

  it('reads an assistance machine the other way round', () => {
    const ASSISTED = '0017'
    const list = [
      W(0, [ex(ASSISTED, [set(30, 8)])]),
      W(1, [ex(ASSISTED, [set(20, 8)])]),
      W(2, [ex(ASSISTED, [set(25, 10)])]),
    ]
    // less help is the harder set: a beat, a weight record, no e1RM, no volume from the help
    expect(kinds(list, 1, ASSISTED)).toEqual(['beat', 'weight'])
    expect(winsOf(list, 1, ASSISTED).beat).toEqual({ w: -10 })
    expect(winsOf(list, 1, ASSISTED).records.weight).toEqual({ v: 20, prev: 30 })
    // ten reps with 25 kg of help: nobody did ten with that much help or less before
    expect(kinds(list, 2, ASSISTED)).toEqual(['reps', 'volume'])
    expect(winsOf(list, 2, ASSISTED).records.volume).toEqual({ v: 10, prev: 8, unit: 'reps' })
  })

  it('counts reps on a bodyweight exercise, and a belt as the harder load', () => {
    const pull = (i, rows) => W(i, [{ id: 'pull', target: { mode: 'reps', bodyweight: true }, sets: rows }])
    const list = [
      pull(0, [set(0, 8), set(0, 8), set(0, 6)]),
      pull(1, [set(0, 8), set(0, 8), set(0, 8)]),
      pull(2, [set(0, 10), set(0, 8), set(0, 8)]),
      pull(3, [set(10, 6), set(10, 6), set(10, 6)]),
    ]
    expect(kinds(list, 1, 'pull')).toEqual(['beat', 'volume'])
    expect(winsOf(list, 1, 'pull').records.volume).toEqual({ v: 24, prev: 22, unit: 'reps' })
    expect(kinds(list, 2, 'pull')).toEqual(['beat', 'reps', 'volume'])
    expect(winsOf(list, 2, 'pull').records.reps).toEqual({ w: 0, r: 10, prev: 8 })
    // the first belt: harder than last time, but no weight record over "nothing"
    expect(kinds(list, 3, 'pull')).toEqual(['beat'])
    expect(winsOf(list, 3, 'pull').beat).toEqual({ w: 10 })
  })

  it('reads each side of a per-side set as its own set', () => {
    const one = (i, L, R) => W(i, [{ id: 'split', target: { mode: 'reps', side: true }, sets: [side(L, R)] }])
    const list = [one(0, { w: 20, r: 5 }, { w: 20, r: 5 }), one(1, { w: 20, r: 6 }, { w: 20, r: 5 })]
    expect(readExercise(list[1], 'split').items).toEqual([{ w: 20, r: 6 }, { w: 20, r: 5 }])
    expect(kinds(list, 1, 'split')).toEqual(['beat', 'e1rm', 'reps', 'volume'])
    expect(winsOf(list, 1, 'split').beat).toEqual({ r: 1 })
  })

  it('counts the drops of a drop set towards volume', () => {
    const drop = r => ({ w: 100, r: 5, done: true, type: 'dropset', drops: [{ w: 80, r }] })
    const list = [bench(0, [drop(5)]), bench(1, [drop(6)])]
    expect(kinds(list, 1)).toEqual(['volume'])
    expect(winsOf(list, 1).records.volume).toEqual({ v: 980, prev: 900, unit: 'load' })
  })

  it('reads a rest-pause set as its total', () => {
    const rp = (r, clusters) => ({ w: 60, r, done: true, type: 'restpause', clusters: clusters.map(c => ({ r: c, restSec: 15 })) })
    const list = [bench(0, [rp(10, [6, 4])]), bench(1, [rp(12, [6, 3, 3])])]
    expect(kinds(list, 1)).toEqual(['beat', 'e1rm', 'reps', 'volume'])
    expect(winsOf(list, 1).beat).toEqual({ r: 2 })
  })

  it('judges both halves of a combined day together', () => {
    const day = (i, light) => W(i, [ex('bench', [set(60, 5)], { rid: 'A' }), ex('bench', [set(40, light)], { rid: 'B' })], { routineIds: ['A', 'B'] })
    const list = [day(0, 10), day(1, 12)]
    expect(kinds(list, 1)).toEqual(['reps', 'volume'])
    expect(winsOf(list, 1).records.reps).toEqual({ w: 40, r: 12, prev: 10 })
  })

  it('starts again when an exercise moves to timed holds, and times holds from there', () => {
    const timed = (i, secs) => W(i, [{ id: 'bench', target: { mode: 'time' }, sets: secs.map(s => hold(s)) }])
    const list = [bench(0, [set(60, 5)]), timed(1, [45, 45]), timed(2, [50, 45])]
    expect(kinds(list, 1)).toEqual([])
    expect(kinds(list, 2)).toEqual(['beat', 'hold'])
    expect(winsOf(list, 2).beat).toEqual({ sec: 5 })
    expect(winsOf(list, 2).records.hold).toEqual({ v: 50, prev: 45 })
  })

  it('reads the history in the order it happened, not the order it was stored', () => {
    // session 1 was logged into the past after session 2 was saved
    const list = [bench(0, [set(60, 5)]), bench(2, [set(65, 5)]), bench(1, [set(62.5, 5)])]
    expect(winsOf(list, 1).records.weight).toEqual({ v: 62.5, prev: 60 })
    expect(winsOf(list, 2).records.weight).toEqual({ v: 65, prev: 62.5 })
  })

  it("takes the routine's own last session, else the last one anywhere", () => {
    const at = (i, rid, rows) => W(i, [ex('bench', rows, { rid })], { routineIds: [rid] })
    const list = [at(0, 'A', [set(80, 5)]), at(1, 'B', [set(60, 10)]), at(2, 'A', [set(80, 6)]), at(3, 'C', [set(80, 7)])]
    // against routine A's 80 × 5, not routine B's lighter 60 × 10
    expect(winsOf(list, 2).beat).toEqual({ r: 1 })
    // routine C never trained it: the last session anywhere, A's 80 × 6
    expect(winsOf(list, 3).beat).toEqual({ r: 1 })
  })

  it('keys a workout without an id the way sync does', () => {
    const legacy = { ...bench(1, [set(62.5, 5)]) }
    delete legacy.id
    const list = [bench(0, [set(60, 5)]), legacy]
    expect(workoutKey(legacy)).toBe(`${legacy.d}|${legacy.start}`)
    expect(winsTimeline(list).get(workoutKey(legacy))[0].records.weight.v).toBe(62.5)
  })
})

describe('the timeline cache', () => {
  it('answers the same history array from the cache, and any other array afresh', () => {
    const list = [bench(0, [set(60, 5)]), bench(1, [set(62.5, 5)])]
    const first = winsTimeline(list)
    expect(winsTimeline(list)).toBe(first)
    // the store clones the state on every update: a clone is read again, never trusted
    expect(winsTimeline(JSON.parse(JSON.stringify(list)))).not.toBe(first)
    // an edit that left no stamp still changes the answer
    expect(winsTimeline([list[0], bench(1, [set(57.5, 5)])]).size).toBe(0)
    expect(winsTimeline(null).size).toBe(0)
  })
})

describe('wins in a month', () => {
  it('counts the exercises that won something in workouts dated that month', () => {
    const list = [
      bench(0, [set(60, 5)]),
      W(1, [ex('bench', [set(62.5, 5)]), ex('row', [set(50, 8)])]),
      W(2, [ex('bench', [set(65, 5)]), ex('row', [set(52.5, 8)])]),
    ]
    const month = iso(0).slice(0, 7)
    expect(monthWins(list, month)).toBe(3)
    expect(monthWins(list, '2025-12')).toBe(0)
  })
})

describe('comparing two sessions', () => {
  const read = (secs) => readExercise(W(0, [{ id: 'plank', target: { mode: 'time' }, sets: secs.map(s => hold(s)) }]), 'plank')
  it('times holds: the longest first, then the total, then the weakest', () => {
    expect(compareReads(read([50, 40]), read([45, 45]), 'plank')).toEqual({ sec: 5 })
    expect(compareReads(read([45, 45, 30]), read([45, 45]), 'plank')).toEqual({ sec: 30 })
    expect(compareReads(read([45, 42]), read([45, 40]), 'plank')).toEqual({ sec: 2 })
    expect(compareReads(read([45, 40]), read([45, 40]), 'plank')).toBeNull()
  })

  it('needs both sides in the same mode', () => {
    const reps = readExercise(bench(0, [set(60, 5)]), 'bench')
    expect(compareReads(reps, null, 'bench')).toBeNull()
    expect(compareReads(read([45]), reps, 'plank')).toBeNull()
  })
})

describe('marks on single sets', () => {
  it('marks a heavier set, or more reps at the same weight', () => {
    expect(setMark(set(60, 8), set(60, 9), 'bench', 'reps')).toEqual({ r: 1 })
    expect(setMark(set(60, 8), set(62.5, 6), 'bench', 'reps')).toEqual({ w: 2.5 })
    expect(setMark(set(60, 8), set(60, 8), 'bench', 'reps')).toBeNull()
    expect(setMark(set(60, 8), set(57.5, 10), 'bench', 'reps')).toBeNull()
    expect(setMark(set(60, 8), set(60, 9, false), 'bench', 'reps')).toBeNull()
    expect(setMark(null, set(60, 9), 'bench', 'reps')).toBeNull()
  })

  it('marks less help on an assistance machine, and a longer hold', () => {
    expect(setMark(set(30, 8), set(25, 8), '0017', 'reps')).toEqual({ w: -5 })
    expect(setMark(set(30, 8), set(35, 8), '0017', 'reps')).toBeNull()
    expect(setMark(hold(40), hold(45), 'plank', 'time')).toEqual({ sec: 5 })
  })

  it('lines today’s work sets up with last time’s, warm-ups aside, each side on its own', () => {
    const last = readExercise(bench(0, [set(60, 8), set(60, 8), set(60, 7)]), 'bench')
    const entry = ex('bench', [warm(40, 8), set(60, 8), set(60, 8), set(60, 8), set(60, 9)])
    expect(rowMarks(last, entry)).toEqual([null, null, null, { r: 1 }, null])
    const one = (L, R) => W(0, [{ id: 'split', target: { mode: 'reps', side: true }, sets: [side(L, R)] }])
    const lastSides = readExercise(one({ w: 20, r: 5 }, { w: 20, r: 5 }), 'split')
    const today = { id: 'split', target: { mode: 'reps', side: true }, sets: [side({ w: 20, r: 6 }, { w: 20, r: 5 })] }
    expect(rowMarks(lastSides, today)).toEqual([{ L: { r: 1 }, R: null }])
  })
})

describe('the goal line', () => {
  const last = readExercise(bench(0, [set(60, 8), set(60, 8), set(60, 7)]), 'bench')
  const entry = (target, plan, extra = {}) => ({ id: 'bench', target: { mode: 'reps', ...target }, plan, sets: [], ...extra })

  it('names the target and how far it is past last time', () => {
    expect(goalOf(entry({ sets: 3, reps: 8, weight: 60 }, { kind: 'hold' }), last))
      .toMatchObject({ kind: 'goal', mode: 'reps', sets: 3, reps: 8, weight: 60, delta: { r: 1 } })
    expect(goalOf(entry({ sets: 3, reps: 6, weight: 62.5 }, { kind: 'up' }), last).delta).toEqual({ w: 2.5 })
  })

  it('says first time when there is nothing to beat', () => {
    expect(goalOf(entry({ sets: 3, reps: 8, weight: 60 }, { kind: 'first' }), null).kind).toBe('first')
    expect(goalOf(entry({ sets: 3, reps: 8, weight: 60 }, undefined), null).kind).toBe('first')
  })

  it('calls a deload a deload, and a session kept out of progression just today', () => {
    const deload = goalOf(entry({ sets: 3, reps: 8, weight: 54 }, { kind: 'deload', why: ['x'] }), last)
    expect(deload).toMatchObject({ kind: 'deload', weight: 54, delta: null })
    expect(goalOf(entry({ sets: 3, reps: 8, weight: 40 }, { kind: 'off' }, { noProg: true }), last).kind).toBe('plain')
  })

  it('reads bodyweight, per-side and timed targets', () => {
    expect(goalOf({ id: 'pull', target: { mode: 'reps', bodyweight: true, sets: 3, reps: 10, weight: 0 }, plan: { kind: 'up' }, sets: [] },
      readExercise(W(0, [{ id: 'pull', target: { mode: 'reps', bodyweight: true }, sets: [set(0, 9), set(0, 9), set(0, 9)] }]), 'pull')))
      .toMatchObject({ kind: 'goal', bw: true, reps: 10, delta: { r: 3 } })
    const lastSides = readExercise(W(0, [{ id: 'split', target: { mode: 'reps', side: true }, sets: [side({ w: 20, r: 5 }, { w: 20, r: 5 })] }]), 'split')
    expect(goalOf({ id: 'split', target: { mode: 'reps', side: true, sets: 1, reps: 12, weight: 20 }, plan: { kind: 'hold' }, sets: [] }, lastSides))
      .toMatchObject({ kind: 'goal', perSide: true, reps: 12, delta: { r: 2 } })
    const lastHolds = readExercise(W(0, [{ id: 'plank', target: { mode: 'time' }, sets: [hold(40), hold(40), hold(35)] }]), 'plank')
    expect(goalOf({ id: 'plank', target: { mode: 'time', sets: 3, sec: 45 }, plan: { kind: 'up' }, sets: [] }, lastHolds))
      .toMatchObject({ kind: 'goal', mode: 'time', sec: 45, delta: { sec: 5 } })
  })

  it('has nothing to say about cardio', () => {
    expect(goalOf({ id: 'run', target: { mode: 'cardio', sets: 1 }, sets: [] }, null)).toBeNull()
  })
})

describe('scoring the exercise in progress', () => {
  const history = { workouts: [bench(0, [set(60, 8), set(60, 8), set(60, 7)])] }
  const live = (rows, extra = {}) => ({ id: 'bench', rid: 'A', target: { mode: 'reps', sets: 3, reps: 8, weight: 60 }, plan: { kind: 'hold' }, sets: rows, ...extra })

  it('gives the goal before a set is done, and the win once the sets add up', () => {
    const before = scoreExercise(history, live([set(60, 8, false), set(60, 8, false), set(60, 8, false)]))
    expect(before.goal).toMatchObject({ kind: 'goal', delta: { r: 1 } })
    expect(before.last.items).toHaveLength(3)
    expect(before.live).toBeNull()
    const after = scoreExercise(history, live([set(60, 8), set(60, 8), set(60, 8)]))
    expect(after.live.beat).toEqual({ r: 1 })
    expect(after.live.records.volume).toMatchObject({ v: 1440, prev: 1380 })
  })

  it('does not call two sets out of three a beat', () => {
    expect(scoreExercise(history, live([set(60, 8), set(60, 8), set(60, 8, false)])).live).toBeNull()
  })

  it('gives an exercise kept out of progression no beat', () => {
    const r = scoreExercise(history, live([set(60, 8), set(60, 8), set(60, 8)], { noProg: true }))
    expect(r.live?.beat).toBeUndefined()
  })

  it('has no last time and no win for an exercise never done before', () => {
    const r = scoreExercise({ workouts: [] }, live([set(60, 8)]))
    expect(r.last).toBeNull()
    expect(r.goal.kind).toBe('first')
    expect(r.live).toBeNull()
  })
})
