// @vitest-environment happy-dom
// docs/dev/WARMUPS.md: warm-ups and recovery listed apart from training, with their own New and
// Ready-made, a training routine saying which warm-up runs first, and moves within each list.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'

const mocks = vi.hoisted(() => ({ ready: vi.fn(), nav: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../sheets.jsx', () => ({
  dayAssignSheet: vi.fn(), dayAddRoutineSheet: vi.fn(), starterPlanSheet: vi.fn(), planToolsSheet: vi.fn(), confirmSheet: vi.fn(),
}))
vi.mock('../sheets-warmups.jsx', () => ({ readyWarmupsSheet: () => mocks.ready() }))
const { default: Plan } = await import('./Plan.jsx')

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  mocks.ready.mockClear(); mocks.nav.mockClear()
  useStore.setState(s => ({ S: { ...s.S, week: {}, dayPlan: {}, routines: [
    { id: 'up', name: 'Upper A', emoji: null, warmup: 'w1', ex: [{ id: '0025' }] },
    { id: 'w1', name: 'Upper warm-up', emoji: 'stretch', kind: 'mobility', ex: [{ id: '3021' }] },
    { id: 'legs', name: 'Legs', emoji: null, ex: [{ id: '0043' }] },
    { id: 'w2', name: 'Recovery', emoji: 'heart', kind: 'mobility', ex: [{ id: '1511' }] },
  ] }, user: null }))
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<Plan />))
const lists = () => [...host.querySelectorAll('.list')].map(l => [...l.querySelectorAll('.tt')].map(x => x.textContent))
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

describe('warm-ups and recovery on the Plan screen', () => {
  it('are listed apart from training, and a routine says which warm-up runs first', () => {
    mount()
    expect(lists().slice(-2)).toEqual([['Upper A', 'Legs'], ['Upper warm-up', 'Recovery']])
    expect(host.textContent).toContain('Warm-ups and recovery')
    const upper = [...host.querySelectorAll('.item')].find(e => e.querySelector('.tt')?.textContent === 'Upper A')
    expect(upper.querySelector('.ss').textContent).toContain('warm-up: Upper warm-up')
  })

  it('move within their own list, past the training routines between them', () => {
    mount()
    const recovery = [...host.querySelectorAll('.item')].find(e => e.querySelector('.tt')?.textContent === 'Recovery')
    click(recovery.querySelector('button[aria-label="Move up"]'))
    expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['up', 'w2', 'w1', 'legs'])
    expect(lists().slice(-2)).toEqual([['Upper A', 'Legs'], ['Recovery', 'Upper warm-up']])
  })

  it('open the ready-made sets, and New makes a warm-up', () => {
    mount()
    click([...host.querySelectorAll('button')].find(b => b.textContent === 'Ready-made'))
    expect(mocks.ready).toHaveBeenCalledTimes(1)
    const news = [...host.querySelectorAll('button')].filter(b => b.textContent === 'New')
    click(news[news.length - 1])
    const made = useStore.getState().S.routines.at(-1)
    expect(made).toMatchObject({ kind: 'mobility', name: 'New warm-up', ex: [] })
    expect(mocks.nav).toHaveBeenCalledWith('/plan/r/' + made.id)
  })
})
