// Warm-ups and recovery (docs/dev/WARMUPS.md): mobility routines, kept apart from training. A
// training routine may name one as its warm-up, run first in the same session; on their own they
// are logged and shown, and count for no progression, record, win, quota, season or muscle load.
// Pure: the ready-made sets, adding them to a profile, and which routine each warm-up suits.
import { uid } from './format.js'
import { EXIDX } from './exercises.js'

export const MOBILITY = 'mobility'

/** Whether a routine is a warm-up or recovery routine rather than training. */
export const isMobilityRoutine = r => !!r && r.kind === MOBILITY

/** A training routine's warm-up, when it names one that still exists and is of the right kind. */
export function warmupOf(S, r) {
  if (!r || isMobilityRoutine(r) || !r.warmup) return null
  const w = (S?.routines || []).find(x => x && x.id === r.warmup)
  return isMobilityRoutine(w) ? w : null
}

// One exercise of a set: reps, seconds or minutes, never a progression (the dose is the point).
// A per-side count of reps is the total of both sides, as everywhere (`side: true`). A hold has no
// sides of its own, so a hold done on each side is one set per side, marked `alt` here and given
// a note in the person's language when the set is added.
const reps = (id, sets, n, more = {}) => ({ id, sets, reps: n, weight: 0, prog: 'off', ...more })
const secs = (id, sets, sec, more = {}) => ({ id, sets, sec, mode: 'time', weight: 0, prog: 'off', ...more })
const mins = (id, min) => ({ id, sets: 1, min, speed: 20, mode: 'cardio', prog: 'off' })
const BIKE = '2138'   // stationary bike
const ALT_NOTE = { en: 'Alternate sides: one set per side.', ru: 'Чередуй стороны: подход на каждую.' }

/**
 * The ready-made sets: [{ key, name: { en, ru }, emoji, region, min, ex }]. `min` is about how
 * long one takes. `region` says which
 * training routines a warm-up suits ('upper' | 'lower'), null for the ones run on their own.
 */
export const WARMUP_SETS = [
  { key: 'warmup-upper', name: { en: 'Upper-body warm-up', ru: 'Разминка верх' }, emoji: 'stretch', region: 'upper', min: 8, ex: [
    mins(BIKE, 3), reps('9003', 1, 15), reps('3021', 1, 12), reps('1017', 1, 12),
    reps('0235', 1, 24, { side: true }), reps('9005', 1, 10, { side: true }),
  ] },
  { key: 'warmup-lower', name: { en: 'Lower-body warm-up', ru: 'Разминка низ' }, emoji: 'stretch', region: 'lower', min: 8, ex: [
    mins(BIKE, 3), reps('3013', 1, 12), reps('9006', 1, 20, { side: true }), secs('1368', 1, 30),
    secs('1377', 2, 30, { alt: true }), reps('1685', 1, 10),
  ] },
  { key: 'shoulders-posture', name: { en: 'Shoulder blades and posture', ru: 'Лопатка и осанка' }, emoji: 'stretch', region: null, min: 10, ex: [
    reps('1017', 2, 12), reps('3021', 2, 12), reps('9004', 2, 15), reps('3542', 2, 10),
    reps('0276', 2, 16, { side: true }), reps('9005', 1, 10, { side: true }),
  ] },
  { key: 'football-recovery', name: { en: 'Recovery after football', ru: 'Восстановление после футбола' }, emoji: 'heart', region: null, min: 15, ex: [
    mins(BIKE, 8), secs('9009', 4, 40, { alt: true }), secs('1511', 4, 40, { alt: true }), secs('1494', 2, 40),
    secs('1377', 2, 40, { alt: true }), secs('1424', 2, 40, { alt: true }),
  ] },
  { key: 'ligaments-feet', name: { en: 'Ligaments, joints and feet', ru: 'Связки, суставы и стопы' }, emoji: 'stretch', region: null, min: 12, ex: [
    reps('1373', 2, 12, { note: { en: 'Three seconds down on each.', ru: 'Опускайся по три секунды.' } }), secs('9007', 4, 30, { alt: true }),
    secs('9008', 2, 30, { alt: true }), reps('0235', 2, 24, { side: true }),
  ] },
]

/** The exercise ids a set names that the catalogue does not have — none, as the tests check. */
export const missingExercises = set => set.ex.map(e => e.id).filter(id => !EXIDX[id])

/**
 * Add ready-made sets to the profile as ordinary, editable mobility routines, in the language
 * given ('ru' or anything else for English). A set already added (by its key) is not added again.
 * Mutates S (inside store.update); returns the routines added.
 */
export function addWarmupSets(S, keys, lang = 'en') {
  if (!Array.isArray(S.routines)) S.routines = []
  const have = new Set(S.routines.filter(isMobilityRoutine).map(r => r.preset).filter(Boolean))
  const added = []
  for (const set of WARMUP_SETS) {
    if (!keys.includes(set.key) || have.has(set.key)) continue
    const say = x => (lang === 'ru' ? x.ru : x.en)
    const ex = set.ex.map(({ alt, note, ...cfg }) => ({ ...cfg, ...(alt ? { note: say(ALT_NOTE) } : note ? { note: say(note) } : {}) }))
    const r = { id: uid(), name: say(set.name), emoji: set.emoji, kind: MOBILITY, preset: set.key, ex }
    S.routines.push(r)
    added.push(r)
  }
  return added
}

const UPPER = new Set(['chest', 'back', 'shoulders', 'upper arms', 'lower arms', 'neck'])
const LOWER = new Set(['upper legs', 'lower legs'])

/** Whether a training routine is mostly upper body, mostly lower, or neither. */
export function regionOf(r) {
  let up = 0, low = 0
  for (const e of r?.ex || []) {
    const bp = EXIDX[e?.id]?.bp
    if (UPPER.has(bp)) up++
    else if (LOWER.has(bp)) low++
  }
  return up > low ? 'upper' : low > up ? 'lower' : null
}

/**
 * Which warm-up suits each training routine that has none: [{ routine, warmup }] — the upper-body
 * warm-up before the routines that are mostly upper body, the lower-body one before the rest that
 * are mostly legs. What the sheet after adding the sets preselects.
 */
export function suggestWarmups(S) {
  const mob = (S?.routines || []).filter(isMobilityRoutine)
  const byRegion = { upper: mob.find(r => r.preset === 'warmup-upper'), lower: mob.find(r => r.preset === 'warmup-lower') }
  return (S?.routines || [])
    .filter(r => r && !isMobilityRoutine(r) && !warmupOf(S, r))
    .map(r => ({ routine: r, warmup: byRegion[regionOf(r)] || null }))
    .filter(x => x.warmup)
}

/** Set (or clear, with null) a training routine's warm-up. Mutates S. */
export function setWarmup(S, routineId, warmupId) {
  const r = (S.routines || []).find(x => x && x.id === routineId)
  if (!r || isMobilityRoutine(r)) return
  if (warmupId) r.warmup = warmupId
  else delete r.warmup
}

/**
 * Skip warm-up: the warm-up's exercises leave the running session, and it is the workout proper
 * from there. The current exercise stays the one it was, or becomes the first left; the session
 * no longer lists the warm-up among its routines. Mutates `active` (inside store.update).
 */
export function skipWarmup(active, routines) {
  if (!active || !Array.isArray(active.entries)) return
  const was = active.entries[active.cur]
  active.entries = active.entries.filter(e => !(e && e.mobility === true))
  const at = was && was.mobility !== true ? active.entries.indexOf(was) : 0
  active.cur = Math.max(0, at)
  active.routineIds = [].concat(active.routineIds || []).filter(id => !isMobilityRoutine((routines || []).find(r => r && r.id === id)))
}
