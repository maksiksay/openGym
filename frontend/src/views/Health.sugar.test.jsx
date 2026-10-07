// @vitest-environment happy-dom
// Sugar and fibre on the Health screen (docs/dev/SUGAR_FIBRE.md): fibre against its goal, sugar
// with no limit, and how many of the day's rows had them.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
const { default: Health } = await import('./Health.jsx')

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
  useStore.setState(s => ({ S: { ...s.S, workouts: [], healthOn: true, health: [], meals: [], foods: [], nutri: { on: true }, ...extra } }))
  act(() => root.render(<Health />))
}
const row = (id, d, extra) => ({ id, d, t: 1, slot: 'b', name: id, g: 100, kcal: 100, p: 5, f: 2, c: 15, ...extra })
const food = () => [...host.querySelectorAll('.card')].find(c => c.querySelector('h2')?.textContent === 'Food')

describe('sugar and fibre on the Health screen', () => {
  it('show fibre against the goal and sugar alone, saying how many rows had them', () => {
    mountWith({ nutri: { on: true, fibGoal: 35 }, meals: [
      row('oats', '2026-10-08', { sug: 1, fib: 10.1 }), row('banana', '2026-10-08', { sug: 12.2, fib: 2.6 }), row('lunch', '2026-10-08'),
    ] })
    const bars = [...food().querySelectorAll('.hbar')].map(b => b.textContent)
    expect(bars.find(t => t.startsWith('Fibre'))).toBe('Fibre · 2 of 3 entries12.7 / 35 g')
    expect(food().querySelector('.hsugar').textContent).toBe('Sugar · 2 of 3 entries13.2 g')
  })

  it('say nothing about coverage when every row has them, and read the goal as 30 by default', () => {
    mountWith({ meals: [row('oats', '2026-10-08', { sug: 1, fib: 10.1 })] })
    const fibre = [...food().querySelectorAll('.hbar')].map(b => b.textContent).find(t => t.startsWith('Fibre'))
    expect(fibre).toBe('Fibre10.1 / 30 g')
    expect(food().querySelector('.hsugar').textContent).toBe('Sugar1 g')
  })

  it('average the week before over the days that have them', () => {
    mountWith({ meals: [
      row('a', '2026-10-07', { sug: 20, fib: 20 }), row('b', '2026-10-06', { sug: 40, fib: 30 }), row('c', '2026-10-05'),
    ] })
    expect(host.textContent).toContain('Fibre 25 g a day · sugar 30 g a day')
  })
})
