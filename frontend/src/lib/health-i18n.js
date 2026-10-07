/* Strings of the health & nutrition module, kept beside it rather than in src/locales/.
 *
 * The module is new and so far speaks English and Russian. Its strings sit here, not in the
 * sixteen locale packs, so that scripts/check-locales.mjs — which fails a key that only some
 * packs carry — stays green while the other languages are still to come. th() reads this pack
 * for the current language, falls back to the main catalogue (shared words like "Save" are
 * already translated everywhere), and then to the English key, the way t() does.
 *
 * Moving these into src/locales/ is the step that comes with translating them.
 */
import { getLang, baseLang, t, dateLocale } from './i18n-core.js'
import ru from './health-i18n.ru.js'

const PACKS = { ru }

export function th(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

/** Russian plural for a count: one / few / many — "1 день", "2 дня", "5 дней". */
/** "8,123 steps", in the language's own plural form. */
export const nSteps = n => `${Math.round(Number(n) || 0).toLocaleString(dateLocale())} ${plural(n, STEPS[baseLang(getLang())] || STEPS.en)}`
const STEPS = { en: ['step', 'steps'], ru: ['шаг', 'шага', 'шагов'] }

/** Water in litres to two places, without the unit: "1.25", "2" (docs/dev/WATER.md). */
export const litresNum = ml => (Math.round((Number(ml) || 0) / 10) / 100).toLocaleString(dateLocale(), { maximumFractionDigits: 2 })
/** "250 ml". */
export const nMl = ml => `${Math.round(Number(ml) || 0).toLocaleString(dateLocale())} ${th('ml')}`

/** "5 of 7 entries" — how many of a day's rows had sugar or fibre (docs/dev/SUGAR_FIBRE.md). In
 *  Russian the noun after «из N» is genitive: «из 1 записи», «из 7 записей», «из 21 записи». */
export function ofEntries(k, n) {
  const lang = baseLang(getLang())
  if (lang === 'ru') return `${k} из ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'записи' : 'записей'}`
  return `${k} of ${n} ${n === 1 ? 'entry' : 'entries'}`
}

export function plural(n, forms) {
  const lang = baseLang(getLang())
  if (lang !== 'ru' && lang !== 'uk') return Math.abs(n) === 1 ? forms[0] : forms[forms.length - 1]
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
