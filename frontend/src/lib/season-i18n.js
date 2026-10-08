/* Strings of the seasons (lib/season.js, docs/dev/SEASONS.md), kept beside them the way the
 * scoreboard keeps its own (lib/score-i18n.js): English is the key, Russian is the one pack so far,
 * and every other language falls back to the main catalogue and then to the English key.
 *
 * The phrasing helpers live here too, so the card, the season sheet and the workout screen say an
 * anchor's numbers the same way.
 */
import { getLang, baseLang, t, dateLocale } from './i18n-core.js'
import { fmtSec } from './history.js'
import { nReps } from './score-i18n.js'
import ru from './season-i18n.ru.js'

const PACKS = { ru }

export function tsn(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

const num = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })

const SLOT = { squat: 'Squat', hinge: 'Hinge', press: 'Horizontal press', pull: 'Vertical pull' }
/** The name of an anchor slot. */
export const slotLabel = slot => tsn(SLOT[slot] || slot)

/** An anchor's number in its own unit: "≈1RM 76 kg", "9 reps", "1:05", and on an assistance
 *  machine the set behind its number, "8 reps · 25 kg of help". */
export function measureText(m, unit = 'kg') {
  if (!m) return '—'
  if (m.kind === 'e1rm') return tsn('≈1RM {0} {1}', num(m.value), unit)
  if (m.kind === 'sec') return fmtSec(m.value)
  if (m.kind === 'assist') return m.w > 0 ? tsn('{0} · {1} {2} of help', nReps(m.r), num(m.w), unit) : nReps(m.r)
  return nReps(m.value)
}

/** The same, short enough for a card's row: "≈79 kg", "9 reps", "1:05". */
export function measureShort(m, unit = 'kg') {
  if (!m) return '—'
  if (m.kind === 'e1rm') return `≈${Math.round(m.value).toLocaleString(dateLocale())} ${unit}`
  return measureText(m, unit)
}

/** How far it came, as a card's row says it: the per cent where there is one. */
export const changeShort = ch => (!ch || ch.delta === 0 ? '' : ch.pct != null ? `${ch.pct > 0 ? '+' : '−'}${Math.abs(ch.pct)}%` : changeText(ch))

/** The set behind it, where there is one worth showing: "65 kg × 11". */
export function setText(m, unit = 'kg') {
  if (!m || m.kind !== 'e1rm' || !(m.w > 0)) return ''
  return `${num(m.w)} ${unit} × ${m.r}`
}

/** How far an anchor came: "+8 kg · +11%", "+3 reps · +50%", "+0:10". On an assistance machine
 *  only the per cent: its number is an estimate made to be compared, not a load anyone lifted. */
export function changeText(ch, unit = 'kg') {
  if (!ch) return ''
  if (ch.kind === 'assist') return ch.pct != null && ch.delta !== 0 ? `${ch.pct > 0 ? '+' : '−'}${Math.abs(ch.pct)}%` : ''
  const sign = ch.delta > 0 ? '+' : ch.delta < 0 ? '−' : '±'
  const abs = Math.abs(ch.delta)
  const amount = ch.kind === 'e1rm' ? `${sign}${num(abs)} ${unit}` : ch.kind === 'sec' ? `${sign}${fmtSec(abs)}` : `${sign}${nReps(abs)}`
  return ch.pct != null && ch.delta !== 0 ? `${amount} · ${ch.pct > 0 ? '+' : '−'}${Math.abs(ch.pct)}%` : amount
}
