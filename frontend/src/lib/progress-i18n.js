/* Strings of the progress photos screen (docs/dev/PROGRESS_PHOTOS.md), kept beside it the way
 * lib/health-i18n.js keeps the health module's: English is the key, Russian the one pack so far,
 * every other language falls back to the main catalogue and then to the English key. */
import { getLang, baseLang, t } from './i18n-core.js'
import ru from './progress-i18n.ru.js'

const PACKS = { ru }

export function tpr(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

// Russian picks one of three forms by the number: 1 день, 2 дня, 5 дней.
function plural(n, forms) {
  const a = Math.abs(Math.round(Number(n) || 0))
  if (forms.length === 2) return a === 1 ? forms[0] : forms[1]
  const m10 = a % 10, m100 = a % 100
  return m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2]
}
const DAYS = { en: ['day', 'days'], ru: ['день', 'дня', 'дней'] }
const PHOTOS = { en: ['photo', 'photos'], ru: ['фото', 'фото', 'фото'] }
const forms = table => table[baseLang(getLang())] || table.en

/** "84 days", "84 дня". */
export const nDays = n => `${Math.round(Number(n) || 0)} ${plural(n, forms(DAYS))}`
/** "12 photos", "12 фото". */
export const nPhotos = n => `${Math.round(Number(n) || 0)} ${plural(n, forms(PHOTOS))}`
