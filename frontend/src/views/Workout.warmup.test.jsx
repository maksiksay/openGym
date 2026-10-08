// @vitest-environment happy-dom
// docs/dev/WARMUPS.md: a session that opens with a warm-up says so above the exercises, and Skip
// warm-up drops the warm-up's exercises for today. A recovery session on its own has no banner:
// there is nothing to skip to.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'
const ROW = '0027'
const routines = [
  { id: 'main', name: 'Main', warmup: 'wu', ex: [{ id: BENCH, sets: 1, reps: 5, weight: 100 }, { id: ROW, sets: 1, reps: 8, weight: 60 }] },
  { id: 'wu', name: 'Upper warm-up', kind: 'mobility', ex: [{ id: '3021', sets: 1, reps: 12, weight: 0, prog: 'off' }, { id: '9003', sets: 1, reps: 15, weight: 0, prog: 'off' }] },
]
const warm = id => ({ id, rid: 'wu', mobility: true, noProg: true, target: { sets: 1, reps: 12, weight: 0 }, sets: [{ w: 0, r: 12, done: false }] })
const work = (id, w) => ({ id, rid: 'main', target: { sets: 1, reps: 5, weight: w }, sets: [{ w, r: 5, done: false }] })

let root
let container
function render(entries, { routineIds = ['wu', 'main'], cur = 0 } = {}) {
  const S = clone(DEF)
  S.routines = clone(routines)
  S.active = { id: 'session', d: '2026-10-08', start: Date.now(), routineIds, routineId: 'main', name: 'Main', bw: null, cur, workoutView: 'list', entries: clone(entries) }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}
const banner = () => container.querySelector('.wu-banner')
const skip = () => act(() => [...banner().querySelectorAll('button')].find(b => b.textContent === 'Skip warm-up').click())
const active = () => useStore.getState().S.active

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  root = null
  container = null
})

describe('a warm-up before the workout', () => {
  it('says how many of the exercises are the warm-up, and Skip warm-up drops them for today', () => {
    render([warm('3021'), warm('9003'), work(BENCH, 100), work(ROW, 60)])
    expect(banner().querySelector('.wu-t').textContent).toBe('Warm-up')
    expect(banner().textContent).toContain('2 exercises')
    skip()
    expect(active().entries.map(e => e.id)).toEqual([BENCH, ROW])
    expect(active().cur).toBe(0)
    expect(active().routineIds).toEqual(['main'])
    expect(banner()).toBeNull()
  })

  it('keeps the exercise in hand when the workout is already past the warm-up', () => {
    render([warm('3021'), work(BENCH, 100), work(ROW, 60)], { cur: 2 })
    skip()
    expect(active().entries[active().cur].id).toBe(ROW)
  })

  it('lists warm-ups and recovery apart on the start screen', () => {
    const S = clone(DEF)
    S.routines = [...clone(routines), { id: 'legs', name: 'Legs', ex: [{ id: '0043', sets: 1, reps: 5, weight: 80 }] }]
    S.active = null
    useStore.setState({ S, user: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
    const listUnder = title => [...container.querySelectorAll('h4.sec')].find(h => h.textContent === title)
      ?.nextElementSibling.querySelectorAll('.tt')
    expect([...listUnder('Warm-ups and recovery')].map(x => x.textContent)).toEqual(['Upper warm-up'])
    expect([...listUnder('Other routines')].map(x => x.textContent)).not.toContain('Upper warm-up')
  })

  it('shows no banner on a recovery session of its own', () => {
    render([warm('3021'), warm('9003')], { routineIds: ['wu'] })
    expect(container.textContent).toContain('Main')
    expect(banner()).toBeNull()
  })
})
