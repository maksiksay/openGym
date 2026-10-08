// The month's training days against a goal: the quota that stands in for the week streak
// (docs/dev/SCOREBOARD.md). A streak is kept alive by the fear of losing it, and one missed week
// ends it. Here a missed session costs nothing: the count only goes up, and a new month starts a
// fresh one.
import { todayISO } from './format.js'
import { workoutDay } from './history.js'

export const DEFAULT_MONTH_GOAL = 8
export const MAX_MONTH_GOAL = 31

/** Four weeks of the plan: the weekdays that hold a routine (a combined day once), times four.
 *  Eight, two a week, without a plan. */
export function autoMonthGoal(S) {
  // A weekday that holds only warm-up or recovery routines is no training day (docs/dev/WARMUPS.md).
  const mobility = new Set((S?.routines || []).filter(r => r && r.kind === 'mobility').map(r => r.id))
  const days = Object.values(S?.week || {}).filter(ids => [].concat(ids || []).some(id => !mobility.has(id))).length
  return days > 0 ? days * 4 : DEFAULT_MONTH_GOAL
}

const setGoal = S => {
  const g = Math.round(Number(S?.monthGoal))
  return Number.isFinite(g) && g >= 1 ? Math.min(MAX_MONTH_GOAL, g) : null
}

/** The goal in force: the one set in Settings (`S.monthGoal`), or the plan's. */
export const monthGoalOf = S => setGoal(S) ?? autoMonthGoal(S)

/** 'YYYY-MM' of the month before. */
export function prevMonth(month) {
  const [y, m] = String(month).split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Training days, not workouts: the gym and a ten-minute session at home on one day are one day.
// workoutDay reads a record whose day got mangled from its start, as every other count does.
// A session of nothing but warm-up or recovery work is kept, but it is no training day
// (docs/dev/WARMUPS.md).
const daysIn = (workouts, month) =>
  new Set((workouts || []).filter(w => !(w && w.mobility === true)).map(workoutDay).filter(d => d && d.startsWith(month + '-'))).size

/**
 * The quota of the calendar month `iso` falls in. Every workout counts towards it: planned or
 * freestyle, a deload, a single set, one logged into the past or imported — all but a session of
 * warm-up or recovery work alone.
 * Returns `{ month, done, goal, auto, met, extra, prevDone }`.
 */
export function monthQuota(S, iso = todayISO()) {
  const month = String(iso).slice(0, 7)
  const goal = monthGoalOf(S)
  const done = daysIn(S?.workouts, month)
  return {
    month, done, goal,
    auto: setGoal(S) == null,
    met: done >= goal,
    extra: Math.max(0, done - goal),
    prevDone: daysIn(S?.workouts, prevMonth(month)),
  }
}
