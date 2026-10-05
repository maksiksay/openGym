import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO, isoOf, fmtDate } from '../lib/format.js'
import { dateLocale } from '../lib/i18n.js'
import { th } from '../lib/health-i18n.js'
import { healthOn, healthSeries, recentAverages, sleepVsTraining } from '../lib/health.js'
import { SLOTS, SLOT_NAMES, mealsOn, totals, dailySeries, progressOf } from '../lib/nutrition.js'
import { checkInSheet, addFoodSheet, mealRowSheet, goalsSheet, foodFormSheet, fmtInt, fmt1, macroLine } from '../sheets-health.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'

const shift = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const SQ = ['Very poor', 'Poor', 'OK', 'Good', 'Great']

/** One macro against its goal: a bar that fills to the goal and runs past it in a softer tint. */
export function MacroBar({ label, value, goal, unit, color }) {
  const r = progressOf(value, goal)
  return <div className="hbar">
    <div className="row between small"><span>{label}</span>
      <span className="muted">{unit === 'kcal' ? fmtInt(value) : fmt1(value)}{goal ? ' / ' + fmtInt(goal) : ''} {unit === 'kcal' ? th('kcal') : th('g')}</span></div>
    <div className="hbar-t"><div className={'hbar-f' + (r > 1 ? ' over' : '')} style={{ width: Math.min(100, r * 100) + '%', background: color }} /></div>
  </div>
}

function WellbeingCard({ d, entry }) {
  if (!entry) return <div className="card">
    <div className="row" style={{ gap: 9, marginBottom: 10 }}>
      <span className="lrow-i" style={{ background: 'var(--indigo, #5e5ce6)' }}><Icon name="moon" /></span>
      <div><div className="lbl2">{th('Wellbeing')}</div><div className="ttl">{d === todayISO() ? th('How did you sleep?') : th('Nothing noted for this day')}</div></div>
    </div>
    <Button variant="primary" icon="plus" onClick={() => checkInSheet(d)}>{th('Log wellbeing')}</Button>
  </div>
  const cell = (label, v) => <div><b>{v}</b><span>{label}</span></div>
  return <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => checkInSheet(d))}>
    <div className="row between" style={{ marginBottom: 8 }}>
      <h2 style={{ margin: 0 }}>{th('Wellbeing')}</h2>
      <Icon name="pencil" className="chev" />
    </div>
    <div className="hsum">
      {entry.sleep != null && cell(th('Sleep, h'), fmt1(entry.sleep))}
      {entry.sq != null && cell(th('Sleep quality'), th(SQ[entry.sq - 1]))}
      {entry.energy != null && cell(th('Energy'), entry.energy + '/5')}
      {entry.stress != null && cell(th('Stress'), entry.stress + '/5')}
      {entry.steps != null && cell(th('Steps'), fmtInt(entry.steps))}
      {entry.waist != null && cell(th('Waist, cm'), fmt1(entry.waist))}
    </div>
    {entry.note && <div className="small muted" style={{ marginTop: 8 }}>{entry.note}</div>}
  </div>
}

function NutritionDay({ S, d }) {
  const rows = mealsOn(S.meals, d)
  const tot = totals(rows)
  const goals = S.nutri?.goals || null
  return <div className="card">
    <div className="row between" style={{ marginBottom: 8 }}>
      <h2 style={{ margin: 0 }}>{th('Food')}</h2>
      <Button size="sm" icon="target" onClick={goalsSheet}>{goals ? th('Goals') : th('Set goals')}</Button>
    </div>
    <div className="row" style={{ alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
      <div className="big">{fmtInt(tot.kcal)}</div>
      <div className="muted">{goals?.kcal ? th('of {0} kcal', fmtInt(goals.kcal)) : th('kcal')}</div>
    </div>
    <MacroBar label={th('Calories')} value={tot.kcal} goal={goals?.kcal} unit="kcal" color="var(--orange)" />
    <MacroBar label={th('Protein')} value={tot.p} goal={goals?.p} unit="g" color="var(--acc)" />
    <MacroBar label={th('Fat')} value={tot.f} goal={goals?.f} unit="g" color="var(--yellow)" />
    <MacroBar label={th('Carbs')} value={tot.c} goal={goals?.c} unit="g" color="var(--blue)" />

    {SLOTS.map(slot => {
      const xs = rows.filter(m => m.slot === slot)
      const st = totals(xs)
      return <div key={slot} className="hslot">
        <div className="row between">
          <span className="hslot-t">{th(SLOT_NAMES[slot])}{xs.length ? <span className="dim"> · {fmtInt(st.kcal)} {th('kcal')}</span> : null}</span>
          <button className="iconbtn" style={{ width: 32, height: 30 }} aria-label={th('Add food')} onClick={() => addFoodSheet({ d, slot })}><Icon name="plus" /></button>
        </div>
        {xs.map(m => <button key={m.id} className="frow" onClick={() => mealRowSheet(m)}>
          <span className="frow-m"><span className="frow-t">{m.name}</span>
            <span className="frow-s">{m.g > 0 ? `${fmtInt(m.g)} ${th('g')} · ` : ''}{macroLine(m)}</span></span>
          <span className="frow-v">{fmtInt(m.kcal)}</span>
        </button>)}
      </div>
    })}
  </div>
}

// The last seven full days, read the way the module wants them read: the mean of the logged days
// next to the goal. Rolling rather than the calendar week, so a Monday does not read as one day,
// and ending yesterday, so a day still being eaten does not drag the mean down by lunchtime.
function WeekCard({ S, d }) {
  const days = dailySeries(S.meals, shift(d, -7), shift(d, -1))
  const n = days.length
  const mean = f => (n ? days.reduce((s, x) => s + x[f], 0) / n : null)
  const kcal = mean('kcal'), prot = mean('p')
  const avg = recentAverages(S.health, d, 7)
  const goals = S.nutri?.goals || null
  const pct = (v, g) => (g && v != null ? ' · ' + Math.round(v / g * 100) + '%' : '')
  return <div className="card">
    <h2 style={{ marginTop: 0 }}>{th('Last 7 days')}</h2>
    <div className="hsum">
      <div><b>{kcal != null ? fmtInt(kcal) : '—'}</b><span>{th('kcal / day')}{pct(kcal, goals?.kcal)}</span></div>
      <div><b>{prot != null ? fmtInt(prot) : '—'}</b><span>{th('protein / day')}{pct(prot, goals?.p)}</span></div>
      <div><b>{avg.sleep != null ? fmt1(avg.sleep) : '—'}</b><span>{th('sleep, h')}</span></div>
      <div><b>{avg.energy != null ? fmt1(avg.energy) : '—'}</b><span>{th('energy, 1–5')}</span></div>
    </div>
    <div className="dim small" style={{ marginTop: 8 }}>
      {n ? th('Food: average of {0} logged days before today. Days without entries are left out, not counted as zero.', n) : th('No food logged in the last seven days.')}
    </div>
  </div>
}

function TrendsCard({ S }) {
  const today = todayISO()
  const from = shift(today, -41)
  // Food ends yesterday: today's total is still growing and would plot as a dip every morning.
  const yesterday = shift(today, -1)
  const kcal = useMemo(() => dailySeries(S.meals, from, yesterday).map(x => ({ t: new Date(x.d + 'T12:00:00').getTime(), y: x.kcal, d: x.d })), [S.meals, from, yesterday])
  const prot = useMemo(() => dailySeries(S.meals, from, yesterday).map(x => ({ t: new Date(x.d + 'T12:00:00').getTime(), y: x.p, d: x.d })), [S.meals, from, yesterday])
  const sleep = useMemo(() => healthSeries(S.health, 'sleep', from, today), [S.health, from, today])
  const energy = useMemo(() => healthSeries(S.health, 'energy', from, today), [S.health, from, today])
  const pairs = useMemo(() => sleepVsTraining(S.health, S.workouts).slice(-8).reverse(), [S.health, S.workouts])
  const goals = S.nutri?.goals || null
  if (kcal.length < 2 && sleep.length < 2) return null
  return <div className="card">
    <h2 style={{ marginTop: 0 }}>{th('Last six weeks')}</h2>
    {kcal.length > 1 && <><div className="small muted">{th('Calories per logged day')}</div>
      <div className="chart"><LineChart points={kcal} h={120} unit={th('kcal')} goal={goals?.kcal || null} color="var(--orange)" /></div></>}
    {prot.length > 1 && <><div className="small muted" style={{ marginTop: 10 }}>{th('Protein, g')}</div>
      <div className="chart"><LineChart points={prot} h={110} unit={th('g')} goal={goals?.p || null} /></div></>}
    {sleep.length > 1 && <><div className="small muted" style={{ marginTop: 10 }}>{th('Sleep, h')}</div>
      <div className="chart"><LineChart points={sleep} h={110} unit={th('h')} color="var(--blue)" /></div></>}
    {energy.length > 1 && <><div className="small muted" style={{ marginTop: 10 }}>{th('Energy, 1–5')}</div>
      <div className="chart"><LineChart points={energy} h={90} color="var(--green)" /></div></>}
    {pairs.length > 0 && <>
      <h4 className="sec">{th('Sleep before your workouts')}</h4>
      <div className="flist">{pairs.map(p => <div key={p.d} className="frow static">
        <span className="frow-m"><span className="frow-t">{fmtDate(p.d, true)}</span>
          <span className="frow-s">{th('Slept {0} h', fmt1(p.sleep))}{p.energy != null ? ' · ' + th('energy {0}/5', p.energy) : ''}</span></span>
        <span className="frow-v">{p.vol > 0 ? fmtInt(p.vol) + ' ' + S.unit : ''}</span>
      </div>)}</div>
    </>}
  </div>
}

export default function Health() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [d, setD] = useState(todayISO())
  const entry = healthOn(S.health, d)
  const nutri = S.nutri || {}
  const isToday = d === todayISO()
  const label = isToday ? th('Today') : new Date(d + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{th('Health')}</h1><div className="sub">{th('Sleep, wellbeing and food')}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={th('Settings')}><Icon name="gear" /></button>
    </div>

    <div className="row between hday">
      <button className="iconbtn" onClick={() => setD(shift(d, -1))} aria-label={th('Previous day')}><Icon name="chevronLeft" /></button>
      <button className="hday-l" onClick={() => setD(todayISO())}>{label}</button>
      <button className="iconbtn" disabled={isToday} onClick={() => setD(shift(d, 1))} aria-label={th('Next day')}><Icon name="chevronRight" /></button>
    </div>

    <WellbeingCard d={d} entry={entry} />

    {nutri.on !== false && (nutri.paused
      ? <div className="card">
          <h2 style={{ marginTop: 0 }}>{th('Food tracking is paused')}</h2>
          <div className="muted small" style={{ marginBottom: 10 }}>{th('Taking a break from counting is part of doing it well. Your log and goals are kept.')}</div>
          <Button onClick={() => useStore.getState().update(s => { s.nutri = { ...(s.nutri || {}), paused: false } })}>{th('Resume tracking')}</Button>
        </div>
      : <NutritionDay S={S} d={d} />)}

    <WeekCard S={S} d={d} />
    <TrendsCard S={S} />

    {nutri.on !== false && !nutri.paused && (S.foods || []).length > 0 && <div className="card">
      <h2 style={{ marginTop: 0 }}>{th('My foods')}</h2>
      <div className="flist">{[...S.foods].sort((a, b) => String(a.name).localeCompare(String(b.name), dateLocale())).map(f =>
        <button key={f.id} className="frow" onClick={() => foodFormSheet({ initial: f })}>
          <span className="frow-m"><span className="frow-t">{f.name}</span>
            <span className="frow-s">{(f.brand ? f.brand + ' · ' : '') + `${fmtInt(f.kcal)} ${th('kcal')} · ${macroLine(f)} ${th('per 100 g')}`}</span></span>
          <Icon name="pencil" className="frow-c" />
        </button>)}</div>
    </div>}
  </div>
}
