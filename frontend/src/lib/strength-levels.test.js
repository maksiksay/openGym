import { describe, expect, it } from 'vitest'
import {
  LB_TO_KG, bodyweightOn, exerciseLevel, levelOf, measureLevel, standardOf, strengthLevels, thresholdsFor,
} from './strength-levels.js'
import { estimate1RM } from './onerm.js'

// A handful of rows of the standards the model was fitted to (Strength Level, March 2026).
const near = (got, want, tol) => got.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThanOrEqual(tol))

describe('the standards', () => {
  it('stay close to the published rows they were fitted to', () => {
    near(thresholdsFor('bench', 'male', 70), [47, 64, 85, 110, 136], 3)
    near(thresholdsFor('bench', 'male', 100), [73, 95, 120, 149, 179], 3.5)
    near(thresholdsFor('squat', 'female', 60), [32, 49, 72, 99, 129], 1.5)
    near(thresholdsFor('deadlift', 'male', 90), [102, 134, 172, 215, 260], 3.5)
    near(thresholdsFor('pull-ups', 'male', 80), [1, 7, 13, 21, 29], 1.5)
  })

  it('know which exercises they stand for, and none for the rest', () => {
    expect(standardOf('0025')).toBe('bench')
    expect(standardOf('1436')).toBe('squat')
    expect(standardOf('0814')).toBe('dips')
    expect(standardOf('0017')).toBeNull()   // the assisted pull-up
    expect(standardOf('1004')).toBeNull()   // a band squat
    expect(thresholdsFor('bench', 'male', 0)).toBeNull()
    expect(thresholdsFor('nothing', 'male', 80)).toBeNull()
  })
})

describe('levelOf', () => {
  const t = [10, 20, 30, 40, 50]
  it('places a value among the thresholds, with what is left to the next', () => {
    expect(levelOf(5, t)).toEqual({ level: -1, next: 10, toNext: 5, toward: 0.5 })
    expect(levelOf(20, t)).toEqual({ level: 1, next: 30, toNext: 10, toward: 0 })
    expect(levelOf(25, t)).toEqual({ level: 1, next: 30, toNext: 5, toward: 0.5 })
    expect(levelOf(60, t)).toEqual({ level: 4, next: null, toNext: 0, toward: 1 })
    expect(levelOf(0, t)).toBeNull()
    expect(levelOf(10, null)).toBeNull()
  })
})

describe('body weight on a day', () => {
  const S = { unit: 'kg', bodyweight: [{ d: '2026-10-10', w: 73 }, { d: '2026-10-01', w: 72 }] }
  it('takes the last weigh-in on or before the day, else the first after', () => {
    expect(bodyweightOn(S, '2026-10-05')).toEqual({ w: 72, d: '2026-10-01', kg: 72 })
    expect(bodyweightOn(S, '2026-10-10').w).toBe(73)
    expect(bodyweightOn(S, '2026-09-01').w).toBe(72)
    expect(bodyweightOn({ bodyweight: [] }, '2026-10-05')).toBeNull()
  })
  it('reads pounds as pounds, and knows them in kilograms', () => {
    expect(bodyweightOn({ unit: 'lb', bodyweight: [{ d: '2026-10-01', w: 176 }] }, '2026-10-05').kg).toBeCloseTo(176 * LB_TO_KG, 5)
  })
})

describe('an exercise\'s level', () => {
  const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
  const workout = (d, id, sets) => ({ id: 'w' + d + id, d, start: Date.parse(d + 'T18:00:00'), entries: [{ id, target: { mode: 'reps' }, sets }] })
  const S = (workouts, over = {}) => ({ unit: 'kg', body: 'male', bodyweight: [{ d: '2026-09-01', w: 72 }], workouts, ...over })
  const today = '2026-10-20'

  it('reads the best estimated max of the last twelve weeks, warm-ups left out', () => {
    const r = exerciseLevel(S([
      workout('2026-10-10', '0025', [set(100, 1, { phase: 'warmup' }), set(60, 8), set(60, 7)]),
      workout('2026-06-01', '0025', [set(100, 5)]),               // too long ago
    ]), '0025', { iso: today })
    expect(r.measure).toMatchObject({ kind: 'e1rm', w: 60, r: 8 })
    expect(r.measure.value).toBeCloseTo(estimate1RM(60, 8), 0)
    expect(r.date).toBe('2026-10-10')
    expect(r.bw.w).toBe(72)
    const t = thresholdsFor('bench', 'male', 72)
    expect(r.thresholds).toEqual(t)
    expect(r.level).toBe(levelOf(r.measure.value, t).level)
  })

  it('reads the most reps in a set of a repetition lift', () => {
    const r = exerciseLevel(S([workout('2026-10-15', '0652', [set(0, 9), set(0, 12), set(0, 8)])]), '0652', { iso: today })
    expect(r.measure).toMatchObject({ kind: 'reps', value: 12 })
    expect(r.reps).toBe(true)
    expect(r.level).toBe(levelOf(12, thresholdsFor('pull-ups', 'male', 72)).level)
  })

  it('has none without a weigh-in, a standard or a recent session', () => {
    const ws = [workout('2026-10-10', '0025', [set(60, 8)])]
    expect(exerciseLevel(S(ws, { bodyweight: [] }), '0025', { iso: today })).toBeNull()
    expect(exerciseLevel(S([workout('2026-10-10', '1004', [set(0, 15)])]), '1004', { iso: today })).toBeNull()
    expect(exerciseLevel(S(ws), '0025', { iso: '2027-03-01' })).toBeNull()
  })

  it('holds a profile in pounds against thresholds in pounds', () => {
    const kg = exerciseLevel(S([workout('2026-10-10', '0025', [set(60, 8)])]), '0025', { iso: today })
    const lb = exerciseLevel(S([workout('2026-10-10', '0025', [set(60 / LB_TO_KG, 8)])], { unit: 'lb', bodyweight: [{ d: '2026-09-01', w: 72 / LB_TO_KG }] }), '0025', { iso: today })
    expect(lb.level).toBe(kg.level)
    lb.thresholds.forEach((v, i) => expect(v * LB_TO_KG).toBeCloseTo(kg.thresholds[i], 5))
  })

  it('reads a measure of the wrong kind as no level', () => {
    expect(measureLevel(S([]), '0652', { kind: 'e1rm', value: 80 }, today)).toBeNull()
    expect(measureLevel(S([]), '0025', { kind: 'reps', value: 10 }, today)).toBeNull()
    expect(measureLevel(S([]), '0025', { kind: 'e1rm', value: 80 }, today)).toMatchObject({ lift: 'bench', reps: false })
  })

  it('lists every lift with a standard trained lately, the highest level first', () => {
    const rows = strengthLevels(S([
      workout('2026-10-10', '0025', [set(60, 5)]),
      workout('2026-10-12', '0032', [set(160, 5)]),
      workout('2026-10-14', '1004', [set(0, 15)]),
    ]), { iso: today })
    expect(rows.map(r => r.lift)).toEqual(['deadlift', 'bench'])
    expect(rows[0].level).toBeGreaterThan(rows[1].level)
  })
})
