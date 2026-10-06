import { describe, it, expect, afterEach } from 'vitest'
import { _setLangState } from './i18n-core.js'
import { ts, nReps, nWins, deltaText, markText, recordChips, winChips, monthLabel, goalText } from './score-i18n.js'

afterEach(() => { _setLangState('en') })

describe('the scoreboard in English', () => {
  it('says how far past last time', () => {
    expect(deltaText({ w: 2.5 }, 'kg')).toBe('+2.5 kg')
    expect(deltaText({ w: -5 }, 'kg')).toBe('−5 kg of help')
    expect(deltaText({ r: 1 }, 'kg')).toBe('+1 rep')
    expect(deltaText({ r: 3 }, 'kg')).toBe('+3 reps')
    expect(deltaText({ weak: 1 }, 'kg')).toBe('+1 on the weakest set')
    expect(deltaText({ sec: 5 }, 'kg')).toBe('+5 s')
    expect(deltaText({ weakSec: 3 }, 'kg')).toBe('+3 s on the weakest hold')
    expect(deltaText(null, 'kg')).toBe('')
  })

  it('marks a set briefly', () => {
    expect(markText({ r: 1 })).toBe('+1')
    expect(markText({ w: 2.5 })).toBe('+2.5')
    expect(markText({ w: -5 })).toBe('−5')
    expect(markText({ sec: 5 })).toBe('+5 s')
    expect(markText(null)).toBe('')
  })

  it('names the records, the beat first', () => {
    const records = {
      weight: { v: 62.5, prev: 60 }, reps: { w: 60, r: 9, prev: 8 }, e1rm: { v: 75, prev: 72 },
      volume: { v: 1240, prev: 1200, unit: 'load' }, hold: { v: 65, prev: 60 },
    }
    expect(recordChips(records, 'kg')).toEqual(['weight 62.5 kg', 'reps 60×9', 'e1RM 75 kg', 'volume 1,240 kg', 'hold 1:05'])
    expect(recordChips({ reps: { w: 0, r: 12, prev: 10 }, volume: { v: 30, prev: 28, unit: 'reps' } }, 'kg')).toEqual(['reps 12', 'volume 30 reps'])
    expect(winChips({ beat: { r: 1 }, records: { weight: { v: 62.5, prev: 60 } } }, 'kg')).toEqual(['+1 rep', 'weight 62.5 kg'])
    expect(recordChips(undefined, 'kg')).toEqual([])
  })

  it('writes the goal the way the rows read', () => {
    expect(goalText({ mode: 'reps', sets: 3, reps: 8, weight: 60 }, 'kg')).toBe('60 kg × 8 · 8 · 8')
    expect(goalText({ mode: 'reps', sets: 3, reps: 12, weight: 0, bw: true }, 'kg')).toBe('12 · 12 · 12')
    expect(goalText({ mode: 'reps', sets: 2, reps: 8, weight: 10, bw: true }, 'kg')).toBe('+10 kg × 8 · 8')
    expect(goalText({ mode: 'reps', sets: 2, reps: 10, weight: 20, perSide: true }, 'kg')).toBe('20 kg × 5 · 5 per side')
    expect(goalText({ mode: 'time', sets: 3, sec: 45, weight: 0 }, 'kg')).toBe('0:45 · 0:45 · 0:45')
    expect(goalText({ mode: 'reps', sets: 8, reps: 5, weight: 60 }, 'kg')).toBe('60 kg × 5 (×8)')
    expect(goalText(null, 'kg')).toBe('')
  })

  it('counts and names the month', () => {
    expect(nWins(1)).toBe('1 win')
    expect(nWins(4)).toBe('4 wins')
    expect(monthLabel('2026-10')).toBe('October')
  })
})

describe('the scoreboard in Russian', () => {
  it('reads the pack and declines the counts', () => {
    _setLangState('ru', {})
    expect(ts('Beat: {0}', '60 кг')).toBe('Побить: 60 кг')
    expect(nReps(1)).toBe('1 повтор')
    expect(nReps(2)).toBe('2 повтора')
    expect(nReps(5)).toBe('5 повторов')
    expect(nReps(21)).toBe('21 повтор')
    expect(nWins(3)).toBe('3 победы')
    expect(deltaText({ r: 2 }, 'кг')).toBe('+2 повтора')
    expect(monthLabel('2026-10')).toBe('Октябрь')
  })

  it('falls back to English for a key the pack does not have', () => {
    _setLangState('de', {})
    expect(ts('Beat: {0}', 'x')).toBe('Beat: x')
  })
})
