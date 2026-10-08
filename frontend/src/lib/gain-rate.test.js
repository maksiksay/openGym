import { describe, expect, it } from 'vitest'
import {
  CORRIDORS, applyKcalStep, calibrationDue, calibrationView, directionOf, dropCalibration, endCalibration,
  gainVerdict, isoPlus, kcalStep, maintenanceEstimate, setKcalGoal, startCalibration, waistOver, weightTrend,
} from './gain-rate.js'
import { splitGoals } from './nutrition.js'

// Weigh-ins every `every` days from `from`, on a straight line from `start`, `perDay` a day.
const line = (from, every, count, start, perDay) =>
  Array.from({ length: count }, (_, i) => ({ d: isoPlus(from, i * every), w: Math.round((start + perDay * i * every) * 1000) / 1000 }))
const FROM = '2026-10-01'
const TODAY = '2026-10-22'

describe('the trend', () => {
  it('fits a line through the weigh-ins, its slope a week and in per cent of the mean', () => {
    const t = weightTrend({ bodyweight: line(FROM, 3, 8, 72, 0.05) }, TODAY)
    expect(t).toMatchObject({ enough: true, n: 8, first: FROM, last: '2026-10-22' })
    expect(t.perWeek).toBeCloseTo(0.35, 9)
    expect(t.mean).toBeCloseTo(72.525, 9)
    expect(t.rate).toBeCloseTo(0.35 / 72.525 * 100, 9)
    expect(t.sePerWeek).toBeCloseTo(0, 9)
    expect(t.now).toBeCloseTo(73.05, 9)
  })

  it('needs 4 weigh-ins on different days over 14 days, and says what is missing', () => {
    expect(weightTrend({ bodyweight: line(FROM, 3, 3, 72, 0) }, TODAY)).toMatchObject({ enough: false, n: 3, missing: 1 })
    expect(weightTrend({ bodyweight: line('2026-10-12', 3, 4, 72, 0) }, TODAY)).toMatchObject({ enough: false, n: 4, missing: 0, readyOn: '2026-10-26' })
    // A day weighed twice is one point, at its mean.
    const twice = [...line('2026-10-12', 3, 3, 72, 0), { d: '2026-10-18', w: 73 }]
    expect(weightTrend({ bodyweight: twice }, TODAY)).toMatchObject({ enough: false, n: 3, missing: 1 })
    expect(weightTrend({ bodyweight: [] }, TODAY)).toMatchObject({ enough: false, n: 0, missing: 4, readyOn: null })
  })

  it('reads the last 28 days only, and nothing before the last calorie change', () => {
    const bodyweight = [{ d: '2026-09-01', w: 60 }, ...line(FROM, 3, 8, 72, 0.05)]
    expect(weightTrend({ bodyweight }, TODAY).n).toBe(8)
    expect(weightTrend({ bodyweight, nutri: { kcalAt: '2026-10-11' } }, TODAY)).toMatchObject({ n: 4, first: '2026-10-13' })
  })
})

describe('the corridor', () => {
  const bodyweight = line(FROM, 3, 8, 72, 0)
  it('takes its direction from the goal weight while there is one', () => {
    expect(directionOf({ bodyweight, targetW: 73 })).toBe('gain')
    expect(directionOf({ bodyweight, targetW: 70 })).toBe('lose')
    expect(directionOf({ bodyweight, targetW: 72.4 })).toBe('keep')
    // 0.5 kg, in a profile in pounds.
    expect(directionOf({ unit: 'lb', bodyweight: [{ d: FROM, w: 159.2 }], targetW: 160 })).toBe('keep')
    expect(directionOf({ unit: 'lb', bodyweight: [{ d: FROM, w: 158 }], targetW: 160 })).toBe('gain')
  })

  it('without a goal weight, from the Goals sheet, and none with neither', () => {
    expect(directionOf({ bodyweight, nutri: { body: { goal: 'lose' } } })).toBe('lose')
    expect(directionOf({ bodyweight })).toBeNull()
    expect(directionOf({ bodyweight: [], targetW: 73 })).toBeNull()
  })
})

describe('the verdict', () => {
  const S = (perDay, over = {}) => ({ unit: 'kg', bodyweight: line(FROM, 3, 8, 72, perDay), targetW: 80, ...over })

  it('is on track inside the corridor', () => {
    expect(gainVerdict(S(0.05), TODAY)).toMatchObject({ kind: 'in', direction: 'gain', corridor: CORRIDORS.gain })
  })

  it('below it, a step of more food; above it, less, never past 300 kcal', () => {
    expect(gainVerdict(S(0.005), TODAY)).toMatchObject({ kind: 'low', step: 250 })
    expect(gainVerdict(S(0.1), TODAY)).toMatchObject({ kind: 'high', step: -300 })
  })

  it('inside the noise of the scale is on track, though the line itself is slow', () => {
    const noisy = [{ d: FROM, w: 72 }, { d: '2026-10-08', w: 72.6 }, { d: '2026-10-15', w: 71.8 }, { d: '2026-10-22', w: 72.4 }]
    const v = gainVerdict({ bodyweight: noisy, targetW: 80 }, TODAY)
    expect(v.trend.rate).toBeLessThan(CORRIDORS.gain[0])
    expect(v.trend.rate + v.trend.rateSE).toBeGreaterThan(CORRIDORS.gain[0])
    expect(v.kind).toBe('in')
  })

  it('waits two weeks after a calorie change, asks for weigh-ins, and has no verdict without a direction', () => {
    expect(gainVerdict(S(0.05, { nutri: { kcalAt: '2026-10-17' } }), TODAY)).toMatchObject({ kind: 'wait', since: '2026-10-17', until: '2026-10-31' })
    expect(gainVerdict(S(0.05, { bodyweight: line(FROM, 3, 3, 72, 0) }), TODAY)).toMatchObject({ kind: 'data' })
    expect(gainVerdict(S(0.05, { targetW: null }), TODAY)).toMatchObject({ kind: 'rate', direction: null })
  })
})

describe('the calorie step', () => {
  const trend = (rate, mean) => ({ rate, mean })
  it('is the gap to the corridor\'s middle, rounded to 50, between 100 and 300 either way', () => {
    // 0.375 % of 72 kg = 0.27 kg a week → 297 kcal a day.
    expect(kcalStep({}, trend(0, 72), CORRIDORS.gain)).toBe(300)
    expect(kcalStep({}, trend(0.3, 72), CORRIDORS.gain)).toBe(100)
    expect(kcalStep({}, trend(0.6, 72), CORRIDORS.gain)).toBe(-200)
    expect(kcalStep({}, trend(-0.2, 72), CORRIDORS.gain)).toBe(300)
    // In pounds, the gap is turned into kilos first.
    expect(kcalStep({ unit: 'lb' }, trend(0, 160), CORRIDORS.gain)).toBe(300)
    expect(kcalStep({ unit: 'lb' }, trend(0.25, 160), CORRIDORS.gain)).toBe(100)
  })

  it('applied, moves the calories and the carbohydrate, stamps the day, and keeps protein and fat', () => {
    const s = { nutri: { goals: { kcal: 2600, p: 130, f: 60, c: 300 } } }
    expect(applyKcalStep(s, 200, TODAY)).toBe(true)
    expect(s.nutri).toMatchObject({ goals: { kcal: 2800, p: 130, f: 60, c: 350 }, kcalAt: TODAY })
    const noCarbs = { nutri: { goals: { kcal: 2600, p: null, f: null, c: null } } }
    applyKcalStep(noCarbs, -150, TODAY)
    expect(noCarbs.nutri.goals).toEqual({ kcal: 2450, p: null, f: null, c: null })
    expect(applyKcalStep({ nutri: { goals: null } }, 200, TODAY)).toBe(false)
  })

  it('a calorie goal set outright: a step from the one there is, or new goals split by the weight', () => {
    const s = { nutri: { goals: { kcal: 2600, p: 130, f: 60, c: 300 } } }
    setKcalGoal(s, 2700, TODAY)
    expect(s.nutri.goals).toMatchObject({ kcal: 2700, c: 325 })
    const fresh = {}
    setKcalGoal(fresh, 2700, TODAY, 72)
    expect(fresh.nutri).toEqual({ goals: splitGoals(2700, 72), kcalAt: TODAY })
    const noWeight = {}
    setKcalGoal(noWeight, 2700, TODAY)
    expect(noWeight.nutri.goals).toEqual({ kcal: 2700, p: null, f: null, c: null })
  })
})

describe('the waist', () => {
  it('first and last measure of the days, with fewer than two none', () => {
    const health = [{ d: '2026-10-02', waist: 80 }, { d: '2026-10-09', sleep: 7 }, { d: '2026-10-20', waist: 80.5 }]
    expect(waistOver({ health }, FROM, TODAY)).toEqual({ from: '2026-10-02', to: '2026-10-20', delta: 0.5 })
    expect(waistOver({ health: health.slice(0, 2) }, FROM, TODAY)).toBeNull()
  })
})

describe('the food calibration', () => {
  const meal = (d, slot, kcal, p) => ({ id: d + slot + kcal, d, slot, kcal, p, f: 0, c: 0 })
  const meals = [
    meal('2026-10-01', 'b', 500, 30), meal('2026-10-01', 'l', 800, 40), meal('2026-10-01', 'd', 900, 50),
    meal('2026-10-02', 'l', 700, 40), meal('2026-10-02', 'd', 1000, 60),
    meal('2026-10-03', 's', 300, 5),                                       // one slot: not a logged day
    meal('2026-10-04', 'b', 400, 20), meal('2026-10-04', 'b', 200, 10),    // two rows, one slot
  ]
  const S = (over = {}) => ({ meals, bodyweight: [{ d: '2026-09-30', w: 72 }], nutri: { on: true, calib: { from: FROM, days: 14 } }, ...over })

  it('starts from today and resumes a paused tracking', () => {
    const s = { nutri: { on: true, paused: true, goals: null } }
    startCalibration(s, 21, FROM)
    expect(s.nutri).toEqual({ on: true, paused: false, goals: null, calib: { from: FROM, days: 21 } })
    startCalibration(s, 9, FROM)
    expect(s.nutri.calib.days).toBe(14)
  })

  it('counts a day with meals in two slots, and averages those, breakfast protein with them', () => {
    expect(calibrationView(S(), '2026-10-05')).toMatchObject({
      day: 5, days: 14, end: '2026-10-14', over: false, logged: 2, kcal: 1950, p: 110, pb: 15, pPerKg: 1.5, pbTarget: 29,
    })
    expect(calibrationView(S({ bodyweight: [] }), '2026-10-05')).toMatchObject({ pPerKg: null, pbTarget: null })
    expect(calibrationView({ nutri: {} }, '2026-10-05')).toBeNull()
  })

  it('ends the first time it is asked after its last day: tracking paused, the summary kept', () => {
    const s = S()
    expect(calibrationDue(s, '2026-10-14')).toBe(false)
    expect(calibrationDue(s, '2026-10-15')).toBe(true)
    expect(endCalibration(s, '2026-10-15')).toBe(true)
    expect(s.nutri.paused).toBe(true)
    expect(s.nutri.calib.result).toEqual({ at: '2026-10-15', logged: 2, kcal: 1950, p: 110, pb: 15 })
    expect(endCalibration(s, '2026-10-16')).toBe(false)
    dropCalibration(s)
    expect(s.nutri.calib).toBeUndefined()
  })

  it('with 10 logged days and the scale over the same days, says what the calories should be', () => {
    const logged = Array.from({ length: 12 }, (_, i) => isoPlus(FROM, i)).flatMap(d => [meal(d, 'b', 900, 40), meal(d, 'l', 1600, 80)])
    const result = { at: '2026-10-15', logged: 12, kcal: 2500, p: 120, pb: 40 }
    const base = { meals: logged, targetW: 80, bodyweight: line(FROM, 4, 4, 72, 0.01), nutri: { paused: true, calib: { from: FROM, days: 14, result } } }
    // 0.07 kg a week, 0.1 %: under the corridor by 0.2 kg a week → 200 kcal more.
    expect(maintenanceEstimate(base)).toMatchObject({ eaten: 2500, direction: 'gain', inside: false, kcal: 2700 })
    const onTrack = { ...base, bodyweight: line(FROM, 4, 4, 72, 0.04) }
    expect(maintenanceEstimate(onTrack)).toMatchObject({ inside: true, kcal: 2500 })
    expect(maintenanceEstimate({ ...base, nutri: { calib: { from: FROM, days: 14, result: { ...result, logged: 9 } } } })).toBeNull()
    expect(maintenanceEstimate({ ...base, bodyweight: line(FROM, 2, 4, 72, 0.01) })).toBeNull()
  })
})
