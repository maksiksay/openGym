import { describe, it, expect } from 'vitest'
import { autoMonthGoal, monthGoalOf, monthQuota, prevMonth, DEFAULT_MONTH_GOAL, MAX_MONTH_GOAL } from './quota.js'

const w = (d, extra = {}) => ({ id: d + Math.random(), d, start: Date.parse(d + 'T18:00:00Z'), entries: [], ...extra })

describe('the goal', () => {
  it('is four weeks of the plan: the weekdays holding a routine, a combined day once', () => {
    expect(autoMonthGoal({ week: { 1: ['a'], 3: ['b'], 5: ['a', 'b'] } })).toBe(12)
    expect(autoMonthGoal({ week: { 1: ['a'], 4: ['b'] } })).toBe(8)
    expect(autoMonthGoal({ week: { 0: [], 2: ['a'] } })).toBe(4)
  })

  it('falls back to eight a month without a plan', () => {
    expect(autoMonthGoal({ week: {} })).toBe(DEFAULT_MONTH_GOAL)
    expect(autoMonthGoal({})).toBe(8)
  })

  it('takes the number you set, whole and at most every day of a month', () => {
    const plan = { week: { 1: ['a'], 4: ['b'] } }
    expect(monthGoalOf({ ...plan, monthGoal: 10 })).toBe(10)
    expect(monthGoalOf({ ...plan, monthGoal: 7.6 })).toBe(8)
    expect(monthGoalOf({ ...plan, monthGoal: 40 })).toBe(MAX_MONTH_GOAL)
    for (const unset of [null, undefined, 0, -3, 'x']) expect(monthGoalOf({ ...plan, monthGoal: unset })).toBe(8)
  })
})

describe('the month', () => {
  const S = {
    week: { 1: ['a'], 4: ['b'] },
    workouts: [
      w('2026-09-02'), w('2026-09-20'),
      w('2026-10-01'), w('2026-10-03'), w('2026-10-03'), w('2026-10-15'),
      w('2026-11-01'),
    ],
  }

  it('counts training days, not workouts, in the calendar month of the day asked about', () => {
    expect(monthQuota(S, '2026-10-20')).toEqual({ month: '2026-10', done: 3, goal: 8, auto: true, met: false, extra: 0, prevDone: 2 })
  })

  it('is met at the goal, and counts the days past it', () => {
    expect(monthQuota({ ...S, monthGoal: 3 }, '2026-10-20')).toMatchObject({ done: 3, goal: 3, auto: false, met: true, extra: 0 })
    expect(monthQuota({ ...S, monthGoal: 2 }, '2026-10-20')).toMatchObject({ met: true, extra: 1 })
  })

  it('starts every month from nothing, and looks back across a new year', () => {
    expect(monthQuota(S, '2026-12-01')).toMatchObject({ month: '2026-12', done: 0, prevDone: 1 })
    expect(prevMonth('2027-01')).toBe('2026-12')
    expect(prevMonth('2026-10')).toBe('2026-09')
  })

  it('counts any workout: freestyle, a deload, a single set, one logged into the past or imported', () => {
    const any = { workouts: [
      w('2026-10-01', { routineIds: [] }),
      w('2026-10-02', { excludeFromProgression: true }),
      w('2026-10-04', { id: 'iw1' }),
    ] }
    expect(monthQuota(any, '2026-10-05').done).toBe(3)
  })

  it('reads the day of a record whose date got mangled from its start', () => {
    const odd = { workouts: [{ id: 'x', d: 'not a day', start: Date.parse('2026-10-03T18:00:00'), entries: [] }] }
    expect(monthQuota(odd, '2026-10-05').done).toBe(1)
  })

  it('reads an empty profile as nothing done', () => {
    expect(monthQuota({}, '2026-10-05')).toMatchObject({ done: 0, goal: 8, met: false, prevDone: 0 })
  })
})
