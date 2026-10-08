import { describe, expect, it } from 'vitest'
import { monthQuota, autoMonthGoal } from './quota.js'
import { winsOf } from './scoreboard.js'
import { entriesForExercise, bestWeightFor } from './history.js'
import { loadOfWorkouts } from './muscles.js'
import { rotationOf } from './rotation.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { buildPlanBundle, mergePlan } from './plan-share.js'
import { settlesDay } from './workout-model.js'

// docs/dev/WARMUPS.md: warm-up and recovery work is kept and shown, and counted for nothing.
const set = (w, r) => ({ w, r, done: true })
const ex = (id, sets, extra = {}) => ({ id, target: { mode: 'reps' }, sets, ...extra })
const W = (id, d, entries, extra = {}) => ({ id, d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T19:00:00'), entries, ...extra })

describe('warm-up and recovery work counts for nothing', () => {
  const workouts = [
    W('a', '2026-10-01', [ex('0025', [set(60, 8), set(60, 8)])]),
    // A warm-up before training: the incline T-raise is the warm-up's, the bench the training's.
    W('b', '2026-10-03', [ex('3542', [set(5, 20)], { mobility: true, noProg: true, rid: 'w' }), ex('0025', [set(60, 9)])]),
    // Recovery on its own, on a day with no training.
    W('c', '2026-10-04', [ex('3542', [set(8, 30)], { mobility: true, noProg: true })], { mobility: true }),
  ]

  it('is no training day for the quota', () => {
    expect(monthQuota({ workouts, monthGoal: 8 }, '2026-10-15').done).toBe(2)
  })

  it('sets no record, wins nothing and adds no muscle load', () => {
    expect(entriesForExercise(workouts[1], '3542')).toEqual([])
    expect(bestWeightFor({ workouts }, '3542')).toBe(0)
    expect(winsOf(workouts, workouts[2])).toEqual([])
    expect(winsOf(workouts, workouts[1]).length).toBeGreaterThan(0)     // the bench's extra rep still wins
    const withWarmup = loadOfWorkouts([workouts[1]])
    const without = loadOfWorkouts([{ ...workouts[1], entries: [workouts[1].entries[1]] }])
    expect(withWarmup).toEqual(without)
  })

  it('takes no turn, and a weekday of nothing but it is no training day for the goal', () => {
    const S = { routines: [{ id: 'up', name: 'Upper', ex: [{ id: '0025' }] }, { id: 'w', name: 'Warm-up', kind: 'mobility', ex: [{ id: '3021' }] }],
      week: { 1: ['up'], 3: ['w'] } }
    expect(rotationOf(S).map(r => r.id)).toEqual(['up'])
    expect(autoMonthGoal(S)).toBe(4)
  })

  it('settles a day that planned nothing but recovery, and no training day', () => {
    const up = { id: 'up', ex: [] }, rec = { id: 'rec', kind: 'mobility', ex: [] }
    expect(settlesDay(workouts[2], [up])).toBe(false)
    expect(settlesDay(workouts[2], [])).toBe(false)
    expect(settlesDay(workouts[2], [rec])).toBe(true)
    expect(settlesDay(workouts[0], [up])).toBe(true)
    expect(settlesDay(workouts[1], [rec])).toBe(true)
  })

  it('is saved with its flags, and the session is known by its training routine', () => {
    const active = { id: 's', d: '2026-10-05', start: 1, routineIds: ['w', 'up'], name: 'Upper', entries: [
      { ...ex('3021', [set(0, 12)]), mobility: true, noProg: true, rid: 'w' },
      { ...ex('0025', [set(60, 8)]), rid: 'up' },
    ] }
    const w = buildCompletedWorkout(active, { end: 2 })
    expect(w.entries.map(e => !!e.mobility)).toEqual([true, false])
    expect(w.mobility).toBeUndefined()
    expect(w.routineId).toBe('up')
    const alone = buildCompletedWorkout({ ...active, routineIds: ['w'], entries: [active.entries[0]] }, { end: 2 })
    expect(alone.mobility).toBe(true)
  })

  it('travels in a plan file with its warm-up link', () => {
    const S = { unit: 'kg', customEx: [], week: {}, routines: [
      { id: 'w', name: 'Warm-up', emoji: 'stretch', kind: 'mobility', preset: 'warmup-upper', ex: [{ id: '3021', sets: 1, reps: 12, weight: 0, prog: 'off' }] },
      { id: 'up', name: 'Upper', emoji: 'barbell', warmup: 'w', ex: [{ id: '0025', sets: 3, reps: 8, weight: 60 }] },
    ] }
    const bundle = buildPlanBundle(S, 'Mine')
    const into = { unit: 'kg', customEx: [], week: {}, routines: [] }
    mergePlan(into, JSON.parse(JSON.stringify(bundle)))
    const [w, up] = into.routines
    expect(w).toMatchObject({ kind: 'mobility', preset: 'warmup-upper' })
    expect(up.warmup).toBe(w.id)
    expect(w.id).not.toBe('w')
  })
})
