import { describe, it, expect, afterEach } from 'vitest'
import { EXDB } from './exercises-data.js'
import { EXIDX, CATALOGUE, searchExercises } from './exercises.js'
import { matchExercise } from './import-csv.js'
import { EXTRA_EXERCISES, EXTRA_STEPS } from './exercises-extra.js'
import { musclesOf } from './muscles.js'
import { isBw } from './history.js'
import { _setLangState, instrFor } from './i18n-core.js'

// The fork's own built-in exercises (docs/dev/AB_PLAN.md).
describe('the exercises this fork adds', () => {
  afterEach(() => _setLangState('en', {}, null, null))

  it('are appended to the catalogue after the dataset, with ids nothing else uses', () => {
    expect(EXDB.slice(-EXTRA_EXERCISES.length).map(e => e.id)).toEqual(['9001', '9002', '9003', '9004', '9005', '9006', '9007', '9008', '9009'])
    expect(new Set(EXDB.map(e => e.id)).size).toBe(EXDB.length)
    for (const e of EXTRA_EXERCISES) expect(EXIDX[e.id]).toBeTruthy()
  })

  it('carry no media, and read as body weight', () => {
    for (const e of EXTRA_EXERCISES) {
      expect(e.img).toBeUndefined()
      expect(e.gif).toBeUndefined()
      expect(isBw({ id: e.id }), e.id).toBe(true)
    }
  })

  it('load the muscles they name', () => {
    expect(musclesOf(EXIDX['9001'])).toMatchObject({ hamstring: 1 })
    expect(musclesOf(EXIDX['9002'])).toMatchObject({ adductors: 1 })
  })

  it('have their steps in Russian, as many as in English, once the pack is loaded', () => {
    for (const e of EXTRA_EXERCISES) expect(EXTRA_STEPS.ru[e.id], e.id).toHaveLength(e.st.length)
    _setLangState('ru', {}, { ...EXTRA_STEPS.ru }, null)
    expect(instrFor(EXIDX['9001'])[0]).toMatch(/^Встаньте на колени/)
  })

  it('are found by search, and by the names an import brings them under', () => {
    expect(searchExercises(CATALOGUE, 'nordic').map(e => e.id)).toContain('9001')
    expect(searchExercises(CATALOGUE, 'copenhagen').map(e => e.id)).toContain('9002')
    for (const [name, id] of [['Nordic Curl', '9001'], ['Nordic Hamstring Curl', '9001'], ['Nordics', '9001'], ['Copenhagen Plank', '9002'], ['Copenhagen', '9002']]) {
      expect(matchExercise(name), name).toBe(id)
    }
  })
})
