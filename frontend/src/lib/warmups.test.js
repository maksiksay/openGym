import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { WARMUP_SETS, addWarmupSets, isMobilityRoutine, missingExercises, regionOf, setWarmup, skipWarmup, suggestWarmups, warmupOf } from './warmups.js'

// docs/dev/WARMUPS.md: the ready-made sets, adding them, and which routine each warm-up suits.
describe('the ready-made sets', () => {
  it('name only exercises the catalogue has, in modes it knows, with no progression', () => {
    expect(WARMUP_SETS.map(s => s.key)).toEqual(['warmup-upper', 'warmup-lower', 'shoulders-posture', 'football-recovery', 'ligaments-feet'])
    for (const set of WARMUP_SETS) {
      expect(missingExercises(set), set.key).toEqual([])
      for (const e of set.ex) {
        expect(e.prog, set.key + ' ' + e.id).toBe('off')
        expect(e.sets >= 1).toBe(true)
        if (e.mode === 'time') expect(e.sec > 0).toBe(true)
        else if (e.mode === 'cardio') expect(e.min > 0).toBe(true)
        else expect(e.reps > 0).toBe(true)
      }
    }
  })

  it('become editable mobility routines, once each, named in the language given', () => {
    const S = { routines: [{ id: 'a', name: 'Upper A', ex: [] }] }
    const added = addWarmupSets(S, ['warmup-upper', 'football-recovery'], 'ru')
    expect(added.map(r => r.name)).toEqual(['Разминка верх', 'Восстановление после футбола'])
    expect(added.every(isMobilityRoutine)).toBe(true)
    expect(added[0].ex[0]).toEqual({ id: '2138', sets: 1, min: 3, speed: 20, mode: 'cardio', prog: 'off' })
    // A hold on each side is a set per side, and says so in the language the set was added in.
    expect(added[1].ex[1]).toMatchObject({ id: '9009', sets: 4, sec: 40, mode: 'time', note: 'Чередуй стороны: подход на каждую.' })
    expect(added[1].ex.some(e => 'alt' in e)).toBe(false)
    expect(addWarmupSets(S, ['warmup-upper'], 'ru')).toEqual([])
    expect(S.routines).toHaveLength(3)
    expect(isMobilityRoutine(S.routines[0])).toBe(false)
  })
})

describe('warm-ups before training', () => {
  const S = () => {
    const s = { routines: [
      { id: 'up', name: 'Upper A', ex: [{ id: '0025' }, { id: '0027' }, { id: '0047' }] },          // bench, row, incline
      { id: 'legs', name: 'Legs', ex: [{ id: '0043' }, { id: '0085' }, { id: '0025' }] },          // squat, RDL, bench
      { id: 'mixed', name: 'Mixed', ex: [{ id: '0043' }, { id: '0025' }] },
    ] }
    addWarmupSets(s, ['warmup-upper', 'warmup-lower'], 'en')
    return s
  }

  it('know a routine as mostly upper body, mostly legs, or neither', () => {
    const s = S()
    expect(['0025', '0027', '0047', '0043', '0085'].every(id => !!EXIDX[id])).toBe(true)
    expect(s.routines.slice(0, 3).map(regionOf)).toEqual(['upper', 'lower', null])
  })

  it('are suggested by region, and once set are a routine\'s own', () => {
    const s = S()
    const sug = suggestWarmups(s)
    expect(sug.map(x => [x.routine.id, x.warmup.preset])).toEqual([['up', 'warmup-upper'], ['legs', 'warmup-lower']])
    setWarmup(s, 'up', sug[0].warmup.id)
    expect(warmupOf(s, s.routines[0]).preset).toBe('warmup-upper')
    expect(suggestWarmups(s).map(x => x.routine.id)).toEqual(['legs'])
    setWarmup(s, 'up', null)
    expect(warmupOf(s, s.routines[0])).toBeNull()
  })

  it('never point at a training routine or at a warm-up\'s own warm-up', () => {
    const s = S()
    s.routines[0].warmup = 'legs'
    expect(warmupOf(s, s.routines[0])).toBeNull()
    const mob = s.routines.find(isMobilityRoutine)
    setWarmup(s, mob.id, s.routines.find(r => r.preset === 'warmup-lower').id)
    expect(mob.warmup).toBeUndefined()
  })
})

describe('skipping the warm-up', () => {
  const routines = [{ id: 'w', kind: 'mobility' }, { id: 'up' }]
  const session = cur => ({ cur, routineIds: ['w', 'up'], entries: [
    { id: '3021', mobility: true, rid: 'w' }, { id: '9003', mobility: true, rid: 'w' }, { id: '0025', rid: 'up' }, { id: '0027', rid: 'up' },
  ] })

  it('drops its exercises and its routine, and starts the workout proper', () => {
    const a = session(1)
    skipWarmup(a, routines)
    expect(a.entries.map(e => e.id)).toEqual(['0025', '0027'])
    expect(a.cur).toBe(0)
    expect(a.routineIds).toEqual(['up'])
  })

  it('keeps the current exercise when it was already past the warm-up', () => {
    const a = session(3)
    skipWarmup(a, routines)
    expect(a.entries[a.cur].id).toBe('0027')
  })
})
