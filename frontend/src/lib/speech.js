// Dictation into the Coach chat (docs/dev/COACH_VOICE_PHOTO.md). The browser's own speech
// recognition (the Web Speech API), so nothing new is installed and no audio passes through this
// server: on an iPhone it is Apple's recognizer, the same one the keyboard's microphone uses.
// Where the browser has none (Firefox, an app shell's web view) there is simply no button.

const Recognizer = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null

/** Whether this browser can dictate at all. */
export const canDictate = () => !!Recognizer()

// A recognizer wants a full tag; the app keeps a bare one. The device's own languages say which
// region the person speaks (ru-RU, en-GB); failing that, the usual one for the language.
const REGION = {
  en: 'en-US', ru: 'ru-RU', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-BR', hu: 'hu-HU',
  pl: 'pl-PL', uk: 'uk-UA', nl: 'nl-NL', tr: 'tr-TR', cs: 'cs-CZ', sv: 'sv-SE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR',
}

/** The recognizer's language for the app's `lang`. */
export function speechLang(lang, deviceLangs = globalThis.navigator?.languages || []) {
  const tag = String(lang || 'en').replace('_', '-')
  if (/^[a-z]{2,3}-[a-z0-9]{2,8}$/i.test(tag)) return tag
  const base = tag.toLowerCase()
  const own = [].concat(deviceLangs || []).find(l => typeof l === 'string' && l.includes('-') && l.toLowerCase().split('-')[0] === base)
  return own || REGION[base] || base
}

/**
 * Listen until stopped, or until the recognizer stops on its own after a pause.
 *
 * `onText(text)` gets the whole transcript so far, the settled words and the current guess,
 * each time it changes; `onEnd(error)` comes once, when listening has stopped for any reason,
 * with null or the recognizer's error code ('not-allowed', 'audio-capture', 'network', …). The
 * recognizer reporting silence or its own stop is not an error. Returns stop().
 */
export function dictate({ lang, onText, onEnd }) {
  const R = Recognizer()
  let r = null
  try { r = R ? new R() : null } catch { r = null }
  if (!r) { onEnd?.('unsupported'); return () => {} }
  let error = null
  let done = false
  const end = () => { if (!done) { done = true; onEnd?.(error) } }
  r.lang = lang
  r.continuous = true
  r.interimResults = true
  r.maxAlternatives = 1
  r.onresult = e => {
    // Rebuilt from every result each time: browsers differ on which results an event repeats,
    // and on whether a phrase after the first starts with a space.
    const parts = []
    for (let i = 0; i < (e.results?.length || 0); i++) {
      const said = String(e.results[i]?.[0]?.transcript || '').trim()
      if (said) parts.push(said)
    }
    onText?.(parts.join(' '))
  }
  r.onerror = e => { if (e?.error && e.error !== 'aborted' && e.error !== 'no-speech') error = e.error }
  r.onend = end
  try { r.start() } catch { error = 'busy'; end(); return () => {} }
  return () => { try { r.stop() } catch { end() } }
}
