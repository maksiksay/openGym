/* Strings of the A/B starter plan and of the next session without a weekly plan
 * (docs/dev/AB_PLAN.md), kept beside them the way lib/health-i18n.js and lib/score-i18n.js keep
 * theirs: English is the key, Russian the one pack so far, and every other language falls back to
 * the main catalogue and then to the English key, the way t() does. Moving these into src/locales/
 * comes with translating them.
 */
import { getLang, baseLang, t } from './i18n-core.js'
import ru from './plan-i18n.ru.js'

const PACKS = { ru }

export function tp(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}
