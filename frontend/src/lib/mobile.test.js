import { describe, expect, it } from 'vitest'
import { isoOf } from './format.js'
import { buildReminderNotifications } from './mobile.js'

const push = { id: 'push', name: 'Push' }
const pull = { id: 'pull', name: 'Pull' }
const legs = { id: 'legs', name: 'Legs' }
const state = (patch = {}) => ({
  routines: [push, pull, legs], week: {}, dayPlan: {}, workouts: [],
  reminder: { on: true, time: '08:00' }, ...patch,
})
const iso = d => isoOf(d)

describe('buildReminderNotifications', () => {
  it('expands the weekly baseline into future dated notifications', () => {
    const now = new Date(2026, 5, 1, 7, 0) // Monday
    const notifications = buildReminderNotifications(state({ week: { 1: 'push', 3: 'pull' } }), now)

    expect(notifications.slice(0, 2).map(n => iso(n.schedule.at))).toEqual([
      iso(now), iso(new Date(2026, 5, 3)),
    ])
    expect(notifications[0].body).toContain('Push')
    expect(notifications[0].schedule.allowWhileIdle).toBe(true)
  })

  it('uses rest today and a routine override tomorrow when rescheduling', () => {
    const now = new Date(2026, 5, 1, 7, 0) // Monday
    const today = iso(now), tomorrow = iso(new Date(2026, 5, 2))
    const notifications = buildReminderNotifications(state({
      week: { 1: 'push' }, dayPlan: { [today]: 'rest', [tomorrow]: 'pull' },
    }), now)

    expect(notifications.slice(0, 1).map(n => [iso(n.schedule.at), n.body])).toEqual([
      [tomorrow, expect.stringContaining('Pull')],
    ])
  })

  it('schedules a valid override on a weekly rest day', () => {
    const now = new Date(2026, 5, 1, 7, 0) // Monday
    const wednesday = new Date(2026, 5, 3)
    const notifications = buildReminderNotifications(state({ dayPlan: { [iso(wednesday)]: 'legs' } }), now)

    expect(notifications.some(n => iso(n.schedule.at) === iso(wednesday) && n.body.includes('Legs'))).toBe(true)
  })

  it('suppresses dates that already have a completed workout', () => {
    const now = new Date(2026, 5, 1, 7, 0) // Monday
    const notifications = buildReminderNotifications(state({
      week: { 1: 'push' }, workouts: [{ d: iso(now) }],
    }), now)

    expect(notifications.some(n => iso(n.schedule.at) === iso(now))).toBe(false)
  })

  it("skips today's reminder after the configured local time has passed", () => {
    const now = new Date(2026, 5, 1, 9, 0) // Monday
    const notifications = buildReminderNotifications(state({ week: { 1: 'push' } }), now)

    expect(notifications.some(n => iso(n.schedule.at) === iso(now))).toBe(false)
    expect(notifications.some(n => iso(n.schedule.at) === iso(new Date(2026, 5, 8)))).toBe(true)
  })

  it('names both routines of a combined day, and reads a legacy scalar day the same', () => {
    const now = new Date(2026, 5, 1, 7, 0) // Monday
    const combined = buildReminderNotifications(state({ week: { 1: ['push', 'pull'] } }), now)[0]
    expect(combined.body).toContain('Push + Pull')

    const legacy = buildReminderNotifications(state({ week: { 1: 'push' } }), now)[0]
    expect(legacy.body).toContain('Push')
  })

  it('falls back to a count for three or more routines on one day', () => {
    const now = new Date(2026, 5, 1, 7, 0)
    const n = buildReminderNotifications(state({ week: { 1: ['push', 'pull', 'legs'] } }), now)[0]
    expect(n.body).toContain('3 routines')
  })

  // docs/dev/WARMUPS.md: a recovery session alone is not the day's training, unless the day
  // planned nothing else.
  it('still reminds of a training day after a recovery session alone, but not of a recovery day', () => {
    const now = new Date(2026, 5, 1, 7, 0) // Monday
    const recovery = { id: 'rec', name: 'Recovery', kind: 'mobility' }
    const morning = { id: 'm', d: iso(now), mobility: true, entries: [] }
    const training = buildReminderNotifications(state({ week: { 1: 'push' }, workouts: [morning] }), now)
    expect(iso(training[0].schedule.at)).toBe(iso(now))
    const recoveryDay = buildReminderNotifications(state({ routines: [push, recovery], week: { 1: 'rec' }, workouts: [morning] }), now)
    expect(recoveryDay.some(n => iso(n.schedule.at) === iso(now))).toBe(false)
  })
})