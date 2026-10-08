/* Strings of the rest an exercise keeps of its own (lib/rest.js), kept beside it the way
 * lib/health-i18n.js keeps the health module's: English is the key, Russian the one pack so far,
 * every other language falls back to the main catalogue and then to the English key. */
import { getLang, baseLang, t } from './i18n-core.js'
import ru from './rest-i18n.ru.js'

const PACKS = { ru }

export function trest(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}
