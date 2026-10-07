import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { makeSideSet, syncSideAggregate } from '../lib/workout-model.js'

// The rating under the plan's last work set (docs/dev/RIR_STEP.md): with "Ask on: the last set",
// the set rows have no effort column. Once that set is the one in hand, one row of the picker's
// presets sits under it; a tap stores the value, ticks the set and folds the row into a chip.
const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.storeSnapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
  })
  state.uiSnapshot = () => ({
    timer: null, work: null,
    startRest: vi.fn(), stopRest: vi.fn(), stopWork: vi.fn(), shiftRestOwner: vi.fn(), startWork: vi.fn(), toast: vi.fn(),
  })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), exerciseDetailSheet: vi.fn(),
  topWeightSheet: vi.fn(), finishWorkout: vi.fn(), workoutCompleteSheet: vi.fn(), confirmSheet: vi.fn(),
  swapActiveWorkoutExercise: vi.fn(), barWeightSheet: vi.fn(), exerciseNoteSheet: vi.fn(), sessionNoteSheet: vi.fn(),
  renameWorkoutSheet: vi.fn(), effortPickerSheet: vi.fn(), menuSheet: vi.fn(), exerciseHistorySheet: vi.fn(),
  exitWorkoutEdit: vi.fn(), addRoutineToSessionSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})),
  IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))

let dom
let root
let container

const set = (done, extra = {}) => ({ w: 60, r: 8, done, ...extra })
const entry = (sets, extra = {}) => ({ id: 'press', target: { mode: 'reps', sets: 3, reps: 8, weight: 60 }, sets, ...extra })

function state(entries, extra = {}) {
  return {
    unit: 'kg', restSec: 90, sound: false, effort: 'rir', effortScope: 'last', gifSize: 'full',
    workouts: [], exWeights: {}, routines: [], bodyweight: [],
    active: { id: 'active', name: 'Test workout', start: Date.now(), cur: 0, entries },
    ...extra,
  }
}

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  dom.Element.prototype.scrollIntoView = vi.fn()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}

async function mount(S) {
  mocks.S = S
  installDom()
  await act(async () => { root.render(React.createElement(Workout)) })
}
// The mocked store has no subscription, so a write shows once the screen renders again.
const rerender = () => act(async () => { root.render(React.createElement(Workout)) })

async function unmount() {
  if (!root) return
  await act(async () => { root.unmount() })
  root = null
  container = null
  dom = null
}

async function tap(button) {
  expect(button).toBeTruthy()
  await act(async () => { button.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}

const rateRows = () => [...container.querySelectorAll('.raterow')]
const buttons = () => [...container.querySelectorAll('.ratebtn')]
const button = label => buttons().find(b => b.textContent.trim() === label)
// The set row a rating row hangs under: the one in the same wrapper.
const rowOf = el => el.parentElement.querySelector('.setrow, .setrow-side')

beforeEach(() => { vi.clearAllMocks() })
afterEach(async () => { await unmount() })

describe('rating the plan\'s last work set', () => {
  it('asks under the plan\'s last work set, with no effort column', async () => {
    await mount(state([entry([set(true), set(true), set(true)])]))
    const rows = rateRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('How many reps were left?')
    expect(rowOf(rows[0])).toBe(container.querySelectorAll('.setrow')[2])
    expect(buttons().map(b => b.textContent.trim())).toEqual(['0', '0.5', '1', '2', '3', '4+'])
    expect(container.querySelectorAll('.effcell, .effcell-stp')).toHaveLength(0)
  })

  it('asks as soon as that set is the one in hand, and not before', async () => {
    await mount(state([entry([set(true), set(false), set(false)])]))
    expect(rateRows()).toHaveLength(0)
    await unmount()
    await mount(state([entry([set(true), set(true), set(false)])]))
    expect(rateRows()).toHaveLength(1)
    expect(rateRows()[0].textContent).toContain('How many reps were left? A tap ticks the set.')
  })

  it('stores the tap on the set and folds into a chip', async () => {
    await mount(state([entry([set(true), set(true), set(true)])]))
    await tap(button('2'))
    expect(mocks.S.active.entries[0].sets[2].rir).toBe(2)
    expect(mocks.S.active.entries[0].sets[1].rir).toBeUndefined()
    await rerender()
    expect(buttons()).toHaveLength(0)
    const chip = container.querySelector('.ratechip')
    expect(chip.textContent.trim()).toBe('RIR 2')
  })

  it('ticks the set with the tap, after storing the rating, so the end-of-workout sheet comes after it', async () => {
    const sheets = await import('../sheets.jsx')
    await mount(state([entry([set(true), set(true), set(false)])]))
    await tap(button('3'))
    const last = mocks.S.active.entries[0].sets[2]
    expect(last.rir).toBe(3)
    expect(last.done).toBe(true)
    expect(sheets.workoutCompleteSheet).toHaveBeenCalledTimes(1)
  })

  it('leaves a ticked set ticked when the rating changes', async () => {
    await mount(state([entry([set(true), set(true), set(true, { rir: 2 })])]))
    await tap(container.querySelector('.ratechip'))
    await tap(button('1'))
    expect(mocks.S.active.entries[0].sets[2].rir).toBe(1)
    expect(mocks.S.active.entries[0].sets[2].done).toBe(true)
  })

  it('opens the row again from the chip to change the rating', async () => {
    await mount(state([entry([set(true), set(true), set(true, { rir: 2 })])]))
    await tap(container.querySelector('.ratechip'))
    expect(buttons()).toHaveLength(6)
    await tap(button('4+'))
    expect(mocks.S.active.entries[0].sets[2].rir).toBe(4)
  })

  it('writes RPE on the RPE scale', async () => {
    await mount(state([entry([set(true), set(true), set(true)])], { effort: 'rpe' }))
    expect(buttons().map(b => b.textContent.trim())).toEqual(['10', '9.5', '9', '8', '7', '6'])
    await tap(button('8'))
    expect(mocks.S.active.entries[0].sets[2].rpe).toBe(8)
  })

  it('asks the plan\'s last set, not a set added on top or a warm-up', async () => {
    const warm = { w: 30, r: 8, done: true, phase: 'warmup' }
    await mount(state([entry([warm, set(true), set(true), set(true), set(true)])]))
    const rows = rateRows()
    expect(rows).toHaveLength(1)
    const work = [...container.querySelectorAll('.setrow')]
    expect(rowOf(rows[0])).toBe(work[3])        // warm-up, then work sets 1–3: the plan's third
    await tap(button('1'))
    expect(mocks.S.active.entries[0].sets[3].rir).toBe(1)
  })

  it('rates a per-side set once, for both sides, and ticks both', async () => {
    const side = syncSideAggregate({ ...makeSideSet({ w: 30, r: 16 }), sides: { L: { w: 30, r: 8, done: true }, R: { w: 30, r: 8, done: false } } })
    await mount(state([entry([side], { target: { mode: 'reps', sets: 1, reps: 16, weight: 30, side: true } })]))
    expect(rateRows()).toHaveLength(1)
    await tap(button('4+'))
    const row = mocks.S.active.entries[0].sets[0]
    expect(row.sides.L.rir).toBe(4)
    expect(row.sides.R.rir).toBe(4)
    expect(row.rir).toBe(4)
    expect(row.sides.L.done).toBe(true)
    expect(row.sides.R.done).toBe(true)
    expect(row.done).toBe(true)
  })

  it('does not ask on a drop set', async () => {
    await mount(state([entry([set(true), set(true), set(true, { type: 'dropset', drops: [{ w: 50, r: 8 }] })])]))
    expect(rateRows()).toHaveLength(0)
  })

  it('brings the column back, and no row, when asked on every set', async () => {
    await mount(state([entry([set(true), set(true), set(true)])], { effortScope: 'all' }))
    expect(rateRows()).toHaveLength(0)
    expect(container.querySelectorAll('.setrow .effcell')).toHaveLength(3)
  })

  it('asks nothing with effort off', async () => {
    await mount(state([entry([set(true), set(true), set(true)])], { effort: 'none' }))
    expect(rateRows()).toHaveLength(0)
    expect(container.querySelectorAll('.effcell')).toHaveLength(0)
  })
})

describe('the first session\'s goal line', () => {
  const hint = 'First time: add weight through your warm-ups until {0} reps leave about 2 in reserve — that is your working weight.'

  it('says how to find the working weight', async () => {
    const plan = { policy: 'linear', kind: 'first', calibrate: true, why: [hint, 8] }
    await mount(state([entry([set(false), set(false), set(false)], { plan })]))
    const line = container.querySelector('.goalline')
    expect(line.textContent).toContain('First time: add weight through your warm-ups until 8 reps leave about 2 in reserve')
  })

  it('keeps the old line without it', async () => {
    const plan = { policy: 'linear', kind: 'first', why: ['Nothing logged yet — this session sets the baseline.'] }
    await mount(state([entry([set(false), set(false), set(false)], { plan })]))
    expect(container.querySelector('.goalline').textContent).toContain('First time — this sets your baseline')
  })
})
