import { describe, expect, it } from 'vitest'
import {
  SEASON_WEEKS, anchorMeasure, anchorProgress, anchorsOutOfPlan, change, closeSeason, currentSeason, dropSeason,
  isoPlus, lastDay, markTests, pastSeasons, seasonResults, seasonState, setAnchors, startNow, startSeason,
  suggestAnchors, swapGuard, testFrom,
} from './season.js'
import { estimate1RM } from './onerm.js'
import { changeShort, changeText, measureText } from './season-i18n.js'

// A season from Monday 5 October 2026: week 6, the test week, runs 9–15 November.
const START = '2026-10-05'
const anchors = { squat: '0043', hinge: '0085', press: '0025', pull: '0017' }
const season = (over = {}) => ({ id: 's1', n: 1, start: START, weeks: 6, anchors, closed: null, ...over })
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const entry = (id, sets) => ({ id, target: { sets: sets.length, reps: 8, weight: sets[0]?.w || 0 }, sets })
let n = 0
const workout = (d, entries) => ({ id: 'w' + (++n), d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T19:00:00'), name: 'A', entries })
const S = (workouts = [], over = {}) => ({ seasons: [season()], workouts, routines: [], ...over })

describe('which season, which week', () => {
  it('counts six weeks from the start, the last of them the test week', () => {
    const s = season()
    expect(testFrom(s)).toBe('2026-11-09')
    expect(lastDay(s)).toBe('2026-11-15')
    expect(seasonState(S(), '2026-10-04')).toMatchObject({ phase: 'upcoming', week: 0, daysToStart: 1 })
    expect(seasonState(S(), '2026-10-05')).toMatchObject({ phase: 'running', week: 1, daysToTest: 35 })
    expect(seasonState(S(), '2026-10-11')).toMatchObject({ phase: 'running', week: 1 })
    expect(seasonState(S(), '2026-10-12')).toMatchObject({ phase: 'running', week: 2 })
    expect(seasonState(S(), '2026-11-08')).toMatchObject({ phase: 'running', week: 5, daysToTest: 1 })
    expect(seasonState(S(), '2026-11-09')).toMatchObject({ phase: 'test', week: 6, end: '2026-11-15' })
    expect(seasonState(S(), '2026-11-15')).toMatchObject({ phase: 'test', week: 6 })
    expect(seasonState(S(), '2026-11-16')).toMatchObject({ phase: 'over', week: 6 })
    expect(seasonState({ seasons: [] }, '2026-11-16')).toEqual({ phase: 'none', season: null })
  })

  it('is over early once every anchor with an exercise is tested', () => {
    const tests = workout('2026-11-10', [
      entry('0043', [set(100, 6, { test: true })]), entry('0085', [set(90, 8, { test: true })]),
      entry('0025', [set(70, 9, { test: true })]), entry('0017', [set(-20, 9, { test: true })]),
    ])
    expect(seasonState(S([tests]), '2026-11-11').phase).toBe('over')
    const untickedOne = workout('2026-11-10', [entry('0043', [set(100, 6, { test: true, done: false })])])
    expect(seasonState(S([untickedOne]), '2026-11-11').phase).toBe('test')
  })

  it('takes the last season not closed, and lists the closed ones', () => {
    const seasons = [season({ id: 'a', closed: { at: '2026-11-15', next: 'now' } }), season({ id: 'b', n: 2, start: '2026-11-15' })]
    expect(currentSeason({ seasons }).id).toBe('b')
    expect(pastSeasons({ seasons }).map(s => s.id)).toEqual(['a'])
    expect(currentSeason({ seasons: [seasons[0]] })).toBeNull()
  })
})

describe('the anchors', () => {
  const plan = [
    { id: 'r1', ex: [{ id: '0025' }, { id: '0047' }, { id: '0091' }] },
    { id: 'r2', ex: [{ id: '0027' }, { id: '0017' }] },
    { id: 'r3', ex: [{ id: '1004' }, { id: '1009' }, { id: '1409' }] },
  ]

  it('fills the four slots from the plan, the best match first', () => {
    expect(suggestAnchors(plan)).toEqual({ squat: '1004', hinge: '1009', press: '0025', pull: '0017' })
  })

  it('takes a weaker match when that is all the plan has, and leaves a slot empty when there is none', () => {
    const weaker = [{ ex: [{ id: '0047' }, { id: '2330' }, { id: '1409' }, { id: '0294' }] }]
    expect(suggestAnchors(weaker)).toEqual({ squat: null, hinge: '1409', press: '0047', pull: '2330' })
    expect(suggestAnchors([])).toEqual({ squat: null, hinge: null, press: null, pull: null })
  })

  it('keeps a previous season\'s anchor while the plan still has it', () => {
    expect(suggestAnchors(plan, { ...anchors, press: '0047', pull: '0652' })).toEqual({ squat: '1004', hinge: '1009', press: '0047', pull: '0017' })
  })

  it('says which anchors left the plan', () => {
    expect(anchorsOutOfPlan(plan, { squat: '1004', hinge: '0085', press: '0025', pull: null })).toEqual(['hinge'])
  })

  it('measures a loaded lift by its estimated max, an assisted or bodyweight one by reps, a hold by seconds', () => {
    const w = workout('2026-10-06', [
      entry('0025', [set(60, 8), set(60, 7)]),
      entry('0017', [set(20, 6), set(20, 8)]),
      { id: '0662', target: { sets: 2, reps: 15 }, sets: [set(0, 15), set(0, 18)] },
      { id: '0001', target: { mode: 'time', sets: 2, sec: 45 }, sets: [{ sec: 40, done: true }, { sec: 55, done: true }] },
    ])
    expect(anchorMeasure(w, '0025')).toEqual({ kind: 'e1rm', value: Math.round(estimate1RM(60, 8) * 10) / 10, w: 60, r: 8 })
    expect(anchorMeasure(w, '0017')).toMatchObject({ kind: 'reps', value: 8 })
    expect(anchorMeasure(w, '0662')).toMatchObject({ kind: 'reps', value: 18 })
    expect(anchorMeasure(w, '0043')).toBeNull()
  })

  it('reads where an anchor started, its best so far, and its test', () => {
    const ws = [
      workout('2026-10-06', [entry('0025', [set(60, 8), set(60, 8)])]),
      workout('2026-10-09', [entry('0025', [set(60, 6)])]),
      workout('2026-10-27', [entry('0025', [set(65, 8)])]),
      workout('2026-11-10', [entry('0025', [set(65, 8), set(65, 11, { test: true })])]),
    ]
    const p = anchorProgress(S(ws), season(), '0025', '2026-11-15')
    expect(p.base).toMatchObject({ kind: 'e1rm', w: 60, r: 8 })
    expect(p.test).toMatchObject({ w: 65, r: 11 })
    expect(p.tested).toBe(true)
    expect(p.best.value).toBe(p.test.value)
    const r1 = v => Math.round(v * 10) / 10
    expect(change(p.base, p.test).pct).toBe(Math.round((r1(estimate1RM(65, 11)) / r1(estimate1RM(60, 8)) - 1) * 100))
    // up to week 4, the test is not there yet
    expect(anchorProgress(S(ws), season(), '0025', '2026-10-30')).toMatchObject({ tested: false, test: null })
  })

  it('lets the best of the test week stand in for a test set nobody marked, and says so', () => {
    const ws = [workout('2026-10-06', [entry('0025', [set(60, 8)])]), workout('2026-11-12', [entry('0025', [set(62.5, 9)])])]
    expect(anchorProgress(S(ws), season(), '0025', '2026-11-15')).toMatchObject({ tested: false, fallback: true, test: { w: 62.5, r: 9 } })
  })

  it('starts an anchor first trained after week 1 from that first time, and says so', () => {
    const ws = [workout('2026-10-20', [entry('0025', [set(60, 8)])]), workout('2026-10-27', [entry('0025', [set(62.5, 8)])])]
    expect(anchorProgress(S(ws), season(), '0025', '2026-10-30')).toMatchObject({ late: true, base: { w: 60 }, best: { w: 62.5 } })
  })
})

describe('the test sets', () => {
  const session = () => [
    entry('0025', [set(20, 8, { phase: 'warmup' }), set(60, 8, { done: false }), set(60, 8, { done: false })]),
    entry('0091', [set(40, 8, { done: false })]),
    entry('0043', [set(100, 5, { done: false }), set(100, 5, { done: false, phase: 'warmup' })]),
  ]

  it('marks the last work set of each anchor in the test week, and nothing before it', () => {
    const before = markTests(S(), session(), '2026-11-08')
    expect(before.flatMap(e => e.sets).some(s => s.test)).toBe(false)
    const marked = markTests(S(), session(), '2026-11-09')
    expect(marked[0].sets.map(s => !!s.test)).toEqual([false, false, true])
    expect(marked[1].sets.some(s => s.test)).toBe(false)               // not an anchor
    expect(marked[2].sets.map(s => !!s.test)).toEqual([true, false])   // the last set is a warm-up
  })

  it('marks an anchor once: not after its test, not twice in a session', () => {
    const tested = workout('2026-11-09', [entry('0025', [set(60, 11, { test: true })])])
    expect(markTests(S([tested]), session(), '2026-11-11')[0].sets.some(s => s.test)).toBe(false)
    const already = markTests(S(), session(), '2026-11-09')
    const again = markTests(S(), [entry('0025', [set(60, 8, { done: false })])], '2026-11-09', already)
    expect(again[0].sets.some(s => s.test)).toBe(false)
    const twice = markTests(S(), [entry('0025', [set(60, 8, { done: false })]), entry('0025', [set(60, 8, { done: false })])], '2026-11-09')
    expect(twice.map(e => e.sets[0].test === true)).toEqual([true, false])
  })

  it('leaves a session alone with no season, or with the season over', () => {
    expect(markTests({ seasons: [] }, session(), '2026-11-09')).toEqual(session())
    expect(markTests(S(), session(), '2026-11-16')).toEqual(session())
  })
})

describe('results', () => {
  it('compares each anchor\'s test with week 1, and counts the sessions and the wins', () => {
    const ws = [
      workout('2026-10-06', [entry('0025', [set(60, 8)]), entry('0017', [set(20, 6)])]),
      workout('2026-10-13', [entry('0025', [set(62.5, 8)]), entry('0017', [set(20, 7)])]),
      workout('2026-11-10', [entry('0025', [set(65, 10, { test: true })]), entry('0017', [set(20, 10, { test: true })])]),
      workout('2026-11-20', [entry('0025', [set(70, 10)])]),   // after the season
    ]
    const r = seasonResults(S(ws), season())
    expect(r.sessions).toBe(3)
    expect(r.wins).toBeGreaterThanOrEqual(2)
    const press = r.anchors.find(a => a.slot === 'press')
    expect(press.change.pct).toBeGreaterThan(0)
    const pull = r.anchors.find(a => a.slot === 'pull')
    expect(pull.change).toEqual({ kind: 'reps', delta: 4, pct: 67 })
    expect(r.anchors.find(a => a.slot === 'squat')).toMatchObject({ base: null, test: null, change: null })
  })
})

describe('starting and closing', () => {
  it('numbers a new season after the last, with six weeks and clean anchors', () => {
    const s = { seasons: [season({ closed: { at: '2026-11-15', next: 'now' } })] }
    const next = startSeason(s, { start: '2026-11-16', anchors: { squat: '0043', press: 25, pull: '' } })
    expect(next).toMatchObject({ n: 2, start: '2026-11-16', weeks: SEASON_WEEKS, anchors: { squat: '0043', hinge: null, press: '25', pull: null }, closed: null })
    expect(s.seasons).toHaveLength(2)
  })

  it('closes into a week off, or straight into the next season, with the same anchors', () => {
    const rest = { seasons: [season()] }
    const next = closeSeason(rest, 's1', 'rest', '2026-11-16')
    expect(rest.seasons[0].closed).toEqual({ at: '2026-11-16', next: 'rest' })
    expect(next).toMatchObject({ n: 2, start: '2026-11-23', anchors })
    expect(seasonState(rest, '2026-11-18')).toMatchObject({ phase: 'upcoming', daysToStart: 5 })
    startNow(rest, next.id, '2026-11-18')
    expect(currentSeason(rest).start).toBe('2026-11-18')
    const now = { seasons: [season()] }
    expect(closeSeason(now, 's1', 'now', '2026-11-16').start).toBe('2026-11-16')
    expect(closeSeason(now, 'missing')).toBeNull()
  })

  it('can give the season in force up, and change its anchors', () => {
    const s = { seasons: [season({ id: 'a', closed: { at: '2026-10-01', next: 'now' } }), season({ id: 'b', n: 2 })] }
    setAnchors(s, 'b', { press: '0047' })
    expect(currentSeason(s).anchors).toEqual({ squat: null, hinge: null, press: '0047', pull: null })
    dropSeason(s, 'b')
    expect(s.seasons.map(x => x.id)).toEqual(['a'])
  })

  it('asks about a new plan only while a season runs', () => {
    expect(swapGuard(S(), '2026-10-20')).toMatchObject({ until: '2026-11-15' })
    expect(swapGuard(S(), '2026-11-12')).toMatchObject({ until: '2026-11-15' })
    expect(swapGuard(S(), '2026-10-01')).toBeNull()
    expect(swapGuard(S(), '2026-11-16')).toBeNull()
    expect(swapGuard({ seasons: [] }, '2026-10-20')).toBeNull()
  })

  it('adds days across a month and a year', () => {
    expect(isoPlus('2026-12-29', 7)).toBe('2027-01-05')
    expect(isoPlus('2026-10-25', 1)).toBe('2026-10-26')
  })
})

// An assistance machine's number is help. In reps alone, less help at the same reps read as +0 %,
// though it is the very progress the machine is for; against a weigh-in it reads as what it is.
describe('an assistance machine, read against the body weight', () => {
  const bodyweight = [{ d: '2026-10-01', w: 72 }]

  it('measures its best set as the body weight the help left you, at its reps', () => {
    const w = workout('2026-10-06', [entry('0017', [set(30, 8), set(25, 6)])])
    // 42 kg of you × 8 → 53.2; 47 kg × 6 → 56.4.
    expect(anchorMeasure(w, '0017', 72)).toEqual({ kind: 'assist', value: 56.4, w: 25, r: 6 })
    expect(anchorMeasure(w, '0017')).toMatchObject({ kind: 'reps', value: 8, w: 30 })
  })

  it('counts less help at the same reps as progress, where reps alone said +0 %', () => {
    const ws = [
      workout('2026-10-06', [entry('0017', [set(30, 8), set(30, 8)])]),
      workout('2026-11-10', [entry('0017', [set(25, 8, { test: true })])]),
    ]
    const p = anchorProgress(S(ws, { bodyweight }), season(), '0017', '2026-11-15')
    expect(p.base).toEqual({ kind: 'assist', value: 53.2, w: 30, r: 8 })
    expect(p.test).toEqual({ kind: 'assist', value: 59.5, w: 25, r: 8 })
    expect(change(p.base, p.test)).toEqual({ kind: 'assist', delta: 6.3, pct: 12 })
    const blind = anchorProgress(S(ws), season(), '0017', '2026-11-15')
    expect(change(blind.base, blind.test)).toEqual({ kind: 'reps', delta: 0, pct: 0 })
  })

  it('reads week 1 against a weigh-in made later, so the start and the test stay comparable', () => {
    const ws = [
      workout('2026-10-06', [entry('0017', [set(30, 8)])]),
      workout('2026-10-27', [entry('0017', [set(27.5, 8)])]),
    ]
    const p = anchorProgress(S(ws, { bodyweight: [{ d: '2026-10-20', w: 72 }] }), season(), '0017', '2026-10-28')
    expect(p.base).toMatchObject({ kind: 'assist', w: 30 })
    expect(p.best).toMatchObject({ kind: 'assist', w: 27.5 })
    expect(change(p.base, p.best).pct).toBeGreaterThan(0)
  })

  it('on reps alone, keeps the set with less help when the reps tie', () => {
    const w = workout('2026-10-06', [entry('0017', [set(30, 8), set(25, 8)])])
    expect(anchorMeasure(w, '0017')).toMatchObject({ kind: 'reps', value: 8, w: 25 })
  })

  it('says the set behind its number, and how far it came in per cent only', () => {
    expect(measureText({ kind: 'assist', value: 59.5, w: 25, r: 8 }, 'kg')).toBe('8 reps · 25 kg of help')
    expect(measureText({ kind: 'assist', value: 79.2, w: 0, r: 8 }, 'kg')).toBe('8 reps')
    expect(changeText({ kind: 'assist', delta: 6.3, pct: 12 }, 'kg')).toBe('+12%')
    expect(changeShort({ kind: 'assist', delta: 6.3, pct: 12 })).toBe('+12%')
  })
})
