// @vitest-environment happy-dom
// An exercise's own rest wins over the rest timer (lib/rest.js). Settings says how many of the
// plan's exercises rest on their own, and Reset makes the timer the rest of all of them.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, confirm: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: opts => { mocks.confirm = opts }, importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
}))
globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.confirm = null
  mocks.S = {
    unit: 'kg', restSec: 90, workouts: [], exWeights: {},
    routines: [
      { id: 'a', name: 'Upper A', ex: [{ id: '0025', sets: 3, restSec: 150, warmupRestSec: 45 }, { id: '0027', sets: 3, restSec: 120 }, { id: '0201', sets: 2 }] },
      { id: 'b', name: 'Upper B', ex: [{ id: '9001', sets: 2, restSec: 60 }] },
    ],
    active: { id: 's', d: '2026-10-08', routineIds: ['a'], entries: [{ id: '0025', target: { sets: 3, restSec: 150 }, sets: [] }] },
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<Settings />))
const rowTitled = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)

describe('the plan’s own rests, under the rest timer', () => {
  it('are counted with their range, and Reset hands every one to the timer, the workout under way too', () => {
    mount()
    const row = rowTitled('Own rest in the plan')
    expect(row.querySelector('.lrow-s').textContent).toBe('Exercises with a rest of their own: 3 (1:00–2:30). It wins over the timer above.')
    act(() => [...row.querySelectorAll('button')].find(b => b.textContent === 'Reset').click())
    expect(mocks.confirm.message).toContain('will rest 1:30 between sets')
    act(() => mocks.confirm.onConfirm())
    expect(mocks.S.routines.flatMap(r => r.ex).filter(e => 'restSec' in e)).toEqual([])
    expect(mocks.S.routines[0].ex[0].warmupRestSec).toBe(45)
    expect(mocks.S.active.entries[0].target).toEqual({ sets: 3 })
  })

  it('are not mentioned when there are none, and with the timer off there is nothing to reset to', () => {
    mocks.S.routines = [{ id: 'a', name: 'Upper A', ex: [{ id: '0025', sets: 3 }] }]
    mount()
    expect(rowTitled('Own rest in the plan')).toBeUndefined()
    act(() => root.unmount())
    root = createRoot(host)
    mocks.S.routines = [{ id: 'a', name: 'Upper A', ex: [{ id: '0025', sets: 3, restSec: 150 }] }]
    mocks.S.restSec = 0
    mount()
    const row = rowTitled('Own rest in the plan')
    expect(row.querySelector('.lrow-s').textContent).toContain('1 (2:30)')
    expect(row.querySelector('button')).toBeNull()
  })
})
