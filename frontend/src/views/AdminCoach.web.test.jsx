// @vitest-environment happy-dom
// The web search switch on the admin card (docs/dev/COACH_WEB.md): shown for a provider that can
// search, sent as a boolean, and replaced by a plain line for one that cannot.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  posts: [],
  status: null,
  base: provider => ({
    disabledByEnv: false, enabled: true, provider,
    providers: [{ id: 'claude', label: 'Claude (Anthropic)', runtime: 'Claude Agent SDK', setupToken: true, connected: true },
      { id: 'openai', label: 'OpenAI API', runtime: 'HTTPS', apiKey: true, http: true, connected: true }],
    model: null, models: {}, baseUrl: null, knownModels: null,
    caps: { perProfileDaily: 0, instanceDaily: 0 }, maxMessageLen: 1000, community: false,
    webSearch: false, webCapable: provider === 'claude',
    runtime: { ok: true, version: 'Claude Agent SDK 1', error: null, needsKey: false }, authMode: 'instance', boundUid: null,
    auth: { state: 'connected', type: 'cli-token', account: 'me', connectedAt: null },
    unprivileged: { ok: true, dropped: true, why: '' }, jobsToday: 0, lastSuccess: null, lastError: null, recent: [],
  }),
}))
vi.mock('../lib/api.js', () => ({
  api: async (path, opts) => {
    if (path === '/api/admin/coach') return structuredClone(mocks.status)
    if (path === '/api/admin/coach/config') {
      const body = JSON.parse(opts.body)
      mocks.posts.push(body)
      Object.assign(mocks.status, body)
      return { ok: true }
    }
    return {}
  },
}))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ refreshConfig: vi.fn(async () => ({})) })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})

const { default: AdminCoach } = await import('./AdminCoach.jsx')

const mounted = []
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })
async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(<AdminCoach />))
  await flush()
  return host
}

describe('the web search switch', () => {
  it('is there for Claude, and switching it sends a boolean', async () => {
    mocks.status = mocks.base('claude')
    mocks.posts.length = 0
    const host = await mount()
    expect(host.textContent).toContain('Let the Coach search the web.')
    const sw = host.querySelector('[role="switch"][aria-label="Web search"]')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await act(async () => { sw.click() })
    await flush()
    expect(mocks.posts).toContainEqual({ webSearch: true })
  })

  it('says a provider that cannot search cannot, with no switch to flip', async () => {
    mocks.status = mocks.base('openai')
    const host = await mount()
    expect(host.querySelector('[role="switch"][aria-label="Web search"]')).toBeNull()
    expect(host.textContent).toContain('has no web search here')
  })
})
