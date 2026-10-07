/* The language check (docs/dev/COACH_QUALITY.md): what a reader would notice in an answer, found
 * without asking a model, so the pipeline can send one extra round naming exactly what to fix.
 *
 * Deliberately narrow. Every rule here matches something a person reading the answer sees as a
 * slip, and leaves alone what is fine: a Latin name in parentheses after its translation, the
 * terms the app itself shows (RIR, 1RM, kg), a brand. It is not a grammar checker; the prompt and
 * the model carry the language, this only catches what slips through.
 *
 * Shared by both runtimes (the server's jobs and the phone's own Coach), like the rest of core/.
 */

// The script each language is written in, for the languages that are not written in Latin
// letters. A base language not listed here is read as Latin-script: only the identifier rules
// apply to it.
const SCRIPTS = {
  ru: 'Cyrillic', uk: 'Cyrillic', be: 'Cyrillic', bg: 'Cyrillic', sr: 'Cyrillic', mk: 'Cyrillic',
  kk: 'Cyrillic', ky: 'Cyrillic', tg: 'Cyrillic', mn: 'Cyrillic',
  el: 'Greek', ar: 'Arabic', fa: 'Arabic', ur: 'Arabic', he: 'Hebrew',
  hi: 'Devanagari', mr: 'Devanagari', ne: 'Devanagari', th: 'Thai', ko: 'Hangul',
  zh: 'Han', ja: 'Han|Hiragana|Katakana'
};
// Lowercase Latin words a non-Latin answer may carry: units, the effort scales and their kin, and
// the app's name. Anything written with a capital letter is left alone anyway.
const ALLOWED = new Set(['rir', 'rpe', 'kg', 'lb', 'lbs', 'km', 'kcal', 'min', 'sec', 'rm', 'e1rm', 'amrap', 'emom', 'ok', 'pr', 'opengym']);
// Identifiers that look like code but are names people write.
const NAMES = new Set(['openGym', 'iPhone', 'iPad', 'iOS', 'macOS', 'watchOS', 'eBay', 'YouTube']);
const MAX_ISSUES = 8;

const baseOf = lang => String(lang || '').toLowerCase().split(/[-_]/)[0];
const LATIN = /^[A-Za-z]+$/;
const HAS_LATIN = /[A-Za-z]/;

// Spans whose contents are someone's words or a name, not the answer's own prose.
const QUOTED = /\([^()]*\)|\[[^\]]*\]|«[^«»]*»|"[^"]*"|“[^”]*”|„[^“”]*[“”]|'[^'\n]*'|`[^`]*`/g;
// Links: an answer with web search lists its sources as "Title — https://…", and a domain may be
// named on its own. Neither is the answer's prose, and a path is full of things that look like code.
const LINKS = /\bhttps?:\/\/\S+|\bwww\.\S+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|gov|edu|int|io|ai|app|dev|info|me|co|uk|de|ru|by|ua|eu)\b(?:\/\S*)?/gi;

/**
 * The slips in one text, each naming its fragment.
 * @param {string} text
 * @param {string} lang  the answer's language tag (meta.lang)
 * @returns {string[]}
 */
export function languageIssues(text, lang) {
  const s = typeof text === 'string' ? text.replace(LINKS, ' ') : '';
  if (!s.trim()) return [];
  const issues = [];
  const add = issue => { if (!issues.includes(issue)) issues.push(issue); };

  // Backticks are how a model quotes a field it was given. The person never sees the payload.
  for (const m of s.matchAll(/`([^`\n]+)`/g)) add(`an internal name in backticks: «${m[1].trim()}»`);
  // Identifiers outside backticks: camelCase, snake_case, or a dotted path (window.workouts).
  const prose = s.replace(/`[^`\n]*`/g, ' ');
  for (const m of prose.matchAll(/\b[a-z]+(?:[A-Z][a-z0-9]+)+\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]+)+\b/g)) {
    const word = m[0];
    if (NAMES.has(word) || /^(e\.g|i\.e)$/i.test(word)) continue;
    add(`an internal name: «${word}»`);
  }

  const script = SCRIPTS[baseOf(lang)];
  if (script) {
    const native = new RegExp(`\\p{Script=${script.split('|').join('}|\\p{Script=')}}`, 'u');
    const nativeOnly = word => native.test(word) && !HAS_LATIN.test(word);
    // Read word by word, with quoted spans blanked out: a name in parentheses or a button label in
    // quotes is not the sentence's own word.
    const words = [...prose.replace(QUOTED, ' ').matchAll(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu)].map(m => m[0]);
    words.forEach((word, i) => {
      if (native.test(word) && HAS_LATIN.test(word)) { add(`a word that mixes two alphabets: «${word}»`); return; }
      if (!LATIN.test(word) || word !== word.toLowerCase() || word.length < 2 || ALLOWED.has(word)) return;
      // Between two words of the answer's own script, a lowercase Latin word is a transliteration
      // or an untranslated word. At the edge of a sentence it may be a quoted reply; left alone.
      if (i > 0 && i < words.length - 1 && nativeOnly(words[i - 1]) && nativeOnly(words[i + 1])) {
        add(`a word not in the answer's language: «${word}»`);
      }
    });
  }
  return issues.slice(0, MAX_ISSUES);
}

// The fields an answer shows a person, wherever they sit in it: the verdict, a summary, each
// change's reason, the notes, a card's text, a question back.
const TEXT_KEYS = new Set(['reading', 'summary', 'why', 'notes', 'text', 'question']);

/** Every human-readable string in a pipeline result, for languageIssues. */
export function answerTexts(result) {
  const out = [];
  const walk = (v, key) => {
    if (typeof v === 'string') { if (TEXT_KEYS.has(key)) out.push(v); return; }
    if (Array.isArray(v)) { v.forEach(x => walk(x, key)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(result, null);
  return out;
}

/** All the slips of a result, across its texts, deduplicated and bounded. */
export function answerIssues(result, lang) {
  const all = [];
  for (const text of answerTexts(result)) for (const issue of languageIssues(text, lang)) if (!all.includes(issue)) all.push(issue);
  return all.slice(0, MAX_ISSUES);
}
