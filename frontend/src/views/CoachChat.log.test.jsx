import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachChat from './CoachChat.jsx'
import { healthOn } from '../lib/health.js'
import { pendingSection, clearPendingSection } from '../lib/app-links.js'
import { todayISO } from '../lib/format.js'

// The chat as the app's assistant (docs/dev/COACH_ASSISTANT.md): a "To log" card that writes a
// weight, a check-in, water and goals only on a tap, with lines that can be left out; and the
// places an answer links to, as buttons that open them.
const mocks = vi.hoisted(() => {
  const state = { S: null, pending: null, job: null, community: false, maxMessageLen: 2200, nav: vi.fn(), toast: vi.fn(), openSheet: vi.fn(), refresh: vi.fn() }
  state.storeSnapshot = () => ({
    S: state.S,
    user: { id: 'u1' },
    ready: true,
    config: { coach: { enabled: true, ...(state.community ? { community: true } : {}) } },
    coachLocal: null,
    update: mut => mut(state.S),
  })
  state.uiSnapshot = () => ({ toast: state.toast, openSheet: state.openSheet })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../lib/coach-api.js', () => ({
  useCoachStatus: () => ({ pending: mocks.pending, job: mocks.job, cap: null, loading: false, lastError: null, last: null, refresh: mocks.refresh, maxMessageLen: mocks.maxMessageLen }),
  resolvePending: vi.fn(() => Promise.resolve({})),
  refinePlan: vi.fn(() => Promise.resolve({})),
  requestReview: vi.fn(() => Promise.resolve({})),
  requestDebrief: vi.fn(() => Promise.resolve({})),
  cohortStats: vi.fn(() => Promise.resolve({ ok: false, enabled: true, sharing: false })),
  setCohortShare: vi.fn(() => Promise.resolve({ ok: true, sharing: true })),
  JOB_ERRORS: { internal: 'x' },
  awaitedJob: () => null,
  settleAwaited: vi.fn(),
}))
vi.mock('../sheets.jsx', () => ({ startFlow: vi.fn(), confirmSheet: vi.fn(), askBeforeNewPlan: go => go() }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})),
  IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))
vi.mock('../coach.css', () => ({}))

let dom, root, container

const logLine = over => ({ id: 'l1', role: 'coach', kind: 'log', text: 'Noted: the weight, the night and the water.', at: Date.now(), status: 'open',
  log: { text: 'Noted.', day: 'today', weight: 72.4, checkin: { sleep: 6, energy: 2 }, water: 1000, goals: { p: 140 } }, ...over })
const answer = { id: 'n1', role: 'coach', kind: 'nochange', text: 'Settings, under Health & food.', open: ['settings.health', 'health'], at: Date.now() }
const state = (chat, over = {}) => ({
  unit: 'kg', lang: 'en', customEx: [], workouts: [], bodyweight: [], exWeights: {}, healthOn: true,
  dayPlan: {}, routines: [], week: {}, health: [], meals: [], nutri: { on: true, goals: { kcal: 2400, p: 130, f: 70, c: 290 } },
  coach: {
    consent: { agreedAt: '2026-07-01T00:00:00Z', version: 4 },
    profile: { goal: 'muscle', experience: 'new', daysPerWeek: 3, sessionMin: 60, preferredDays: [1, 3, 5], equipment: [] },
    log: [], snapshots: [], chat: [{ id: 'c1', role: 'user', kind: 'intake', at: 1 }, ...chat], timings: []
  },
  ...over,
})

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}
async function mount(S) {
  if (root) { await act(async () => { root.unmount() }); root = null }
  mocks.S = S
  mocks.pending = null
  mocks.job = null
  installDom()
  await act(async () => { root.render(React.createElement(CoachChat)) })
}
async function click(el) {
  expect(el).toBeTruthy()
  await act(async () => { el.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}
const card = () => container.querySelector('.pcard.log')
const items = () => [...card().querySelectorAll('.log-item')].map(r => r.querySelector('.log-name').textContent + ': ' + r.querySelector('.log-v').textContent)

beforeEach(() => { vi.clearAllMocks(); clearPendingSection() })
afterEach(async () => {
  if (root) { await act(async () => { root.unmount() }); root = null }
  container = null; dom = null
})

describe('the "To log" card', () => {
  it('shows each line with what it changes, and writes nothing until Log is tapped', async () => {
    const S = state([logLine()])
    await mount(S)
    expect(items()).toEqual([
      'Weight: 72.4 kg',
      'Sleep: 6 h',
      'Energy: 2/5',
      'Water: +1,000 ml',
      'Protein goal: 130 g → 140 g',
    ])
    expect(S.bodyweight).toEqual([])
    expect(S.health).toEqual([])
  })

  it('writes what was kept, on the day chosen, and then says what it logged', async () => {
    const S = state([logLine()])
    await mount(S)
    const energy = [...card().querySelectorAll('.log-item')].find(r => /Energy/.test(r.textContent))
    await click(energy.querySelector('[aria-label="Leave out"]'))
    await click([...card().querySelectorAll('button')].find(b => b.textContent === 'Log'))
    const today = todayISO()
    expect(S.bodyweight.map(b => [b.d, b.w])).toEqual([[today, 72.4]])
    expect(healthOn(S.health, today)).toMatchObject({ sleep: 6, water: 1000 })
    expect(healthOn(S.health, today).energy).toBeUndefined()
    expect(S.nutri.goals.p).toBe(140)
    const line = S.coach.chat.find(m => m.id === 'l1')
    expect(line.status).toBe('logged')
    await mount(S)
    expect(container.querySelector('.meal-done').textContent).toContain('Logged: Weight 72.4 kg · Sleep 6 h · Water +1,000 ml · Protein goal 140 g')
  })

  it('leaves the check-in and the water out while the health log is off', async () => {
    await mount(state([logLine()], { healthOn: false }))
    expect(items()).toEqual(['Weight: 72.4 kg', 'Protein goal: 130 g → 140 g'])
  })
})

describe('an answer\'s links', () => {
  it('are buttons that open the place, Settings at its section', async () => {
    await mount(state([answer]))
    const links = [...container.querySelectorAll('.msg-link')]
    expect(links.map(b => b.textContent)).toEqual(['Open: Settings → Health & food', 'Open: Health'])
    await click(links[0])
    expect(mocks.nav).toHaveBeenCalledWith('/settings')
    expect(pendingSection()).toBe('health')
  })

  it('leave out a place this profile has switched off', async () => {
    await mount(state([answer], { healthOn: false }))
    expect([...container.querySelectorAll('.msg-link')].map(b => b.textContent)).toEqual(['Open: Settings → Health & food'])
  })
})
