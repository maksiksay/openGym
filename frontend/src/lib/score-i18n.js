/* Strings of the scoreboard (lib/scoreboard.js, lib/quota.js; docs/dev/SCOREBOARD.md), kept beside
 * it the way the health module keeps its own (lib/health-i18n.js): English is the key, Russian is
 * the one pack so far, and every other language falls back to the main catalogue and then to the
 * English key, the way t() does. That keeps scripts/check-locales.mjs green while the other
 * languages are still to come; moving these into src/locales/ comes with translating them.
 *
 * The phrasing helpers live here too, so the card, the finish sheet, History and Home say a win
 * the same way.
 */
import { getLang, baseLang, t, dateLocale } from './i18n-core.js'
import { fmtNum } from './format.js'
import { fmtSec } from './history.js'
import { plural } from './health-i18n.js'
import ru from './score-i18n.ru.js'

const PACKS = { ru }

export function ts(s, ...args) {
  const pack = PACKS[baseLang(getLang())]
  if (pack && pack[s]) {
    let v = pack[s]
    for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
    return v
  }
  return t(s, ...args)
}

const REPS = { en: ['rep', 'reps'], ru: ['повтор', 'повтора', 'повторов'] }
const WINS = { en: ['win', 'wins'], ru: ['победа', 'победы', 'побед'] }
const counted = (n, table) => `${n} ${plural(n, table[baseLang(getLang())] || table.en)}`

/** "1 rep", "3 reps"; three forms in Russian. */
export const nReps = n => counted(n, REPS)
/** "1 win", "3 wins". */
export const nWins = n => counted(n, WINS)

/** How a session or a target is past last time: "+2.5 kg", "+1 rep", "+1 on the weakest set",
 *  "−5 kg of help", "+5 s". Empty for no delta. */
export function deltaText(delta, unit) {
  if (!delta) return ''
  if (delta.w != null) return delta.w > 0 ? `+${fmtNum(delta.w)} ${unit}` : ts('−{0} {1} of help', fmtNum(-delta.w), unit)
  if (delta.r != null) return '+' + nReps(delta.r)
  if (delta.weak != null) return ts('+{0} on the weakest set', delta.weak)
  if (delta.sec != null) return ts('+{0} s', delta.sec)
  if (delta.weakSec != null) return ts('+{0} s on the weakest hold', delta.weakSec)
  return ''
}

/** A set mark beside its row: "+1", "+2.5", "−5", "+5 s". */
export function markText(mark) {
  if (!mark) return ''
  if (mark.w != null) return (mark.w > 0 ? '+' : '−') + fmtNum(Math.abs(mark.w))
  if (mark.r != null) return '+' + mark.r
  if (mark.sec != null) return ts('+{0} s', mark.sec)
  return ''
}

/** The goal line's numbers: "60 kg × 8 · 8 · 8", "12 · 12 · 12", "+10 kg × 8 · 8",
 *  "20 kg × 5 · 5 per side", "0:45 · 0:45". Past six sets the count is written out. */
export function goalText(goal, unit) {
  if (!goal) return ''
  const n = Math.max(1, goal.sets || 1)
  const each = v => (n > 6 ? `${v} (×${n})` : Array.from({ length: n }, () => v).join(' · '))
  if (goal.mode === 'time') {
    const holds = each(fmtSec(goal.sec))
    return goal.weight > 0 ? `${fmtNum(goal.weight)} ${unit} × ${holds}` : holds
  }
  const sets = goal.perSide ? ts('{0} per side', each(goal.reps / 2)) : each(goal.reps)
  if (goal.bw) return goal.weight > 0 ? `+${fmtNum(goal.weight)} ${unit} × ${sets}` : sets
  return `${fmtNum(goal.weight)} ${unit} × ${sets}`
}

// "60×9", or the reps alone for an unloaded set.
const repSet = ({ w, r }) => (w > 0 ? `${fmtNum(w)}×${r}` : String(r))

/** The chips of an exercise's records, in a fixed order. */
export function recordChips(records, unit) {
  const out = []
  if (!records) return out
  if (records.weight) out.push(ts('weight {0}', `${fmtNum(records.weight.v)} ${unit}`))
  if (records.reps) out.push(ts('reps {0}', repSet(records.reps)))
  if (records.e1rm) out.push(ts('e1RM {0}', `${fmtNum(records.e1rm.v)} ${unit}`))
  if (records.volume) out.push(ts('volume {0}', records.volume.unit === 'reps' ? nReps(records.volume.v) : `${fmtNum(records.volume.v)} ${unit}`))
  if (records.hold) out.push(ts('hold {0}', fmtSec(records.hold.v)))
  return out
}

/** Every chip of one exercise's win: the beat first, then the records. */
export const winChips = (win, unit) => [...(win?.beat ? [deltaText(win.beat, unit)] : []), ...recordChips(win?.records, unit)]

/** "October", in the UI language, capitalised as a label. */
export function monthLabel(month) {
  const [y, m] = String(month).split('-').map(Number)
  const name = new Date(y, (m || 1) - 1, 1).toLocaleDateString(dateLocale(), { month: 'long' })
  return name.charAt(0).toLocaleUpperCase(dateLocale()) + name.slice(1)
}
