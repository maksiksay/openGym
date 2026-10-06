// The links in a Coach message (docs/dev/COACH_CHAT.md): a chat answer that rests on a web search
// names its sources by URL, and on a phone a URL nobody can tap is one nobody opens. Only http(s)
// is ever a link; anything else stays text.

const URL_RE = /\bhttps?:\/\/[^\s<>"'«»]+/gi

/** Where a found URL ends: punctuation after it belongs to the sentence, and a closing bracket
 *  to the text around it unless the URL opened one itself (Wikipedia's "Foo_(bar)"). */
function trimUrl(raw) {
  let url = raw
  for (;;) {
    const last = url.slice(-1)
    if ('.,;:!?'.includes(last)) url = url.slice(0, -1)
    else if (last === ')' && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) url = url.slice(0, -1)
    else if (last === ']' && !url.includes('[')) url = url.slice(0, -1)
    else return url
  }
}

/** `text` cut into `{ text }` and `{ url }` parts, in order; the parts joined give `text` back. */
export function splitLinks(text) {
  const s = String(text ?? '')
  const parts = []
  let at = 0
  for (const m of s.matchAll(URL_RE)) {
    const url = trimUrl(m[0])
    if (!/^https?:\/\/[^/?#\s]+/i.test(url)) continue
    if (m.index > at) parts.push({ text: s.slice(at, m.index) })
    parts.push({ url })
    at = m.index + url.length
  }
  if (at < s.length) parts.push({ text: s.slice(at) })
  return parts
}
