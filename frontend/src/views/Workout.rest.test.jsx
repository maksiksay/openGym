// @vitest-environment happy-dom
// An exercise that rests on its own, not on Settings' timer (lib/rest.js), says so on its card,
// before the rest it times comes as a surprise.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const work = (id, w, restSec) => ({ id, rid: 'main', target: { sets: 1, reps: 5, weight: w, ...(restSec ? { restSec } : {}) }, sets: [{ w, r: 5, done: false }] })

let root
let container
beforeEach(() => {
  localStorage.clear()
  const S = clone(DEF)
  S.restSec = 90
  S.routines = [{ id: 'main', name: 'Main', ex: [{ id: '0025', sets: 1, reps: 5, weight: 100, restSec: 150 }, { id: '0027', sets: 1, reps: 8, weight: 60 }] }]
  S.active = { id: 'session', d: '2026-10-08', start: Date.now(), routineIds: ['main'], routineId: 'main', name: 'Main', bw: null, cur: 0, workoutView: 'list',
    entries: [work('0025', 100, 150), work('0027', 60)] }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('an exercise’s own rest on its card', () => {
  it('is shown where the exercise has one, and not where the timer decides', () => {
    const units = [...container.querySelectorAll('.wl-unit')]
    expect(units).toHaveLength(2)
    const tags = unit => [...unit.querySelectorAll('.tag')].map(x => x.textContent)
    expect(tags(units[0])).toContain('Rest 2:30')
    expect(tags(units[1]).some(x => x.startsWith('Rest '))).toBe(false)
  })
})
