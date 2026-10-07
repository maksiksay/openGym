/* Strings of the RIR step (lib/progression.js, docs/dev/RIR_STEP.md) and of rating the last set
 * (views/Workout.jsx, views/Settings.jsx), kept beside them the way the scoreboard keeps its own
 * (lib/score-i18n.js): English is the key, Russian is the one pack so far, and every other language
 * falls back to the main catalogue and then to the English key, the way t() does. That keeps
 * scripts/check-locales.mjs green while the other languages are still to come.
 *
 * A prescription's reason is a template and its arguments (`why`). The older reasons live in the
 * main catalogue and the RIR step's here, so `te` is the one way to say any of them.
 */
import { getLang, baseLang, t } from './i18n-core.js'
import ru from './effort-i18n.ru.js'

const PACKS = { ru }

export function te(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

/** A prescription's reason in the profile's language, or null when it has none. */
export const whyText = why => (Array.isArray(why) && why.length ? te(...why) : null)
