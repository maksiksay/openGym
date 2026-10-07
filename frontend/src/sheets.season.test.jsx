// @vitest-environment happy-dom
// A season in the workout lifecycle (docs/dev/SEASONS.md): a session started in the test week
// carries the anchors' test sets, and a whole new plan mid-season is asked about first.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { askBeforeNewPlan, beginWorkout } from './sheets.jsx'

vi.mock('./lib/nav.js', () => ({ nav: vi.fn() }))

const season = (over = {}) => ({ id: 's1', n: 1, start: '2026-10-05', weeks: 6, anchors: { squat: null, hinge: null, press: '0025', pull: null }, closed: null, ...over })
const routines = [{ id: 'A', name: 'Push', ex: [{ id: '0025', sets: 3, reps: 8, mode: 'reps', weight: 60 }, { id: '0091', sets: 2, reps: 8, mode: 'reps', weight: 30 }] }]

const on = (iso, extra = {}) => {
  vi.setSystemTime(new Date(iso + 'T12:00:00'))
  useStore.setState(s => ({ S: { ...s.S, routines, workouts: [], active: null, seasons: [season()], weighIn: false, ...extra } }))
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); useUI.setState({ sheets: [] }) })
afterEach(() => { vi.useRealTimers(); useStore.setState(s => ({ S: { ...s.S, active: null, seasons: [] } })) })

describe('a session started in a season', () => {
  const tests = () => useStore.getState().S.active.entries.map(e => e.sets.map(x => !!x.test))

  it('carries the anchors\' test sets in the test week', () => {
    on('2026-11-10')
    beginWorkout(['A'], null)
    expect(tests()).toEqual([[false, false, true], [false, false]])
  })

  it('carries none before it, or once the anchor is tested', () => {
    on('2026-10-20')
    beginWorkout(['A'], null)
    expect(tests().flat().some(Boolean)).toBe(false)
    on('2026-11-12', { workouts: [{ id: 'w', d: '2026-11-10', start: 1, entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 60, r: 11, done: true, test: true }] }] }] })
    beginWorkout(['A'], null)
    expect(tests().flat().some(Boolean)).toBe(false)
  })
})

describe('a whole new plan mid-season', () => {
  it('is asked about while the season runs, and goes ahead only on the answer', () => {
    on('2026-10-20')
    const go = vi.fn()
    askBeforeNewPlan(go)
    expect(go).not.toHaveBeenCalled()
    const sheets = useUI.getState().sheets
    expect(sheets).toHaveLength(1)
    expect(sheets[0].kind).toBe('center')
  })

  it('just goes ahead in the week off, after the season, or with no season', () => {
    for (const [iso, extra] of [['2026-10-01', {}], ['2026-11-16', {}], ['2026-10-20', { seasons: [] }]]) {
      on(iso, extra)
      const go = vi.fn()
      askBeforeNewPlan(go)
      expect(go).toHaveBeenCalledTimes(1)
    }
    expect(useUI.getState().sheets).toHaveLength(0)
  })
})
