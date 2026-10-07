// @vitest-environment happy-dom
// The Health screen's Water card and chart (docs/dev/WATER.md).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { healthOn } from '../lib/health.js'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
const waterSheet = vi.fn()
vi.mock('../sheets-health.jsx', async orig => ({ ...(await orig()), waterSheet: (...a) => waterSheet(...a) }))
const { default: Health } = await import('./Health.jsx')

let host, root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-08T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  waterSheet.mockClear()
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })
const mountWith = extra => {
  useStore.setState(s => ({ S: { ...s.S, workouts: [], healthOn: true, health: [], meals: [], foods: [], waterGoal: null, nutri: { on: true }, ...extra } }))
  act(() => root.render(<Health />))
}
const card = () => [...host.querySelectorAll('.card')].find(c => c.querySelector('h2')?.textContent === 'Water')
const kefir = (d, g) => ({ id: d + g, d, t: 1, slot: 'b', name: 'Kefir', g, kcal: 100, p: 7.5, f: 2.5, c: 10, drink: true })

describe('the Water card', () => {
  it('reads the day against the goal, names the part from food, and averages the week before', () => {
    mountWith({ health: [{ d: '2026-10-08', t: 1, water: 1000 }, { d: '2026-10-07', t: 1, water: 2500 }], meals: [kefir('2026-10-08', 250), kefir('2026-10-06', 1500)] })
    const c = card()
    expect(c.querySelector('.hwater-n').textContent).toContain('1.25of 2 l')
    expect(c.textContent).toContain('Buttons 1,000 ml · from food 250 ml')
    expect(c.textContent).toContain('The 7 days before: 2 l a day on average')
    // A kefir is food too: the food list says it in millilitres.
    expect(host.textContent).toContain('250 ml · ')
  })

  it('works on the day shown, and the number opens the exact amount', () => {
    mountWith({})
    act(() => host.querySelector('[aria-label="Previous day"]').click())
    act(() => [...card().querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Add 500 ml').click())
    expect(healthOn(useStore.getState().S.health, '2026-10-07').water).toBe(500)
    expect(healthOn(useStore.getState().S.health, '2026-10-08')).toBeNull()
    act(() => card().querySelector('.hwater-n').click())
    expect(waterSheet).toHaveBeenCalledWith('2026-10-07')
  })

  it('leaves the check-in for a day that has only water', () => {
    mountWith({ health: [{ d: '2026-10-08', t: 1, water: 500 }] })
    expect(host.textContent).toContain('Log wellbeing')
  })
})
