import { describe, expect, it } from 'vitest'
import { preparePhoto, toBase64, PHOTO_MAX_BYTES } from './coach-photo.js'

const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const file = bytes => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })
const picture = () => ({ width: 4000, height: 3000, closed: false, close() { this.closed = true } })
const encoded = size => ({ blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, ...new Array(Math.max(0, size - 3)).fill(7)])], { type: 'image/jpeg' }), mime: 'image/jpeg', width: 1280, height: 960 })

describe('a photo for the Coach chat', () => {
  it('is drawn again on the device and goes as base64, never as the file that was picked', async () => {
    const pic = picture()
    const calls = []
    const out = await preparePhoto(file([...JPEG, 1, 2, 3]), {
      decode: async (f, mime) => { calls.push(['decode', mime]); return pic },
      encode: async (p, edge, q) => { calls.push(['encode', edge, q]); return encoded(4) },
    })
    expect(out).toMatchObject({ type: 'image/jpeg', data: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 7)), bytes: 4, width: 1280, height: 960 })
    expect(calls).toEqual([['decode', 'image/jpeg'], ['encode', 1280, 0.82]])
    expect(pic.closed).toBe(true)
  })

  it('steps the quality down, then the size, before giving up past the cap', async () => {
    const edges = []
    const big = encoded(PHOTO_MAX_BYTES + 1)
    const out = await preparePhoto(file(JPEG), {
      decode: async () => picture(),
      encode: async (p, edge, q) => { edges.push([edge, q]); return edges.length < 3 ? big : encoded(10) },
    })
    expect(edges).toEqual([[1280, 0.82], [1280, 0.65], [960, 0.6]])
    expect(out.bytes).toBe(10)
    const pic = picture()
    await expect(preparePhoto(file(JPEG), { decode: async () => pic, encode: async () => big })).rejects.toMatchObject({ code: 'toolarge' })
    expect(pic.closed).toBe(true)
  })

  it('refuses what is not a picture, or is a GIF', async () => {
    const never = async () => { throw new Error('not reached') }
    await expect(preparePhoto(file([...new TextEncoder().encode('just some text')]), { decode: never, encode: never })).rejects.toMatchObject({ code: 'unreadable' })
    await expect(preparePhoto(file([...new TextEncoder().encode('GIF89a......')]), { decode: never, encode: never })).rejects.toMatchObject({ code: 'unreadable' })
  })

  it('turns half a megabyte into base64 without overflowing the stack', async () => {
    const bytes = new Uint8Array(512 * 1024).map((_, i) => i % 251)
    const b64 = await toBase64(new Blob([bytes]))
    const back = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    expect(back.length).toBe(bytes.length)
    expect(back.every((v, i) => v === bytes[i])).toBe(true)
  })
})
