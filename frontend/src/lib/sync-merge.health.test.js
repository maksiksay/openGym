// The health log, meals and foods through the same merge two devices' copies go through.
import { describe, expect, it } from 'vitest'
import { mergeStates, resetIdsOf, sinceReset } from './sync-merge.js'
import { syncFingerprint, countChanges } from './sync-changes.js'

const base = (over = {}) => ({ unit: 'kg', workouts: [], routines: [], bodyweight: [], customEx: [], ...over })

describe('health in mergeStates', () => {
  it('keeps both devices\' halves of one day', () => {
    const phone = base({ _ts: 100, health: [{ d: '2026-10-05', t: 100, sleep: 7, energy: 4 }] })
    const server = base({ _ts: 200, health: [{ d: '2026-10-05', t: 150, steps: 8000 }] })
    expect(mergeStates(phone, server).health).toEqual([{ d: '2026-10-05', t: 150, sleep: 7, energy: 4, steps: 8000 }])
  })
  it('leaves a copy without a health log as it was', () => {
    expect('health' in mergeStates(base({ _ts: 1 }), base({ _ts: 2 }))).toBe(false)
  })
})

describe('meals and foods in mergeStates', () => {
  it('unites rows and keeps the version edited last, whichever copy is newer', () => {
    const a = base({ _ts: 300, meals: [{ id: 'm1', t: 10, g: 100 }, { id: 'm2', t: 20, g: 50 }] })
    const b = base({ _ts: 100, meals: [{ id: 'm1', t: 30, g: 150 }, { id: 'm3', t: 5, g: 70 }] })
    const out = mergeStates(a, b).meals
    expect(out.map(m => m.id).sort()).toEqual(['m1', 'm2', 'm3'])
    expect(out.find(m => m.id === 'm1').g).toBe(150)
  })
  it('does the same for the food library', () => {
    const a = base({ _ts: 2, foods: [{ id: 'f', t: 1, name: 'old' }] })
    const b = base({ _ts: 1, foods: [{ id: 'f', t: 9, name: 'fixed label' }] })
    expect(mergeStates(a, b).foods).toEqual([{ id: 'f', t: 9, name: 'fixed label' }])
  })
})

describe('reset', () => {
  it('names health days, meals and foods, and drops exactly those from a copy that missed it', () => {
    const before = base({ health: [{ d: '2026-10-01', t: 1, sleep: 7 }], meals: [{ id: 'm1', t: 1 }], foods: [{ id: 'f1', t: 1 }] })
    const ids = resetIdsOf(before)
    expect(ids.health).toEqual(['2026-10-01|1'])
    expect(ids.meals).toEqual(['m1'])
    const stale = base({ health: [...before.health, { d: '2026-10-02', t: 5, sleep: 6 }], meals: [...before.meals, { id: 'm2', t: 5 }], foods: before.foods })
    const kept = sinceReset(stale, 3, ids)
    expect(kept.health.map(e => e.d)).toEqual(['2026-10-02'])
    expect(kept.meals.map(m => m.id)).toEqual(['m2'])
    expect(kept.foods).toEqual([])
  })
  it('without names falls back to time', () => {
    const stale = base({ health: [{ d: 'a', t: 1 }, { d: 'b', t: 9 }], meals: [{ id: 'x', t: 1 }] })
    const kept = sinceReset(stale, 5, null)
    expect(kept.health.map(e => e.d)).toEqual(['b'])
    expect(kept.meals).toEqual([])
    expect('foods' in kept).toBe(false)
  })
})

describe('change count', () => {
  it('counts each meal and health day as its own change', () => {
    const S = base({ meals: [], health: [] })
    const fp = syncFingerprint(S)
    const S2 = { ...S, meals: [{ id: 'm1' }, { id: 'm2' }], health: [{ d: '2026-10-05', sleep: 7 }] }
    expect(countChanges(S2, fp)).toBe(3)
  })
})

describe('sign-in extras', () => {
  it('counts meals, check-in days and foods the server lacks', async () => {
    const { localExtras } = await import('./sync-merge.js')
    const local = base({ meals: [{ id: 'a' }, { id: 'b' }], health: [{ d: 'x', t: 5 }, { d: 'y', t: 1 }], foods: [{ id: 'f' }] })
    const server = base({ meals: [{ id: 'a' }], health: [{ d: 'x', t: 1 }, { d: 'y', t: 9 }] })
    expect(localExtras(local, server)).toMatchObject({ meals: 1, health: 1, foods: 1 })
  })
})
