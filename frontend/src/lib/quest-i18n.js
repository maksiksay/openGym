/* Strings of the quests and their forecasts (lib/quests.js, docs/dev/QUESTS.md), kept beside them
 * the way lib/season-i18n.js keeps the seasons': English is the key, Russian the one pack so far,
 * every other language falls back to the main catalogue and then to the English key.
 *
 * The phrasing helpers live here too, so Home's card, the sheet and the finish sheet name a quest
 * and say its forecast the same way. */
import { getLang, baseLang, t, dateLocale, exerciseNameFor, exerciseNameClass } from './i18n-core.js'
import { EXIDX } from './exercises.js'
import { levelName } from './level-i18n.js'
import { standardOf, isRepsLift } from './strength-levels.js'
import ru from './quest-i18n.ru.js'

const PACKS = { ru }

export function tq(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

// Russian picks one of three forms by the number: 1 неделя, 2 недели, 5 недель.
function plural(n, forms) {
  const a = Math.abs(Math.round(Number(n) || 0))
  if (forms.length === 2) return a === 1 ? forms[0] : forms[1]
  const m10 = a % 10, m100 = a % 100
  return m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2]
}
const FORMS = {
  weeks: { en: ['week', 'weeks'], ru: ['неделю', 'недели', 'недель'] },
  sessions: { en: ['session', 'sessions'], ru: ['тренировка', 'тренировки', 'тренировок'] },
  reps: { en: ['rep', 'reps'], ru: ['повторение', 'повторения', 'повторений'] },
}
const word = (kind, n) => plural(n, FORMS[kind][baseLang(getLang())] || FORMS[kind].en)
const num = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })

/** The exercise a quest is on, in the app's language. */
export const questExercise = (S, q) => {
  const ex = EXIDX[String(q.exId)] || (S?.customEx || []).find(e => String(e?.id) === String(q.exId))
  return ex ? exerciseNameFor(ex) : String(q.exId)
}

/** The class its name element takes, so it is cased the way every exercise name is. */
export const questNameClass = q => exerciseNameClass(EXIDX[String(q.exId)])

/** What a quest asks for, without the exercise: "≈1RM 70 kg", "80 kg × 5", "10 reps in a set". */
export function questGoal(S, q) {
  const unit = S?.unit || 'kg'
  if (q.kind === 'e1rm') return tq('≈1RM {0} {1}', num(q.value), unit)
  if (q.kind === 'set') return `${num(q.w)} ${unit} × ${q.r}`
  if (q.kind === 'reps') return tq('{0} in a set', `${q.r} ${word('reps', q.r)}`)
  if (q.kind === 'level') return tq('Level: {0}', levelName(q.level))
  if (q.kind === 'ratio') return q.ratio === 1 ? tq('≈1RM = body weight') : tq('≈1RM = {0} × body weight', num(q.ratio))
  if (q.kind === 'unassisted') return tq('First pull-up without help')
  return ''
}

/** Where the bar stands, in the quest's own terms: "≈62 of 70 kg", "8 of 10 reps", "72 % of a strict pull-up". */
export function barText(S, q, bar) {
  if (bar.best == null || bar.target == null) return ''
  if (q.kind === 'unassisted') return tq('{0} % of a strict pull-up', Math.min(100, Math.round((100 * bar.best) / bar.target)))
  if (q.kind === 'reps' || (q.kind === 'level' && isRepsLift(standardOf(q.exId)))) {
    return tq('{0} of {1}', bar.best, `${bar.target} ${word('reps', bar.target)}`)
  }
  return tq('≈{0} of {1} {2}', Math.round(bar.best), Math.round(bar.target), S?.unit || 'kg')
}

/** The forecast in words. */
export function forecastText(f) {
  if (f.kind === 'weeks') {
    if (f.hi == null) return tq('in {0}+ weeks, if the pace holds', f.lo)
    if (f.hi === f.lo) return tq('in about {0}, if the pace holds', `${f.lo} ${word('weeks', f.lo)}`)
    return tq('in {0}–{1}, if the pace holds', f.lo, `${f.hi} ${word('weeks', f.hi)}`)
  }
  if (f.kind === 'close') return tq('the trend is there: a good session away')
  if (f.kind === 'far') return tq('more than half a year at this pace')
  if (f.kind === 'flat') return tq('no climb yet, so no forecast')
  if (f.kind === 'data') return tq('{0} more for a forecast', `${f.missing} ${word('sessions', f.missing)}`)
  if (f.kind === 'weigh') return tq('a weigh-in is needed to read it')
  return ''
}
