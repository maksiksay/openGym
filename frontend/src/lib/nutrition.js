/* Nutrition: foods, logged meals, daily totals and goals. Pure functions over S, no React.
 *
 * Three lists live in the synced state (store/useStore.js DEF):
 *
 *   S.foods  — the person's own food library, values per 100 g:
 *              { id, t, name, brand?, code?, kcal, p, f, c, srv?, drink?, src: 'own' | 'off' }
 *              `code` is the barcode for a product found through Open Food Facts (lib/off.js);
 *              `srv` the usual portion in grams, offered first when the food is added; `drink`
 *              marks a drink without alcohol, whose millilitres count as water (docs/dev/WATER.md).
 *   S.meals  — what was eaten, one row per food per meal:
 *              { id, d, t, slot, name, g, kcal, p, f, c, fid?, src?, drink? }
 *              The numbers are the portion's own, computed when it was logged. A meal row never
 *              looks its food up again: correcting a food's label next month must not rewrite
 *              what was eaten last month, the same way a renamed routine does not rename the
 *              workouts logged under it. `drink` is copied the same way, so a drink's grams —
 *              its millilitres, 1 ml taken as 1 g — go into that day's water (lib/health.js).
 *   S.nutri  — settings: { on, paused, goals: { kcal, p, f, c } | null, home }
 *
 * Built-in foods (lib/foods-base.js) are never copied into S.foods; a meal row made from one
 * carries `fid: 'b:<id>'` and `src: 'base'`.
 *
 * Deliberately absent: a daily verdict. The person asked for full tracking, and full tracking
 * is exactly where rigid restraint starts for the susceptible few, so what the app leads with
 * is the week's average against the goal — a day over is a day, not a failure. See
 * weeklyNutrition and the Health screen.
 */

import { weekKey } from './format.js'

const list = v => (Array.isArray(v) ? v : [])
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const r1 = n => Math.round(n * 10) / 10

export const SLOTS = ['b', 'l', 'd', 's']        // breakfast, lunch, dinner, snack
export const SLOT_NAMES = { b: 'Breakfast', l: 'Lunch', d: 'Dinner', s: 'Snack' }
export const MACROS = ['kcal', 'p', 'f', 'c']

/** The default meal slot for a time of day — what the add sheet opens on. */
export function slotForHour(h) {
  if (h < 11) return 'b'
  if (h < 16) return 'l'
  if (h < 21) return 'd'
  return 's'
}

/** A food's per-100 g values scaled to `g` grams, rounded the way a label is. */
export function portion(food, g) {
  const k = num(g) / 100
  return {
    kcal: Math.round(num(food?.kcal) * k),
    p: r1(num(food?.p) * k),
    f: r1(num(food?.f) * k),
    c: r1(num(food?.c) * k),
  }
}

/** kcal from macros (Atwater 4/9/4) — the fallback when a label gives macros but no energy. */
export const kcalOf = ({ p, f, c }) => Math.round(num(p) * 4 + num(f) * 9 + num(c) * 4)

/** The rows logged on one day, in slot order and then in the order they were added. */
export function mealsOn(meals, d) {
  const order = s => { const i = SLOTS.indexOf(s); return i < 0 ? SLOTS.length : i }
  return list(meals).filter(m => m && m.d === d).sort((a, b) => order(a.slot) - order(b.slot) || num(a.t) - num(b.t))
}

/** Sum of a set of meal rows. */
export function totals(rows) {
  const out = { kcal: 0, p: 0, f: 0, c: 0, n: 0 }
  for (const m of list(rows)) {
    if (!m) continue
    out.kcal += num(m.kcal); out.p += num(m.p); out.f += num(m.f); out.c += num(m.c); out.n++
  }
  out.kcal = Math.round(out.kcal); out.p = r1(out.p); out.f = r1(out.f); out.c = r1(out.c)
  return out
}

export const dayTotals = (meals, d) => totals(mealsOn(meals, d))

/** Totals per day for every day that has anything logged, oldest first: [{ d, kcal, p, f, c, n }]. */
export function dailySeries(meals, from = null, to = null) {
  const byDay = new Map()
  for (const m of list(meals)) {
    if (!m?.d || (from && m.d < from) || (to && m.d > to)) continue
    if (!byDay.has(m.d)) byDay.set(m.d, [])
    byDay.get(m.d).push(m)
  }
  return [...byDay.keys()].sort().map(d => ({ d, ...totals(byDay.get(d)) }))
}

/**
 * Week by week, newest first: the mean of the days that have something logged (a day nobody
 * logged is unknown, not zero — averaging it in would read every forgotten day as a fast) and
 * how many such days there were. [{ key, days, kcal, p, f, c }]
 */
export function weeklyNutrition(meals, ws) {
  const weeks = new Map()
  for (const day of dailySeries(meals)) {
    const key = weekKey(day.d, ws)
    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key).push(day)
  }
  return [...weeks.keys()].sort().reverse().map(key => {
    const days = weeks.get(key)
    const avg = f => days.reduce((s, x) => s + x[f], 0) / days.length
    return { key, days: days.length, kcal: Math.round(avg('kcal')), p: r1(avg('p')), f: r1(avg('f')), c: r1(avg('c')) }
  })
}

/**
 * Goals from body data. Mifflin–St Jeor for resting energy, an activity factor on top, then the
 * goal's adjustment. Protein 1.8 g/kg (the middle of the 1.6–2.2 range that covers a lifter
 * in a deficit or a surplus), fat 0.8 g/kg, the rest carbohydrate. Rounded to numbers a person
 * can remember. Returns null when anything needed is missing.
 *
 *   sex 'male' | 'female', weightKg, heightCm, age, activity 1.2…1.9, goal 'lose' | 'keep' | 'gain'
 */
export const ACTIVITY = [
  { k: 1.2, label: 'Mostly sitting' },
  { k: 1.375, label: 'Light: 1–3 workouts a week' },
  { k: 1.55, label: 'Moderate: 3–5 workouts a week' },
  { k: 1.725, label: 'High: 6–7 workouts a week' },
]
export const GOAL_ADJ = { lose: -0.15, keep: 0, gain: 0.1 }

export function suggestGoals({ sex, weightKg, heightCm, age, activity = 1.375, goal = 'keep' } = {}) {
  const w = num(weightKg), h = num(heightCm), a = num(age)
  if (!(w > 0 && h > 0 && a > 0)) return null
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'female' ? -161 : 5)
  const tdee = bmr * (num(activity) || 1.375)
  const kcal = Math.round(tdee * (1 + (GOAL_ADJ[goal] ?? 0)) / 10) * 10
  const p = Math.round(w * 1.8)
  const f = Math.round(w * 0.8)
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4))
  return { kcal, p, f, c }
}

/** How far along a goal a number is, 0…1.5 (capped so a big day does not blow the bar up). */
export const progressOf = (v, goal) => (num(goal) > 0 ? Math.min(1.5, num(v) / num(goal)) : 0)

/* ---------- search ---------- */

// Lower case, ё folded into е, punctuation to spaces: "Творог 5%" and "творог 5" are the same query.
export const fold = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}%.,]+/gu, ' ').trim()

/**
 * Rank a candidate name against a query: every query word has to appear (as a word start, or
 * anywhere for words of 4+ letters), and a name that starts with the query beats one that only
 * contains it. 0 = no match.
 */
export function matchScore(name, query) {
  const n = fold(name), q = fold(query)
  if (!q) return 1
  if (!n) return 0
  const words = q.split(' ').filter(Boolean)
  const nWords = n.split(' ')
  let score = 0
  for (const w of words) {
    if (nWords.some(x => x.startsWith(w))) score += 3
    else if (w.length >= 4 && n.includes(w)) score += 1
    else return 0
  }
  if (n.startsWith(q)) score += 5
  if (n === q) score += 5
  return score - n.length / 100
}

/**
 * The person's foods and the built-in ones that match `query`, best first, own foods winning a
 * tie (they are what this person actually eats). Each result: { key, food, kind: 'own' | 'base' }.
 */
export function searchFoods(query, { own = [], base = [], nameOf = f => f.name, limit = 40 } = {}) {
  const out = []
  for (const f of list(own)) {
    const s = matchScore(`${f.name} ${f.brand || ''}`, query)
    if (s > 0) out.push({ key: 'o:' + f.id, food: f, kind: 'own', s: s + 0.5 })
  }
  for (const f of list(base)) {
    const s = Math.max(matchScore(nameOf(f), query), matchScore(f.n?.en || '', query))
    if (s > 0) out.push({ key: 'b:' + f.id, food: f, kind: 'base', s })
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit)
}

/**
 * What was eaten lately, one row per distinct food, newest first — the list the add sheet
 * opens on, since most of what anyone eats this week they also ate last week. Each item keeps
 * the last portion, so a repeat is one tap.
 */
export function recentFoods(meals, limit = 20) {
  const seen = new Set()
  const out = []
  const rows = list(meals).filter(m => m && m.name).sort((a, b) => num(b.t) - num(a.t))
  for (const m of rows) {
    const key = m.fid || 'n:' + fold(m.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
    if (out.length >= limit) break
  }
  return out
}

/** A meal row from a food and a portion. `food` is per 100 g. */
export function mealRow({ food, g, d, slot, fid = null, src = null, id, t = Date.now() }) {
  const row = { id, d, t, slot, name: String(food?.name || '').slice(0, 120), g: Math.round(num(g)), ...portion(food, g) }
  if (fid) row.fid = fid
  if (src) row.src = src
  if (food?.drink === true) row.drink = true
  return row
}

/**
 * Logging the same thing again: a recent row scaled to a new portion. The row's own numbers
 * are per its grams, so they are brought back to per-100 g first.
 */
export function repeatRow(prev, { g = prev?.g, d, slot, id, t = Date.now() }) {
  const base = num(prev?.g) > 0 ? 100 / num(prev.g) : 0
  const per100 = { name: prev?.name, kcal: num(prev?.kcal) * base, p: num(prev?.p) * base, f: num(prev?.f) * base, c: num(prev?.c) * base, drink: prev?.drink === true }
  // A row logged without grams (a quick entry: "lunch, ~700 kcal") repeats as itself.
  if (!base) return { ...prev, id, d, slot, t }
  return mealRow({ food: per100, g, d, slot, fid: prev.fid || null, src: prev.src || null, id, t })
}

/** A quick entry with no food behind it: a name and the numbers, as eaten. */
export function quickRow({ name, kcal, p, f, c, d, slot, id, t = Date.now() }) {
  const k = num(kcal) || kcalOf({ p, f, c })
  return { id, d, t, slot, name: String(name || '').slice(0, 120), g: 0, kcal: Math.round(k), p: r1(num(p)), f: r1(num(f)), c: r1(num(c)), src: 'quick' }
}

/** A food entered by hand is valid when it has a name and either energy or some macro — or is a
 *  drink, which may have neither: water, black coffee, a zero cola. */
export function validFood(f) {
  if (!f || !String(f.name || '').trim()) return false
  const vals = MACROS.map(k => num(f[k]))
  if (vals.some(v => v < 0)) return false
  if (num(f.p) + num(f.f) + num(f.c) > 100.5) return false     // more than 100 g of macros per 100 g
  return f.drink === true || vals.some(v => v > 0)
}
