// The places a Coach answer may link to (docs/dev/COACH_ASSISTANT.md): each id the server allows
// (api/coach/core/app-links.js) as a route, a Settings section to scroll to, and a label in the
// person's language. A test checks every route against App.jsx and every section against Settings.
import { APP_LINKS } from '../../../api/coach/core/app-links.js'
import { t } from './i18n.js'
import { th } from './health-i18n.js'

export { APP_LINKS }

export const LINKS = {
  home: { path: '/home', label: () => t('Home') },
  plan: { path: '/plan', label: () => t('Plan') },
  health: { path: '/health', label: () => th('Health'), needs: S => S?.healthOn !== false },
  stats: { path: '/stats', label: () => t('Stats') },
  history: { path: '/history', label: () => t('History') },
  library: { path: '/library', label: () => t('Exercises') },
  muscles: { path: '/muscles', label: () => t('Explore muscles') },
  balance: { path: '/structural-balance', label: () => t('Structural balance') },
  coach: { path: '/coach', label: () => t('Coach') },
  checkin: { path: '/checkin', label: () => t('At the gym'), needs: S => S?.checkIn !== false },
  settings: { path: '/settings', label: () => t('Settings') },
  'settings.general': { path: '/settings', section: 'general', label: () => t('General') },
  'settings.health': { path: '/settings', section: 'health', label: () => th('Health & food') },
  'settings.import': { path: '/settings', section: 'import', label: () => th('Import from Apple Health'), needs: S => S?.healthOn !== false },
  'settings.workout': { path: '/settings', section: 'workout', label: () => t('During a workout') },
  'settings.appearance': { path: '/settings', section: 'appearance', label: () => t('Appearance') },
  'settings.data': { path: '/settings', section: 'data', label: () => t('Data') },
  'settings.notifications': { path: '/settings', section: 'notifications', label: () => t('Notifications') },
  'settings.equipment': { path: '/settings', section: 'equipment', label: () => t('Equipment') },
  'settings.account': { path: '/settings', section: 'account', label: () => t('Account') },
}

/** "Settings → Health & food", "Stats" — what the button says after "Open:". */
export function linkLabel(id) {
  const l = LINKS[id]
  if (!l) return ''
  return l.section ? t('Settings') + ' → ' + l.label() : l.label()
}

/** Whether the place exists for this profile: Health and the gym check-in can be switched off. */
export const linkAvailable = (S, id) => !!LINKS[id] && (!LINKS[id].needs || LINKS[id].needs(S))

// The Settings section to scroll to after the route changes. Kept here rather than in the
// router's state, and for a few seconds only, so a later visit to Settings opens at the top.
let pending = null
export const pendingSection = () => (pending && Date.now() - pending.at < 3000 ? pending.section : null)
export const clearPendingSection = () => { pending = null }

/** Go to a link's place; Settings then scrolls to the section (views/Settings.jsx). */
export function openLink(nav, id) {
  const l = LINKS[id]
  if (!l) return
  pending = l.section ? { section: l.section, at: Date.now() } : null
  nav(l.path)
}
