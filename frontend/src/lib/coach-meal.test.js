import { describe, expect, it } from 'vitest'
import { cardDate, cardMeals, cardPortions, cardStart, gramsOf } from './coach-meal.js'
import { dayTotals } from './nutrition.js'

const meal = {
  text: 'Counted as you said; the oil is my guess.', slot: null, day: 'today',
  items: [
    { name: 'Гречка отварная', g: 200, kcal: 110, p: 4.2, f: 1.1, c: 21.3, confidence: 'typical' },
    { name: 'Куриная грудка', g: 150, kcal: 165, p: 31, f: 3.6, c: 0, confidence: 'typical' },
    { name: 'Масло подсолнечное', g: 10, kcal: 899, p: 0, f: 99.9, c: 0, confidence: 'estimate' },
  ],
}
const at = (h, iso = '2026-10-07') => new Date(iso + 'T' + String(h).padStart(2, '0') + ':30:00')
let n = 0
const id = () => 'm' + (++n)

describe('a meal card', () => {
  it('starts on the meal the Coach named, or the one for the time of day, and on its day', () => {
    expect(cardStart(meal, at(8))).toEqual({ slot: 'b', day: 'today' })
    expect(cardStart(meal, at(13))).toEqual({ slot: 'l', day: 'today' })
    expect(cardStart({ ...meal, slot: 'd', day: 'yesterday' }, at(8))).toEqual({ slot: 'd', day: 'yesterday' })
    expect(cardDate('today', at(1))).toBe('2026-10-07')
    expect(cardDate('yesterday', at(1, '2026-10-01'))).toBe('2026-09-30')
  })

  it('takes the grams the person typed, falls back to the Coach\'s, and leaves out a nought', () => {
    expect(gramsOf(meal, [], 0)).toBe(200)
    expect(gramsOf(meal, ['250'], 0)).toBe(250)
    expect(gramsOf(meal, ['12,6'], 0)).toBe(13)
    expect(gramsOf(meal, [''], 0)).toBe(200)
    expect(gramsOf(meal, ['abc'], 0)).toBe(200)
    expect(gramsOf(meal, [0], 0)).toBe(0)
    expect(gramsOf(meal, ['99999'], 0)).toBe(5000)
  })

  it('adds the portions up at the grams settled on', () => {
    const { rows, total } = cardPortions(meal, ['300', undefined, '0'])
    expect(rows.map(r => [r.g, r.kcal])).toEqual([[300, 330], [150, 248], [0, 0]])
    expect(total).toMatchObject({ kcal: 578, p: 59.1, n: 2 })
  })

  it('writes one ordinary meal row per item still in, marked as an estimate', () => {
    const rows = cardMeals(meal, { grams: [undefined, '120', '0'], day: 'yesterday', slot: 'd', now: at(9), id })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ d: '2026-10-06', slot: 'd', name: 'Гречка отварная', g: 200, kcal: 220, p: 8.4, f: 2.2, c: 42.6, src: 'ai' })
    expect(rows[1]).toMatchObject({ name: 'Куриная грудка', g: 120, kcal: 198, p: 37.2, src: 'ai' })
    expect(rows[0].id).not.toBe(rows[1].id)
    expect(dayTotals(rows, '2026-10-06')).toMatchObject({ kcal: 418, n: 2 })
  })

  it('logs into the meal for the time of day when none was picked', () => {
    const rows = cardMeals(meal, { now: at(22), id })
    expect(rows.every(r => r.slot === 's' && r.d === '2026-10-07')).toBe(true)
  })
})
