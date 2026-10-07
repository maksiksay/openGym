// A meal the Coach read from a message or a photo (docs/dev/COACH_VOICE_PHOTO.md), turned into
// rows for the food log. The card in views/CoachChat.jsx holds what the person chose (the grams,
// the meal, the day); these decide what that adds up to and what gets written. Each item comes
// as a portion with its food's values per 100 g, so a changed portion rescales like any other.
import { mealRow, portion, slotForHour, totals, SLOTS } from './nutrition.js'
import { isoOf, uid } from './format.js'

const GRAMS_MAX = 5000

/** The grams settled on for item `i`: the person's number when they typed one, else the Coach's.
 *  Nought leaves the item out. */
export function gramsOf(meal, grams, i) {
  const raw = grams?.[i]
  const n = typeof raw === 'string' ? (raw.trim() ? Number(raw.replace(',', '.')) : NaN) : raw
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return Math.min(GRAMS_MAX, Math.round(n))
  return Math.round(Number(meal?.items?.[i]?.g) || 0)
}

/** Where a card starts: the meal the Coach named or the one for the time of day, and its day. */
export function cardStart(meal, now = new Date()) {
  return {
    slot: SLOTS.includes(meal?.slot) ? meal.slot : slotForHour(now.getHours()),
    day: meal?.day === 'yesterday' ? 'yesterday' : 'today',
  }
}

/** The date a card's day stands for. */
export function cardDate(day, now = new Date()) {
  const d = new Date(now.getTime())
  if (day === 'yesterday') d.setDate(d.getDate() - 1)
  return isoOf(d)
}

/** Each item at the grams settled on, with its own numbers, and what the items still in add up to. */
export function cardPortions(meal, grams) {
  const rows = (meal?.items || []).map((it, i) => {
    const g = gramsOf(meal, grams, i)
    return { name: it.name, g, confidence: it.confidence, ...(it.drink === true ? { drink: true } : {}), ...portion(it, g) }
  })
  return { rows, total: totals(rows.filter(r => r.g > 0)) }
}

/** The rows the food log gets: one per item still in, ordinary meal rows marked as estimates. */
export function cardMeals(meal, { grams, day, slot, now = new Date(), id = uid } = {}) {
  const d = cardDate(day, now)
  const at = SLOTS.includes(slot) ? slot : slotForHour(now.getHours())
  return (meal?.items || [])
    .map((it, i) => ({ it, i, g: gramsOf(meal, grams, i) }))
    .filter(x => x.g > 0)
    .map(({ it, i, g }) => mealRow({ food: it, g, d, slot: at, src: 'ai', id: id(), t: now.getTime() + i }))
}
