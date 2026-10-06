// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachChat from './CoachChat.jsx'
import { refinePlan, requestReview, sendChat } from '../lib/coach-api.js'

// Where a typed message goes (docs/dev/COACH_CHAT.md): to the Coach as a chat message, which
// decides itself whether to answer, propose a change or ask back, except while a new plan is
// pending or there is no plan at all, where it still refines the plan.
const mocks = vi.hoisted(() => {
  const state = { S: null, pending: null, job: null, last: null, nav: vi.fn(), toast: vi.fn(), openSheet: vi.fn(), refresh: vi.fn() }
  state.storeSnapshot = () => ({
    S: state.S,
    user: { id: 'u1' },
    ready: true,
    config: { coach: { enabled: true } },
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
  useCoachStatus: () => ({ pending: mocks.pending, job: mocks.job, cap: null, loading: false, lastError: null, last: mocks.last, refresh: mocks.refresh, maxMessageLen: 1000 }),
  resolvePending: vi.fn(() => Promise.resolve({})),
  refinePlan: vi.fn(() => Promise.resolve({})),
  requestReview: vi.fn(() => Promise.resolve({})),
  sendChat: vi.fn(() => Promise.resolve({})),
  requestDebrief: vi.fn(() => Promise.resolve({})),
  requestPlan: vi.fn(() => Promise.resolve({})),
  cohortStats: vi.fn(() => Promise.resolve({ ok: false, enabled: true, sharing: false })),
  setCohortShare: vi.fn(() => Promise.resolve({ ok: true, sharing: true })),
  JOB_ERRORS: { internal: 'x' },
  jobErrorText: () => 'x',
  awaitedJob: () => null,
  settleAwaited: vi.fn(),
}))
vi.mock('../sheets.jsx', () => ({ startFlow: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({})),
  IS_APPLE: false, IS_ANDROID: false, BIO: 'biometrics',
}))
vi.mock('../coach.css', () => ({}))

const routine = { id: 'r1', name: 'Strength A', emoji: '💪', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps' }] }
const state = ({ routines = [routine], chat = [] } = {}) => ({
  unit: 'kg', lang: 'en', customEx: [], workouts: [], bodyweight: [], exWeights: {},
  dayPlan: {}, routines, week: {},
  coach: {
    consent: { agreedAt: '2026-07-01T00:00:00Z', version: 2 },
    profile: { goal: 'muscle', experience: 'new', daysPerWeek: 3, sessionMin: 60, preferredDays: [1, 3, 5], equipment: [] },
    log: [], snapshots: [], chat: [{ id: 'c1', role: 'user', kind: 'intake', at: 1 }, ...chat], timings: []
  },
})

let root, host
async function mount({ S = state(), pending = null, job = null, last = null } = {}) {
  mocks.S = S
  mocks.pending = pending
  mocks.job = job
  mocks.last = last
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(React.createElement(CoachChat)) })
}
async function say(text) {
  const box = host.querySelector('.composer textarea')
  await act(async () => {
    Object.getOwnPropertyDescriptor(box.constructor.prototype, 'value').set.call(box, text)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { host.querySelector('.composer .send').click() })
}

beforeEach(() => { vi.clearAllMocks(); globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(async () => {
  if (root) { await act(async () => { root.unmount() }); root = null }
  host?.remove()
})

describe('a message typed in the Coach chat', () => {
  it('goes to the Coach as a chat message when there is a plan and nothing pending', async () => {
    await mount()
    await say('How much protein should I eat?')
    expect(sendChat).toHaveBeenCalledWith('How much protein should I eat?')
    expect(requestReview).not.toHaveBeenCalled()
    expect(refinePlan).not.toHaveBeenCalled()
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'user', kind: 'text', text: 'How much protein should I eat?' })
  })

  it('goes to the Coach as a chat message while a review waits, too', async () => {
    await mount({ pending: { id: 'r1', kind: 'review', summary: 's', changes: [] } })
    await say('Why fewer sets?')
    expect(sendChat).toHaveBeenCalledWith('Why fewer sets?')
  })

  it('still refines a new plan that is pending', async () => {
    await mount({ pending: { id: 'p1', kind: 'create', bundle: { opengym_plan: 1, name: 'Coach plan', week: {}, routines: [routine], customEx: [] } } })
    await say('Shorter sessions, please')
    expect(refinePlan).toHaveBeenCalledWith('Shorter sessions, please')
    expect(sendChat).not.toHaveBeenCalled()
  })

  it('still asks for a plan when there is none', async () => {
    await mount({ S: state({ routines: [] }) })
    await say('Three days, dumbbells only')
    expect(refinePlan).toHaveBeenCalledWith('Three days, dumbbells only')
    expect(sendChat).not.toHaveBeenCalled()
  })
})

describe('when a run ends', () => {
  const review = { id: 'r1', kind: 'review', summary: 's', changes: [] }
  const running = { id: 'j1', kind: 'chat', state: 'running', startedAt: Date.now() }
  async function end(last, pending = review) {
    mocks.job = null
    mocks.last = last
    mocks.pending = pending
    await act(async () => { root.render(React.createElement(CoachChat)) })
  }

  it('writes the answer into the thread even with a review waiting, and leaves the review', async () => {
    await mount({ pending: review, job: running })
    await end({ id: 'j1', kind: 'chat', outcome: 'nochange', reading: 'Because every set hit its target.' })
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'coach', kind: 'nochange', text: 'Because every set hit its target.' })
    const lines = mocks.S.coach.chat.length
    await act(async () => { root.render(React.createElement(CoachChat)) })   // the store's update, seen
    expect(mocks.S.coach.chat).toHaveLength(lines)
    expect(host.textContent).toContain('Because every set hit its target.')
    expect(host.querySelector('[role="checkbox"], .pcard')).toBeTruthy()
  })

  it('writes nothing when the run made the proposal', async () => {
    await mount({ job: running })
    const before = mocks.S.coach.chat.length
    await end({ id: 'j1', kind: 'chat', outcome: 'ready' })
    expect(mocks.S.coach.chat).toHaveLength(before)
  })

  it('says it failed, with a review waiting too', async () => {
    await mount({ pending: review, job: running })
    await end({ id: 'j1', kind: 'chat', outcome: 'failed', errorClass: 'timeout' })
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'coach', kind: 'error' })
  })
})

describe('the Coach’s answer', () => {
  it('shows the sources it names as links that open outside the app, and nothing else as one', async () => {
    const text = 'About 1.6 g per kg a day.\n\nMorton 2018 — https://bjsm.bmj.com/content/52/6/376\njavascript:alert(1)'
    await mount({ S: state({ chat: [{ id: 'a1', role: 'coach', kind: 'nochange', text, at: 2 }] }) })
    const links = [...host.querySelectorAll('.msg.coach .bub a')]
    expect(links.map(a => a.getAttribute('href'))).toEqual(['https://bjsm.bmj.com/content/52/6/376'])
    expect(links[0].getAttribute('target')).toBe('_blank')
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer')
    expect(host.textContent).toContain('javascript:alert(1)')
    expect(host.textContent).toContain('About 1.6 g per kg a day.')
  })

  it('leaves the person’s own lines as plain text', async () => {
    await mount({ S: state({ chat: [{ id: 'u2', role: 'user', kind: 'text', text: 'see https://example.org', at: 2 }] }) })
    expect(host.querySelectorAll('.msg.user a')).toHaveLength(0)
  })
})
