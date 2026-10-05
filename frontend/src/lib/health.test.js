import { describe, it, expect } from 'vitest'
import { cleanField, setHealth, healthOn, mergeHealth, healthSeries, recentAverages, weeklyHealth, sleepVsTraining, meanOf } from './health.js'

describe('cleanField', () => {
  it('keeps values in range, drops the rest instead of clamping', () => {
    expect(cleanField('sleep', 7.4)).toBe(7.5)
    expect(cleanField('sleep', 25)).toBeUndefined()
    expect(cleanField('energy', 3.6)).toBe(4)
    expect(cleanField('energy', 0)).toBeUndefined()
    expect(cleanField('steps', '8421')).toBe(8421)
    expect(cleanField('waist', 82.34)).toBe(82.3)
    expect(cleanField('sleep', '')).toBeUndefined()
    expect(cleanField('sleep', null)).toBeUndefined()
    expect(cleanField('bogus', 1)).toBeUndefined()
  })
  it('trims notes', () => {
    expect(cleanField('note', '  ok  ')).toBe('ok')
    expect(cleanField('note', '   ')).toBeUndefined()
    expect(cleanField('note', 'x'.repeat(600)).length).toBe(500)
  })
})

describe('setHealth', () => {
  it('creates, updates field by field and stamps', () => {
    const S = {}
    setHealth(S, '2026-10-05', { sleep: 7, energy: 4 }, 10)
    setHealth(S, '2026-10-05', { steps: 9000 }, 20)
    expect(healthOn(S.health, '2026-10-05')).toEqual({ d: '2026-10-05', sleep: 7, energy: 4, steps: 9000, t: 20 })
  })
  it('null clears a field; clearing the last one removes the day', () => {
    const S = { health: [] }
    setHealth(S, '2026-10-05', { sleep: 7 }, 1)
    setHealth(S, '2026-10-05', { sleep: null }, 2)
    expect(S.health).toEqual([])
  })
  it('keeps days sorted and ignores unknown fields', () => {
    const S = { health: [] }
    setHealth(S, '2026-10-06', { sleep: 6 }, 1)
    setHealth(S, '2026-10-04', { sleep: 8, hack: 1 }, 1)
    expect(S.health.map(e => e.d)).toEqual(['2026-10-04', '2026-10-06'])
    expect(S.health[0].hack).toBeUndefined()
  })
})

describe('mergeHealth', () => {
  it('unites days and merges a shared day field by field, the later edit winning', () => {
    const phone = [{ d: '2026-10-05', t: 100, sleep: 7, energy: 3 }, { d: '2026-10-04', t: 50, sleep: 8 }]
    const server = [{ d: '2026-10-05', t: 200, steps: 9000, energy: 4 }]
    expect(mergeHealth(phone, server)).toEqual([
      { d: '2026-10-04', t: 50, sleep: 8 },
      { d: '2026-10-05', t: 200, sleep: 7, energy: 4, steps: 9000 },
    ])
  })
  it('is symmetric and skips junk', () => {
    const a = [{ d: '2026-10-05', t: 1, sleep: 6 }, null, { t: 3 }]
    const b = [{ d: '2026-10-05', t: 2, sleep: 7 }]
    expect(mergeHealth(a, b)).toEqual(mergeHealth(b, a))
    expect(mergeHealth(a, b)[0].sleep).toBe(7)
  })
})

describe('series and averages', () => {
  const H = [
    { d: '2026-09-29', sleep: 6, energy: 2 },
    { d: '2026-10-01', sleep: 8, energy: 4, steps: 10000 },
    { d: '2026-10-05', sleep: 7, energy: 3, steps: 6000 },
  ]
  it('charts one field over the days that have it', () => {
    expect(healthSeries(H, 'steps').map(p => p.y)).toEqual([10000, 6000])
  })
  it('averages the last week, counting how many days had each field', () => {
    const a = recentAverages(H, '2026-10-05', 7)
    expect(a.from).toBe('2026-09-29')
    expect(a.sleep).toBe(7)
    expect(a.sleepN).toBe(3)
    expect(a.steps).toBe(8000)
    expect(a.stress).toBeNull()
  })
  it('groups by week, newest first', () => {
    const w = weeklyHealth(H, 1)
    expect(w.map(x => x.key)).toEqual(['2026-10-05', '2026-09-28'])
    expect(w[1]).toMatchObject({ n: 2, sleep: 7, energy: 3 })
  })
  it('meanOf ignores missing values', () => {
    expect(meanOf([{ x: 1 }, {}, { x: 3 }], 'x')).toBe(2)
    expect(meanOf([], 'x')).toBeNull()
  })
})

describe('sleepVsTraining', () => {
  it('pairs each workout with the night before it', () => {
    const H = [{ d: '2026-10-05', sleep: 5.5, energy: 2 }]
    const W = [
      { d: '2026-10-05', vol: 4200, entries: [] },
      { d: '2026-10-03', vol: 5000, entries: [] },
    ]
    expect(sleepVsTraining(H, W)).toEqual([{ d: '2026-10-05', sleep: 5.5, energy: 2, vol: 4200 }])
  })
})
