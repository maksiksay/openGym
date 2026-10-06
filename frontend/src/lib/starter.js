// The starter-plan catalog. Training data only: the chooser's plan names and descriptions are
// written as string literals inside t() calls in sheets.jsx, because check-source-strings.mjs
// only finds them there — copy parked in here would silently ship English in every language.
//
// A routine is [key, name, emoji, [[exerciseId, sets, reps, config?], …]]. The key is what a
// plan's schedule points at, so a weekday never depends on the position of a routine in the array.
// `config` is merged into the exercise's config: a rep range (repsMin), a policy (prog) or
// per-side work (side); reps stay the routine's usual total, so per side they count both sides.
// Names stay canonical English — they become ordinary user routines, which are not translated —
// unless a plan says `localNames`, and the caller hands buildStarterPlan a translator.
import { uid } from './format.js'

const PPL = [
  ['push', 'Push Day', 'barbell', [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
  ['pull', 'Pull Day', 'pullup', [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
  ['legs', 'Leg Day', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]]
]

const UPPER_LOWER = [
  ['upper-a', 'Upper A', 'barbell', [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
  ['lower-a', 'Lower A', 'legs', [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
  ['upper-b', 'Upper B', 'barbell', [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
  ['lower-b', 'Lower B', 'legs', [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]]
]

const FULL_BODY = [
  ['fb-a', 'Full Body A', 'figureStrength', [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
  ['fb-b', 'Full Body B', 'figureStrength', [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
  ['fb-c', 'Full Body C', 'figureStrength', [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]]
]

const FIVE_BY_FIVE = [
  ['5x5-a', '5×5 A', 'barbell', [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
  ['5x5-b', '5×5 B', 'barbell', [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
  ['5x5-c', '5×5 C', 'barbell', [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]]
]

// Two forty-minute sessions on the four anchor lifts (squat, hinge, horizontal press, vertical
// pull), each finished with the Nordic curl and the Copenhagen adduction (docs/dev/AB_PLAN.md).
// Those two are a dose of injury prevention, not a number to push, so their progression is off.
// Pull-ups and dips are body weight, which climbs in reps whatever the policy.
const DOUBLE = { prog: 'double' }
const FINISHERS = [['9001', 2, 5, { prog: 'off' }], ['9002', 2, 12, { prog: 'off', side: true }]]
const AB = [
  ['ab-a', 'Strength A', 'barbell', [
    ['0043', 3, 5], ['0025', 3, 8, { repsMin: 6, ...DOUBLE }], ['0027', 3, 10, { repsMin: 8, ...DOUBLE }],
    ['0410', 2, 20, { repsMin: 16, side: true, ...DOUBLE }], ...FINISHERS]],
  ['ab-b', 'Strength B', 'pullup', [
    ['0085', 3, 8, { repsMin: 6, ...DOUBLE }], ['0652', 3, 6], ['0426', 3, 8, { repsMin: 6, ...DOUBLE }],
    ['0251', 3, 6], ...FINISHERS]]
]

// [weekday, routineKey] — weekday is a DAYN index, so 1 is Monday. Fixed weeks only: every
// plan repeats the same seven days, which is all the weekly plan model can represent.
// A plan with no schedule claims no weekday: its sessions take turns whenever there is time
// (lib/rotation.js), `perWeek` times a week.
const PLANS = {
  'ab-2x40': { routines: AB, schedule: [], perWeek: 2, localNames: true },
  ppl: { routines: PPL, schedule: [[1, 'push'], [3, 'pull'], [5, 'legs']] },
  'upper-lower': { routines: UPPER_LOWER, schedule: [[1, 'upper-a'], [2, 'lower-a'], [4, 'upper-b'], [5, 'lower-b']] },
  'full-body': { routines: FULL_BODY, schedule: [[1, 'fb-a'], [3, 'fb-b'], [5, 'fb-c']] },
  '5x5': { routines: FIVE_BY_FIVE, schedule: [[1, '5x5-a'], [3, '5x5-b'], [5, '5x5-c']] }
}

const build = (routines, nameOf = name => name) =>
  routines.map(([, name, emoji, list]) => ({
    id: uid(), name: nameOf(name), emoji,
    ex: list.map(([id, sets, reps, config]) => ({ id, sets, reps, weight: 0, ...config }))
  }))

// Fresh routine objects (new ids) — [push, pull, legs]. The demo build seeds a history on
// top of exactly these three, so this entry point keeps its shape.
export const starterRoutines = () => build(PPL)

// [{ id, days }] for the chooser. The day count is read off the schedule rather than stored
// beside it, so the two can never disagree.
export const starterPlanOptions = () =>
  Object.entries(PLANS).map(([id, { schedule, perWeek }]) => ({ id, days: schedule.length, ...(perWeek ? { perWeek } : {}) }))

// The weekdays a plan would claim, or null for an unknown id.
export const starterPlanDays = id => PLANS[id]?.schedule.map(([day]) => day) ?? null

// Fresh routines plus the weekdays to put them on, or null for an unknown id — a caller that
// treats null as "change nothing" can never half-apply a plan. `nameOf` names the routines of a
// plan that wants them in the interface language.
export const buildStarterPlan = (id, { nameOf } = {}) => {
  const plan = PLANS[id]
  if (!plan) return null
  const routines = build(plan.routines, plan.localNames && nameOf ? nameOf : undefined)
  // key → the id just minted for it, so the schedule below names its routine
  const byKey = Object.fromEntries(plan.routines.map(([key], i) => [key, routines[i].id]))
  return { routines, schedule: plan.schedule.map(([day, key]) => ({ day, routineId: byKey[key] })) }
}
