import { describe, it, expect } from 'vitest'
import { cleanCode, normalizeProduct, lookupBarcode, searchProducts, productUrl } from './off.js'

const product = {
  code: '4810268031012',
  product_name: 'Творог 5%',
  product_name_en: 'Cottage cheese 5%',
  brands: 'Савушкин, Brest',
  serving_quantity: '180',
  nutriments: { 'energy-kcal_100g': 121, proteins_100g: 17, fat_100g: 5, carbohydrates_100g: 1.8 },
}

const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })

describe('cleanCode', () => {
  it('keeps the retail lengths only', () => {
    expect(cleanCode(' 4810268 031012 ')).toBe('4810268031012')
    expect(cleanCode('12345')).toBeNull()
    expect(cleanCode('96385074')).toBe('96385074')
  })
})

describe('normalizeProduct', () => {
  it('maps a label to per-100 g food with brand, code and serving', () => {
    expect(normalizeProduct(product, 'ru')).toEqual({
      name: 'Творог 5%', brand: 'Савушкин', code: '4810268031012', kcal: 121, p: 17, f: 5, c: 1.8, srv: 180, src: 'off',
    })
  })
  it('prefers the UI language name', () => {
    expect(normalizeProduct(product, 'en').name).toBe('Cottage cheese 5%')
  })
  it('derives kcal from kJ, then from macros', () => {
    expect(normalizeProduct({ product_name: 'x', nutriments: { energy_100g: 418.4 } }).kcal).toBe(100)
    expect(normalizeProduct({ product_name: 'x', nutriments: { proteins_100g: 10, fat_100g: 0, carbohydrates_100g: 10 } }).kcal).toBe(80)
  })
  it('refuses a product with no name or no energy', () => {
    expect(normalizeProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull()
    expect(normalizeProduct({ product_name: 'x', nutriments: { proteins_100g: 10 } })).toBeNull()
    expect(normalizeProduct(null)).toBeNull()
  })
})

describe('lookupBarcode', () => {
  it('asks OFF for the product and normalises it', async () => {
    let asked = null
    const food = await lookupBarcode('4810268031012', { lang: 'ru', fetchFn: async url => { asked = url; return res(200, { status: 1, product }) } })
    expect(asked).toContain('/api/v2/product/4810268031012')
    expect(food.kcal).toBe(121)
  })
  it('reports a missing and an incomplete product', async () => {
    expect(await lookupBarcode('4810268031012', { fetchFn: async () => res(404, null) })).toEqual({ missing: true })
    expect(await lookupBarcode('4810268031012', { fetchFn: async () => res(200, { status: 0 }) })).toEqual({ missing: true })
    expect(await lookupBarcode('4810268031012', { fetchFn: async () => res(200, { status: 1, product: { product_name: 'Кефир' } }) }))
      .toEqual({ incomplete: true, name: 'Кефир' })
    expect(await lookupBarcode('abc', { fetchFn: async () => { throw new Error('no call') } })).toEqual({ missing: true })
  })
  it('rejects on a server error', async () => {
    await expect(lookupBarcode('4810268031012', { fetchFn: async () => res(503, null) })).rejects.toThrow()
  })
})

describe('searchProducts', () => {
  it('keeps products with nutrition, once each', async () => {
    const products = [product, { ...product }, { product_name: 'no label' }]
    const out = await searchProducts('творог', { lang: 'ru', fetchFn: async () => res(200, { products }) })
    expect(out).toHaveLength(1)
  })
  it('does not search for a single letter', async () => {
    expect(await searchProducts('т', { fetchFn: async () => { throw new Error('no call') } })).toEqual([])
  })
})

it('productUrl points at the product page', () => {
  expect(productUrl('4810268031012')).toBe('https://world.openfoodfacts.org/product/4810268031012')
})
