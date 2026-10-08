import { describe, expect, it } from 'vitest'
import {
  MAX_OPEN, doneQuests, dropQuest, nextQuest, openQuests, pinQuest, questBar, questDone, questForecast,
  questMeasure, questSuggestions, questTarget, questWinsIn, questsDoneBy, recentBest,
} from './quests.js'
import { estimate1RM, FORMULAS } from './onerm.js'
import { dayIndex } from './trend.js'

const BENCH = '0025'          // barbell bench press
const ASSISTED = '0017'       // assisted pull-up
const PUSH_UP = '0662'
const PULL_UP = '0652'
const TODAY = '2026-11-01'
const plus = (iso, n) => new Date((dayIndex(iso) + n) * 864e5).toISOString().slice(0, 10)

let n = 0
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const workout = (d, entries) => ({ id: 'w' + (++n), d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T19:00:00'), entries })
const entry = (id, sets) => ({ id, target: { sets: sets.length, reps: 8 }, sets })
// Bench sessions every `every` days back from TODAY, the weight climbing `perSession` each time, 8 reps.
const benchRun = (count, every, start, perSession) =>
  Array.from({ length: count }, (_, i) => workout(plus(TODAY, -(count - 1 - i) * every), [entry(BENCH, [set(start + i * perSession, 8)])]))
const S = (workouts, over = {}) => ({ unit: 'kg', body: 'male', workouts, routines: [{ id: 'r', ex: [{ id: BENCH }, { id: ASSISTED }, { id: PUSH_UP }] }], quests: [], ...over })

describe('a quest\'s measure and target', () => {
  const w = workout(TODAY, [entry(BENCH, [set(60, 8), set(62.5, 6)]), entry(ASSISTED, [set(30, 8)]), entry(PUSH_UP, [set(0, 15), set(0, 18)])])
  const bodyweight = [{ d: '2026-10-01', w: 72 }]

  it('reads the best estimated max, the most reps, and on an assistance machine body weight less help', () => {
    expect(questMeasure({}, { kind: 'e1rm', exId: BENCH }, w)).toBeCloseTo(Math.max(estimate1RM(60, 8), estimate1RM(62.5, 6)), 9)
    expect(questMeasure({}, { kind: 'reps', exId: PUSH_UP }, w)).toBe(18)
    expect(questMeasure({ bodyweight }, { kind: 'unassisted', exId: ASSISTED }, w)).toBeCloseTo(Math.round(FORMULAS.epley(42, 8) * 10) / 10, 9)
    expect(questMeasure({}, { kind: 'unassisted', exId: ASSISTED }, w)).toBeNull()
  })

  it('aims at a fixed number, or at one that moves with that day\'s body weight', () => {
    expect(questTarget({}, { kind: 'e1rm', value: 70 })).toBe(70)
    expect(questTarget({}, { kind: 'set', w: 80, r: 5 })).toBeCloseTo(Math.round(FORMULAS.epley(80, 5) * 10) / 10, 9)
    expect(questTarget({}, { kind: 'set', w: 80, r: 1 })).toBe(80)
    expect(questTarget({ bodyweight }, { kind: 'ratio', ratio: 1 }, TODAY)).toBe(72)
    expect(questTarget({ bodyweight }, { kind: 'unassisted' }, TODAY)).toBe(74.4)
    expect(questTarget({ bodyweight, body: 'male' }, { kind: 'level', exId: BENCH, level: 2 }, TODAY)).toBeGreaterThan(60)
    expect(questTarget({}, { kind: 'ratio', ratio: 1 }, TODAY)).toBeNull()
  })
})

describe('done', () => {
  it('by the first workout from the day it was pinned that reaches it, never an older one', () => {
    const ws = [workout('2026-10-01', [entry(BENCH, [set(70, 8)])]), workout('2026-10-10', [entry(BENCH, [set(60, 8)])]), workout('2026-10-20', [entry(BENCH, [set(72.5, 5)])])]
    const q = { id: 'q', kind: 'e1rm', exId: BENCH, value: 80, from: '2026-10-05' }
    expect(questDone(S(ws), q)).toEqual({ d: '2026-10-20', key: ws[2].id })
    expect(questDone(S(ws), { ...q, value: 90 })).toBeNull()
  })

  it('a weight × reps needs that set itself, not only its estimate', () => {
    const q = { id: 'q', kind: 'set', exId: BENCH, w: 80, r: 5, from: '2026-10-01' }
    expect(questDone(S([workout('2026-10-10', [entry(BENCH, [set(85, 4)])])]), q)).toBeNull()
    expect(questDone(S([workout('2026-10-12', [entry(BENCH, [set(80, 5)])])]), q)).toMatchObject({ d: '2026-10-12' })
    // A warm-up never counts.
    expect(questDone(S([workout('2026-10-12', [entry(BENCH, [set(80, 5, { warmup: true, phase: 'warmup' }), set(60, 5)])])]), q)).toBeNull()
  })

  it('the first strict pull-up: a set with no help, or any set of a bodyweight pull-up', () => {
    const q = { id: 'q', kind: 'unassisted', exId: ASSISTED, from: '2026-10-01' }
    expect(questDone(S([workout('2026-10-10', [entry(ASSISTED, [set(5, 6)])])]), q)).toBeNull()
    expect(questDone(S([workout('2026-10-11', [entry(ASSISTED, [set(0, 1)])])]), q)).toMatchObject({ d: '2026-10-11' })
    expect(questDone(S([workout('2026-10-12', [entry(PULL_UP, [set(0, 1)])])]), q)).toMatchObject({ d: '2026-10-12' })
    expect(questDone(S([workout('2026-10-12', [entry('0688', [set(0, 10)])])]), q)).toBeNull()   // scapular pull-up
  })

  it('a multiple of body weight against that day\'s weight, and the done ones listed latest first', () => {
    const ws = [workout('2026-10-10', [entry(BENCH, [set(65, 3)])]), workout('2026-10-20', [entry(BENCH, [set(70, 3)])])]
    const quests = [
      { id: 'a', kind: 'ratio', exId: BENCH, ratio: 1, from: '2026-10-01' },
      { id: 'b', kind: 'e1rm', exId: BENCH, value: 60, from: '2026-10-01' },
      { id: 'c', kind: 'e1rm', exId: BENCH, value: 200, from: '2026-10-01' },
    ]
    const st = S(ws, { quests, bodyweight: [{ d: '2026-10-01', w: 72 }] })
    expect(questDone(st, quests[0])).toMatchObject({ d: '2026-10-20' })   // 70 × 3 ≈ 77 ≥ 72; 65 × 3 ≈ 71.5 is not
    expect(doneQuests(st).map(q => q.id)).toEqual(['a', 'b'])
    expect(openQuests(st).map(q => q.id)).toEqual(['c'])
    expect(questsDoneBy(st, ws[1]).map(q => q.id)).toEqual(['a'])
    expect(questWinsIn(st, '2026-10')).toBe(2)
    expect(questWinsIn(st, '2026-11')).toBe(0)
  })
})

describe('the bar', () => {
  it('runs from where it was pinned to the target, at the best of the last 28 days', () => {
    const ws = benchRun(5, 7, 60, 2.5)   // 60 … 70 kg × 8
    const q = { id: 'q', kind: 'e1rm', exId: BENCH, value: 100, from: plus(TODAY, -28), base: estimate1RM(60, 8) }
    const bar = questBar(S(ws), q, TODAY)
    expect(bar.best).toBeCloseTo(estimate1RM(70, 8), 9)
    expect(bar.toward).toBeCloseTo((estimate1RM(70, 8) - estimate1RM(60, 8)) / (100 - estimate1RM(60, 8)), 9)
    // Pinned before any session: it starts from the first one after.
    expect(questBar(S(ws), { ...q, base: undefined, from: plus(TODAY, -100) }, TODAY).base).toBeCloseTo(estimate1RM(60, 8), 9)
  })
})

describe('the forecast', () => {
  const q = target => ({ id: 'q', kind: 'e1rm', exId: BENCH, value: target, from: plus(TODAY, -60) })

  it('a range of weeks from the trend, its error making the ends', () => {
    // +2.5 kg a week at 8 reps, a clean line: the range closes on one number.
    const f = questForecast(S(benchRun(6, 7, 60, 2.5)), q(100), TODAY)
    expect(f.kind).toBe('weeks')
    // 2.5 kg × (1 + 8/30) a week; ≈91.8 today, so 8.2 to go: about 3 weeks.
    expect(f.perWeek).toBeCloseTo(2.5 * (1 + 8 / 30), 1)
    expect(f).toMatchObject({ lo: 3, hi: 3 })
  })

  it('a noisy climb has a wider range, or no upper end', () => {
    const ws = [60, 65, 61, 66, 63, 68].map((wt, i) => workout(plus(TODAY, -(5 - i) * 7), [entry(BENCH, [set(wt, 8)])]))
    const f = questForecast(S(ws), q(110), TODAY)
    expect(f.kind).toBe('weeks')
    expect(f.hi == null || f.hi > f.lo).toBe(true)
  })

  it('no climb, too few sessions, too far, already there, or a weigh-in missing', () => {
    expect(questForecast(S(benchRun(6, 7, 60, 0)), q(100), TODAY)).toEqual({ kind: 'flat' })
    expect(questForecast(S(benchRun(6, 7, 60, -1)), q(100), TODAY)).toEqual({ kind: 'flat' })
    expect(questForecast(S(benchRun(3, 7, 60, 2.5)), q(100), TODAY)).toEqual({ kind: 'data', missing: 1 })
    expect(questForecast(S(benchRun(6, 7, 60, 0.25)), q(150), TODAY)).toEqual({ kind: 'far' })
    expect(questForecast(S(benchRun(6, 7, 60, 2.5)), q(80), TODAY)).toEqual({ kind: 'close' })
    expect(questForecast(S([]), { kind: 'ratio', exId: BENCH, ratio: 1, from: TODAY }, TODAY)).toEqual({ kind: 'weigh' })
  })
})

describe('pinning and suggestions', () => {
  const ws = [
    workout(plus(TODAY, -7), [entry(BENCH, [set(50, 8)]), entry(ASSISTED, [set(30, 8)]), entry(PUSH_UP, [set(0, 12)])]),
    workout(TODAY, [entry(BENCH, [set(52.5, 8)])]),
  ]

  it('suggests one per lift first, from the plan, never one already open', () => {
    const st = S(ws, { bodyweight: [{ d: TODAY, w: 72 }] })
    const ideas = questSuggestions(st, TODAY)
    expect(ideas.slice(0, 3)).toEqual([
      { kind: 'ratio', exId: BENCH, ratio: 1 },
      { kind: 'unassisted', exId: ASSISTED },
      { kind: 'reps', exId: PUSH_UP, r: 15 },
    ])
    // The next round estimated max above the best of the last 28 days: ≈66.5 → 70.
    expect(ideas).toContainEqual({ kind: 'e1rm', exId: BENCH, value: 70 })
    expect(ideas.some(i => i.kind === 'level' && i.exId === BENCH)).toBe(true)
    pinQuest(st, ideas[1], TODAY)
    expect(questSuggestions(st, TODAY).some(i => i.kind === 'unassisted')).toBe(false)
    // Without a weigh-in, nothing that needs one.
    expect(questSuggestions(S(ws), TODAY).map(i => i.kind)).toEqual(['e1rm', 'unassisted', 'reps'])
  })

  it('pins with its base and its day, three at most, and takes one off', () => {
    const st = S(ws)
    const q = pinQuest(st, { kind: 'e1rm', exId: BENCH, value: 80 }, TODAY)
    expect(q).toMatchObject({ kind: 'e1rm', exId: BENCH, value: 80, from: TODAY, base: recentBest(st, { kind: 'e1rm', exId: BENCH }, TODAY) })
    pinQuest(st, { kind: 'reps', exId: PUSH_UP, r: 15 }, TODAY)
    pinQuest(st, { kind: 'unassisted', exId: ASSISTED }, TODAY)
    expect(pinQuest(st, { kind: 'e1rm', exId: BENCH, value: 90 }, TODAY)).toBe(false)
    expect(openQuests(st)).toHaveLength(MAX_OPEN)
    dropQuest(st, q.id)
    expect(openQuests(st)).toHaveLength(2)
  })

  it('after a quest done, the next of its kind', () => {
    const st = S(ws, { bodyweight: [{ d: TODAY, w: 72 }] })
    expect(nextQuest(st, { kind: 'e1rm', exId: BENCH, value: 80 }, TODAY)).toEqual({ kind: 'e1rm', exId: BENCH, value: 85 })
    expect(nextQuest(st, { kind: 'reps', exId: PUSH_UP, r: 15 }, TODAY)).toEqual({ kind: 'reps', exId: PUSH_UP, r: 20 })
    expect(nextQuest(st, { kind: 'level', exId: BENCH, level: 4 }, TODAY)).toBeNull()
    expect(nextQuest(st, { kind: 'unassisted', exId: ASSISTED }, TODAY)).toEqual({ kind: 'reps', exId: PULL_UP, r: 5 })
  })
})
