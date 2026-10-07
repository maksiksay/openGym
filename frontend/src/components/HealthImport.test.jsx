// @vitest-environment happy-dom
// Steps and sleep from Apple Health, in Settings (docs/dev/HEALTH_IMPORT.md): a key made and shown
// once, the last import, and the way to turn it off.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { confirmSheet } from '../sheets.jsx'
import HealthImport, { lastImportText } from './HealthImport.jsx'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))
vi.mock('../lib/clipboard.js', () => ({ copyText: vi.fn(async () => true) }))

const URL_ = 'https://gym.example/api/health/import'
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.mocked(api).mockReset(); vi.mocked(confirmSheet).mockReset()
  useUI.setState({ sheets: [] })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const mount = async () => { await act(async () => { root.render(<HealthImport />) }) }
const button = re => [...host.querySelectorAll('button')].find(b => re.test(b.textContent))

describe('the Apple Health import in Settings', () => {
  it('makes a key on request, and shows it with the address only then', async () => {
    vi.mocked(api).mockImplementation(async (path, opts) => (opts?.method === 'POST'
      ? { key: 'ogh_secret', url: URL_, exists: true, created: Date.parse('2026-10-08T09:00:00'), lastUsed: null, last: null }
      : { exists: false, url: URL_ }))
    await mount()
    expect(host.textContent).toContain('Off')
    await act(async () => { button(/Make a key/).click() })
    expect(api).toHaveBeenCalledWith('/api/health/import-key', { method: 'POST', body: '{}' })
    expect([...host.querySelectorAll('.himp-key code')].map(c => c.textContent)).toEqual([URL_, 'ogh_secret'])
    expect(host.textContent).toContain('nothing imported yet')
    expect(button(/New key/)).toBeTruthy()
  })

  it('says what the last import wrote, and asks before turning the key off', async () => {
    vi.mocked(api).mockResolvedValue({ exists: true, url: URL_, created: 1, lastUsed: Date.parse('2026-10-08T09:00:00'), last: [{ d: '2026-10-07', steps: 8123 }, { d: '2026-10-08', sleep: 7.25 }] })
    await mount()
    expect(host.textContent).toContain('8,123 steps · slept 7 h 15 min')
    expect(host.querySelector('.himp-key')).toBeNull()
    act(() => { button(/Turn off/).click() })
    expect(confirmSheet).toHaveBeenCalledWith(expect.objectContaining({ danger: true }))
  })

  it('opens the recipe for the Shortcut', async () => {
    vi.mocked(api).mockResolvedValue({ exists: false, url: URL_ })
    await mount()
    act(() => { button(/How to set up the Shortcut/).click() })
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('writes the last import in a line', () => {
    expect(lastImportText([{ d: 'x', steps: 1 }, { d: 'y', sleep: 6.5 }])).toBe('1 step · slept 6 h 30 min')
    expect(lastImportText(null)).toBe('')
  })
})
