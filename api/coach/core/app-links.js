/* The places in the app a chat answer may link to (docs/dev/COACH_ASSISTANT.md). This is the whole
 * list: validateChat drops any other id, and the app maps each one to a route and, for Settings,
 * a section (frontend/src/lib/app-links.js — whose test checks every id against App.jsx and the
 * Settings sections). The app map in prompts/app.md names them. */
export const APP_LINKS = Object.freeze([
  'home', 'plan', 'health', 'stats', 'history', 'progress', 'library', 'muscles', 'balance', 'coach', 'checkin',
  'settings', 'settings.general', 'settings.health', 'settings.import', 'settings.workout',
  'settings.appearance', 'settings.data', 'settings.notifications', 'settings.equipment', 'settings.account'
]);
export const OPEN_MAX = 2;

/** An answer's `open`, as kept: known ids only, each once, at most two. */
export const cleanOpen = v => (Array.isArray(v)
  ? [...new Set(v.filter(x => typeof x === 'string' && APP_LINKS.includes(x)))].slice(0, OPEN_MAX)
  : []);
