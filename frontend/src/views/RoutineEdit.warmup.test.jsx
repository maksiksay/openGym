// @vitest-environment happy-dom
// docs/dev/WARMUPS.md: a training routine names the warm-up that runs first, in the editor; a
// warm-up or recovery routine has no progression, deload or warm-up of its own to set.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
bindUI(useUI)
const clone = value => JSON.parse(JSON.stringify(value))

const mounted = []
function mount(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(node))
  mounted.push([root, host])
  return host
}

function renderRoutine(id) {
  const S = clone(DEF)
  S.routines = [
    { id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [{ id: '0025', sets: 3, reps: 8, weight: 40 }] },
    { id: 'w1', name: 'Upper warm-up', emoji: 'stretch', kind: 'mobility', ex: [{ id: '3021', sets: 1, reps: 12, weight: 0, prog: 'off' }] },
    { id: 'w2', name: 'Recovery', emoji: 'heart', kind: 'mobility', ex: [] },
  ]
  useStore.setState({ S, user: null })
  return mount(
    <MemoryRouter initialEntries={['/routine/' + id]}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  )
}

const rowTitled = (host, title) => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
// Open the Warm-up row's sheet and tap one of its options.
function pick(host, label) {
  act(() => rowTitled(host, 'Warm-up').click())
  const sheet = mount(useUI.getState().sheets.at(-1).render(() => {}))
  const options = [...sheet.querySelectorAll('.lrow-t')].map(x => x.textContent)
  act(() => [...sheet.querySelectorAll('button')].find(b => b.textContent === label).click())
  return options
}

beforeEach(() => { localStorage.clear(); useUI.setState({ sheets: [] }) })
afterEach(() => {
  for (const [root, host] of mounted.splice(0)) { act(() => root.unmount()); host.remove() }
})

describe('the warm-up in the routine editor', () => {
  it('a training routine picks one of the warm-ups, says it runs first, and can go back to none', () => {
    const host = renderRoutine('r1')
    expect(rowTitled(host, 'Warm-up').querySelector('.lrow-v').textContent).toBe('None')
    expect(host.textContent).not.toContain('Runs first when this routine starts.')

    expect(pick(host, 'Upper warm-up')).toEqual(['None', 'Upper warm-up', 'Recovery'])
    expect(useStore.getState().S.routines[0].warmup).toBe('w1')
    expect(rowTitled(host, 'Warm-up').querySelector('.lrow-v').textContent).toBe('Upper warm-up')
    expect(host.textContent).toContain('Runs first when this routine starts. Skip warm-up drops it for that day.')

    pick(host, 'None')
    expect('warmup' in useStore.getState().S.routines[0]).toBe(false)
    expect(host.textContent).not.toContain('Runs first when this routine starts.')
  })

  it('a warm-up or recovery routine has no progression, deload or warm-up of its own', () => {
    const host = renderRoutine('w1')
    expect(host.textContent).toContain('A warm-up or recovery routine')
    expect(rowTitled(host, 'Warm-up')).toBeUndefined()
    expect(rowTitled(host, 'Progression')).toBeUndefined()
    expect(rowTitled(host, 'Deload routine')).toBeUndefined()
  })
})
