// Sheets of warm-ups and recovery (docs/dev/WARMUPS.md): the ready-made sets to add, and which
// warm-up runs before which workout. The data rules are lib/warmups.js's.
import { useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { getLang, baseLang } from './lib/i18n.js'
import { exCount } from './lib/format.js'
import { WARMUP_SETS, addWarmupSets, isMobilityRoutine, setWarmup, suggestWarmups } from './lib/warmups.js'
import { tw } from './lib/warmups-i18n.js'
import Icon from './components/Icon.jsx'
import { Button, Check } from './components/ui.jsx'
import { glyphOf } from './lib/glyphs.js'
import { tappable } from './lib/use-sheet-keyboard.js'

// A row toggles on a tap anywhere; its checkbox is a button of its own, so its tap stops there.
const Tick = ({ on, toggle }) => <span onClick={e => e.stopPropagation()}><Check checked={on} onChange={toggle} /></span>

const ui = () => useUI.getState()
const update = (...a) => useStore.getState().update(...a)
const nameOf = set => (baseLang(getLang()) === 'ru' ? set.name.ru : set.name.en)

function ReadyWarmups({ close }) {
  const S = useStore(s => s.S)
  const have = new Set((S.routines || []).filter(isMobilityRoutine).map(r => r.preset).filter(Boolean))
  const [pick, setPick] = useState(() => WARMUP_SETS.filter(s => !have.has(s.key)).map(s => s.key))
  const toggle = key => setPick(xs => (xs.includes(key) ? xs.filter(x => x !== key) : [...xs, key]))
  const add = () => {
    update(s => { addWarmupSets(s, pick, baseLang(getLang())) })
    close()
    // Then where the warm-ups go: before the routines that suit them.
    if (suggestWarmups(useStore.getState().S).length) attachWarmupsSheet()
  }
  return <>
    <h3>{tw('Ready-made sets')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{tw('Each becomes an ordinary routine you can change. None of them counts as training: no progression, records, wins or quota.')}</div>
    <div className="list">{WARMUP_SETS.map(set => {
      const added = have.has(set.key)
      return <div key={set.key} className={'item' + (added ? ' dim' : '')} {...(added ? {} : tappable(() => toggle(set.key)))}>
        <span className="lrow-i"><Icon name={glyphOf(set.emoji)} /></span>
        <div className="grow"><div className="tt">{nameOf(set)}</div>
          <div className="ss">{added ? tw('Added') : tw('about {0} min · {1}', set.min, exCount(set.ex.length))}</div></div>
        {!added && <Tick on={pick.includes(set.key)} toggle={() => toggle(set.key)} />}
      </div>
    })}</div>
    <div style={{ height: 14 }} />
    <Button variant="primary" icon="plus" disabled={!pick.length} onClick={add}>{tw('Add')}</Button>
  </>
}
export const readyWarmupsSheet = () => ui().openSheet(close => <ReadyWarmups close={close} />)

function AttachWarmups({ close }) {
  const S = useStore(s => s.S)
  const [rows] = useState(() => suggestWarmups(S).map(x => ({ id: x.routine.id, name: x.routine.name, wid: x.warmup.id, wname: x.warmup.name })))
  const [on, setOn] = useState(() => rows.map(r => r.id))
  const toggle = id => setOn(xs => (xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id]))
  const apply = () => {
    update(s => { for (const r of rows) if (on.includes(r.id)) setWarmup(s, r.id, r.wid) })
    close()
  }
  return <>
    <h3>{tw('Before which workouts?')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{tw('The warm-up runs first when the workout starts; Skip warm-up drops it for that day.')}</div>
    <div className="list">{rows.map(r => <div key={r.id} className="item" {...tappable(() => toggle(r.id))}>
      <div className="grow"><div className="tt">{r.name}</div><div className="ss">{tw('warm-up: {0}', r.wname)}</div></div>
      <Tick on={on.includes(r.id)} toggle={() => toggle(r.id)} />
    </div>)}</div>
    <div style={{ height: 14 }} />
    <Button variant="primary" disabled={!on.length} onClick={apply}>{tw('Set')}</Button>
    <div style={{ height: 6 }} />
    <Button variant="ghost" onClick={close}>{tw('Not now')}</Button>
  </>
}
export const attachWarmupsSheet = () => ui().openSheet(close => <AttachWarmups close={close} />)
