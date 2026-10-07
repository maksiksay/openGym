import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { APP_LINKS, LINKS, clearPendingSection, linkAvailable, linkLabel, openLink, pendingSection } from './app-links.js'

// docs/dev/COACH_ASSISTANT.md: every place the server lets an answer link to exists in the app.
const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../views/Settings.jsx', import.meta.url), 'utf8')
const routes = new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]))

describe('the app links', () => {
  it('cover exactly the ids the server allows', () => {
    expect(Object.keys(LINKS).sort()).toEqual([...APP_LINKS].sort())
  })

  it('each lead to a route that exists, and a Settings section that exists', () => {
    for (const id of APP_LINKS) {
      expect(routes.has(LINKS[id].path), id + ' → ' + LINKS[id].path).toBe(true)
      if (LINKS[id].section) expect(settings.includes(`id="set-${LINKS[id].section}"`), id).toBe(true)
    }
  })

  it('say where they go', () => {
    expect(linkLabel('settings.health')).toBe('Settings → Health & food')
    expect(linkLabel('library')).toBe('Exercises')
    expect(linkLabel('nowhere')).toBe('')
  })

  it('leave out what this profile has switched off', () => {
    expect(linkAvailable({ healthOn: false }, 'health')).toBe(false)
    expect(linkAvailable({ checkIn: false }, 'checkin')).toBe(false)
    expect(linkAvailable({}, 'health')).toBe(true)
    expect(linkAvailable({}, 'nowhere')).toBe(false)
  })

  it('go to the route, and leave Settings the section to scroll to', () => {
    const nav = vi.fn()
    openLink(nav, 'settings.data')
    expect(nav).toHaveBeenCalledWith('/settings')
    expect(pendingSection()).toBe('data')
    clearPendingSection()
    openLink(nav, 'stats')
    expect(pendingSection()).toBeNull()
  })
})
