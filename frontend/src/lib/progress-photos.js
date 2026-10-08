// Progress photos (docs/dev/PROGRESS_PHOTOS.md): the photos kept with logged workouts as one feed,
// the body weight and waist of their days, and what changed between two of them. Pure, over S; the
// files themselves are the workout media's (lib/workout-media.js, components/WorkoutMedia.jsx).
import { workoutMediaOf } from './media-refs.js'

const list = v => (Array.isArray(v) ? v : [])
const dayNum = iso => Math.round(Date.parse(iso + 'T12:00:00Z') / 864e5)
const r1 = n => Math.round(n * 10) / 10

// How far a weigh-in or a waist measurement may be from a photo's day to stand for it.
export const NEAR_DAYS = 7

/**
 * Every photo of every logged workout, newest day first: [{ key, d, w, i, ref }]. Videos stay out:
 * they are form checks, not progress. `i` is the photo's index among the workout's own photos and
 * videos — what its viewer opens at.
 */
export function progressPhotos(S) {
  const out = []
  for (const w of list(S?.workouts)) {
    if (!w || typeof w.d !== 'string') continue
    workoutMediaOf(w).forEach((ref, i) => {
      if (ref.kind === 'image') out.push({ key: `${w.id || w.start || w.d}:${i}:${ref.hash}`, d: w.d, w, i, ref, at: Number(w.start) || 0 })
    })
  }
  return out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at - a.at) || (a.i - b.i)))
}

/** The feed's days, newest first: [{ d, photos }]. */
export function photoDays(photos) {
  const days = []
  for (const p of photos) {
    const last = days[days.length - 1]
    if (last && last.d === p.d) last.photos.push(p)
    else days.push({ d: p.d, photos: [p] })
  }
  return days
}

// The entry nearest to `d` within NEAR_DAYS, the earlier of two equally near.
function nearest(items, d) {
  let best = null
  for (const it of items) {
    const gap = Math.abs(dayNum(it.d) - dayNum(d))
    if (gap > NEAR_DAYS) continue
    if (!best || gap < best.gap || (gap === best.gap && it.d < best.d)) best = { ...it, gap }
  }
  return best
}

/**
 * The body weight and the waist that stand for a day: that day's, or the nearest within a week
 * (`exact: false`, shown with ≈), or null. The weight is in the profile's unit, as logged.
 */
export function bodyOn(S, d) {
  const w = nearest(list(S?.bodyweight).filter(b => b && typeof b.d === 'string' && Number.isFinite(b.w)).map(b => ({ d: b.d, v: b.w })), d)
  const waist = nearest(list(S?.health).filter(e => e && typeof e.d === 'string' && Number.isFinite(e.waist)).map(e => ({ d: e.d, v: e.waist })), d)
  return {
    weight: w ? { w: w.v, d: w.d, exact: w.gap === 0 } : null,
    waist: waist ? { cm: waist.v, d: waist.d, exact: waist.gap === 0 } : null,
  }
}

/**
 * What changed from the earlier photo to the later: the days between, and the weight and waist
 * deltas when both days have them (null otherwise). The two may come in either order.
 */
export function comparison(S, a, b) {
  const [x, y] = a.d <= b.d ? [a, b] : [b, a]
  const bx = bodyOn(S, x.d), by = bodyOn(S, y.d)
  return {
    from: x.d, to: y.d,
    days: dayNum(y.d) - dayNum(x.d),
    weight: bx.weight && by.weight ? r1(by.weight.w - bx.weight.w) : null,
    waist: bx.waist && by.waist ? r1(by.waist.cm - bx.waist.cm) : null,
  }
}

/** The last logged workouts, newest first, for adding photos to one: [{ w, d, name, photos }]. */
export function photoWorkouts(S, n = 10) {
  return list(S?.workouts)
    .filter(w => w && typeof w.d === 'string')
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (Number(b.start) || 0) - (Number(a.start) || 0)))
    .slice(0, n)
    .map(w => ({ w, d: w.d, name: w.name || '', photos: workoutMediaOf(w).filter(m => m.kind === 'image').length }))
}
