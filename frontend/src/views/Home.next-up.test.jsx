// @vitest-environment happy-dom
// With no weekly plan at all, Home offers the routine whose turn it is (docs/dev/AB_PLAN.md).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'
import { startFlow, dayOverrideSheet } from '../sheets.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '',
}))

const routines = [
  { id: 'A', name: 'Strength A', emoji: 'barbell', ex: [{ id: '0043', sets: 3, reps: 5 }] },
  { id: 'B', name: 'Strength B', emoji: 'pullup', ex: [{ id: '0085', sets: 3, reps: 8 }] },
]
const yesterday = { id: 'w1', d: '2026-10-14', start: Date.parse('2026-10-14T18:00:00'), routineIds: ['A'], entries: [] }

let host, root
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T12:00:00'))   // a Thursday
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

const mountWith = extra => {
  useStore.setState(s => ({
    S: { ...s.S, routines, workouts: [yesterday], bodyweight: [], dayPlan: {}, week: {}, active: null, ...extra },
    user: null,
  }))
  act(() => root.render(<Home />))
}
const row = () => host.querySelector('.today-row')

describe('the today row without a weekly plan', () => {
  it('offers the routine whose turn it is, and starts it on a tap', () => {
    mountWith()
    expect(row().textContent).toContain('Next up')
    expect(row().textContent).toContain('Strength B')
    expect(row().textContent).toContain('Start')
    act(() => { row().click() })
    expect(startFlow).toHaveBeenCalledWith(['B'])
  })

  it('stays a rest day while the weekly plan is in use', () => {
    mountWith({ week: { 1: ['A'] } })
    expect(row().textContent).toContain('Rest day')
    expect(row().textContent).not.toContain('Next up')
    act(() => { row().click() })
    expect(startFlow).not.toHaveBeenCalled()
    expect(dayOverrideSheet).toHaveBeenCalled()
  })

  it('says done once today has its session, the way a planned day does', () => {
    mountWith({ workouts: [yesterday, { ...yesterday, id: 'w2', d: '2026-10-15', start: Date.parse('2026-10-15T09:00:00'), routineIds: ['B'], name: 'Strength B' }] })
    expect(row().textContent).toContain('Strength B — done')
    expect(row().textContent).not.toContain('Next up')
  })
})
