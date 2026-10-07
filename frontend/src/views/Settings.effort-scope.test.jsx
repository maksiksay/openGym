// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

// "Ask on" (docs/dev/RIR_STEP.md): where the effort rating is asked — one row under the plan's
// last work set, or the column on every set. It only shows while effort is on.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, openSheet: null }
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
  const snap = () => ({ toast: vi.fn(), openSheet: mocks.openSheet })
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
  loadStarterPlan: vi.fn(), starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.openSheet = vi.fn()
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'rir',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings />))
const segButton = label => [...host.querySelectorAll('.seg button')].find(b => b.textContent === label)

describe('Settings — where the effort rating is asked', () => {
  it('reads an absent choice as the last set, and says what that does', () => {
    mount()
    expect(segButton('The last set').getAttribute('aria-pressed')).toBe('true')
    expect(segButton('Every set').getAttribute('aria-pressed')).toBe('false')
    expect(host.textContent).toContain('One rating under the last work set of each exercise; it sets the size of the next step.')
  })

  it('writes effortScope to the store', () => {
    mount()
    act(() => { segButton('Every set').click() })
    expect(mocks.S.effortScope).toBe('all')
    mount()
    expect(segButton('Every set').getAttribute('aria-pressed')).toBe('true')
    expect(host.textContent).toContain('A rating on every set, in its own column.')
    act(() => { segButton('The last set').click() })
    expect(mocks.S.effortScope).toBe('last')
  })

  it('is not offered while effort is off', () => {
    mocks.S.effort = 'none'
    mount()
    expect(segButton('The last set')).toBeUndefined()
    expect(segButton('Every set')).toBeUndefined()
  })

  it('tells in the help sheet that progression now reads the last set', () => {
    mount()
    act(() => { host.querySelector('button[aria-label="What are RIR and RPE?"]').click() })
    expect(mocks.openSheet).toHaveBeenCalledTimes(1)
    const sheet = document.createElement('div')
    const sheetRoot = createRoot(sheet)
    act(() => sheetRoot.render(mocks.openSheet.mock.calls[0][0](() => {})))
    expect(sheet.textContent).toContain('Progression reads the last set’s rating')
    expect(sheet.textContent).not.toContain('progression and estimated 1RM are unaffected')
    act(() => sheetRoot.unmount())
  })
})
