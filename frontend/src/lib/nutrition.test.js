import { describe, it, expect } from 'vitest'
import {
  portion, kcalOf, mealsOn, totals, dayTotals, dailySeries, weeklyNutrition, suggestGoals, progressOf,
  fold, matchScore, searchFoods, recentFoods, mealRow, repeatRow, quickRow, validFood, slotForHour,
} from './nutrition.js'
import { BASE_FOODS, BASE_BY_ID, baseName, baseAsFood } from './foods-base.js'

const chicken = { name: 'Chicken breast', kcal: 165, p: 31, f: 3.6, c: 0 }

describe('portion', () => {
  it('scales per-100 g values to the grams eaten', () => {
    expect(portion(chicken, 150)).toEqual({ kcal: 248, p: 46.5, f: 5.4, c: 0 })
  })
  it('is zero for no grams and tolerates missing fields', () => {
    expect(portion(chicken, 0)).toEqual({ kcal: 0, p: 0, f: 0, c: 0 })
    expect(portion({ kcal: 100 }, 50)).toEqual({ kcal: 50, p: 0, f: 0, c: 0 })
  })
})

describe('kcalOf', () => {
  it('uses 4/9/4', () => expect(kcalOf({ p: 10, f: 10, c: 10 })).toBe(170))
})

describe('day totals', () => {
  const meals = [
    { id: 'a', d: '2026-10-05', t: 3, slot: 'd', kcal: 500, p: 40, f: 20, c: 30 },
    { id: 'b', d: '2026-10-05', t: 1, slot: 'b', kcal: 300.4, p: 20.04, f: 10, c: 30 },
    { id: 'c', d: '2026-10-04', t: 2, slot: 'l', kcal: 700, p: 30, f: 30, c: 70 },
  ]
  it('orders a day by slot then entry time', () => {
    expect(mealsOn(meals, '2026-10-05').map(m => m.id)).toEqual(['b', 'a'])
  })
  it('sums and rounds', () => {
    expect(dayTotals(meals, '2026-10-05')).toEqual({ kcal: 800, p: 60, f: 30, c: 60, n: 2 })
    expect(totals([])).toEqual({ kcal: 0, p: 0, f: 0, c: 0, n: 0 })
  })
  it('lists only days that have entries, oldest first, within bounds', () => {
    expect(dailySeries(meals).map(x => x.d)).toEqual(['2026-10-04', '2026-10-05'])
    expect(dailySeries(meals, '2026-10-05').map(x => x.d)).toEqual(['2026-10-05'])
  })
})

describe('weeklyNutrition', () => {
  it('averages logged days only — an unlogged day is unknown, not a fast', () => {
    const meals = [
      { d: '2026-09-28', kcal: 2000, p: 150, f: 70, c: 200 },   // Monday
      { d: '2026-09-30', kcal: 3000, p: 130, f: 90, c: 300 },   // Wednesday
      { d: '2026-10-05', kcal: 2500, p: 160, f: 80, c: 250 },   // next Monday
    ]
    const w = weeklyNutrition(meals, 1)
    expect(w.map(x => x.key)).toEqual(['2026-10-05', '2026-09-28'])
    expect(w[1]).toMatchObject({ days: 2, kcal: 2500, p: 140 })
  })
})

describe('suggestGoals', () => {
  it('Mifflin–St Jeor × activity, protein 1.8 g/kg, fat 0.8 g/kg, carbs the rest', () => {
    // 80 kg, 180 cm, 30 y male: BMR = 800 + 1125 − 150 + 5 = 1780; × 1.55 = 2759 → 2760
    const g = suggestGoals({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activity: 1.55, goal: 'keep' })
    expect(g).toEqual({ kcal: 2760, p: 144, f: 64, c: Math.round((2760 - 144 * 4 - 64 * 9) / 4) })
  })
  it('applies the goal adjustment and the female constant', () => {
    const keep = suggestGoals({ sex: 'female', weightKg: 60, heightCm: 165, age: 28, activity: 1.375 })
    const lose = suggestGoals({ sex: 'female', weightKg: 60, heightCm: 165, age: 28, activity: 1.375, goal: 'lose' })
    expect(lose.kcal).toBeLessThan(keep.kcal)
    expect(keep.kcal).toBe(Math.round((600 + 1031.25 - 140 - 161) * 1.375 / 10) * 10)
  })
  it('needs weight, height and age', () => {
    expect(suggestGoals({ weightKg: 80, heightCm: 180 })).toBeNull()
    expect(suggestGoals()).toBeNull()
  })
})

describe('progressOf', () => {
  it('is a capped ratio, 0 without a goal', () => {
    expect(progressOf(50, 100)).toBe(0.5)
    expect(progressOf(400, 100)).toBe(1.5)
    expect(progressOf(50, null)).toBe(0)
  })
})

describe('search', () => {
  it('folds case, ё and punctuation', () => {
    expect(fold('Творог 5%!')).toBe('творог 5%')
    expect(fold('Ёжик')).toBe('ежик')
  })
  it('needs every word, prefers prefixes', () => {
    expect(matchScore('Куриная грудка', 'грудка кур')).toBeGreaterThan(0)
    expect(matchScore('Куриная грудка', 'индейка')).toBe(0)
    expect(matchScore('Гречка варёная', 'греч')).toBeGreaterThan(matchScore('Каша с гречкой', 'греч'))
  })
  it('finds own and built-in foods, own first on a tie', () => {
    const own = [{ id: 'x', name: 'Гречка Мистраль' }]
    const res = searchFoods('гречка', { own, base: BASE_FOODS, nameOf: f => baseName(f, 'ru') })
    expect(res[0].kind).toBe('own')
    expect(res.some(r => r.key === 'b:buckwheat-c')).toBe(true)
  })
  it('matches built-ins by their English name too', () => {
    const res = searchFoods('buckwheat', { base: BASE_FOODS, nameOf: f => baseName(f, 'ru') })
    expect(res.map(r => r.food.id)).toContain('buckwheat-c')
  })
})

describe('recentFoods', () => {
  it('one row per food, newest first', () => {
    const meals = [
      { name: 'Овсянка', fid: 'b:oats-w', t: 1, g: 250 },
      { name: 'Банан', fid: 'b:banana', t: 2, g: 120 },
      { name: 'Овсянка', fid: 'b:oats-w', t: 3, g: 300 },
      { name: 'Кофе с молоком', t: 4 },
    ]
    const r = recentFoods(meals)
    expect(r.map(m => m.name)).toEqual(['Кофе с молоком', 'Овсянка', 'Банан'])
    expect(r[1].g).toBe(300)
  })
})

describe('rows', () => {
  it('mealRow keeps the portion numbers and the source', () => {
    const r = mealRow({ food: chicken, g: 200, d: '2026-10-05', slot: 'l', fid: 'o:1', src: 'own', id: 'm1', t: 5 })
    expect(r).toEqual({ id: 'm1', d: '2026-10-05', t: 5, slot: 'l', name: 'Chicken breast', g: 200, kcal: 330, p: 62, f: 7.2, c: 0, fid: 'o:1', src: 'own' })
  })
  it('repeatRow rescales a past row to a new portion', () => {
    const prev = mealRow({ food: chicken, g: 200, d: '2026-10-04', slot: 'l', id: 'm1', t: 1 })
    const r = repeatRow(prev, { g: 100, d: '2026-10-05', slot: 'd', id: 'm2', t: 2 })
    expect(r).toMatchObject({ id: 'm2', d: '2026-10-05', slot: 'd', g: 100, kcal: 165, p: 31 })
  })
  it('repeatRow repeats a quick entry as it was', () => {
    const q = quickRow({ name: 'Обед в столовой', kcal: 700, d: '2026-10-04', slot: 'l', id: 'q', t: 1 })
    expect(repeatRow(q, { d: '2026-10-05', slot: 'l', id: 'q2', t: 2 })).toMatchObject({ id: 'q2', d: '2026-10-05', kcal: 700, src: 'quick' })
  })
  it('quickRow fills energy from macros when it is missing', () => {
    expect(quickRow({ name: 'x', p: 30, f: 10, c: 50, d: 'd', slot: 's', id: 'i' }).kcal).toBe(410)
  })
})

describe('validFood', () => {
  it('needs a name and something non-zero, nothing negative, at most 100 g of macros', () => {
    expect(validFood({ name: 'x', kcal: 100 })).toBe(true)
    expect(validFood({ name: ' ', kcal: 100 })).toBe(false)
    expect(validFood({ name: 'x' })).toBe(false)
    expect(validFood({ name: 'x', kcal: -1 })).toBe(false)
    expect(validFood({ name: 'x', p: 60, f: 30, c: 20 })).toBe(false)
  })
})

describe('slotForHour', () => {
  it('maps the clock to a meal', () => {
    expect([7, 12, 19, 23].map(slotForHour)).toEqual(['b', 'l', 'd', 's'])
  })
})

describe('built-in foods', () => {
  it('have unique ids, both names and plausible values', () => {
    expect(BASE_BY_ID.size).toBe(BASE_FOODS.length)
    for (const f of BASE_FOODS) {
      expect(f.n.en && f.n.ru, f.id).toBeTruthy()
      expect(f.p + f.f + f.c, f.id).toBeLessThanOrEqual(100.5)
      // Energy close to what the macros imply, so a typo in one number cannot hide. Not exact:
      // total carbohydrate includes fibre, which yields about half of 4 kcal/g, so vegetables
      // run a few kcal under — hence the 8 kcal floor. Alcohol carries energy no macro shows.
      if (['beer', 'wine-dry'].includes(f.id)) continue
      const implied = f.p * 4 + f.f * 9 + f.c * 4
      expect(Math.abs(f.kcal - implied), f.id).toBeLessThanOrEqual(Math.max(implied * 0.12, 8))
    }
  })
  it('read in the language asked, English otherwise', () => {
    const f = BASE_BY_ID.get('egg')
    expect(baseName(f, 'ru')).toBe('Яйцо куриное')
    expect(baseName(f, 'de')).toBe('Egg')
    expect(baseAsFood(f, 'en')).toMatchObject({ id: 'egg', name: 'Egg', kcal: 143, srv: 50 })
  })
})
