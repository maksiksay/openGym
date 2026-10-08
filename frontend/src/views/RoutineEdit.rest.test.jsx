// @vitest-environment happy-dom
// The plan says which exercises rest on their own rather than on Settings' timer (lib/rest.js).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let container
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('an exercise’s own rest in the routine editor', () => {
  it('follows its sets and reps, and is absent where the timer decides', () => {
    const S = JSON.parse(JSON.stringify(DEF))
    S.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [
      { id: '0025', sets: 3, reps: 8, weight: 60, restSec: 150 },
      { id: '0027', sets: 3, reps: 8, weight: 50 },
    ] }]
    useStore.setState({ S, user: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(
      <MemoryRouter initialEntries={['/routine/r1']}>
        <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
      </MemoryRouter>
    ))
    const lines = [...container.querySelectorAll('.item .ss')].map(x => x.textContent)
    expect(lines).toHaveLength(2)
    expect(lines[0].endsWith(' · rest 2:30')).toBe(true)
    expect(lines[1]).not.toContain('rest')
  })
})
