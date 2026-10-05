import { describe, it, expect } from 'vitest'
import { decodeLuminance, toLuminance } from './barcode-web.js'

// An EAN-13 drawn in memory, so the decoder is tested against a real symbol and not a mock.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = L.map(p => [...p].map(b => (b === '0' ? '1' : '0')).join(''))
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function ean13Modules(code) {
  const d = [...code].map(Number)
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]]
  return bits + '101'
}

function drawEan13(code, { module = 3, quiet = 12, height = 80 } = {}) {
  const bits = ean13Modules(code)
  const width = (bits.length + quiet * 2) * module
  const lum = new Uint8ClampedArray(width * height).fill(255)
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== '1') continue
      for (let k = 0; k < module; k++) lum[y * width + (quiet + i) * module + k] = 0
    }
  }
  return { lum, width, height }
}

describe('decodeLuminance', () => {
  it('reads an EAN-13', async () => {
    const { lum, width, height } = drawEan13('4810268031014')
    expect(await decodeLuminance(lum, width, height)).toBe('4810268031014')
  })
  it('returns null for an empty frame', async () => {
    const lum = new Uint8ClampedArray(200 * 50).fill(255)
    expect(await decodeLuminance(lum, 200, 50)).toBeNull()
    expect(await decodeLuminance(null, 0, 0)).toBeNull()
  })
})

describe('toLuminance', () => {
  it('weights RGB like ZXing', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255])
    expect([...toLuminance(rgba, 3, 1)]).toEqual([255, 0, 76])
  })
})
