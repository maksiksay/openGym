import { describe, expect, it } from 'vitest'
import { fitLine, dayIndex } from './trend.js'

describe('the line', () => {
  it('fits a straight line exactly, with no error', () => {
    const f = fitLine([0, 1, 2, 3].map(x => ({ x, y: 2 + 0.5 * x })))
    expect(f.slope).toBeCloseTo(0.5, 12)
    expect(f.se).toBeCloseTo(0, 12)
    expect(f.at(10)).toBeCloseTo(7, 12)
  })

  it('says how far to trust a noisy slope', () => {
    // Residuals ±0.14 / ±0.42 around a slope of 0.0057 a day: 1.4 / 245 and √(0.196 / 245).
    const f = fitLine([{ x: 0, y: 72 }, { x: 7, y: 72.6 }, { x: 14, y: 71.8 }, { x: 21, y: 72.4 }])
    expect(f.slope).toBeCloseTo(1.4 / 245, 12)
    expect(f.se).toBeCloseTo(Math.sqrt(0.196 / 245), 6)
  })

  it('needs two points on two different x', () => {
    expect(fitLine([])).toBeNull()
    expect(fitLine([{ x: 1, y: 1 }])).toBeNull()
    expect(fitLine([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull()
    expect(fitLine([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toMatchObject({ slope: 1, se: 0 })
  })

  it('counts days between ISO dates', () => {
    expect(dayIndex('2026-10-22') - dayIndex('2026-10-01')).toBe(21)
    expect(dayIndex('2027-01-01') - dayIndex('2026-12-31')).toBe(1)
  })
})
