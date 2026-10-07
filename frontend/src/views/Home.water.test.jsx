// @vitest-environment happy-dom
// Water on the Home health card (docs/dev/WATER.md): today against the goal, the buttons, and
// drinks from the food log counted in.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { healthOn } from '../lib/health.js'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
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
  nav.mockClear()
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })
const mountWith = extra => {
  useStore.setState(s => ({ S: { ...s.S, routines: [], workouts: [], bodyweight: [], active: null, healthOn: true, seasons: [], health: [], meals: [], waterGoal: null, ...extra }, user: null }))
  act(() => root.render(<Home />))
}
const row = () => host.querySelector('.health-water')
const press = label => act(() => { [...row().querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label).click() })
const today = () => healthOn(useStore.getState().S.health, '2026-10-08')

describe('water on the Home health card', () => {
  it('starts at nothing of the goal, and the buttons fill the counter without opening the Health screen', () => {
    mountWith({})
    expect(row().textContent).toContain('0 of 2 l')
    expect(row().querySelector('[aria-label="Take away 250 ml"]')).toBeNull()
    press('Add 250 ml')
    press('Add 500 ml')
    expect(today().water).toBe(750)
    expect(row().textContent).toContain('0.75 of 2 l')
    press('Take away 250 ml')
    expect(today().water).toBe(500)
    expect(nav).not.toHaveBeenCalled()
  })

  it('counts drinks from the food log in, and earns a tick at the goal', () => {
    mountWith({ waterGoal: 1500, health: [{ d: '2026-10-08', t: 1, water: 1250 }],
      meals: [{ id: 'k', d: '2026-10-08', t: 1, slot: 'b', name: 'Kefir', g: 250, kcal: 100, p: 7.5, f: 2.5, c: 10, drink: true }] })
    expect(row().textContent).toContain('1.5 of 1.5 l ✓')
  })

  it('is no check-in: the card still asks how the night was', () => {
    mountWith({ health: [{ d: '2026-10-08', t: 1, water: 500 }] })
    expect(host.textContent).toContain('How did you sleep?')
    expect(host.textContent).toContain('Log wellbeing')
  })
})
