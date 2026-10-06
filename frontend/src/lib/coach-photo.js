// A photo for the Coach chat (docs/dev/COACH_VOICE_PHOTO.md). Decoded and drawn again on the
// device with the media module's own helpers, at most 1280 px on its long side, so what leaves is
// a plain JPEG or WebP of a few hundred kilobytes: never the original file, and nothing of its
// metadata (where it was taken, by which phone) along with it.
import { decodeImage, encodeImage, MediaError } from './media-ingest.js'
import { sniffKind } from './media-sniff.js'

export const PHOTO_EDGE = 1280
export const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024   // the server's cap (api/coach/photo.js)

/** A blob's bytes as base64, in chunks: a spread of half a megabyte would overflow the stack. */
export async function toBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * A picked file → { type, data, bytes, width, height, blob }: `type` and `data` (base64) are
 * what the chat sends; `blob` is for the preview. Throws MediaError('unreadable') for a file
 * that is not a picture this browser can read, MediaError('toolarge') for one that will not
 * come under the cap.
 */
export async function preparePhoto(file, { decode = decodeImage, encode = encodeImage } = {}) {
  const kind = sniffKind(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
  if (!kind || kind.kind !== 'image') throw new MediaError('unreadable')
  const pic = await decode(file, kind.mime)
  try {
    for (const [edge, quality] of [[PHOTO_EDGE, 0.82], [PHOTO_EDGE, 0.65], [960, 0.6]]) {
      const out = await encode(pic, edge, quality)
      if (out.blob.size <= PHOTO_MAX_BYTES) {
        return { type: out.mime, data: await toBase64(out.blob), bytes: out.blob.size, width: out.width, height: out.height, blob: out.blob }
      }
    }
    throw new MediaError('toolarge')
  } finally {
    pic.close()
  }
}
