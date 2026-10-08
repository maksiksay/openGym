import { describe, expect, it } from 'vitest'
import { clearOwnRests, ownRestRange, ownRests } from './rest.js'
import { restSecFor } from './supersetFlow.js'

// A plan file brought its own rest per exercise, and Settings' timer said nothing of it.
const state = () => ({
  restSec: 90,
  routines: [
    { id: 'a', name: 'Upper A', ex: [{ id: '0025', sets: 3, restSec: 150, warmupRestSec: 45 }, { id: '0027', sets: 3, restSec: 120 }, { id: '0201', sets: 2 }] },
    { id: 'w', name: 'Warm-up', kind: 'mobility', ex: [{ id: '3021', sets: 1 }] },
    { id: 'b', name: 'Upper B', ex: [{ id: '9001', sets: 2, restSec: 60 }] },
  ],
  active: { id: 's', routineIds: ['a'], entries: [
    { id: '0025', target: { sets: 3, restSec: 150, warmupRestSec: 45 }, sets: [] },
    { id: '0201', target: { sets: 2 }, sets: [] },
  ] },
})

describe('an exercise’s own rest', () => {
  it('is found across the plan, with the shortest and the longest', () => {
    const S = state()
    expect(ownRests(S).map(x => [x.routine.id, x.cfg.id])).toEqual([['a', '0025'], ['a', '0027'], ['b', '9001']])
    expect(ownRestRange(S)).toEqual([60, 150])
    expect(ownRestRange({ routines: [{ ex: [{ id: '0025' }] }] })).toBeNull()
    expect(ownRests({})).toEqual([])
  })

  it('is cleared in the plan and in the workout under way, so the timer is the rest everywhere', () => {
    const S = state()
    expect(restSecFor(S.active.entries, [0], S.restSec)).toBe(150)
    expect(clearOwnRests(S)).toBe(3)
    expect(ownRests(S)).toEqual([])
    expect(S.routines[0].ex[0]).toEqual({ id: '0025', sets: 3, warmupRestSec: 45 })   // the ramp sets' rest stays
    expect(S.active.entries[0].target).toEqual({ sets: 3, warmupRestSec: 45 })
    expect(restSecFor(S.active.entries, [0], S.restSec)).toBe(90)
  })

  it('leaves a saved workout open for editing as it was', () => {
    const S = state()
    S.active.editingWorkoutId = 'w1'
    clearOwnRests(S)
    expect(S.active.entries[0].target.restSec).toBe(150)
    expect(ownRests(S)).toEqual([])
  })
})
