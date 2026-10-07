// @vitest-environment happy-dom
// Strength levels in Stats, and an anchor's level in a season's results (docs/dev/STRENGTH_LEVELS.md).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useUI } from '../store/useUI.js'
import { bwSheet } from '../sheets.jsx'
import StrengthLevelsCard from './StrengthLevels.jsx'
import { AnchorLevel } from '../sheets-season.jsx'
import { anchorProgress } from '../lib/season.js'

vi.mock('../sheets.jsx', () => ({ bwSheet: vi.fn(), confirmSheet: vi.fn(), starterPlanSheet: vi.fn() }))

const today = new Date().toISOString().slice(0, 10)
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const set = (w, r) => ({ w, r, done: true })
const workout = (d, id, sets) => ({ id: 'w' + d + id, d, start: Date.parse(d + 'T18:00:00'), entries: [{ id, target: { mode: 'reps' }, sets }] })
const S = (over = {}) => ({ unit: 'kg', body: 'male', bodyweight: [{ d: daysAgo(30), w: 72 }], customEx: [], workouts: [], ...over })

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.mocked(bwSheet).mockClear()
  useUI.setState({ sheets: [] })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const render = el => act(() => root.render(el))

describe('the strength levels card', () => {
  it('asks for a weigh-in first, since levels are read against body weight', () => {
    render(<StrengthLevelsCard S={S({ bodyweight: [], workouts: [workout(daysAgo(3), '0025', [set(60, 8)])] })} />)
    expect(host.textContent).toContain('Levels are read against your body weight')
    act(() => { [...host.querySelectorAll('button')].find(b => /Log weight/.test(b.textContent)).click() })
    expect(bwSheet).toHaveBeenCalled()
  })

  it('shows each lift with a standard: its level, the bar, and what is left to the next', () => {
    render(<StrengthLevelsCard S={S({ workouts: [workout(daysAgo(3), '0025', [set(60, 8)]), workout(daysAgo(2), '1004', [set(0, 15)])] })} />)
    expect(host.textContent).toContain('Body weight 72 kg · man')
    const rows = [...host.querySelectorAll('.level-row')]
    expect(rows).toHaveLength(1)                        // the band squat has no standard
    expect(rows[0].textContent).toContain('barbell bench press')
    expect(rows[0].querySelector('.level-badge').textContent).toBe('Novice')
    expect(rows[0].textContent).toMatch(/To Intermediate: \+[\d.]+ kg/)
    expect(rows[0].querySelectorAll('.level-bar i.on')).toHaveLength(2)
    act(() => { rows[0].click() })
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('says which lifts have standards when none of them was trained lately', () => {
    render(<StrengthLevelsCard S={S({ workouts: [workout(daysAgo(3), '1004', [set(0, 15)])] })} />)
    expect(host.querySelector('.level-row')).toBeNull()
    expect(host.textContent).toContain('Levels exist for the bench press')
  })
})

describe('an anchor\'s level in a season\'s results', () => {
  const season = { id: 's', n: 1, start: daysAgo(44), weeks: 6, anchors: { squat: null, hinge: null, press: '0025', pull: null }, closed: null }
  const state = S({
    bodyweight: [{ d: daysAgo(60), w: 72 }],
    workouts: [workout(daysAgo(43), '0025', [set(55, 8)]), { ...workout(daysAgo(4), '0025', [set(70, 10)]), entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 70, r: 10, done: true, test: true }] }] }],
  })

  it('reads week 1 and the test against the standards, with the arrow when it went up', () => {
    const p = anchorProgress(state, season, '0025', today)
    render(<AnchorLevel S={state} season={season} id="0025" p={p} />)
    expect(host.textContent).toBe('Level: Novice → Intermediate ↑')
  })

  it('says nothing for an anchor without a standard', () => {
    const p = { base: { kind: 'reps', value: 15 }, test: { kind: 'reps', value: 20 } }
    render(<AnchorLevel S={state} season={season} id="1004" p={p} />)
    expect(host.textContent).toBe('')
  })
})
