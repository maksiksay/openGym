/* Product barcodes (EAN-13, EAN-8, UPC) read in the browser, for the food log. The gym check-in
 * reader next door (lib/scan-web.js) only ever wanted QR; a food package carries a 1-D code,
 * and iPhone Safari — the PWA this mostly runs as — has no BarcodeDetector at all.
 *
 * Two decoders, in order:
 *   1. BarcodeDetector, where the browser has one (Chrome on Android), asked for retail formats.
 *   2. ZXing (@zxing/library, Apache-2.0, see NOTICE.md), pure JS. Dynamic-imported, so it
 *      ships only to someone who opens the scanner.
 *
 * decodeLuminance is the pure core — 8-bit grey pixels in, digits out — and what the unit test
 * runs against a code drawn in memory. decodeProductCode wraps it with the canvas plumbing.
 */

let _zx = null
async function zxing() {
  if (!_zx) {
    const m = await import('@zxing/library')
    const hints = new Map()
    hints.set(m.DecodeHintType.POSSIBLE_FORMATS, [m.BarcodeFormat.EAN_13, m.BarcodeFormat.EAN_8, m.BarcodeFormat.UPC_A, m.BarcodeFormat.UPC_E])
    hints.set(m.DecodeHintType.TRY_HARDER, true)
    const reader = new m.MultiFormatReader()
    reader.setHints(hints)
    _zx = { m, reader }
  }
  return _zx
}

let _detector = null
function nativeDetector() {
  if (_detector !== null) return _detector
  try {
    _detector = typeof BarcodeDetector === 'function' ? new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }) : false
  } catch (e) { _detector = false }
  return _detector
}

/** 8-bit luminance (Uint8ClampedArray of width × height) → the code's digits, or null. */
export async function decodeLuminance(lum, width, height) {
  if (!lum || !width || !height) return null
  const { m, reader } = await zxing()
  try {
    const src = new m.RGBLuminanceSource(lum, width, height)
    const bmp = new m.BinaryBitmap(new m.HybridBinarizer(src))
    const res = reader.decodeWithState(bmp)
    const text = res && res.getText()
    return text && /^\d{8,14}$/.test(text) ? text : null
  } catch (e) {
    return null      // NotFoundException and friends: nothing in this frame
  } finally {
    reader.reset()
  }
}

/** RGBA pixels → luminance (Rec. 601 weights, the ones ZXing uses itself). */
export function toLuminance(rgba, width, height) {
  const out = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8
  return out
}

let _canvas = null
/**
 * Read a retail barcode from anything drawImage accepts (a <video> frame, an <img>, a bitmap).
 * The frame is scaled to at most 1280 px wide: enough bars per pixel for an EAN at arm's length,
 * and it keeps a phone's 12 MP photo from stalling the decoder.
 */
export async function decodeProductCode(source) {
  const det = nativeDetector()
  if (det) {
    try {
      const hits = await det.detect(source)
      const v = hits && hits[0] && hits[0].rawValue
      if (v && /^\d{8,14}$/.test(v)) return v
    } catch (e) { /* fall through to ZXing */ }
  }
  const sw = source.videoWidth || source.naturalWidth || source.width
  const sh = source.videoHeight || source.naturalHeight || source.height
  if (!sw || !sh) return null
  const k = Math.min(1, 1280 / sw)
  const w = Math.round(sw * k), h = Math.round(sh * k)
  if (!_canvas) _canvas = document.createElement('canvas')
  _canvas.width = w; _canvas.height = h
  const ctx = _canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  return decodeLuminance(toLuminance(img.data, w, h), w, h)
}

/** A barcode out of a picture file the person took or picked. */
export async function decodeProductFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await decodeProductCode(img)
  } finally { URL.revokeObjectURL(url) }
}
