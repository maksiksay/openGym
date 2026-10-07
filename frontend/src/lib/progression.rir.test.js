// The RIR step (docs/dev/RIR_STEP.md): the rating of the plan's last work set sets the size of the
// next step. 4+ in reserve doubles it when that stays within 10 % of the weight, nothing left
// holds the weight once, and a miss after a short night does not count toward a deload.
import { describe, it, expect } from 'vitest'
import { readSession, nextPrescription, effortZone, EASY_RIR, LIMIT_RIR, MAX_JUMP, SHORT_NIGHT_H } from './progression.js'
import { makeSideSet, syncSideAggregate } from './workout-model.js'

const BENCH = '0025'      // barbell bench press: a 2.5 kg step
const CABLE = '0188'      // cable middle fly: the same step on a much lighter load
const ASSISTED = '0017'   // assisted pull-up: less help is harder (issue #232)
const SITUP = '0001'      // 3/4 sit-up: body weight, climbs in reps

const day = i => '2026-03-' + String(10 + i).padStart(2, '0')
const rate = (rir, rpe) => (rir != null ? { rir } : rpe != null ? { rpe } : {})
// One logged set; a rep count of null is a set never checked off.
const set = (w, r, e = {}) => (r === null ? { w, r: 0, done: false } : { w, r, done: true, ...e })
// A workout of one entry: `reps` at `w` against `goal` reps, the last set rated `rir` (or `rpe`).
const sess = (i, id, w, reps, { goal, rir, rpe } = {}) => ({
  d: day(i),
  entries: [{
    id,
    target: { mode: 'reps', sets: reps.length, reps: goal, weight: w },
    sets: reps.map((r, k) => set(w, r, k === reps.length - 1 ? rate(rir, rpe) : {}))
  }]
})
const state = (workouts, extra = {}) => ({ unit: 'kg', effort: 'rir', workouts, ...extra })

describe('effortZone', () => {
  it('reads a rating into one of three zones, with no gaps for a typed value', () => {
    expect([EASY_RIR, LIMIT_RIR, MAX_JUMP, SHORT_NIGHT_H]).toEqual([4, 1, 0.1, 6])
    expect(effortZone(0)).toBe('limit')
    expect(effortZone(0.5)).toBe('limit')
    expect(effortZone(0.75)).toBe('limit')
    expect(effortZone(1)).toBe('range')
    expect(effortZone(3.5)).toBe('range')
    expect(effortZone(3.75)).toBe('range')
    expect(effortZone(4)).toBe('easy')
    expect(effortZone(7)).toBe('easy')
    expect(effortZone(null)).toBe(null)
    expect(effortZone(undefined)).toBe(null)
  })
})

describe('readSession carries the rating of the plan\'s last work set', () => {
  const T = { mode: 'reps', sets: 3, reps: 8 }
  const read = sets => readSession({ id: BENCH, target: T, sets })

  it('reads RIR, and RPE converted to it', () => {
    expect(read([set(60, 8), set(60, 8), set(60, 8, { rir: 2 })]).rir).toBe(2)
    expect(read([set(60, 8), set(60, 8), set(60, 8, { rpe: 8 })]).rir).toBe(2)
  })

  it('is null when the last set was not rated or not done', () => {
    expect(read([set(60, 8), set(60, 8), set(60, 8)]).rir).toBe(null)
    expect(read([set(60, 8), set(60, 8), { w: 60, r: 8, done: false, rir: 4 }]).rir).toBe(null)
  })

  it('takes the plan\'s last set, not a set added on top or a warm-up', () => {
    const extra = read([set(60, 8), set(60, 8), set(60, 8, { rir: 1 }), set(60, 8, { rir: 4 })])
    expect(extra.rir).toBe(1)
    const warm = read([{ w: 30, r: 8, done: true, phase: 'warmup', rir: 6 }, set(60, 8), set(60, 8), set(60, 8, { rir: 2 })])
    expect(warm.rir).toBe(2)
  })

  it('ignores the rating of a drop set or a rest-pause set', () => {
    expect(read([set(60, 8), set(60, 8), { ...set(60, 8, { rir: 4 }), type: 'dropset', drops: [{ w: 50, r: 8 }] }]).rir).toBe(null)
    expect(read([set(60, 8), set(60, 8), { ...set(60, 8, { rir: 4 }), type: 'restpause', clusters: [{ r: 3, restSec: 15 }] }]).rir).toBe(null)
  })

  it('reads a per-side set by its harder side', () => {
    const side = syncSideAggregate({ ...makeSideSet({ w: 30, r: 16 }), sides: { L: { w: 30, r: 8, done: true, rir: 4 }, R: { w: 30, r: 8, done: true, rir: 1 } } })
    expect(readSession({ id: BENCH, target: { mode: 'reps', sets: 1, reps: 16, side: true }, sets: [side] }).rir).toBe(1)
  })
})

describe('RIR step: linear', () => {
  const cfg = { id: BENCH, sets: 3, reps: 8, prog: 'linear' }
  const after = (w, reps, e = {}) => nextPrescription(state([sess(0, BENCH, w, reps, { goal: 8, ...e })]), cfg)

  it('takes a double step when every rep went with 4+ left', () => {
    const p = after(60, [8, 8, 8], { rir: 4 })
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(65)
    expect(p.why).toEqual(['Every rep with 4+ left — a double step: {0} {1} more.', 5, 'kg'])
  })

  it('doubles at exactly 10 % of the weight, and not above it', () => {
    expect(after(50, [8, 8, 8], { rir: 4 }).weight).toBe(55)
    const p = after(40, [8, 8, 8], { rir: 4 })
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(42.5)
    expect(p.why).toEqual(['Every rep with 4+ left — {0} {1} more (a double step would be over 10 %).', 2.5, 'kg'])
  })

  it('never doubles a light lift, where one step is already a large share', () => {
    const p = nextPrescription(state([sess(0, CABLE, 12.5, [12, 12, 12], { goal: 12, rir: 4 })]), { id: CABLE, sets: 3, reps: 12, prog: 'linear' })
    expect(p.weight).toBe(15)
  })

  it('takes the usual step in range, and when the set was not rated', () => {
    for (const rir of [1, 2, 3, 3.5]) {
      const p = after(60, [8, 8, 8], { rir })
      expect(p.weight, String(rir)).toBe(62.5)
      expect(p.why).toEqual(['Every rep last time — {0} {1} more.', 2.5, 'kg'])
    }
    expect(after(60, [8, 8, 8]).weight).toBe(62.5)
  })

  it('holds the weight when the last set had nothing left', () => {
    for (const rir of [0, 0.5, 0.75]) {
      const p = after(60, [8, 8, 8], { rir })
      expect(p.kind, String(rir)).toBe('hold')
      expect(p.weight).toBe(60)
      expect(p.why).toEqual(['Every rep, nothing left in the tank — the same again, to make it yours.'])
    }
  })

  it('holds only once: the next clean session at that weight steps whatever its rating', () => {
    const twice = state([sess(0, BENCH, 60, [8, 8, 8], { goal: 8, rir: 0 }), sess(1, BENCH, 60, [8, 8, 8], { goal: 8, rir: 0 })])
    expect(nextPrescription(twice, cfg).weight).toBe(62.5)
    // a clean session earlier in the run at this weight counts, even with a miss in between
    const between = state([sess(0, BENCH, 60, [8, 8, 8], { goal: 8, rir: 0 }), sess(1, BENCH, 60, [8, 8, 6], { goal: 8 }), sess(2, BENCH, 60, [8, 8, 8], { goal: 8, rir: 0 })])
    expect(nextPrescription(between, cfg).weight).toBe(62.5)
  })

  it('holds the first clean session at a weight, after misses or a lighter one', () => {
    const afterMiss = state([sess(0, BENCH, 60, [8, 8, 6], { goal: 8 }), sess(1, BENCH, 60, [8, 8, 8], { goal: 8, rir: 0 })])
    expect(nextPrescription(afterMiss, cfg).kind).toBe('hold')
    const afterLighter = state([sess(0, BENCH, 57.5, [8, 8, 8], { goal: 8, rir: 0 }), sess(1, BENCH, 60, [8, 8, 8], { goal: 8, rir: 0 })])
    const p = nextPrescription(afterLighter, cfg)
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(60)
  })

  it('lets the reps decide: a miss rated 4+ is still a miss', () => {
    const p = after(60, [8, 8, 6], { rir: 4 })
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(60)
    expect(p.why[0]).toBe('Missed reps last time — same weight again ({0} of {1} to go).')
  })

  it('reads RPE through RIR', () => {
    const rpe = v => nextPrescription({ ...state([sess(0, BENCH, 60, [8, 8, 8], { goal: 8, rpe: v })]), effort: 'rpe' }, cfg)
    expect(rpe(6).weight).toBe(65)
    expect(rpe(9).weight).toBe(62.5)
    expect(rpe(9.5).kind).toBe('hold')
    expect(rpe(10).kind).toBe('hold')
  })

  it('reads the plan\'s last set, whatever was rated on a set added on top', () => {
    const entry = sets => state([{ d: day(0), entries: [{ id: BENCH, target: { mode: 'reps', sets: 3, reps: 8, weight: 60 }, sets }] }])
    expect(nextPrescription(entry([set(60, 8), set(60, 8), set(60, 8, { rir: 1 }), set(60, 8, { rir: 4 })]), cfg).weight).toBe(62.5)
    expect(nextPrescription(entry([set(60, 8), set(60, 8), set(60, 8, { rir: 4 }), set(60, 8, { rir: 0 })]), cfg).weight).toBe(65)
  })

  it('leaves a drop set and rest-pause to the usual step', () => {
    const last = type => ({ ...set(60, 8, { rir: 4 }), type, ...(type === 'dropset' ? { drops: [{ w: 50, r: 8 }] } : { clusters: [{ r: 3, restSec: 15 }] }) })
    for (const type of ['dropset', 'restpause']) {
      const st = state([{ d: day(0), entries: [{ id: BENCH, target: { mode: 'reps', sets: 3, reps: 8, weight: 60 }, sets: [set(60, 8), set(60, 8), last(type)] }] }])
      expect(nextPrescription(st, cfg).weight, type).toBe(62.5)
    }
  })

  it('leaves Greyskull to its own double jump', () => {
    const gs = { id: BENCH, sets: 3, reps: 5, prog: 'greyskull' }
    const p = nextPrescription(state([sess(0, BENCH, 60, [5, 5, 7], { goal: 5, rir: 4 })]), gs)
    expect(p.weight).toBe(62.5)
    expect(p.why).toEqual(['Every rep last time — {0} {1} more.', 2.5, 'kg'])
  })
})

describe('RIR step: double progression', () => {
  const cfg = { id: BENCH, sets: 3, reps: 12, repsMin: 8, prog: 'double' }
  const after = (w, reps, goal, e = {}) => nextPrescription(state([sess(0, BENCH, w, reps, { goal, ...e })]), cfg)

  it('takes a double step at the top of the range with 4+ left', () => {
    const p = after(60, [12, 12, 12], 12, { rir: 4 })
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(65)
    expect(p.reps).toBe(8)
    expect(p.why).toEqual(['Top of the rep range with 4+ left — a double step: {0} {1} more, back to {2} reps.', 5, 'kg', 8])
  })

  it('keeps one step at the top when a double one would be over 10 %', () => {
    const p = after(40, [12, 12, 12], 12, { rir: 4 })
    expect(p.weight).toBe(42.5)
    expect(p.reps).toBe(8)
    expect(p.why).toEqual(['Top of the rep range with 4+ left — {0} {1} more, back to {2} reps (a double step would be over 10 %).', 2.5, 'kg', 8])
  })

  it('aims two reps higher below the top with 4+ left, never past the top', () => {
    const p = after(40, [9, 9, 9], 9, { rir: 4 })
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(40)
    expect(p.reps).toBe(11)
    expect(p.why).toEqual(['Same weight — 4+ left last time, so aim for {0} reps.', 11])
    expect(after(40, [11, 11, 11], 11, { rir: 4 }).reps).toBe(12)
  })

  it('climbs one rep as before after a miss rated 4+, and at the limit', () => {
    expect(after(40, [10, 9, 9], 10, { rir: 4 }).reps).toBe(10)
    const limit = after(40, [9, 9, 9], 9, { rir: 0 })
    expect(limit.reps).toBe(10)
    expect(limit.why).toEqual(['Same weight — aim for {0} reps this time.', 10])
  })

  it('still steps at the top of the range when the last set had nothing left', () => {
    const p = after(40, [12, 12, 12], 12, { rir: 0 })
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(42.5)
    expect(p.why).toEqual(['Top of the rep range in every set — {0} {1} more, back to {2} reps.', 2.5, 'kg', 8])
  })
})

describe('RIR step: bodyweight', () => {
  const cfg = { id: SITUP, sets: 3, reps: 10, weight: 0, prog: 'linear', bodyweight: true }
  const after = (reps, goal, e = {}, c = cfg) => nextPrescription(state([sess(0, SITUP, 0, reps, { goal, ...e })]), c)

  it('climbs two reps instead of one with 4+ left', () => {
    const p = after([10, 10, 10], 10, { rir: 4 })
    expect(p.kind).toBe('up')
    expect(p.reps).toBe(12)
    expect(p.why).toEqual(['Bodyweight — every rep with 4+ left, so go for {0}.', 12])
  })

  it('stops at the ceiling', () => {
    expect(after([14, 14, 14], 14, { rir: 4 }, { ...cfg, repsMax: 15 }).reps).toBe(15)
  })

  it('climbs a unilateral total by two steps, two reps a side', () => {
    expect(after([16, 16, 16], 16, { rir: 4 }, { ...cfg, reps: 16, side: true }).reps).toBe(20)
  })

  it('climbs one rep as before in range and at the limit', () => {
    expect(after([10, 10, 10], 10, { rir: 2 }).reps).toBe(11)
    expect(after([10, 10, 10], 10, { rir: 0 }).reps).toBe(11)
  })
})

describe('RIR step: assistance machines', () => {
  const cfg = { id: ASSISTED, sets: 3, reps: 8, prog: 'linear', inc: 2.5 }
  const after = (help, e = {}, extra = {}) => nextPrescription(state([sess(0, ASSISTED, help, [8, 8, 8], { goal: 8, ...e })], extra), cfg)

  it('takes a double step of less help when the work left is large enough', () => {
    // 80 kg body, 30 kg of help: 50 kg of work, and 5 kg is 10 % of it
    const p = after(30, { rir: 4 }, { bodyweight: [{ d: day(0), w: 80 }] })
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(25)
    expect(p.why).toEqual(['Every rep with 4+ left — a double step: {0} {1} less help.', 5, 'kg'])
  })

  it('keeps one step when the work left is small, or no weigh-in says what it is', () => {
    const small = after(30, { rir: 4 }, { bodyweight: [{ d: day(0), w: 60 }] })
    expect(small.weight).toBe(27.5)
    expect(small.why).toEqual(['Every rep with 4+ left — {0} {1} less help (a double step would be over 10 %).', 2.5, 'kg'])
    expect(after(30, { rir: 4 }).weight).toBe(27.5)
  })

  it('reads the latest weigh-in by date', () => {
    const p = after(30, { rir: 4 }, { bodyweight: [{ d: day(5), w: 80 }, { d: day(1), w: 60 }] })
    expect(p.weight).toBe(25)
  })

  it('holds the help when the last set had nothing left', () => {
    const p = after(30, { rir: 0 }, { bodyweight: [{ d: day(0), w: 80 }] })
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(30)
  })
})

describe('RIR step: per-side sets', () => {
  const cfg = { id: BENCH, sets: 1, reps: 16, prog: 'linear', side: true }
  const sideSet = (w, L, R) => syncSideAggregate({ ...makeSideSet({ w, r: 16 }), sides: { L: { w, r: 8, done: true, rir: L }, R: { w, r: 8, done: true, rir: R } } })
  const after = (w, L, R) => nextPrescription(state([{ d: day(0), entries: [{ id: BENCH, target: { mode: 'reps', sets: 1, reps: 16, side: true, weight: w }, sets: [sideSet(w, L, R)] }] }]), cfg)

  it('lets the harder side decide', () => {
    expect(after(50, 4, 4).weight).toBe(55)
    expect(after(50, 4, 1).weight).toBe(52.5)
  })
})

describe('short nights', () => {
  const cfg = { id: BENCH, sets: 3, reps: 8, prog: 'linear' }
  const miss = i => sess(i, BENCH, 60, [8, 8, 6], { goal: 8 })
  const night = (i, sleep) => ({ d: day(i), sleep })

  it('does not count a miss after a short night toward a deload', () => {
    const p = nextPrescription(state([miss(0), miss(1), miss(2)], { health: [night(1, 5)] }), cfg)
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(60)
    expect(p.why).toEqual(['Missed reps last time — same weight again ({0} of {1} to go).', 1, 3])
  })

  it('says so after the short night itself, and asks for the same target', () => {
    const p = nextPrescription(state([miss(0), miss(1)], { health: [night(1, 5.5)] }), cfg)
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(60)
    expect(p.why).toEqual(['Short night ({0} h) — the same target again; this miss does not count.', 5.5])
  })

  it('repeats the reps it asked for under double progression, not one more than the worst set', () => {
    const dbl = { id: BENCH, sets: 3, reps: 12, repsMin: 8, prog: 'double' }
    const st = state([sess(0, BENCH, 40, [10, 10, 10], { goal: 10 }), sess(1, BENCH, 40, [11, 9, 8], { goal: 11 })], { health: [night(1, 5)] })
    const p = nextPrescription(st, dbl)
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(40)
    expect(p.reps).toBe(11)
    expect(p.why[0]).toBe('Short night ({0} h) — the same target again; this miss does not count.')
  })

  it('still deloads when three misses on ordinary nights came before it', () => {
    const p = nextPrescription(state([miss(0), miss(1), miss(2), miss(3)], { health: [night(3, 4)] }), cfg)
    expect(p.kind).toBe('deload')
  })

  it('treats a miss as ordinary with no sleep logged, or six hours or more', () => {
    expect(nextPrescription(state([miss(0), miss(1), miss(2)]), cfg).kind).toBe('deload')
    expect(nextPrescription(state([miss(0), miss(1), miss(2)], { health: [night(2, 6)] }), cfg).kind).toBe('deload')
    expect(nextPrescription(state([miss(0), miss(1), miss(2)], { health: [{ d: day(2), steps: 9000 }] }), cfg).kind).toBe('deload')
  })

  it('counts a hit after a short night as a hit', () => {
    const p = nextPrescription(state([sess(0, BENCH, 60, [8, 8, 8], { goal: 8 })], { health: [night(0, 4)] }), cfg)
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(62.5)
  })

  it('covers timed holds too', () => {
    const timed = { id: BENCH, mode: 'time', sets: 2, sec: 45, prog: 'time' }
    const hold = i => ({ d: day(i), entries: [{ id: BENCH, target: { sets: 2, sec: 45, mode: 'time' }, sets: [{ sec: 45, w: 0, done: true }, { sec: 30, w: 0, done: true }] }] })
    const p = nextPrescription(state([hold(0), hold(1), hold(2)], { health: [night(2, 5)] }), timed)
    expect(p.kind).toBe('hold')
    expect(p.why[0]).toBe('Short night ({0} h) — the same target again; this miss does not count.')
  })
})

describe('the first session', () => {
  const hint = 'First time: add weight through your warm-ups until {0} reps leave about 2 in reserve — that is your working weight.'
  const first = (cfg, extra = {}) => nextPrescription({ unit: 'kg', workouts: [], effort: 'rir', ...extra }, cfg)

  it('tells a loaded lift how to find its working weight when effort is on', () => {
    const p = first({ id: BENCH, sets: 3, reps: 8, prog: 'linear' })
    expect(p.kind).toBe('first')
    expect(p.weight).toBeUndefined()
    expect(p.why).toEqual([hint, 8])
    expect(p.calibrate).toBe(true)
    expect(first({ id: BENCH, sets: 3, reps: 15, repsMin: 10, prog: 'double' }).why).toEqual([hint, 10])
    expect(first({ id: BENCH, sets: 3, reps: 8, prog: 'linear' }, { effort: 'rpe' }).why).toEqual([hint, 8])
  })

  it('keeps the old sentence with effort off, and for work with no weight to add', () => {
    const old = ['Nothing logged yet — this session sets the baseline.']
    expect(first({ id: BENCH, sets: 3, reps: 8, prog: 'linear' }, { effort: 'none' }).why).toEqual(old)
    expect(first({ id: BENCH, sets: 3, reps: 8, prog: 'linear' }, { effort: 'none' }).calibrate).toBeUndefined()
    expect(first({ id: BENCH, sets: 3, reps: 8, prog: 'linear' }, { effort: null }).why).toEqual(old)
    expect(first({ id: SITUP, sets: 3, reps: 10, weight: 0, prog: 'linear', bodyweight: true }).why).toEqual(old)
    expect(first({ id: ASSISTED, sets: 3, reps: 8, prog: 'linear' }).why).toEqual(old)
    expect(first({ id: BENCH, mode: 'time', sets: 2, sec: 45, prog: 'time' }).why).toEqual(old)
  })
})
