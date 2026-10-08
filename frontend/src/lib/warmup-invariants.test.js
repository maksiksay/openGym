import { describe, expect, it } from 'vitest'
import { workoutVolume, insertWarmupRow, buildSets, rerampWarmups, warmupRamp } from './history.js'
import { applyPrescription } from './progression.js'

// The config sheet tells users warm-ups are "left out of volume, records and progression",
// and history.js repeats that as an invariant in a comment. Volume was the one place it
// was false — harmless while warm-ups were hand-added and rare, wrong now that a routine
// plans them by default and the number is written into the saved workout for good.
describe('warm-ups and volume', () => {
  const w = {
    entries: [{
      id: 'bench',
      sets: [
        { w: 50, r: 5, done: true, phase: 'warmup', warmup: true },
        { w: 75, r: 5, done: true, phase: 'warmup', warmup: true },
        { w: 87.5, r: 5, done: true, phase: 'warmup', warmup: true },
        { w: 100, r: 5, done: true },
        { w: 100, r: 5, done: true },
        { w: 100, r: 5, done: true },
      ],
    }],
  }

  it('counts only the work sets', () => {
    expect(workoutVolume(w)).toBe(1500)
  })

  it('a warm-up adds nothing, whatever it weighs', () => {
    const heavy = { entries: [{ id: 'b', sets: [{ w: 200, r: 10, done: true, phase: 'warmup', warmup: true }] }] }
    expect(workoutVolume(heavy)).toBe(0)
  })
})

// A warm-up must never be heavier than the set it warms you up for. The ramp branch clamps
// to the work weight; the early-return branch did not, so a hand-edited warm-up above the
// work weight propagated into every warm-up added after it.
describe('a warm-up never outweighs the work set', () => {
  // The 120 is something the user typed, and it stays: silently rewriting their own edit
  // would be worse than leaving it. What must not happen is the NEW row inheriting it, which
  // is how one bad number used to spread through the whole warm-up block.
  it('does not copy a hand-edited warm-up that sits above the work weight', () => {
    const rows = [{ warmup: true, phase: 'warmup', w: 120, r: 5 }, { w: 100, r: 5 }]
    const out = insertWarmupRow(rows, 'reps', { reps: 5 }, 2.5)
    expect(out.map(r => r.w)).toEqual([120, 100, 100])
    expect(out[1].phase).toBe('warmup')
  })

  it('still ramps normally when the previous warm-up is below the work weight', () => {
    const rows = [{ warmup: true, phase: 'warmup', w: 50, r: 5 }, { w: 100, r: 5 }]
    const out = insertWarmupRow(rows, 'reps', { reps: 5 }, 2.5)
    expect(out.filter(r => r.phase === 'warmup').map(r => r.w)).toEqual([50, 75])
  })
})

// buildSets prepends the warm-ups, then applyPrescription rewrites the WORK rows only — so a
// ramp built against last session's weight is stale the moment progression moves. On a deload
// that put the last warm-up above every work set.
describe('the ramp follows the prescribed weight', () => {
  const S = { workouts: [], exWeights: {}, routines: [] }
  const cfg = { id: 'bench', sets: 3, reps: 5, weight: 100, warmupSets: 2 }

  it('re-ramps after a deload instead of aiming at the old weight', () => {
    const rows = applyPrescription(buildSets(S, cfg, { step: 2.5 }), { kind: 'deload', weight: 50 })
    const warm = rows.filter(r => r.phase === 'warmup').map(r => r.w)
    const work = rows.filter(r => r.phase !== 'warmup').map(r => r.w)
    expect(work).toEqual([50, 50, 50])
    for (const x of warm) expect(x).toBeLessThanOrEqual(50)
    expect(warm).toEqual([25, 37.5])
  })

  it('re-ramps after a bump', () => {
    const rows = applyPrescription(buildSets(S, cfg, { step: 2.5 }), { kind: 'up', weight: 150 })
    expect(rows.filter(r => r.phase !== 'warmup').map(r => r.w)).toEqual([150, 150, 150])
    expect(rows.filter(r => r.phase === 'warmup').map(r => r.w)).toEqual([75, 112.5])
  })
})

// On an assistance machine the number is help: a warm-up with less of it is harder than the work
// sets. The ramp climbed from 0 toward the work's number all the same, so every warm-up of an
// assisted pull-up came out heavier than the sets it was meant to warm you up for.
describe('an assistance machine warms up with more help, not less', () => {
  const ASSISTED = '0017'   // assisted pull-up
  const S = { workouts: [], exWeights: {}, routines: [], bodyweight: [{ d: '2026-10-01', w: 72 }] }
  const helpOf = rows => rows.filter(r => r.phase === 'warmup').map(r => r.w)

  it('ramps down from your body weight to the work\'s help, a notch more help when it rounds', () => {
    const ramp = warmupRamp(S, { id: ASSISTED })
    expect(ramp).toEqual({ assisted: true, bw: 72 })
    let rows = [{ w: 30, r: 8 }]
    rows = insertWarmupRow(rows, 'reps', { reps: 8 }, 2.5, ramp)
    rows = insertWarmupRow(rows, 'reps', { reps: 8 }, 2.5, ramp)
    // 42 kg of you on the work sets; the warm-ups leave you about half and three quarters of it.
    expect(rows.map(r => r.w)).toEqual([52.5, 42.5, 30])
  })

  it('without a weigh-in starts from twice the work\'s help', () => {
    const ramp = warmupRamp({ ...S, bodyweight: [] }, { id: ASSISTED })
    expect(ramp).toEqual({ assisted: true, bw: null })
    let rows = [{ w: 30, r: 8 }]
    rows = insertWarmupRow(rows, 'reps', { reps: 8 }, 2.5, ramp)
    rows = insertWarmupRow(rows, 'reps', { reps: 8 }, 2.5, ramp)
    expect(rows.map(r => r.w)).toEqual([45, 37.5, 30])
    expect(insertWarmupRow([{ w: 0, r: 8 }], 'reps', { reps: 8 }, 2.5, ramp)[0].w).toBe(0)
  })

  it('a logged warm-up stays and the next one ramps down from it', () => {
    const rows = [
      { w: 50, r: 8, done: true, phase: 'warmup', warmup: true },
      { w: 0, r: 8, phase: 'warmup', warmup: true },
      { w: 30, r: 8 },
    ]
    expect(rerampWarmups(rows, 2.5, { assisted: true, bw: 72 }).map(r => r.w)).toEqual([50, 40, 30])
    // One logged with less help than the work sets is not ramped from: the next is the work's own.
    rows[0] = { ...rows[0], w: 20 }
    expect(rerampWarmups(rows, 2.5, { assisted: true, bw: 72 }).map(r => r.w)).toEqual([20, 30, 30])
  })

  it('follows the prescription: less help on the work sets, the warm-ups re-ramped toward it', () => {
    const cfg = { id: ASSISTED, sets: 3, reps: 8, weight: 30, warmupSets: 2 }
    const built = buildSets(S, cfg, { step: 2.5 })
    expect(helpOf(built)).toEqual([52.5, 42.5])
    const rows = applyPrescription(built, { kind: 'up', weight: 25 }, 2.5, warmupRamp(S, cfg))
    expect(rows.filter(r => r.phase !== 'warmup').map(r => r.w)).toEqual([25, 25, 25])
    expect(helpOf(rows)).toEqual([50, 37.5])
  })

  it('leaves an ordinary lift\'s ramp as it was', () => {
    expect(warmupRamp(S, { id: 'bench' })).toEqual({})
    expect(warmupRamp(S, { id: ASSISTED, assisted: false })).toEqual({})
    const cfg = { id: 'bench', sets: 3, reps: 5, weight: 100, warmupSets: 2 }
    expect(helpOf(buildSets(S, cfg, { step: 2.5 }))).toEqual([50, 75])
  })
})
