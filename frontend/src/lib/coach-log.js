// What the Coach noted from the chat (docs/dev/COACH_ASSISTANT.md) — a weight, a check-in, water,
// goals — turned into the card's lines and, on the person's tap, into their own data. The card in
// views/CoachChat.jsx holds which lines were left out and the day; this decides what each line
// says and what it writes. The validator (api/coach/core/log.js) has already bounded every value.
import { healthOn, setHealth, addWater, waterOn, waterGoalOf, stepsGoalOf } from './health.js'
import { fibreGoalOf } from './nutrition.js'
import { cardDate } from './coach-meal.js'

export const CHECKIN_KEYS = ['sleep', 'sq', 'energy', 'stress', 'steps']
export const GOAL_KEYS = ['kcal', 'p', 'f', 'c', 'fib', 'steps', 'water']

const weighInOn = (S, d) => (Array.isArray(S?.bodyweight) ? S.bodyweight.find(b => b && b.d === d) : null) || null

/** What a goal is now: the food goals as set (null when not), the others as the app reads them. */
export function goalNow(S, k) {
  if (k === 'fib') return fibreGoalOf(S)
  if (k === 'steps') return stepsGoalOf(S)
  if (k === 'water') return waterGoalOf(S)
  const v = S?.nutri?.goals?.[k]
  return Number.isFinite(v) ? v : null
}

/**
 * The card's lines, in order: [{ key, part, field, from, to, day }]. `from` is what is there now
 * (null when nothing), `to` what the line writes; for water `from` is the day's total so far and
 * `to` what is added. `day` says whether the line belongs to a day (goals do not). Check-in and
 * water lines are left out while the health log is switched off: there is nowhere to see them.
 */
export function logLines(S, log, day = log?.day, now = new Date()) {
  const d = cardDate(day === 'yesterday' ? 'yesterday' : 'today', now)
  const health = S?.healthOn !== false
  const lines = []
  if (Number.isFinite(log?.weight)) lines.push({ key: 'weight', part: 'weight', field: 'weight', from: weighInOn(S, d)?.w ?? null, to: log.weight, day: true })
  if (health && log?.checkin) {
    const e = healthOn(S?.health, d)
    for (const k of CHECKIN_KEYS) if (Number.isFinite(log.checkin[k])) lines.push({ key: 'checkin.' + k, part: 'checkin', field: k, from: e?.[k] ?? null, to: log.checkin[k], day: true })
  }
  if (health && Number.isFinite(log?.water)) lines.push({ key: 'water', part: 'water', field: 'water', from: waterOn(S, d).total, to: log.water, day: true })
  if (log?.goals) for (const k of GOAL_KEYS) if (Number.isFinite(log.goals[k])) lines.push({ key: 'goals.' + k, part: 'goals', field: k, from: goalNow(S, k), to: log.goals[k], day: false })
  return lines
}

/**
 * Write the card into S (call it inside store.update): every line whose key is not in `skip`.
 * - a weight replaces that day's weigh-in, or adds one;
 * - the check-in sets only the fields named, the rest of the day stays;
 * - water is added to the day's counter;
 * - each goal named is set; the rest stay.
 * Returns the lines written.
 */
export function applyLog(S, log, { day = log?.day, skip = [], now = new Date() } = {}) {
  const d = cardDate(day === 'yesterday' ? 'yesterday' : 'today', now)
  const t = now.getTime()
  const lines = logLines(S, log, day, now).filter(l => !skip.includes(l.key))
  for (const l of lines) {
    if (l.part === 'weight') {
      if (!Array.isArray(S.bodyweight)) S.bodyweight = []
      const ex = weighInOn(S, d)
      if (ex) { ex.w = l.to; ex.t = t } else S.bodyweight.push({ d, w: l.to, t })
      S.bodyweight.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
    } else if (l.part === 'water') {
      addWater(S, d, l.to, t)
    } else if (l.part === 'goals') {
      const nutri = S.nutri && typeof S.nutri === 'object' ? S.nutri : {}
      if (l.field === 'fib') S.nutri = { ...nutri, fibGoal: l.to }
      else if (l.field === 'steps') S.stepsGoal = l.to
      else if (l.field === 'water') S.waterGoal = l.to
      else S.nutri = { ...nutri, goals: { kcal: null, p: null, f: null, c: null, ...(nutri.goals || {}), [l.field]: l.to } }
    }
  }
  const patch = Object.fromEntries(lines.filter(l => l.part === 'checkin').map(l => [l.field, l.to]))
  if (Object.keys(patch).length) setHealth(S, d, patch, t)
  return lines
}
