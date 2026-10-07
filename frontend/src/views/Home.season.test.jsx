// @vitest-environment happy-dom
// The season on Home (docs/dev/SEASONS.md): an invitation, the week it is in with what the anchors
// have done, the test week, the week off, and the end.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { seasonSheet, seasonStartSheet } from '../sheets-season.jsx'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))
vi.mock('../sheets-season.jsx', () => ({ seasonSheet: vi.fn(), seasonStartSheet: vi.fn() }))

const season = (over = {}) => ({ id: 's1', n: 1, start: '2026-10-05', weeks: 6, anchors: { squat: null, hinge: null, press: '0025', pull: '0017' }, closed: null, ...over })
const lift = (d, ex, w, r, extra = {}) => ({
  id: 'w' + d + ex, d, start: Date.parse(d + 'T18:00:00'), routineIds: ['A'],
  entries: [{ id: ex, rid: 'A', target: { mode: 'reps' }, sets: [{ w, r, done: true, ...extra }] }],
})
const routines = [{ id: 'A', name: 'Push', ex: [{ id: '0025', sets: 3, reps: 8 }, { id: '0017', sets: 3, reps: 8 }] }]

let host, root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.mocked(seasonSheet).mockClear(); vi.mocked(seasonStartSheet).mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

const mountOn = (iso, extra = {}) => {
  vi.setSystemTime(new Date(iso + 'T12:00:00'))
  useStore.setState(s => ({
    S: { ...s.S, routines, workouts: [], bodyweight: [], dayPlan: {}, week: {}, active: null, seasons: [], unit: 'kg', ...extra },
    user: null,
  }))
  act(() => root.render(<Home />))
}
const card = () => host.querySelector('.season-card')
const tap = el => act(() => { el.click() })

describe('the season card on Home', () => {
  it('invites a season once there is a plan, and opens the start sheet', () => {
    mountOn('2026-10-20')
    expect(card().textContent).toContain('Start a season')
    tap(card())
    expect(seasonStartSheet).toHaveBeenCalled()
  })

  it('says nothing about seasons before there is a plan', () => {
    mountOn('2026-10-20', { routines: [] })
    expect(card()).toBeNull()
  })

  it('shows the week, the weeks gone, and each anchor\'s best with how far it came', () => {
    mountOn('2026-10-20', {
      seasons: [season()],
      workouts: [lift('2026-10-06', '0025', 60, 8), lift('2026-10-15', '0025', 65, 8)],
    })
    expect(card().textContent).toContain('Season 1 · week 3 of 6')
    expect(card().textContent).toContain('Test from')
    expect([...card().querySelectorAll('.season-weeks i')].map(i => i.className.trim())).toEqual(['on', 'on', 'on', '', '', 'test'])
    const rows = [...card().querySelectorAll('.season-row')].map(r => r.textContent)
    expect(rows[0]).toBe('barbell bench press≈82 kg +8%')
    expect(rows[1]).toContain('not yet logged')
    tap(card())
    expect(seasonSheet).toHaveBeenCalled()
  })

  it('in the test week, says what the test is and which anchors are done', () => {
    mountOn('2026-11-10', {
      seasons: [season()],
      workouts: [lift('2026-10-06', '0025', 60, 8), lift('2026-11-09', '0025', 62.5, 11, { test: true })],
    })
    expect(card().textContent).toContain('Season 1 · test week')
    expect(card().textContent).toContain('as many reps as you can')
    const rows = [...card().querySelectorAll('.season-row')]
    expect(rows[0].querySelector('[data-icon="checkCircle"]')).toBeTruthy()
    expect(rows[1].textContent).toContain('to test')
  })

  it('in the week off, says when the next season starts', () => {
    mountOn('2026-10-01', { seasons: [season({ n: 2 })] })
    expect(card().textContent).toContain('Week off · Season 2 starts')
  })

  it('after the last day, says the season is over and opens its results', () => {
    mountOn('2026-11-16', { seasons: [season()] })
    expect(card().textContent).toContain('Season 1 is over')
    tap(card())
    expect(seasonSheet).toHaveBeenCalled()
  })
})
