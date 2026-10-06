/* A photo sent with a chat message (docs/dev/COACH_VOICE_PHOTO.md).
 *
 * The phone has already decoded and re-encoded it (frontend/src/lib/coach-photo.js), so a real one
 * is a JPEG or a WebP of a few hundred kilobytes with no metadata of the original left in it. What
 * arrives here is still only what a client sent, so its type is read off the bytes, never taken
 * from the declared one, and its size is capped. The photo is then held by the job in memory and
 * handed to the provider; nothing here, or after, writes it anywhere.
 */
import { sniffMedia } from '../media.js';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** { ok: true, photo: { mediaType, data } } | { ok: false, error }. `data` is base64. */
export function cleanPhoto(p) {
  if (!p || typeof p !== 'object' || typeof p.data !== 'string') return { ok: false, error: 'photo must be { type, data } with base64 data' };
  const data = p.data.replace(/\s+/g, '');
  // A base64 string's length says its size before it is decoded: refuse an oversized one unread.
  if (!data || data.length > Math.ceil(PHOTO_MAX_BYTES / 3) * 4) return { ok: false, error: `the photo is empty or larger than ${PHOTO_MAX_BYTES / 1024 / 1024} MB` };
  if (data.length % 4 || !BASE64.test(data)) return { ok: false, error: 'the photo is not base64' };
  const bytes = Buffer.from(data, 'base64');
  const kind = sniffMedia(bytes.subarray(0, 64));
  if (!kind || !PHOTO_TYPES.includes(kind.mime)) return { ok: false, error: 'the photo must be a JPEG, PNG or WebP image' };
  return { ok: true, photo: { mediaType: kind.mime, data } };
}
