import { describe, it, expect } from 'vitest'
import { nextUp, usesWeek, rotationOf } from './rotation.js'

const ex = [{ id: '0043', sets: 3, reps: 5 }]
const R = (id, extra = {}) => ({ id, name: id, ex, ...extra })
const W = (day, routineIds, extra = {}) => ({ id: 'w' + day + routineIds.join(''), d: `2026-10-0${day}`, start: Date.parse(`2026-10-0${day}T18:00:00`), routineIds, entries: [], ...extra })
const TODAY = '2026-10-09'
const S = (extra = {}) => ({ routines: [R('A'), R('B')], week: {}, dayPlan: {}, workouts: [], ...extra })
const up = st => nextUp(st, TODAY)?.id ?? null

describe('the next session without a weekly plan', () => {
  it('offers the first routine before anything is trained', () => {
    expect(up(S())).toBe('A')
  })

  it('offers the routine after the one trained last, and wraps around', () => {
    expect(up(S({ workouts: [W(1, ['A'])] }))).toBe('B')
    expect(up(S({ workouts: [W(1, ['A']), W(3, ['B'])] }))).toBe('A')
    const three = { routines: [R('A'), R('B'), R('C')] }
    expect(up(S({ ...three, workouts: [W(1, ['A']), W(3, ['B'])] }))).toBe('C')
  })

  it('follows the order of the Plan, not the order the routines were trained in', () => {
    expect(up(S({ routines: [R('B'), R('A')], workouts: [W(1, ['B'])] }))).toBe('A')
    expect(up(S({ routines: [R('B'), R('A')], workouts: [W(1, ['A'])] }))).toBe('B')
  })

  it('reads the last session by when it happened, so one logged into the past does not count as last', () => {
    // B on the 3rd, then A logged afterwards for the 1st
    expect(up(S({ workouts: [W(3, ['B']), W(1, ['A'])] }))).toBe('A')
  })

  it('counts a combined session by its routine that comes last in the Plan', () => {
    expect(up(S({ workouts: [W(1, ['A', 'B'])] }))).toBe('A')
    expect(up(S({ routines: [R('A'), R('B'), R('C')], workouts: [W(1, ['B', 'A'])] }))).toBe('C')
  })

  it('leaves deload, rehab and empty routines out of the turns', () => {
    const routines = [R('A'), R('D', { excludeFromProgression: true }), R('E', { ex: [] }), R('B')]
    expect(rotationOf({ routines }).map(r => r.id)).toEqual(['A', 'B'])
    expect(up(S({ routines, workouts: [W(1, ['A'])] }))).toBe('B')
    // a deload session in between does not move the turn
    expect(up(S({ routines, workouts: [W(1, ['A']), W(2, ['D'])] }))).toBe('B')
  })

  it('skips a session whose routines are gone, for the one before it', () => {
    expect(up(S({ workouts: [W(1, ['A']), W(2, ['deleted'])] }))).toBe('B')
    expect(up(S({ workouts: [W(2, ['deleted'])] }))).toBe('A')
  })

  it('reads a session saved before routineIds by its routineId', () => {
    const legacy = { ...W(1, []), routineIds: undefined, routineId: 'A' }
    expect(up(S({ workouts: [legacy] }))).toBe('B')
  })

  it('is off while the weekly plan holds a routine on any day', () => {
    expect(usesWeek({ week: { 1: ['A'] } })).toBe(true)
    expect(usesWeek({ week: { 1: [], 3: [] } })).toBe(false)
    expect(up(S({ week: { 1: ['A'] } }))).toBeNull()
    expect(up(S({ week: { 1: [], 3: [] } }))).toBe('A')
  })

  it('gives way to a day marked by hand', () => {
    expect(up(S({ dayPlan: { [TODAY]: 'rest' } }))).toBeNull()
    expect(up(S({ dayPlan: { [TODAY]: 'B' } }))).toBeNull()
    expect(up(S({ dayPlan: { '2026-10-08': 'rest' } }))).toBe('A')
  })

  it('has nothing to offer without a routine with exercises', () => {
    expect(up(S({ routines: [] }))).toBeNull()
    expect(up(S({ routines: [R('E', { ex: [] })] }))).toBeNull()
    expect(nextUp({}, TODAY)).toBeNull()
  })
})
