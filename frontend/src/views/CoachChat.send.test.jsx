// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachChat from './CoachChat.jsx'
import { refinePlan, requestReview, sendChat } from '../lib/coach-api.js'
import { preparePhoto } from '../lib/coach-photo.js'

// Where a typed message goes (docs/dev/COACH_CHAT.md): to the Coach as a chat message, which
// decides itself whether to answer, propose a change or ask back, except while a new plan is
// pending or there is no plan at all, where it still refines the plan.
const mocks = vi.hoisted(() => {
  const state = { S: null, pending: null, job: null, last: null, vision: false, nav: vi.fn(), toast: vi.fn(), openSheet: vi.fn(), refresh: vi.fn() }
  state.storeSnapshot = () => ({
    S: state.S,
    user: { id: 'u1' },
    ready: true,
    config: { coach: { enabled: true, vision: state.vision } },
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
vi.mock('../lib/coach-photo.js', () => ({
  preparePhoto: vi.fn(async () => ({ type: 'image/jpeg', data: 'QUJD', bytes: 180 * 1024, width: 1280, height: 960, blob: new Blob(['x']) })),
}))

const routine = { id: 'r1', name: 'Strength A', emoji: '💪', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps' }] }
const MEAL = {
  text: 'Counted as you said; the oil is my guess.', slot: 'l', day: 'today',
  items: [
    { name: 'Гречка отварная', g: 200, kcal: 110, p: 4.2, f: 1.1, c: 21.3, confidence: 'typical' },
    { name: 'Куриная грудка', g: 150, kcal: 165, p: 31, f: 3.6, c: 0, confidence: 'typical' },
    { name: 'Масло подсолнечное', g: 10, kcal: 899, p: 0, f: 99.9, c: 0, confidence: 'estimate' },
  ],
}
const state = ({ routines = [routine], chat = [] } = {}) => ({
  unit: 'kg', lang: 'en', customEx: [], workouts: [], bodyweight: [], exWeights: {},
  dayPlan: {}, routines, week: {},
  coach: {
    consent: { agreedAt: '2026-07-01T00:00:00Z', version: 3 },
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
    expect(sendChat).toHaveBeenCalledWith('How much protein should I eat?', null)
    expect(requestReview).not.toHaveBeenCalled()
    expect(refinePlan).not.toHaveBeenCalled()
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'user', kind: 'text', text: 'How much protein should I eat?' })
  })

  it('goes to the Coach as a chat message while a review waits, too', async () => {
    await mount({ pending: { id: 'r1', kind: 'review', summary: 's', changes: [] } })
    await say('Why fewer sets?')
    expect(sendChat).toHaveBeenCalledWith('Why fewer sets?', null)
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

  it('brings a meal as a card for the food log, and leaves a waiting review alone', async () => {
    await mount({ pending: review, job: running })
    await end({ id: 'j1', kind: 'chat', outcome: 'meal', reading: MEAL.text, meal: MEAL })
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'coach', kind: 'meal', status: 'open', text: MEAL.text, meal: MEAL })
  })

  it('says it failed, with a review waiting too', async () => {
    await mount({ pending: review, job: running })
    await end({ id: 'j1', kind: 'chat', outcome: 'failed', errorClass: 'timeout' })
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'coach', kind: 'error' })
  })
})

describe('dictation', () => {
  class FakeRecognizer {
    static last = null
    constructor() { FakeRecognizer.last = this }
    start() { this.started = true }
    stop() { this.stopped = true; this.onend?.() }
    say(...phrases) { this.onresult?.({ results: phrases.map(p => Object.assign([{ transcript: p }], { isFinal: true })) }) }
  }
  afterEach(() => { delete globalThis.webkitSpeechRecognition })

  it('offers no microphone where the browser cannot dictate', async () => {
    await mount()
    expect(host.querySelector('.composer .mic')).toBeNull()
  })

  it('puts what is said after what was typed, and sends nothing on its own', async () => {
    globalThis.webkitSpeechRecognition = FakeRecognizer
    await mount()
    const box = host.querySelector('.composer textarea')
    await act(async () => {
      Object.getOwnPropertyDescriptor(box.constructor.prototype, 'value').set.call(box, 'Привет.')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const mic = host.querySelector('.composer .mic')
    await act(async () => { mic.click() })
    expect(FakeRecognizer.last.started).toBe(true)
    expect(mic.getAttribute('aria-pressed')).toBe('true')
    expect(box.readOnly).toBe(true)
    await act(async () => { FakeRecognizer.last.say('Сколько белка', 'мне нужно?') })
    expect(box.value).toBe('Привет. Сколько белка мне нужно?')
    await act(async () => { mic.click() })
    expect(FakeRecognizer.last.stopped).toBe(true)
    expect(mic.getAttribute('aria-pressed')).toBe('false')
    expect(sendChat).not.toHaveBeenCalled()
    await act(async () => { host.querySelector('.composer .send').click() })
    expect(sendChat).toHaveBeenCalledWith('Привет. Сколько белка мне нужно?', null)
  })

  it('stops listening when the message is sent, and takes no more words', async () => {
    globalThis.webkitSpeechRecognition = FakeRecognizer
    await mount()
    await act(async () => { host.querySelector('.composer .mic').click() })
    await act(async () => { FakeRecognizer.last.say('Сколько белка') })
    const r = FakeRecognizer.last
    r.stop = function () { this.stopped = true }   // a recognizer that ends a little later
    await act(async () => { host.querySelector('.composer .send').click() })
    expect(sendChat).toHaveBeenCalledWith('Сколько белка', null)
    await act(async () => { r.say('Сколько белка мне'); r.onend() })
    expect(host.querySelector('.composer textarea').value).toBe('')
  })

  it('says why when the microphone is refused', async () => {
    globalThis.webkitSpeechRecognition = FakeRecognizer
    await mount()
    await act(async () => { host.querySelector('.composer .mic').click() })
    await act(async () => { FakeRecognizer.last.onerror({ error: 'not-allowed' }); FakeRecognizer.last.onend() })
    expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('not allowed'))
    expect(host.querySelector('.composer .mic').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('a meal card', () => {
  const line = (over = {}) => ({ id: 'meal1', at: Date.now(), role: 'coach', kind: 'meal', text: MEAL.text, meal: MEAL, status: 'open', ...over })
  const type = async (el, value) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  const rerender = () => act(async () => { root.render(React.createElement(CoachChat)) })

  it('shows what the Coach counted, and adds it at the grams the person settled on', async () => {
    await mount({ S: state({ chat: [line()] }) })
    const card = host.querySelector('.pcard.meal')
    expect(card.querySelector('.pcard-h').textContent).toContain('558')
    expect(card.textContent).toContain('Counted as you said; the oil is my guess.')
    const inputs = card.querySelectorAll('.meal-g input')
    expect([...inputs].map(i => i.value)).toEqual(['200', '150', '10'])
    await type(inputs[1], '100')
    await type(inputs[2], '0')
    expect(card.querySelector('.pcard-h').textContent).toContain('385')
    await act(async () => { [...card.querySelectorAll('button')].find(b => /Add to the food log/.test(b.textContent)).click() })
    expect(mocks.S.meals.map(r => [r.name, r.g, r.kcal, r.slot, r.src])).toEqual([
      ['Гречка отварная', 200, 220, 'l', 'ai'],
      ['Куриная грудка', 100, 165, 'l', 'ai'],
    ])
    const saved = mocks.S.coach.chat.find(m => m.id === 'meal1')
    expect(saved).toMatchObject({ status: 'added', added: { slot: 'l', day: 'today', n: 2, kcal: 385 } })
    await rerender()
    expect(host.querySelector('.pcard.meal')).toBeNull()
    expect(host.querySelector('.meal-done').textContent).toContain('Added to lunch, today: 385 kcal')
  })

  it('logs into yesterday\'s dinner when the person says so on the card', async () => {
    await mount({ S: state({ chat: [line()] }) })
    const press = label => act(async () => { [...host.querySelectorAll('.meal-when button')].find(b => b.textContent === label).click() })
    await press('Dinner')
    await press('Yesterday')
    await act(async () => { [...host.querySelectorAll('.pcard.meal button')].find(b => /Add to the food log/.test(b.textContent)).click() })
    const d = new Date(); d.setDate(d.getDate() - 1)
    const yesterday = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    expect(mocks.S.meals.every(r => r.slot === 'd' && r.d === yesterday)).toBe(true)
  })

  it('turned down, it logs nothing and folds', async () => {
    await mount({ S: state({ chat: [line()] }) })
    await act(async () => { [...host.querySelectorAll('.pcard.meal button')].find(b => /Not now/.test(b.textContent)).click() })
    expect(mocks.S.meals).toBeUndefined()
    expect(mocks.S.coach.chat.find(m => m.id === 'meal1').status).toBe('dismissed')
  })

  it('with food tracking off, shows the numbers and says where to switch it on, with no Add', async () => {
    await mount({ S: { ...state({ chat: [line()] }), nutri: { on: false } } })
    const card = host.querySelector('.pcard.meal')
    expect(card.querySelector('.pcard-h').textContent).toContain('558')
    expect(card.textContent).toContain('Settings → Health & food')
    expect([...card.querySelectorAll('button')].some(b => /Add to the food log/.test(b.textContent))).toBe(false)
  })
})

describe('a photo', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => { mocks.vision = false })
  const pick = async () => {
    const input = host.querySelector('.composer input[type="file"]')
    Object.defineProperty(input, 'files', { configurable: true, value: [new Blob(['raw'], { type: 'image/jpeg' })] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  }

  it('can be attached only where the provider can see it', async () => {
    await mount()
    expect(host.querySelector('.composer .attach')).toBeNull()
  })

  it('is not offered while a new plan is being refined, which takes text only', async () => {
    mocks.vision = true
    await mount({ S: state({ routines: [] }) })
    expect(host.querySelector('.composer .attach')).toBeNull()
  })

  it('is prepared on the device, previewed, and sent with the message or on its own', async () => {
    mocks.vision = true
    await mount()
    expect(host.querySelector('.composer .attach')).toBeTruthy()
    await pick()
    expect(preparePhoto).toHaveBeenCalledTimes(1)
    expect(host.querySelector('.attach-preview img').getAttribute('src')).toBe('blob:preview')
    expect(host.querySelector('.attach-preview').textContent).toContain('180 KB')
    const send = host.querySelector('.composer .send')
    expect(send.disabled).toBe(false)
    await act(async () => { send.click() })
    expect(sendChat).toHaveBeenCalledWith('', expect.objectContaining({ type: 'image/jpeg', data: 'QUJD' }))
    expect(mocks.S.coach.chat.at(-1)).toMatchObject({ role: 'user', kind: 'text', text: '', photo: true })
    expect(host.querySelector('.attach-preview')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('can be taken off again before sending', async () => {
    mocks.vision = true
    await mount()
    await pick()
    await act(async () => { host.querySelector('.attach-preview button').click() })
    expect(host.querySelector('.attach-preview')).toBeNull()
    expect(host.querySelector('.composer .send').disabled).toBe(true)
  })

  it('says so when the file is not a photo it can read', async () => {
    mocks.vision = true
    vi.mocked(preparePhoto).mockRejectedValueOnce(Object.assign(new Error('unreadable'), { code: 'unreadable' }))
    await mount()
    await pick()
    expect(mocks.toast).toHaveBeenCalledWith('That file could not be read as a photo.')
    expect(host.querySelector('.attach-preview')).toBeNull()
  })

  it('leaves a mark in the thread where it went, since it is not kept', async () => {
    await mount({ S: state({ chat: [{ id: 'p1', role: 'user', kind: 'text', text: '', photo: true, at: 2 }, { id: 'p2', role: 'user', kind: 'text', text: 'Lunch', photo: true, at: 3 }] }) })
    const bubbles = [...host.querySelectorAll('.msg.user .bub')].slice(-2)
    expect(bubbles.map(b => [b.textContent, !!b.querySelector('[data-icon="camera"]')])).toEqual([['Photo', true], ['Lunch', true]])
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
