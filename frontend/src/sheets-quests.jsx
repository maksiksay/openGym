// The quests (docs/dev/QUESTS.md): Home's card, the sheet with the open ones, the suggestions, your
// own and the done ones, and the rows the finish sheet adds to its wins. Kept free of sheets.jsx,
// which imports the finish rows from here.
import { useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { todayISO, fmtDate } from './lib/format.js'
import { t } from './lib/i18n.js'
import { isAssisted } from './lib/exercises.js'
import { isBw } from './lib/history.js'
import {
  MAX_OPEN, openQuests, doneQuests, questsDoneBy, questBar, questForecast, questSuggestions, questTarget,
  recentBest, pinQuest, dropQuest, nextQuest,
} from './lib/quests.js'
import { tq, questExercise, questNameClass, questGoal, barText, forecastText } from './lib/quest-i18n.js'
import Icon from './components/Icon.jsx'
import { Button, NumberField, SelectRow } from './components/ui.jsx'
import { tappable } from './lib/use-sheet-keyboard.js'

const update = (...a) => useStore.getState().update(...a)
const ui = () => useUI.getState()
const toast = m => ui().toast(m)

const pin = tpl => {
  update(s => { pinQuest(s, tpl, todayISO()) })
  toast(tq('Quest pinned'))
}

/** One open quest: the lift, the goal, the bar and the forecast. */
function QuestRow({ S, q, onClick }) {
  const today = todayISO()
  const bar = questBar(S, q, today)
  return <div className="quest" {...tappable(onClick)}>
    <div className="row between small"><span className={'quest-ex ' + questNameClass(q)}>{questExercise(S, q)}</span><span className="muted quest-now">{barText(S, q, bar)}</span></div>
    <div className="quest-goal">{questGoal(S, q)}</div>
    <div className="hbar-t"><div className="hbar-f" style={{ width: Math.round((bar.toward ?? 0) * 100) + '%', background: 'var(--acc)' }} /></div>
    <div className="dim small quest-f">{forecastText(questForecast(S, q, today))}</div>
  </div>
}

/** A quest to pin: the lift, the goal and where you stand now. */
function IdeaRow({ S, tpl, disabled }) {
  const today = todayISO()
  const best = recentBest(S, tpl, today)
  const target = questTarget(S, tpl, today)
  const now = best != null && target != null ? barText(S, tpl, { best, target, toward: target > 0 ? best / target : 0 }) : ''
  return <div className="row quest-idea" style={{ gap: 10, alignItems: 'center' }}>
    <div className="grow">
      <div className={'small muted quest-ex ' + questNameClass(tpl)}>{questExercise(S, tpl)}</div>
      <div className="quest-goal">{questGoal(S, tpl)}</div>
      {now && <div className="dim small">{now}</div>}
    </div>
    <Button size="sm" icon="target" disabled={disabled} onClick={() => pin(tpl)}>{tq('Pin')}</Button>
  </div>
}

/* ---------------------------------- Home ---------------------------------- */

/** Home's Quests card: the open ones, or with none the first thing worth pinning. */
export function QuestsCard({ S }) {
  const open = openQuests(S)
  const ideas = open.length ? [] : questSuggestions(S, todayISO(), 1)
  if (!open.length && !ideas.length) return null
  return <div className="card">
    <div className="row between" style={{ marginBottom: 10 }}>
      <h2 style={{ margin: 0 }}>{tq('Quests')}</h2>
      <Button size="sm" icon={open.length < MAX_OPEN ? 'plus' : 'list'} aria-label={tq('Quests')} onClick={questsSheet} />
    </div>
    {open.map(q => <QuestRow key={q.id} S={S} q={q} onClick={questsSheet} />)}
    {!open.length && <>
      <div className="muted small" style={{ marginBottom: 10 }}>{tq('Pick a goal on a lift, and the app shows how far along you are and when it is likely to land.')}</div>
      <IdeaRow S={S} tpl={ideas[0]} />
    </>}
  </div>
}

/* ---------------------------------- the sheet ---------------------------------- */

const nameOf = (S, id) => questExercise(S, { exId: id })
const planIds = S => {
  const out = []
  for (const r of S.routines || []) for (const e of r.ex || []) if (e?.id != null && !out.includes(String(e.id))) out.push(String(e.id))
  return out
}

/** Your own quest: an exercise of the plan and a weight × reps, or reps for a bodyweight one. */
function OwnQuest({ S, disabled }) {
  const ids = planIds(S)
  const [id, setId] = useState(ids[0] || '')
  const [w, setW] = useState(null)
  const [r, setR] = useState(null)
  if (!ids.length) return null
  const assisted = isAssisted(id)
  const bw = isBw({ id })
  const ok = !!id && !assisted && (bw ? r > 0 : w > 0 && r > 0)
  const add = () => { pin(bw ? { kind: 'reps', exId: id, r: Math.round(r) } : { kind: 'set', exId: id, w, r: Math.round(r) }); setW(null); setR(null) }
  return <>
    <SelectRow title={tq('Exercise')} value={id} options={ids.map(x => ({ value: x, label: nameOf(S, x) }))} onChange={setId} search />
    {assisted
      ? <div className="muted small" style={{ margin: '8px 0' }}>{tq('For an assistance machine, pin the first pull-up without help from the suggestions.')}</div>
      : <div className="grid2" style={{ margin: '8px 0' }}>
          {!bw && <label className="hfield"><span>{tq('Weight')}, {S.unit || 'kg'}</span><NumberField className="field" value={w} nullable onChange={setW} /></label>}
          <label className="hfield"><span>{bw ? tq('Reps in a set') : tq('Reps')}</span><NumberField className="field" value={r} nullable decimal={false} onChange={setR} /></label>
        </div>}
    <Button size="sm" icon="target" disabled={disabled || !ok} onClick={add}>{tq('Pin')}</Button>
  </>
}

function askDrop(q) {
  ui().openSheet(close => <div style={{ textAlign: 'center', padding: '4px 0' }}>
    <h3 style={{ marginBottom: 8 }}>{tq('Take this quest off?')}</h3>
    <div className="muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>{tq('Its progress is read from your log, so nothing is lost.')}</div>
    <button className="btn danger" onClick={() => { close(); update(s => dropQuest(s, q.id)) }}>{tq('Take it off')}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </div>, { kind: 'center' })
}

function QuestsSheet() {
  const S = useStore(s => s.S)
  const open = openQuests(S)
  const ideas = questSuggestions(S, todayISO())
  const done = doneQuests(S).slice(0, 10)
  const full = open.length >= MAX_OPEN
  return <>
    <h3>{tq('Quests')}</h3>
    {open.length > 0 && <>
      <h4 className="sec">{tq('Open')}</h4>
      {open.map(q => <div key={q.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div className="grow"><QuestRow S={S} q={q} /></div>
        <button className="iconbtn" aria-label={tq('Take it off')} onClick={() => askDrop(q)}><Icon name="xmark" /></button>
      </div>)}
    </>}
    <h4 className="sec">{tq('Suggestions')}</h4>
    {full && <div className="muted small" style={{ marginBottom: 8 }}>{tq('Three are open: finish or take one off to pin another.')}</div>}
    {ideas.length
      ? ideas.map(tpl => <IdeaRow key={tpl.kind + tpl.exId} S={S} tpl={tpl} disabled={full} />)
      : <div className="muted small">{tq('Nothing to suggest yet: a session of the plan comes first.')}</div>}
    <h4 className="sec">{tq('Your own')}</h4>
    <OwnQuest S={S} disabled={full} />
    {done.length > 0 && <>
      <h4 className="sec">{tq('Done')}</h4>
      {done.map(q => <div key={q.id} className="row between small quest-doneline">
        <span><Icon name="checkCircle" /> <span className={questNameClass(q)}>{questExercise(S, q)}</span>: {questGoal(S, q)}</span>
        <span className="muted">{tq('done {0}', fmtDate(q.done.d, true))}</span>
      </div>)}
    </>}
  </>
}
export const questsSheet = () => ui().openSheet(() => <QuestsSheet />)

/* ---------------------------------- the finish sheet ---------------------------------- */

/** The quests a finished workout completed, as rows of its wins, each with its next step. */
export function QuestFinishRows({ w }) {
  const S = useStore(s => s.S)
  const done = questsDoneBy(S, w)
  if (!done.length) return null
  const open = openQuests(S)
  return done.map(q => {
    const next = nextQuest(S, q, todayISO())
    const offer = next && open.length < MAX_OPEN && !open.some(x => x.kind === next.kind && String(x.exId) === String(next.exId))
    return <div key={q.id}>
      <div className="small winrow quest-donerow"><Icon name="flag" />
        <span>{tq('Quest done')}: <span className={questNameClass(q)}>{questExercise(S, q)}</span> — {questGoal(S, q)}</span></div>
      {offer && <Button size="sm" variant="ghost" icon="target" onClick={() => pin(next)}>{tq('Next: {0}', questGoal(S, next))}</Button>}
    </div>
  })
}
