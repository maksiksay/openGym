// @vitest-environment happy-dom
// The rate of gain on Home and in its sheet, and the food calibration's cards (docs/dev/GAIN_RATE.md).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { isoPlus } from './lib/gain-rate.js'
import { GainLine, CalibrationCard, CalibrationOffer, CalibrationSummary } from './sheets-gain.jsx'

const TODAY = '2026-10-22'
const FROM = '2026-10-01'
const line = (every, count, start, perDay) =>
  Array.from({ length: count }, (_, i) => ({ d: isoPlus(FROM, i * every), w: Math.round((start + perDay * i * every) * 1000) / 1000 }))

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
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', workouts: [], health: [], meals: [], nutri: { on: true }, targetW: 80, ...extra } }))
  return useStore.getState().S
}
const renderTopSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const button = (host, re) => [...host.querySelectorAll('button')].find(b => re.test(b.textContent))

describe('the line on Home', () => {
  it('says the rate and where it stands', () => {
    expect(render(<GainLine S={withState({ bodyweight: line(3, 8, 72, 0.05) })} />).textContent).toBe('+0.48 % a week · on track')
    expect(render(<GainLine S={withState({ bodyweight: line(3, 8, 72, 0.005) })} />).textContent).toBe('+0.05 % a week · slow: about 250 kcal more a day')
  })

  it('asks for the weigh-ins still missing, and says nothing with none at all', () => {
    expect(render(<GainLine S={withState({ bodyweight: line(3, 2, 72, 0) })} />).textContent).toBe('2 more weigh-ins for a rate')
    expect(render(<GainLine S={withState({ bodyweight: [] })} />).textContent).toBe('')
  })

  it('opens the Rate sheet, whose Apply moves the calorie goal and restarts the clock', () => {
    const S = withState({ bodyweight: line(3, 8, 72, 0.005), nutri: { on: true, goals: { kcal: 2600, p: 130, f: 60, c: 300 } } })
    const host = render(<GainLine S={S} />)
    act(() => host.querySelector('.gain-line').click())
    const sheet = renderTopSheet()
    expect(sheet.textContent).toContain('Slower than the corridor.')
    expect(sheet.textContent).toContain('Goal 2,600 → 2,850 kcal')
    act(() => button(sheet, /^Apply$/).click())
    expect(useStore.getState().S.nutri).toMatchObject({ goals: { kcal: 2850, c: 363 }, kcalAt: TODAY })
  })

  it('in the Rate sheet without a calorie goal, points to the Goals sheet instead', () => {
    const S = withState({ bodyweight: line(3, 8, 72, 0.005) })
    const host = render(<GainLine S={S} />)
    act(() => host.querySelector('.gain-line').click())
    const sheet = renderTopSheet()
    expect(sheet.textContent).toContain('About 250 kcal more a day')
    expect(button(sheet, /Set goals/)).toBeTruthy()
  })
})

describe('the food calibration', () => {
  const meal = (d, slot, kcal, p) => ({ id: d + slot, d, t: 1, slot, name: 'x', g: 100, kcal, p, f: 0, c: 0 })

  it('offers a start below the food day, and once started shows where it stands', () => {
    withState({ bodyweight: [{ d: FROM, w: 72 }] })
    const offer = render(<CalibrationOffer S={useStore.getState().S} />)
    act(() => button(offer, /3 weeks/).click())
    const S = useStore.getState().S
    expect(S.nutri.calib).toEqual({ from: TODAY, days: 21 })
    expect(render(<CalibrationOffer S={S} />).textContent).toBe('')
    const card = render(<CalibrationCard S={{ ...S, meals: [meal(TODAY, 'b', 600, 35), meal(TODAY, 'l', 900, 45)] }} />)
    expect(card.textContent).toContain('Day 1 of 21 · logged days: 1')
    expect(card.textContent).toContain('1,500kcal a day')
    expect(card.textContent).toContain('35 / 29protein at breakfast, g')
  })

  it('once over, the paused card says what it found and offers the calories as a goal', () => {
    const days = Array.from({ length: 12 }, (_, i) => isoPlus(FROM, i))
    const S = withState({
      bodyweight: line(4, 4, 72, 0.01),
      meals: days.flatMap(d => [meal(d, 'b', 900, 40), meal(d, 'l', 1600, 80)]),
      nutri: { on: true, paused: true, calib: { from: FROM, days: 14, result: { at: '2026-10-15', logged: 12, kcal: 2500, p: 120, pb: 40 } } },
    })
    const host = render(<CalibrationSummary S={S} />)
    expect(host.textContent).toContain('Calibration over: 12 of 14 days logged')
    expect(host.textContent).toContain('For the corridor, about 2,700 kcal.')
    act(() => button(host, /Make it my goal/).click())
    expect(useStore.getState().S.nutri.goals.kcal).toBe(2700)
    expect(useStore.getState().S.nutri.kcalAt).toBe(TODAY)
  })
})
