/* Open Food Facts — the free, open product database (openfoodfacts.org, data under ODbL), used
 * for packaged food: look a barcode up, or search by name. No key and no account; requests go
 * from the person's own device straight to OFF, so nothing about what they eat passes through
 * the openGym server.
 *
 * What comes back is normalised into the per-100 g food shape of lib/nutrition.js and, once the
 * person picks it, saved into S.foods with its barcode — so every product is looked up once and
 * then works offline. OFF is community data: a product can be missing, or carry a label with a
 * gap. A product with no usable energy or macros is reported as such rather than saved as zero.
 *
 * Network access is injected (`fetchFn`) so the parsing is testable without one.
 */

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_ru,product_name_en,generic_name,brands,nutriments,serving_quantity,quantity'
const TIMEOUT_MS = 12000

const num = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const r1 = n => Math.round(n * 10) / 10

/** A barcode as digits only; EAN-8, UPC-A/E, EAN-13 and GTIN-14 lengths. null otherwise. */
export function cleanCode(s) {
  const d = String(s || '').replace(/\D/g, '')
  return [8, 12, 13, 14].includes(d.length) ? d : null
}

/** The product's name in the UI language when OFF has one, else whatever it has. */
function nameOf(p, lang) {
  const pick = [p?.['product_name_' + lang], p?.product_name, p?.product_name_en, p?.generic_name]
  return (pick.find(s => typeof s === 'string' && s.trim()) || '').trim()
}

/**
 * An OFF product → { name, brand, code, kcal, p, f, c, srv, src: 'off' } per 100 g, or null when
 * it has no name or no usable nutrition. Energy in kcal when the label gives it, else from kJ.
 */
export function normalizeProduct(p, lang = 'en') {
  if (!p || typeof p !== 'object') return null
  const n = p.nutriments || {}
  const name = nameOf(p, lang)
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null && num(n['energy_100g']) != null) kcal = num(n['energy_100g']) / 4.184
  const pr = num(n.proteins_100g), f = num(n.fat_100g), c = num(n.carbohydrates_100g)
  if (kcal == null && pr != null && f != null && c != null) kcal = pr * 4 + f * 9 + c * 4
  if (!name || kcal == null) return null
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : ''
  const srv = num(p.serving_quantity)
  return {
    name: name.slice(0, 120),
    ...(brand ? { brand: brand.slice(0, 60) } : {}),
    ...(cleanCode(p.code) ? { code: cleanCode(p.code) } : {}),
    kcal: Math.round(kcal), p: r1(pr ?? 0), f: r1(f ?? 0), c: r1(c ?? 0),
    ...(srv && srv > 0 && srv < 2000 ? { srv: Math.round(srv) } : {}),
    src: 'off',
  }
}

async function getJson(url, fetchFn) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null
  const tm = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null
  try {
    const res = await fetchFn(url, { signal: ctl?.signal, headers: { Accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error('off ' + res.status)
    return await res.json()
  } finally { if (tm) clearTimeout(tm) }
}

/**
 * Look a barcode up. Resolves to a normalised food, `{ missing: true }` when OFF does not know
 * the product, or `{ incomplete: true, name }` when it does but the label has no nutrition.
 * Rejects on a network failure.
 */
export async function lookupBarcode(code, { lang = 'en', fetchFn = globalThis.fetch } = {}) {
  const c = cleanCode(code)
  if (!c) return { missing: true }
  const j = await getJson(`${BASE}/api/v2/product/${c}?fields=${FIELDS}`, fetchFn)
  if (!j || j.status === 0 || !j.product) return { missing: true }
  const food = normalizeProduct({ ...j.product, code: j.product.code || c }, lang)
  if (!food) return { incomplete: true, name: nameOf(j.product, lang) }
  return food
}

/** Search OFF by name. Resolves to normalised foods (those without nutrition dropped). */
export async function searchProducts(query, { lang = 'en', fetchFn = globalThis.fetch, limit = 20 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}`
  const j = await getJson(url, fetchFn)
  const out = []
  const seen = new Set()
  for (const p of Array.isArray(j?.products) ? j.products : []) {
    const f = normalizeProduct(p, lang)
    if (!f) continue
    const key = f.code || f.name + '|' + (f.brand || '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

/** The product's page on OFF — where a missing or wrong label can be fixed for everyone. */
export const productUrl = code => `${BASE}/product/${cleanCode(code) || ''}`
