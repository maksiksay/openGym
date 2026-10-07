// The seasons' sheets (docs/dev/SEASONS.md): starting one, the season with its anchors and its
// results, and the question asked before a whole new plan replaces the season's.
import { useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { todayISO, fmtDate, fmtDateRange } from './lib/format.js'
import { exerciseNameFor } from './lib/i18n.js'
import { EXIDX } from './lib/exercises.js'
import {
  ANCHOR_SLOTS, anchorProgress, anchorsOutOfPlan, change, closeSeason, dropSeason, lastDay,
  pastSeasons, seasonResults, seasonState, setAnchors, startNow, startSeason, suggestAnchors,
} from './lib/season.js'
import { tsn, slotLabel, measureText, setText, changeText } from './lib/season-i18n.js'
import { measureLevel } from './lib/strength-levels.js'
import { tlv, levelName } from './lib/level-i18n.js'
import { confirmSheet, starterPlanSheet } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import { Button, Row, SelectRow } from './components/ui.jsx'

const update = (...a) => useStore.getState().update(...a)
const ui = () => useUI.getState()
const toast = m => ui().toast(m)

const nameOf = (S, id) => exerciseNameFor(EXIDX[id] || (S.customEx || []).find(e => String(e?.id) === String(id)) || { n: String(id) })

/** The exercises of the plan, once each, for an anchor slot to pick from. */
function planOptions(S) {
  const seen = new Set()
  const out = [{ value: '', label: tsn('None') }]
  for (const r of S.routines || []) for (const e of r.ex || []) {
    const id = String(e.id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ value: id, label: nameOf(S, id) })
  }
  return out
}

/* ---------------------------------- starting, and the anchors ---------------------------------- */

/** The start sheet, or, given the season in force, its anchors to change. */
function SeasonStart({ close, editing = null }) {
  const S = useStore(s => s.S)
  const prev = pastSeasons(S).at(-1)
  const n = editing ? editing.n : (Number(prev?.n) || 0) + 1
  const [start, setStart] = useState(todayISO())
  const [anchors, setA] = useState(() => (editing ? { ...editing.anchors } : suggestAnchors(S.routines, prev?.anchors)))
  const gone = new Set(anchorsOutOfPlan(S.routines, anchors))
  const options = planOptions(S)
  // An anchor kept from before that the plan no longer has still shows, by its name.
  const optionsFor = slot => (anchors[slot] && !options.some(o => o.value === anchors[slot])
    ? [...options, { value: anchors[slot], label: nameOf(S, anchors[slot]) }] : options)
  const save = () => {
    if (!ANCHOR_SLOTS.some(k => anchors[k])) { toast(tsn('Pick at least one anchor lift.')); return }
    if (editing) update(s => setAnchors(s, editing.id, anchors))
    else update(s => { startSeason(s, { start, anchors }) })
    close()
    if (!editing) toast(tsn('Season {0} started', n))
  }
  return <>
    <h3>{tsn('Season {0}', n)}</h3>
    {!editing && <>
      <p className="muted small">{tsn('Six weeks. In the last one, the last set of each anchor in your ordinary sessions is the test. Then the results, and a week off or straight into the next season.')}</p>
      <div className="sect-b" style={{ marginBottom: 14 }}>
        <Row icon="calendar" title={tsn('Starts on')}>
          <input type="date" className="timef" value={start} onChange={e => setStart(e.target.value || todayISO())} />
        </Row>
      </div>
    </>}
    <h4 className="sec">{tsn('Anchor lifts')}</h4>
    <p className="muted small">{tsn('Four lifts that stay through every change of program, so the numbers stay comparable. Everything else can change.')}</p>
    <div className="sect-b season-slots" style={{ marginBottom: 14 }}>
      {ANCHOR_SLOTS.map(slot => <div key={slot}>
        <SelectRow title={slotLabel(slot)} sheetTitle={slotLabel(slot)} value={anchors[slot] || ''} options={optionsFor(slot)} stackedValue
          onChange={v => setA(a => ({ ...a, [slot]: v || null }))} />
        {gone.has(slot) && <div className="season-warn"><Icon name="warning" />{tsn('Not in the plan any more')}</div>}
      </div>)}
    </div>
    <Button variant="primary" icon={editing ? 'check' : 'flag'} onClick={save}>{editing ? tsn('Change the anchors') : tsn('Start the season')}</Button>
  </>
}
export const seasonStartSheet = () => ui().openSheet(close => <SeasonStart close={close} />)

/* ---------------------------------- the season ---------------------------------- */

/** One anchor: its name and what it did, from week 1 to its best so far, or to its test. */
function AnchorLine({ S, season, slot, iso, results }) {
  const id = season.anchors?.[slot]
  if (!id) return null
  const unit = S.unit || 'kg'
  const p = anchorProgress(S, season, id, iso)
  const to = results ? p.test : p.best
  const ch = change(p.base, to)
  const detail = results && p.test ? setText(p.test, unit) : ''
  return <div className="season-anchor">
    <div className="season-anchor-hd">
      <span className="season-slot">{slotLabel(slot)}</span>
      {p.tested && <span className="season-tested"><Icon name="checkCircle" />{tsn('tested')}</span>}
    </div>
    <div className="season-anchor-n">{nameOf(S, id)}</div>
    {!p.base
      ? <div className="muted small">{tsn('not yet logged')}</div>
      : <div className="season-anchor-v">
        <span>{measureText(p.base, unit)}</span>
        <Icon name="chevronRight" />
        <span className={ch && ch.delta > 0 ? 'up' : ''}>{measureText(to, unit)}</span>
        {ch && ch.delta !== 0 && <span className="season-delta">{changeText(ch, unit)}</span>}
      </div>}
    {(detail || (results && p.fallback)) && <div className="muted small">{[detail, results && p.fallback ? tsn('best of the test week') : ''].filter(Boolean).join(' · ')}</div>}
    {results && <AnchorLevel S={S} season={season} id={id} p={p} />}
  </div>
}

/** An anchor's strength level in week 1 and at its test (docs/dev/STRENGTH_LEVELS.md), where its
 *  exercise has a standard and there is a weigh-in to read it against. */
export function AnchorLevel({ S, season, id, p }) {
  const from = p.base ? measureLevel(S, id, p.base, season.start) : null
  const to = p.test ? measureLevel(S, id, p.test, lastDay(season)) : null
  if (!from && !to) return null
  const up = from && to && to.level > from.level
  return <div className="season-level">
    {tlv('Level')}: {from ? levelName(from.level) : '—'} → <span className={up ? 'up' : ''}>{to ? levelName(to.level) : '—'}{up ? ' ↑' : ''}</span>
  </div>
}

function SeasonSheet({ close }) {
  const S = useStore(s => s.S)
  const iso = todayISO()
  const st = seasonState(S, iso)
  const season = st.season
  const past = pastSeasons(S).slice().reverse()
  const editAnchors = () => { close(); ui().openSheet(c => <SeasonStart close={c} editing={season} />) }
  const giveUp = () => confirmSheet({
    title: tsn('Give Season {0} up?', season.n),
    message: tsn('The season goes. Your workouts stay as they are.'),
    confirmText: tsn('Give it up'), danger: true,
    onConfirm: () => { update(s => dropSeason(s, season.id)); close() }
  })
  const finish = next => {
    update(s => { closeSeason(s, season.id, next, iso) })
    close()
    toast(tsn('Season {0} closed', season.n))
  }

  return <>
    {season && <>
      <h3>{tsn('Season {0}', season.n)}</h3>
      <div className="muted small" style={{ marginBottom: 12 }}>
        {st.phase === 'upcoming' ? tsn('Starts {0}', fmtDate(season.start, true))
          : st.phase === 'over' ? fmtDateRange(season.start, st.end)
            : tsn('Week {0} of {1} · until {2}', st.week, st.weeks, fmtDate(st.end, true))}
      </div>
      {st.phase === 'test' && <p className="season-note">{tsn('The last set of each anchor is the test: as many reps as you can, one or two left in the tank.')}</p>}
      {st.phase === 'over' && <h4 className="sec">{tsn('Results')}</h4>}
      <div className="season-anchors">
        {ANCHOR_SLOTS.map(slot => <AnchorLine key={slot} S={S} season={season} slot={slot} iso={iso} results={st.phase === 'over'} />)}
      </div>
      {st.phase === 'over' && <SeasonTotals S={S} season={season} />}

      {st.phase === 'upcoming' && <Button variant="primary" icon="flag" onClick={() => { update(s => startNow(s, season.id, iso)); close() }}>{tsn('Start now')}</Button>}
      {st.phase === 'over' && <>
        <Button variant="primary" onClick={() => finish('rest')}>{tsn('Week off, then Season {0}', season.n + 1)}</Button>
        <div style={{ height: 8 }} />
        <Button onClick={() => finish('now')}>{tsn('Season {0} now', season.n + 1)}</Button>
        <h4 className="sec" style={{ marginTop: 18 }}>{tsn('Change the program')}</h4>
        <p className="muted small">{tsn('Now is the time: the anchors carry over. A starter plan is one tap away; a plan file or the Coach work too.')}</p>
        <Button icon="sparkles" onClick={() => { close(); starterPlanSheet() }}>{tsn('Change the program')}</Button>
      </>}
      {st.phase !== 'over' && <div className="season-actions">
        <Button variant="ghost" size="sm" onClick={editAnchors}>{tsn('Change the anchors')}</Button>
        <Button variant="ghost" size="sm" className="dim" onClick={giveUp}>{tsn('Give this season up')}</Button>
      </div>}
    </>}

    {!!past.length && <>
      <h4 className="sec" style={{ marginTop: 18 }}>{tsn('Past seasons')}</h4>
      {past.map(p => <details key={p.id} className="season-past">
        <summary>{tsn('Season {0}', p.n)} · {fmtDateRange(p.start, lastDay(p))}</summary>
        <div className="season-anchors">
          {ANCHOR_SLOTS.map(slot => <AnchorLine key={slot} S={S} season={p} slot={slot} iso={lastDay(p)} results />)}
        </div>
        <SeasonTotals S={S} season={p} />
      </details>)}
    </>}
  </>
}

function SeasonTotals({ S, season }) {
  const r = seasonResults(S, season)
  return <div className="season-totals muted small">
    {tsn('{0} sessions', r.sessions)} · {tsn('{0} wins · {1} records', r.wins, r.records)}
  </div>
}
export const seasonSheet = () => ui().openSheet(close => <SeasonSheet close={close} />)
