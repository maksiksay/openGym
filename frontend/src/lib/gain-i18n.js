/* Strings of the rate of gain and the food calibration (lib/gain-rate.js, docs/dev/GAIN_RATE.md),
 * kept beside them the way lib/health-i18n.js keeps the health module's: English is the key,
 * Russian the one pack so far, every other language falls back to the main catalogue and then to
 * the English key.
 *
 * The phrasing helpers live here too, so the Home line and the Rate sheet say a reading the same
 * way. */
import { getLang, baseLang, t, dateLocale } from './i18n-core.js'
import ru from './gain-i18n.ru.js'

const PACKS = { ru }

export function tg(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

// Russian picks one of three forms by the number: 1 взвешивание, 2 взвешивания, 5 взвешиваний.
function plural(n, forms) {
  const a = Math.abs(Math.round(Number(n) || 0))
  if (forms.length === 2) return a === 1 ? forms[0] : forms[1]
  const m10 = a % 10, m100 = a % 100
  return m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2]
}
const MORE = {
  en: ['{0} more weigh-in for a rate', '{0} more weigh-ins for a rate'],
  ru: ['ещё {0} взвешивание для темпа', 'ещё {0} взвешивания для темпа', 'ещё {0} взвешиваний для темпа'],
}

/** "2 more weigh-ins for a rate". */
export const moreWeighIns = n => (plural(n, MORE[baseLang(getLang())] || MORE.en)).replace('{0}', Math.round(Number(n) || 0))

const dec = (n, digits) => Math.abs(n).toLocaleString(dateLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })
const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '±')

/** A rate in per cent a week, two decimals: "+0.32 %". */
export const pctText = rate => `${sign(Math.round(rate * 100))}${dec(rate, 2)} %`

/** The same as a weight: "+0.23 kg". */
export const perWeekText = (perWeek, unit = 'kg') => `${sign(Math.round(perWeek * 100))}${dec(perWeek, 2)} ${unit}`

/** A corridor: "+0.25 … +0.5 %". */
export const corridorText = ([lo, hi]) =>
  `${sign(lo)}${Math.abs(lo).toLocaleString(dateLocale())} … ${sign(hi)}${Math.abs(hi).toLocaleString(dateLocale())} %`

const CORRIDOR_OF = { gain: 'Corridor for a gain', keep: 'Corridor to keep the weight', lose: 'Corridor for a cut' }
/** "Corridor for a gain". */
export const corridorLabel = direction => tg(CORRIDOR_OF[direction] || CORRIDOR_OF.keep)

// The short word for where a rate is, by what the person is after: slower or faster is about the
// direction they are going, not about the sign.
const SIDE = {
  gain: { low: 'slow', high: 'fast' },
  lose: { low: 'fast', high: 'slow' },
  keep: { low: 'losing', high: 'gaining' },
}
/** "on track", "slow", "fast", "gaining", "losing". */
export const sideLabel = (direction, kind) => (kind === 'in' ? tg('on track') : tg(SIDE[direction]?.[kind] || kind))

/** "about 200 kcal more a day". */
export const stepText = step => tg(step > 0 ? 'about {0} kcal more a day' : 'about {0} kcal less a day', Math.abs(step).toLocaleString(dateLocale()))
