// The rest between sets. Settings' rest timer is a default: an exercise may carry its own
// `restSec` (issue #10, supersetFlow.js restSecFor), and that wins. A plan file can bring such
// rests in, and nothing on the timer said so — Settings read 90 s while the bench rested 2:30.
// These say where the plan rests on its own, and clear that on request. Pure.

/** The plan's exercises that rest on their own instead of on the timer: [{ routine, cfg }]. */
export function ownRests(S) {
  const out = []
  for (const routine of S?.routines || []) {
    for (const cfg of routine?.ex || []) if (cfg && cfg.restSec > 0) out.push({ routine, cfg })
  }
  return out
}

/** The shortest and longest of those rests in seconds, [min, max], or null without any. */
export function ownRestRange(S) {
  const secs = ownRests(S).map(x => x.cfg.restSec)
  return secs.length ? [Math.min(...secs), Math.max(...secs)] : null
}

/**
 * Let the timer decide everywhere: every exercise in the plan drops its own rest, and so does
 * every exercise of the workout under way, whose targets were copied from the plan when it
 * started. A ramp set's shorter `warmupRestSec` stays. A saved workout open for editing is a
 * record, not a session, and is left as it was. Mutates S (inside store.update); returns how
 * many of the plan's exercises had a rest of their own.
 */
export function clearOwnRests(S) {
  const n = ownRests(S).length
  for (const routine of S?.routines || []) {
    for (const cfg of routine?.ex || []) if (cfg && 'restSec' in cfg) delete cfg.restSec
  }
  if (S?.active && !S.active.editingWorkoutId) {
    for (const entry of S.active.entries || []) if (entry?.target && 'restSec' in entry.target) delete entry.target.restSec
  }
  return n
}
