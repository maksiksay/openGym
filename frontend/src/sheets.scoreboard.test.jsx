// @vitest-environment happy-dom
// The scoreboard outside the workout screen (docs/dev/SCOREBOARD.md): the finish sheet lists what
// the session won and where the month stands, History shows the count and the chips, and the
// month's goal is set in its own sheet.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout, workoutDetailSheet, monthGoalSheet, WorkoutRow } from './sheets.jsx'

const BENCH = '0025'   // barbell bench press
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []

function mount(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(node))
  return host
}
const mountTopSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return mount(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

const done = (w, r) => ({ w, r, done: true })
const benchDay = (id, d, w) => ({
  id, d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T19:00:00'), name: 'Push', routineIds: ['A'], prs: [],
  entries: [{ id: BENCH, rid: 'A', target: { mode: 'reps', sets: 2, reps: 10, weight: w }, sets: [done(w, 10), done(w, 10)] }],
})

function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    routines: [{ id: 'A', name: 'Push', emoji: 'dumbbell', ex: [{ id: BENCH, sets: 2, reps: 10, weight: 50, mode: 'reps' }] }],
    week: { 1: ['A'], 5: ['A'] }, dayPlan: {}, active: null, weighIn: false,
    workouts: [benchDay('w1', '2026-09-11', 50)],
  }, extra)
  useStore.setState({ S: st, user: null })
}

// Today's session, every set ticked, at `w` kg.
function liveSession(w) {
  useStore.getState().update(s => {
    s.active = {
      id: 'live', d: '2026-09-16', start: Date.now() - 3600000, name: 'Push', routineIds: ['A'],
      entries: [{ id: BENCH, rid: 'A', target: { mode: 'reps', sets: 2, reps: 10, weight: w }, sets: [done(w, 10), done(w, 10)] }],
    }
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toasts: [] })
  document.body.innerHTML = ''
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.useRealTimers()
})

describe('the finish sheet', () => {
  it('lists what the session won, and where the month stands', () => {
    act(() => liveSession(52.5))
    act(() => finishWorkout())
    const sheet = mountTopSheet()
    expect(sheet.textContent).toContain('Wins1')
    expect(sheet.querySelector('.winrow').textContent).toBe('barbell bench press — +2.5 kg · weight 52.5 kg · e1RM 70 kg · volume 1,050 kg')
    expect(sheet.textContent).toContain('September: 2 of 8')
    // the PR list upstream reads is still written
    expect(S().workouts.at(-1).prs).toEqual([BENCH])
  })

  it('banks a session that won nothing, without calling it worse', () => {
    act(() => liveSession(45))
    act(() => finishWorkout())
    const sheet = mountTopSheet()
    expect(sheet.textContent).toContain('Wins—')
    expect(sheet.querySelector('.winrow')).toBeNull()
    expect(sheet.textContent).toContain('Session banked · September: 2 of 8')
  })

  it('says when the month’s quota is met', () => {
    install({ monthGoal: 2 })
    act(() => liveSession(45))
    act(() => finishWorkout())
    expect(mountTopSheet().textContent).toContain('September: 2 of 2 — quota met ✓')
  })
})

describe('History', () => {
  const history = () => [benchDay('w1', '2026-09-11', 50), benchDay('w2', '2026-09-14', 52.5)]

  it('counts the wins on a workout row', () => {
    install({ workouts: history() })
    const row = mount(<WorkoutRow w={history()[1]} onClick={() => {}} />)
    const badge = row.querySelector('.pr')
    expect(badge.textContent).toBe('1')
    expect(badge.getAttribute('aria-label')).toBe('1 win')
    // the first session set the baseline and has no badge
    expect(mount(<WorkoutRow w={history()[0]} onClick={() => {}} />).querySelector('.pr')).toBeNull()
  })

  it('names the wins under the exercise of a past workout', () => {
    install({ workouts: history() })
    act(() => workoutDetailSheet(S().workouts[1]))
    expect(mountTopSheet().querySelector('.winline').textContent).toBe('+2.5 kg · weight 52.5 kg · e1RM 70 kg · volume 1,050 kg')
  })
})

describe('the month’s goal', () => {
  it('saves a number of your own, and goes back to the plan’s', () => {
    act(() => monthGoalSheet())
    let sheet = mountTopSheet()
    expect(button(sheet, 'Auto — 8 from your plan')).toBeTruthy()
    act(() => { sheet.querySelector('button[aria-label="Increase"]').click() })
    act(() => { button(sheet, 'Save').click() })
    expect(S().monthGoal).toBe(9)

    act(() => monthGoalSheet())
    sheet = mountTopSheet()
    act(() => { button(sheet, 'Auto — 8 from your plan').click() })
    expect(S().monthGoal).toBeNull()
  })
})
