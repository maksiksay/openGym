import { describe, expect, it } from 'vitest'
import { applyLog, goalNow, logLines } from './coach-log.js'
import { healthOn } from './health.js'

// docs/dev/COACH_ASSISTANT.md: the card's lines, and what a tap writes.
const now = new Date('2026-10-08T12:00:00')
const base = () => ({
  unit: 'kg', healthOn: true,
  bodyweight: [{ d: '2026-10-07', w: 72.8, t: 1 }],
  health: [{ d: '2026-10-08', t: 1, energy: 4, water: 750 }],
  meals: [{ id: 'k', d: '2026-10-08', t: 1, slot: 'b', name: 'Kefir', g: 250, kcal: 100, p: 7.5, f: 2.5, c: 10, drink: true }],
  nutri: { on: true, goals: { kcal: 2400, p: 130, f: 70, c: 290 } },
})
const log = { text: 'Noted.', day: 'today', weight: 72.4, checkin: { sleep: 6, energy: 2 }, water: 1000, goals: { p: 140, fib: 35, steps: 9000, water: 2500 } }

describe('the card\'s lines', () => {
  it('say what is there now and what each becomes', () => {
    const lines = logLines(base(), log, 'today', now)
    expect(lines.map(l => [l.key, l.from, l.to])).toEqual([
      ['weight', null, 72.4],
      ['checkin.sleep', null, 6],
      ['checkin.energy', 4, 2],
      ['water', 1000, 1000],          // 750 from the buttons and the 250 ml kefir, so far
      ['goals.p', 130, 140],
      ['goals.fib', 30, 35],
      ['goals.steps', 8000, 9000],
      ['goals.water', 2000, 2500],
    ])
    expect(lines.filter(l => l.day).map(l => l.key)).toEqual(['weight', 'checkin.sleep', 'checkin.energy', 'water'])
  })

  it('read yesterday\'s weigh-in for yesterday, and know a food goal that is not set', () => {
    expect(logLines(base(), { weight: 72.4 }, 'yesterday', now)[0]).toMatchObject({ from: 72.8, to: 72.4 })
    expect(goalNow({ nutri: { goals: null } }, 'p')).toBeNull()
  })

  it('leave the check-in and the water out while the health log is off', () => {
    expect(logLines({ ...base(), healthOn: false }, log, 'today', now).map(l => l.part)).toEqual(['weight', 'goals', 'goals', 'goals', 'goals'])
  })
})

describe('a tap', () => {
  it('writes every line: the weight, the check-in by field, water on top, the goals named', () => {
    const S = base()
    const written = applyLog(S, log, { now })
    expect(written).toHaveLength(8)
    expect(S.bodyweight).toEqual([{ d: '2026-10-07', w: 72.8, t: 1 }, { d: '2026-10-08', w: 72.4, t: now.getTime() }])
    expect(healthOn(S.health, '2026-10-08')).toMatchObject({ sleep: 6, energy: 2, water: 1750 })
    expect(S.nutri.goals).toEqual({ kcal: 2400, p: 140, f: 70, c: 290 })
    expect(S.nutri.fibGoal).toBe(35)
    expect(S.stepsGoal).toBe(9000)
    expect(S.waterGoal).toBe(2500)
  })

  it('replaces the day\'s weigh-in rather than adding a second', () => {
    const S = base()
    applyLog(S, { weight: 72.1 }, { day: 'yesterday', now })
    expect(S.bodyweight).toEqual([{ d: '2026-10-07', w: 72.1, t: now.getTime() }])
  })

  it('leaves out what was crossed off, and keeps the rest of the day as it was', () => {
    const S = base()
    applyLog(S, log, { skip: ['weight', 'checkin.energy', 'goals.steps'], now })
    expect(S.bodyweight).toHaveLength(1)
    expect(healthOn(S.health, '2026-10-08')).toMatchObject({ sleep: 6, energy: 4 })
    expect(S.stepsGoal).toBeUndefined()
  })

  it('sets a food goal on a profile that has none', () => {
    const S = { nutri: {} }
    applyLog(S, { goals: { kcal: 2500 } }, { now })
    expect(S.nutri.goals).toEqual({ kcal: 2500, p: null, f: null, c: null })
  })
})
