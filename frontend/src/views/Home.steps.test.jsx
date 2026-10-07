// @vitest-environment happy-dom
// Steps on the Home health card (docs/dev/HEALTH_IMPORT.md): yesterday against the goal, and the
// week's average over the days that have a count.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))
vi.mock('../sheets-season.jsx', () => ({ seasonSheet: vi.fn(), seasonStartSheet: vi.fn() }))

let host, root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-08T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })
const mountWith = extra => {
  useStore.setState(s => ({ S: { ...s.S, routines: [], workouts: [], bodyweight: [], active: null, healthOn: true, seasons: [], ...extra }, user: null }))
  act(() => root.render(<Home />))
}

describe('steps on the Home health card', () => {
  it('shows yesterday against the goal and the week\'s average', () => {
    mountWith({ stepsGoal: 8000, health: [{ d: '2026-10-07', steps: 8123 }, { d: '2026-10-06', steps: 6001 }] })
    expect(host.querySelector('.health-steps').textContent).toBe('Yesterday 8,123 steps ✓ · 7 days: 7,062 on average of 8,000')
  })

  it('says nothing before any day has a count', () => {
    mountWith({ health: [{ d: '2026-10-07', energy: 4 }] })
    expect(host.querySelector('.health-steps')).toBeNull()
  })
})
