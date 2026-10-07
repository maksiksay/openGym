import { describe, it, expect } from 'vitest'
import { cleanField, setHealth, healthOn, mergeHealth, healthSeries, recentAverages, weeklyHealth, sleepVsTraining, meanOf } from './health.js'
import { STEPS_GOAL_DEFAULT, stepsGoalOf, stepsSummary } from './health.js'
import { addWater, drinksOn, hasWellbeing, waterGoalOf, waterOn, waterSeries, waterSummary, WATER_GOAL_CHOICES, WATER_GOAL_DEFAULT } from './health.js'

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

// docs/dev/HEALTH_IMPORT.md: the steps goal, and what Home says against it.

describe('the steps goal', () => {
  it('is the profile\'s own, or 8,000', () => {
    expect(stepsGoalOf({})).toBe(STEPS_GOAL_DEFAULT)
    expect(stepsGoalOf({ stepsGoal: 10000 })).toBe(10000)
    expect(stepsGoalOf({ stepsGoal: 'lots' })).toBe(8000)
    expect(stepsGoalOf({ stepsGoal: 99 })).toBe(8000)
  })

  it('reads yesterday against it, and the week\'s average over the days that have a count', () => {
    const S = { stepsGoal: 8000, health: [
      { d: '2026-10-07', steps: 8123 },
      { d: '2026-10-06', steps: 6000, energy: 3 },
      { d: '2026-10-05', energy: 4 },                // no count: unknown, not zero
      { d: '2026-09-29', steps: 20000 },             // eight days before: outside the week
      { d: '2026-10-08', steps: 500 },               // today, still growing: not counted
    ] }
    expect(stepsSummary(S, '2026-10-08')).toEqual({ goal: 8000, yesterday: { d: '2026-10-07', steps: 8123, met: true }, avg: 7062, days: 2 })
    expect(stepsSummary(S, '2026-10-07').yesterday).toEqual({ d: '2026-10-06', steps: 6000, met: false })
    expect(stepsSummary({ health: [] }, '2026-10-08')).toEqual({ goal: 8000, yesterday: null, avg: null, days: 0 })
  })
})

// docs/dev/WATER.md: the counter, drinks from the food log, the goal.

describe('water', () => {
  const drink = (d, g, extra = {}) => ({ id: d + g, d, t: 1, slot: 'b', name: 'Kefir', g, kcal: 0, p: 0, f: 0, c: 0, drink: true, ...extra })

  it('is a field of the day in whole millilitres, 0 to 10 l, merged like the others', () => {
    expect(cleanField('water', 249.6)).toBe(250)
    expect(cleanField('water', 10001)).toBeUndefined()
    expect(cleanField('water', -1)).toBeUndefined()
    expect(mergeHealth([{ d: '2026-10-05', t: 1, water: 500, sleep: 7 }], [{ d: '2026-10-05', t: 2, water: 750 }]))
      .toEqual([{ d: '2026-10-05', t: 2, water: 750, sleep: 7 }])
  })

  it('adds, takes away, never goes below nothing, and goes at nothing', () => {
    const S = { health: [{ d: '2026-10-05', t: 1, sleep: 7 }] }
    expect(addWater(S, '2026-10-05', 250, 2)).toBe(250)
    expect(addWater(S, '2026-10-05', 500, 3)).toBe(750)
    expect(healthOn(S.health, '2026-10-05')).toEqual({ d: '2026-10-05', t: 3, sleep: 7, water: 750 })
    expect(addWater(S, '2026-10-05', -1000, 4)).toBe(0)
    expect(healthOn(S.health, '2026-10-05')).toEqual({ d: '2026-10-05', t: 4, sleep: 7 })
    // A day that held only water is gone with it.
    const T = { health: [] }
    addWater(T, '2026-10-06', 250, 1)
    addWater(T, '2026-10-06', -250, 2)
    expect(T.health).toEqual([])
    expect(addWater({ health: [{ d: '2026-10-06', t: 1, water: 9900 }] }, '2026-10-06', 500)).toBe(10000)
  })

  it('counts the drinks of the food log in, and nothing else from it', () => {
    const S = {
      health: [{ d: '2026-10-05', water: 1000 }],
      meals: [drink('2026-10-05', 250), drink('2026-10-05', 300, { drink: undefined, name: 'Porridge' }),
        drink('2026-10-04', 330), drink('2026-10-05', 0)],
    }
    expect(drinksOn(S.meals, '2026-10-05')).toBe(250)
    expect(waterOn(S, '2026-10-05')).toEqual({ taps: 1000, food: 250, total: 1250 })
    expect(waterOn(S, '2026-10-04')).toEqual({ taps: 0, food: 330, total: 330 })
    expect(waterOn({}, '2026-10-04')).toEqual({ taps: 0, food: 0, total: 0 })
  })

  it('has a goal of the profile\'s own, or 2 l', () => {
    expect(waterGoalOf({})).toBe(WATER_GOAL_DEFAULT)
    expect(WATER_GOAL_DEFAULT).toBe(2000)
    expect(waterGoalOf({ waterGoal: 2500 })).toBe(2500)
    expect(waterGoalOf({ waterGoal: 50 })).toBe(2000)
    expect(waterGoalOf({ waterGoal: '3l' })).toBe(2000)
    expect(WATER_GOAL_CHOICES).toContain(2000)
  })

  it('reads a day against the goal, and the average of the week before over the days that have any', () => {
    const S = { waterGoal: 2000,
      health: [
        { d: '2026-10-08', water: 1500 },
        { d: '2026-10-07', water: 2000 },
        { d: '2026-10-06', sleep: 7 },                // no water: unknown, not zero
        { d: '2026-09-30', water: 3000 },             // eight days before: outside the week
      ],
      meals: [drink('2026-10-08', 500), drink('2026-10-05', 1000)] }
    expect(waterSummary(S, '2026-10-08')).toEqual({
      goal: 2000, day: { taps: 1500, food: 500, total: 2000, met: true }, avg: 1500, days: 2,
    })
    expect(waterSummary(S, '2026-10-07').day.met).toBe(true)
    expect(waterSummary({ health: [] }, '2026-10-08')).toEqual({ goal: 2000, day: { taps: 0, food: 0, total: 0, met: false }, avg: null, days: 0 })
  })

  it('charts the day\'s total in litres, over the days that have any', () => {
    const S = { health: [{ d: '2026-10-05', water: 1250 }, { d: '2026-10-03', sleep: 8 }], meals: [drink('2026-10-05', 300), drink('2026-10-04', 330)] }
    expect(waterSeries(S).map(p => [p.d, p.y])).toEqual([['2026-10-04', 0.33], ['2026-10-05', 1.55]])
    expect(waterSeries(S, '2026-10-05', '2026-10-05').map(p => p.d)).toEqual(['2026-10-05'])
  })

  it('is no check-in on its own', () => {
    expect(hasWellbeing({ d: '2026-10-05', t: 1, water: 500 })).toBe(false)
    expect(hasWellbeing({ d: '2026-10-05', t: 1, water: 500, energy: 3 })).toBe(true)
    expect(hasWellbeing({ d: '2026-10-05', t: 1, steps: 9000 })).toBe(true)
    expect(hasWellbeing(null)).toBe(false)
  })
})
