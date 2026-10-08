// @vitest-environment happy-dom
// The quests on Home, in their sheet and on the finish sheet (docs/dev/QUESTS.md).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { QuestsCard, QuestFinishRows, questsSheet } from './sheets-quests.jsx'

const TODAY = '2026-11-01'
const BENCH = '0025'
const set = (w, r) => ({ w, r, done: true })
let n = 0
const workout = (d, entries) => ({ id: 'w' + (++n), d, start: Date.parse(d + 'T18:00:00'), end: Date.parse(d + 'T19:00:00'), entries })
const bench = (d, w, r = 8) => workout(d, [{ id: BENCH, target: { sets: 1, reps: r }, sets: [set(w, r)] }])

const mounted = []
let original
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  original = useStore.getState().S
  useUI.setState({ sheets: [] })
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(r => r.unmount()) })
  document.body.innerHTML = ''
  useStore.setState({ S: original })
  vi.useRealTimers()
})
const render = el => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const withState = extra => {
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', body: 'male', bodyweight: [], routines: [{ id: 'r', ex: [{ id: BENCH }] }], quests: [], ...extra } }))
  return useStore.getState().S
}
const button = (host, re) => [...host.querySelectorAll('button')].find(b => re.test(b.textContent))
const renderTopSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
// Six weeks of bench, 50 → 62.5 kg × 8.
const run = () => [0, 1, 2, 3, 4, 5].map(i => bench(new Date(Date.parse(TODAY) - (5 - i) * 7 * 864e5).toISOString().slice(0, 10), 50 + i * 2.5))

describe('Home\'s Quests card', () => {
  it('says nothing before there is a session to suggest from', () => {
    expect(render(<QuestsCard S={withState({ workouts: [] })} />).textContent).toBe('')
  })

  it('with none open, offers the first suggestion; pinned, shows its bar and forecast', () => {
    const host = render(<QuestsCard S={withState({ workouts: run() })} />)
    expect(host.textContent).toContain('Pick a goal on a lift')
    expect(host.textContent).toContain('≈1RM 80 kg')
    act(() => button(host, /^Pin$/).click())
    const S = useStore.getState().S
    expect(S.quests).toEqual([expect.objectContaining({ kind: 'e1rm', exId: BENCH, value: 80, from: TODAY })])
    const card = render(<QuestsCard S={S} />)
    expect(card.querySelector('.quest-goal').textContent).toBe('≈1RM 80 kg')
    expect(card.querySelector('.quest').textContent).toContain('≈79 of 80 kg')
    expect(card.querySelector('.quest-f').textContent).toMatch(/^the trend is there|^in /)
  })

  it('opens the sheet: the open quests, suggestions, your own and the done ones', () => {
    withState({ workouts: run(), quests: [{ id: 'q', kind: 'e1rm', exId: BENCH, value: 60, from: '2026-09-01' }, { id: 'p', kind: 'e1rm', exId: BENCH, value: 100, from: TODAY }] })
    act(() => questsSheet())
    const sheet = renderTopSheet()
    expect(sheet.textContent).toContain('Open')
    expect(sheet.textContent).toContain('≈1RM 100 kg')
    expect(sheet.textContent).toContain('Suggestions')
    expect(sheet.textContent).toContain('Your own')
    expect(sheet.textContent).toMatch(/Done.*≈1RM 60 kg.*done/)
  })
})

describe('the finish sheet', () => {
  it('lists a quest the workout completed, with its next step to pin', () => {
    const last = bench(TODAY, 57.5)    // ≈72.8 kg
    const S = withState({ workouts: [bench('2026-10-20', 50), last], quests: [{ id: 'q', kind: 'e1rm', exId: BENCH, value: 70, from: '2026-10-01' }] })
    const host = render(<QuestFinishRows w={last} />)
    expect(host.textContent).toContain('Quest done: barbell bench press — ≈1RM 70 kg')
    act(() => button(host, /Next: ≈1RM 75 kg/).click())
    expect(useStore.getState().S.quests.at(-1)).toMatchObject({ kind: 'e1rm', exId: BENCH, value: 75 })
    expect(render(<QuestFinishRows w={S.workouts[0]} />).textContent).toBe('')
  })
})
