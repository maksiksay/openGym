// @vitest-environment happy-dom
// The progress photos screen (docs/dev/PROGRESS_PHOTOS.md): the feed, the empty screen, compare
// with its defaults, a side changed, the slider, and what a tap opens.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'

const mocks = vi.hoisted(() => ({ viewer: vi.fn(), openSheet: vi.fn(), nav: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: mocks.openSheet })
  const useUI = sel => (sel ? sel(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('../components/WorkoutMedia.jsx', async orig => ({ ...(await orig()), openWorkoutMediaViewer: (...a) => mocks.viewer(...a) }))
const { default: Progress } = await import('./Progress.jsx')

const h = c => c.repeat(64)
const photo = c => ({ kind: 'image', hash: h(c), mime: 'image/webp', size: 3, width: 8, height: 6, at: 1 })
const video = c => ({ kind: 'video', hash: h(c), mime: 'video/mp4', size: 3, width: 8, height: 6, at: 1 })
const workout = (id, d, start, media) => ({ id, d, start, name: 'Strength ' + id, entries: [], media })
const withPhotos = {
  workouts: [
    workout('a', '2026-07-01', 1, [photo('a'), video('b')]),
    workout('b', '2026-08-01', 2, [photo('c')]),
    workout('c', '2026-09-23', 3, [photo('d')]),
  ],
  bodyweight: [{ d: '2026-06-28', w: 74.5 }, { d: '2026-08-01', w: 73.2 }, { d: '2026-09-23', w: 72.4 }],
  health: [{ d: '2026-07-03', waist: 84 }, { d: '2026-09-23', waist: 81 }],
}

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  mocks.viewer.mockClear(); mocks.openSheet.mockClear(); mocks.nav.mockClear()
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const mountWith = extra => {
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', workouts: [], bodyweight: [], health: [], ...extra } }))
  act(() => root.render(<Progress />))
}
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text)
const click = el => act(() => { el.click() })

describe('the progress photos screen', () => {
  it('lists the days with photos, newest first, with the weight and waist that stand for them', () => {
    mountWith(withPhotos)
    expect([...host.querySelectorAll('.pp-dayh')].map(x => x.textContent)).toEqual([
      expect.stringMatching(/^23 Sept? 2026 · 72\.4 kg · 81 cm$/),
      expect.stringMatching(/^1 Aug 2026 · 73\.2 kg$/),
      expect.stringMatching(/^1 Jul 2026 · ≈74\.5 kg · ≈84 cm$/),
    ])
    expect(host.querySelectorAll('.pp-item')).toHaveLength(3)   // the video stays out
  })

  it('says where photos come from while there are none', () => {
    mountWith({ workouts: [workout('a', '2026-07-01', 1, [])] })
    expect(host.textContent).toContain('No progress photos yet')
    expect(button('Compare')).toBeUndefined()
    expect(button('Add photos')).toBeTruthy()
  })

  it('opens the workout\'s own viewer at the photo', () => {
    mountWith(withPhotos)
    click(host.querySelectorAll('.pp-item')[2])
    expect(mocks.viewer).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 0)
  })

  it('compares the first and the latest, and a side can be changed from the feed', () => {
    mountWith(withPhotos)
    click(button('Compare'))
    const sides = () => [...host.querySelectorAll('.pp-side .pp-date')].map(x => x.textContent)
    expect(sides()).toEqual([expect.stringMatching(/^1 Jul 2026$/), expect.stringMatching(/^23 Sept? 2026$/)])
    expect(host.querySelector('.pp-sum').textContent).toBe('84 days · −2.1 kg · −3 cm waist')
    click(host.querySelectorAll('.pp-side button')[0])
    click(host.querySelectorAll('.pp-item')[1])                  // Aug 1
    expect(sides()[0]).toMatch(/^1 Aug 2026$/)
    expect(host.querySelector('.pp-sum').textContent).toBe('53 days · −0.8 kg')
    expect(mocks.viewer).not.toHaveBeenCalled()
  })

  it('lays the two over each other under a slider', () => {
    mountWith(withPhotos)
    click(button('Compare'))
    click([...host.querySelectorAll('button')].find(b => b.textContent === 'Slider'))
    const range = host.querySelector('.pp-range')
    expect(host.querySelector('.pp-top').style.clipPath).toBe('inset(0 0 0 50%)')
    act(() => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(range, '30')
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.querySelector('.pp-top').style.clipPath).toBe('inset(0 0 0 30%)')
  })

  it('adds photos to a workout picked from the last ones', () => {
    mountWith(withPhotos)
    click(host.querySelector('[aria-label="Add photos"]'))
    expect(mocks.openSheet).toHaveBeenCalledTimes(1)
  })
})
