/* Strings of the strength levels (lib/strength-levels.js, docs/dev/STRENGTH_LEVELS.md), kept beside
 * them the way the seasons keep their own (lib/season-i18n.js): English is the key, Russian is the
 * one pack so far, and every other language falls back to the main catalogue and then to the key.
 */
import { getLang, baseLang, t, dateLocale } from './i18n-core.js'
import { nReps } from './score-i18n.js'
import ru from './level-i18n.ru.js'

const PACKS = { ru }

export function tlv(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

const NAMES = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']
/** A level's name; below the first one, "Not yet beginner". */
export const levelName = i => (i >= 0 && i < NAMES.length ? tlv(NAMES[i]) : tlv('Not yet beginner'))

const kg = (n, unit) => `${(Math.round(n * 2) / 2).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} ${unit}`
/** A threshold or a measure in its own unit: "87.5 kg" (to the half), "13 reps". */
export const amountText = (n, reps, unit = 'kg') => (reps ? nReps(Math.ceil(n)) : kg(n, unit))

/** What is left to the next level: "To Advanced: +12.5 kg", or the top. */
export function toNextText(r, unit = 'kg') {
  if (!r) return ''
  if (r.next == null) return tlv('The top level')
  const left = r.reps ? nReps(Math.max(1, Math.ceil(r.toNext))) : `${(Math.ceil(r.toNext * 2) / 2).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} ${unit}`
  return tlv('To {0}: +{1}', levelName(r.level + 1), left)
}
