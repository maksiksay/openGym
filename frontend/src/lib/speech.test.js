import { afterEach, describe, expect, it, vi } from 'vitest'
import { canDictate, dictate, speechLang } from './speech.js'

// A recognizer that does what the test says, when the test says.
class FakeRecognizer {
  static last = null
  constructor() { FakeRecognizer.last = this; this.started = false; this.stopped = false }
  start() { if (FakeRecognizer.refuse) throw new Error('already started'); this.started = true }
  stop() { this.stopped = true; this.onend?.() }
  say(...phrases) {
    const results = phrases.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal }))
    this.onresult?.({ resultIndex: 0, results })
  }
}
const install = () => { FakeRecognizer.refuse = false; globalThis.webkitSpeechRecognition = FakeRecognizer }
afterEach(() => { delete globalThis.webkitSpeechRecognition; delete globalThis.SpeechRecognition; FakeRecognizer.last = null })

describe('dictation', () => {
  it('is offered only where the browser has a recognizer', () => {
    expect(canDictate()).toBe(false)
    install()
    expect(canDictate()).toBe(true)
  })

  it('hands over the whole transcript each time, settled words and the current guess', () => {
    install()
    const onText = vi.fn()
    dictate({ lang: 'ru-RU', onText, onEnd: () => {} })
    const r = FakeRecognizer.last
    expect(r.started).toBe(true)
    expect([r.lang, r.continuous, r.interimResults]).toEqual(['ru-RU', true, true])
    r.say(['Сколько белка', false])
    r.say(['Сколько белка', true], [' мне нужно ', false])
    expect(onText.mock.calls.map(c => c[0])).toEqual(['Сколько белка', 'Сколько белка мне нужно'])
  })

  it('ends once, with no error for silence or its own stop', () => {
    install()
    const onEnd = vi.fn()
    const stop = dictate({ lang: 'en-US', onText: () => {}, onEnd })
    FakeRecognizer.last.onerror({ error: 'no-speech' })
    stop()
    FakeRecognizer.last.onend()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(null)
  })

  it('ends with the reason when the microphone is refused', () => {
    install()
    const onEnd = vi.fn()
    dictate({ lang: 'en-US', onText: () => {}, onEnd })
    FakeRecognizer.last.onerror({ error: 'not-allowed' })
    FakeRecognizer.last.onend()
    expect(onEnd).toHaveBeenCalledWith('not-allowed')
  })

  it('ends at once where it cannot start', () => {
    const onEnd = vi.fn()
    dictate({ lang: 'en-US', onText: () => {}, onEnd })
    expect(onEnd).toHaveBeenCalledWith('unsupported')
    install()
    FakeRecognizer.refuse = true
    const again = vi.fn()
    dictate({ lang: 'en-US', onText: () => {}, onEnd: again })
    expect(again).toHaveBeenCalledWith('busy')
  })
})

describe('speechLang', () => {
  it('takes the device\'s own region for the app\'s language', () => {
    expect(speechLang('ru', ['en-GB', 'ru-BY'])).toBe('ru-BY')
    expect(speechLang('en', ['ru-RU', 'en-GB'])).toBe('en-GB')
  })
  it('falls back to the usual region, keeps a full tag, and passes an unknown code through', () => {
    expect(speechLang('ru', ['en-US'])).toBe('ru-RU')
    expect(speechLang('pt-BR', [])).toBe('pt-BR')
    expect(speechLang('pt_BR', [])).toBe('pt-BR')
    expect(speechLang('xx', [])).toBe('xx')
    expect(speechLang(null, [])).toBe('en-US')
  })
})
