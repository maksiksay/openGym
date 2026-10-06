import { describe, expect, it } from 'vitest'
import { splitLinks } from './links.js'

const join = parts => parts.map(p => p.text ?? p.url).join('')

describe('splitLinks', () => {
  it('finds the sources under a Coach answer', () => {
    const text = 'About 1.6 g per kg.\n\nMorton 2018 — https://bjsm.bmj.com/content/52/6/376\nhttp://example.org/x — http://example.org/x'
    const parts = splitLinks(text)
    expect(parts.filter(p => p.url).map(p => p.url)).toEqual(['https://bjsm.bmj.com/content/52/6/376', 'http://example.org/x', 'http://example.org/x'])
    expect(join(parts)).toBe(text)
  })

  it('leaves the punctuation after a URL to the sentence', () => {
    const parts = splitLinks('See https://example.org/a. Or (https://example.org/b), or https://en.wikipedia.org/wiki/Foo_(bar)!')
    expect(parts.filter(p => p.url).map(p => p.url)).toEqual(['https://example.org/a', 'https://example.org/b', 'https://en.wikipedia.org/wiki/Foo_(bar)'])
  })

  it('never makes a link of anything but http(s)', () => {
    for (const s of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'example.org/x', 'ftp://example.org', 'https://', '']) {
      expect(splitLinks(s).some(p => p.url)).toBe(false)
    }
    expect(join(splitLinks('javascript:alert(1)'))).toBe('javascript:alert(1)')
  })

  it('is plain text when there is nothing to link, and copes with no text at all', () => {
    expect(splitLinks('Sleep 7–9 hours.')).toEqual([{ text: 'Sleep 7–9 hours.' }])
    expect(splitLinks(null)).toEqual([])
  })
})
