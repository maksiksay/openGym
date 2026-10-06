// @vitest-environment happy-dom
// The month's quota stands where the week streak was (docs/dev/SCOREBOARD.md).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '',
}))

const lift = (id, d, ex, w) => ({
  id, d, start: Date.parse(d + 'T18:00:00'), routineIds: ['A'],
  entries: [{ id: ex, rid: 'A', target: { mode: 'reps' }, sets: [{ w, r: 5, done: true }] }],
})
const history = [
  lift('w1', '2026-09-20', 'bench', 60),
  lift('w2', '2026-10-02', 'bench', 62.5),
  lift('w3', '2026-10-02', 'row', 50),      // a second workout on the same day: one training day
  lift('w4', '2026-10-09', 'bench', 65),
]

let host, root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

const mountWith = (extra = {}) => {
  useStore.setState(s => ({
    S: {
      ...s.S, routines: [{ id: 'A', name: 'Push', ex: [] }], workouts: history, bodyweight: [], dayPlan: {},
      week: { 1: ['A'], 4: ['A'] }, active: null, monthGoal: null, ...extra,
    },
    user: null,
  }))
  act(() => root.render(<Home />))
}
const dots = () => [...host.querySelectorAll('.quota-dots i')].map(i => i.className || '-')

describe('the quota card on Home', () => {
  it('counts this month’s training days against four weeks of the plan', () => {
    mountWith()
    expect(host.textContent).toContain('October · 2 of 8')
    expect(host.textContent).toContain('Wins: 2 · September: 1')
    expect(dots()).toEqual(['on', 'on', '-', '-', '-', '-', '-', '-'])
    expect(host.textContent).not.toContain('week streak')
  })

  it('says when the quota is met, and marks the days past it', () => {
    mountWith({ monthGoal: 1 })
    expect(host.textContent).toContain('October · 2 of 1')
    expect(host.textContent).toContain('Quota met ✓ · Wins: 2')
    expect(dots()).toEqual(['on', 'extra'])
  })

  it('reads a long goal as a bar', () => {
    mountWith({ monthGoal: 20 })
    expect(host.querySelector('.quota-dots')).toBeNull()
    expect(host.querySelector('.quota-bar i').style.width).toBe('10%')
  })
})
