/* The app's exercise names for a job's language (docs/dev/COACH_QUALITY.md).
 *
 * The packs under ./names/ are generated from the app's own (frontend/src/exercise-names/) by
 * scripts/build-coach-assets.mjs, so the Coach names an exercise the way the app shows it rather
 * than translating the catalogue's English itself. A pack is loaded the first time a job in its
 * language needs it, and kept: they are a few dozen kilobytes each and never change while the
 * server runs.
 *
 * Server-only. The phone's own Coach passes the pack the app already has loaded.
 */

const cache = new Map();
// Only a language tag can become a file name here: no dots, no slashes, nothing else.
const TAG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/** The pack for `lang` — the exact tag first (pt-BR), then its base language (pt) — or null. */
export async function namesFor(lang) {
  const tag = typeof lang === 'string' ? lang.trim().replace('_', '-') : '';
  const tries = [...new Set([tag, tag.split('-')[0]])].filter(t => TAG.test(t) && t !== 'en');
  for (const t of tries) {
    if (!cache.has(t)) {
      try { cache.set(t, (await import(`./names/${t}.js`)).default || null); } catch { cache.set(t, null); }
    }
    if (cache.get(t)) return cache.get(t);
  }
  return null;
}
