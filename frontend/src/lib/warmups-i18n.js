/* Strings of warm-ups and recovery (docs/dev/WARMUPS.md), kept beside them the way
 * lib/health-i18n.js keeps the health module's: English is the key, Russian the one pack so far,
 * every other language falls back to the main catalogue and then to the English key. */
import { getLang, baseLang, t } from './i18n-core.js'
import ru from './warmups-i18n.ru.js'

const PACKS = { ru }

export function tw(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}
