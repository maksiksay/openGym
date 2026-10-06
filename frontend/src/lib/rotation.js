// The next session when there is no weekly plan (docs/dev/AB_PLAN.md): the routine after the one
// trained last, in Plan order. Someone who trains whenever the week allows is offered the right
// routine without having to remember which one came last.
import { todayISO } from './format.js'

const startOf = w => (Number.isFinite(w?.start) ? w.start : new Date((w?.d || '') + 'T12:00:00').getTime())
const routineIdsOf = w => [].concat(w?.routineIds ?? (w?.routineId ? [w.routineId] : []))

/** Whether the weekly plan is in use: a routine on any weekday. */
export const usesWeek = S => Object.values(S?.week || {}).some(ids => [].concat(ids || []).length > 0)

/** The routines that take turns, in Plan order: none that is empty or kept out of progression (a
 *  deload or rehab routine is done when it is needed, not when its turn comes). */
export const rotationOf = S => (S?.routines || []).filter(r => r && (r.ex || []).length > 0 && r.excludeFromProgression !== true)

/**
 * The routine to offer on `iso`, or null. Null whenever a weekly plan is in use, which then says
 * what each day is, and on a day marked by hand (rest, or a routine of its own).
 *
 * The last turn is the latest workout, by when it started, that trained one of the routines; a
 * combined session counts as its routine that comes last in the Plan. A session whose routines
 * were all deleted since says nothing, so the one before it decides.
 */
export function nextUp(S, iso = todayISO()) {
  if (usesWeek(S)) return null
  if (S?.dayPlan && S.dayPlan[iso] !== undefined) return null
  const turns = rotationOf(S)
  if (!turns.length) return null
  const place = new Map(turns.map((r, i) => [r.id, i]))
  let last = -1
  let lastStart = -Infinity
  // Stored order settles a tie of starts: the later record is the later session.
  for (const w of S?.workouts || []) {
    const at = routineIdsOf(w).map(id => place.get(id)).filter(i => i !== undefined)
    if (!at.length) continue
    const t = startOf(w)
    if (t >= lastStart) { lastStart = t; last = Math.max(...at) }
  }
  return turns[(last + 1) % turns.length]
}
