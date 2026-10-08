import { describe, expect, it } from 'vitest'
import { NEAR_DAYS, bodyOn, comparison, photoDays, photoWorkouts, progressPhotos } from './progress-photos.js'

// docs/dev/PROGRESS_PHOTOS.md: the feed, the weight and waist of a day, and what changed.
const h = c => c.repeat(64)
const photo = c => ({ kind: 'image', hash: h(c), mime: 'image/webp', size: 3, width: 8, height: 6, at: 1 })
const video = c => ({ kind: 'video', hash: h(c), mime: 'video/mp4', size: 3, width: 8, height: 6, dur: 10, at: 1 })
const workout = (id, d, start, media, name = 'Strength A') => ({ id, d, start, name, entries: [], media })

const S = {
  unit: 'kg',
  workouts: [
    workout('w1', '2026-07-01', 1, [photo('a'), video('b'), photo('c')]),
    workout('w2', '2026-09-23', 3, [photo('d')], 'Strength B'),
    workout('w3', '2026-09-23', 2, []),
    workout('w4', '2026-10-05', 4, [video('e')]),
    { id: 'junk', media: [photo('f')] },
  ],
  bodyweight: [{ d: '2026-06-28', w: 74.5 }, { d: '2026-09-23', w: 72.4 }, { d: '2026-10-20', w: 71 }],
  health: [{ d: '2026-07-03', waist: 84 }, { d: '2026-09-23', waist: 81 }],
}

describe('the feed', () => {
  it('holds every photo of every workout, newest day first, videos left out', () => {
    const ps = progressPhotos(S)
    expect(ps.map(p => [p.d, p.w.id, p.i, p.ref.hash[0]])).toEqual([
      ['2026-09-23', 'w2', 0, 'd'],
      ['2026-07-01', 'w1', 0, 'a'],
      ['2026-07-01', 'w1', 2, 'c'],     // its index among the workout's photos AND videos
    ])
    expect(new Set(ps.map(p => p.key)).size).toBe(3)
  })

  it('groups a day\'s photos under it', () => {
    expect(photoDays(progressPhotos(S)).map(x => [x.d, x.photos.length])).toEqual([['2026-09-23', 1], ['2026-07-01', 2]])
    expect(progressPhotos({})).toEqual([])
  })
})

describe('a day\'s weight and waist', () => {
  it('are that day\'s, or the nearest within a week, or none', () => {
    expect(bodyOn(S, '2026-09-23')).toEqual({ weight: { w: 72.4, d: '2026-09-23', exact: true }, waist: { cm: 81, d: '2026-09-23', exact: true } })
    expect(bodyOn(S, '2026-07-01')).toEqual({ weight: { w: 74.5, d: '2026-06-28', exact: false }, waist: { cm: 84, d: '2026-07-03', exact: false } })
    expect(bodyOn(S, '2026-08-15')).toEqual({ weight: null, waist: null })
    expect(NEAR_DAYS).toBe(7)
  })

  it('take the earlier of two equally near', () => {
    expect(bodyOn({ bodyweight: [{ d: '2026-10-01', w: 70 }, { d: '2026-10-05', w: 71 }] }, '2026-10-03').weight).toMatchObject({ w: 70, d: '2026-10-01' })
  })
})

describe('what changed', () => {
  it('counts the days and the deltas from the earlier photo, in either order', () => {
    const [newer, older] = progressPhotos(S)
    const c = comparison(S, newer, older)
    expect(c).toEqual({ from: '2026-07-01', to: '2026-09-23', days: 84, weight: -2.1, waist: -3 })
    expect(comparison(S, older, newer)).toEqual(c)
  })

  it('leaves a part out when either day lacks it', () => {
    expect(comparison(S, { d: '2026-07-01' }, { d: '2026-08-15' })).toMatchObject({ days: 45, weight: null, waist: null })
  })
})

describe('adding photos', () => {
  it('lists the last workouts, newest first, with how many photos each has', () => {
    expect(photoWorkouts(S, 3).map(x => [x.w.id, x.name, x.photos])).toEqual([['w4', 'Strength A', 0], ['w2', 'Strength B', 1], ['w3', 'Strength A', 0]])
  })
})
