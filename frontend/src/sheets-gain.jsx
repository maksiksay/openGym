// The rate of gain and the food calibration (docs/dev/GAIN_RATE.md): the line on Home's body-weight
// card, the Rate sheet behind it, and the calibration's cards on the Health screen.
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { todayISO, fmtDate, fmtNum } from './lib/format.js'
import {
  gainVerdict, applyKcalStep, setKcalGoal, waistOver, calibrationView, startCalibration, dropCalibration,
  maintenanceEstimate, CALIB_DAYS,
} from './lib/gain-rate.js'
import { tg, moreWeighIns, pctText, perWeekText, corridorText, corridorLabel, sideLabel, stepText } from './lib/gain-i18n.js'
import { th } from './lib/health-i18n.js'
import { convertBodyWeight } from './lib/units.js'
import { lastBW } from './lib/history.js'
import { goalsSheet, fmtInt, fmt1 } from './sheets-health.jsx'
import { confirmSheet } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import { Button } from './components/ui.jsx'
import { tappable } from './lib/use-sheet-keyboard.js'

const update = (...a) => useStore.getState().update(...a)
const ui = () => useUI.getState()
const toast = m => ui().toast(m)

const COLOR = { in: 'var(--green)', low: 'var(--orange)', high: 'var(--orange)' }

/* ---------------------------------- Home ---------------------------------- */

/** What a reading says on one line, or '' when there is nothing to say yet. */
function lineText(v) {
  if (v.kind === 'wait') return tg('Calories changed {0} · a rate from {1}', fmtDate(v.since, true), fmtDate(v.until, true))
  if (v.kind === 'data') {
    if (!v.trend.n) return ''
    return v.trend.missing ? moreWeighIns(v.trend.missing) : tg('A rate from {0}', fmtDate(v.trend.readyOn, true))
  }
  const rate = tg('{0} a week', pctText(v.trend.rate))
  if (v.kind === 'rate') return rate
  if (v.kind === 'in') return `${rate} · ${sideLabel(v.direction, 'in')}`
  return `${rate} · ${sideLabel(v.direction, v.kind)}: ${stepText(v.step)}`
}

/** The line under the goal on Home's body-weight card; a tap opens the Rate sheet. */
export function GainLine({ S }) {
  const v = gainVerdict(S, todayISO())
  const text = lineText(v)
  if (!text) return null
  return <div className={'small row gain-line' + (COLOR[v.kind] ? '' : ' muted')} style={{ marginTop: 4, gap: 5, cursor: 'pointer', ...(COLOR[v.kind] ? { color: COLOR[v.kind] } : {}) }} {...tappable(rateSheet)}>
    <Icon name="chartLine" style={{ fontSize: 13 }} />
    <span>{text}</span>
    <Icon name="chevronRight" style={{ fontSize: 12, marginInlineStart: 'auto' }} />
  </div>
}

/* ---------------------------------- the Rate sheet ---------------------------------- */

const VERDICT = {
  gain: { low: 'Slower than the corridor.', high: 'Faster than the corridor.' },
  lose: { low: 'Losing faster than the corridor.', high: 'Losing slower than the corridor.' },
  keep: { low: 'Losing, where the goal is to keep the weight.', high: 'Gaining, where the goal is to keep the weight.' },
}

/** Where the direction came from: the goal weight, or the Goals sheet's goal. */
function sourceText(S, v) {
  const corridor = corridorText(v.corridor)
  const target = Number(S.targetW)
  if (target > 0) {
    return v.direction === 'keep'
      ? tg('{0} a week · your goal of {1} {2} is within reach', corridor, fmtNum(target), S.unit)
      : tg('{0} a week · towards your goal of {1} {2}', corridor, fmtNum(target), S.unit)
  }
  return tg('{0} a week · from the goal in Goals', corridor)
}

function RateSheet({ close }) {
  const S = useStore(s => s.S)
  const today = todayISO()
  const v = gainVerdict(S, today)
  const tr = v.trend
  const unit = S.unit || 'kg'
  const kcal = Number(S.nutri?.goals?.kcal) > 0 ? S.nutri.goals.kcal : null
  const waist = tr.enough ? waistOver(S, tr.first, today) : null
  const apply = () => {
    update(s => { applyKcalStep(s, v.step, today) })
    toast(tg('Calorie goal changed'))
    close()
  }
  return <>
    <h3>{tg('Weight trend')}</h3>
    {tr.enough && <>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <div className="big" style={{ color: COLOR[v.kind] }}>{pctText(tr.rate)}</div>
        <div className="muted">{tg('{0} a week', perWeekText(tr.perWeek, unit))}</div>
      </div>
      <div className="dim small" style={{ marginTop: 2 }}>{tg('From {0} weigh-ins since {1}', tr.n, fmtDate(tr.first, true))}</div>
    </>}
    {v.corridor && <div className="small" style={{ marginTop: 10 }}>
      <b>{corridorLabel(v.direction)}</b>: {sourceText(S, v)}
    </div>}
    <div style={{ marginTop: 12, lineHeight: 1.5 }}>
      {v.kind === 'wait' && tg('You changed the calories on {0}. The scale shows a change as water first, so the rate is read again from {1}.', fmtDate(v.since, true), fmtDate(v.until, true))}
      {v.kind === 'data' && <>{tr.missing ? moreWeighIns(tr.missing) + '. ' : tr.readyOn ? tg('A rate from {0}', fmtDate(tr.readyOn, true)) + '. ' : ''}{tg('The rate needs 4 weigh-ins over 2 weeks. Two or three a week are enough.')}</>}
      {v.kind === 'rate' && tg('Set a goal weight, and this says whether it is the pace you want.')}
      {v.kind === 'in' && tg('Inside the corridor, or within the noise of the scale. Keep eating the way you do.')}
      {(v.kind === 'low' || v.kind === 'high') && <>{tg(VERDICT[v.direction][v.kind])} {tg('One step, then two weeks for the scale to show it.')}</>}
    </div>
    {(v.kind === 'low' || v.kind === 'high') && <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
      {kcal
        ? <>
            <div className="big" style={{ fontSize: 20 }}>{tg('Goal {0} → {1} kcal', fmtInt(kcal), fmtInt(kcal + v.step))}</div>
            <div className="dim small" style={{ margin: '4px 0 10px' }}>{tg('Carbohydrate moves with it; protein and fat stay.')}</div>
            <Button variant="primary" onClick={apply}>{tg('Apply')}</Button>
          </>
        : <>
            <div style={{ marginBottom: 10 }}>{stepText(v.step).replace(/^./, c => c.toUpperCase())}</div>
            <Button icon="target" onClick={() => { close(); goalsSheet() }}>{th('Set goals')}</Button>
          </>}
    </div>}
    {waist && <div className="small" style={{ marginTop: 12 }}>{tg('Waist {0} cm since {1}', (waist.delta > 0 ? '+' : waist.delta < 0 ? '−' : '±') + fmt1(Math.abs(waist.delta)), fmtDate(waist.from, true))}</div>}
    <div className="dim small" style={{ marginTop: 12 }}>{tg('A weigh-in before a workout counts too. The same time of day keeps the line straighter.')}</div>
  </>
}
export const rateSheet = () => ui().openSheet(close => <RateSheet close={close} />)

/* ---------------------------------- the food calibration ---------------------------------- */

const weightKgOf = S => {
  const bw = lastBW(S)
  return bw ? convertBodyWeight(bw.w, S.unit, 'kg') : null
}

const running = v => !!v && !v.result && !v.over

/** Below the food day, while no calibration runs: the offer to start one. */
export function CalibrationOffer({ S }) {
  const today = todayISO()
  if (running(calibrationView(S, today))) return null
  const start = days => { update(s => { startCalibration(s, days, today) }); toast(tg('Calibration started')) }
  return <div className="card">
    <h2 style={{ marginTop: 0 }}>{tg('Food calibration')}</h2>
    <div className="muted small" style={{ marginBottom: 10 }}>{tg('Log everything you eat for 2 or 3 weeks to learn what your portions hold. Then tracking pauses by itself.')}</div>
    <div className="row" style={{ gap: 8 }}>
      {CALIB_DAYS.map(d => <Button key={d} size="sm" onClick={() => start(d)}>{tg(d === 14 ? '2 weeks' : '3 weeks')}</Button>)}
    </div>
  </div>
}

/** Above the food day, while a calibration runs: where it stands. */
export function CalibrationCard({ S }) {
  const v = calibrationView(S, todayISO())
  if (!running(v)) return null
  const stop = () => confirmSheet({
    title: tg('Stop the calibration?'), message: tg('What you logged stays in your log.'),
    confirmText: tg('Stop'), onConfirm: () => update(s => { dropCalibration(s) }),
  })
  return <div className="card">
    <div className="row between" style={{ marginBottom: 6 }}>
      <h2 style={{ margin: 0 }}>{tg('Food calibration')}</h2>
      <Button size="sm" variant="ghost" onClick={stop}>{tg('Stop')}</Button>
    </div>
    <div className="muted small" style={{ marginBottom: 10 }}>{tg('Day {0} of {1} · logged days: {2}', v.day, v.days, v.logged)}</div>
    <div className="hsum">
      <div><b>{v.kcal != null ? fmtInt(v.kcal) : '—'}</b><span>{tg('kcal a day')}</span></div>
      <div><b>{v.p != null ? fmtInt(v.p) : '—'}</b><span>{tg('protein, g')}{v.pPerKg != null ? ' · ' + tg('{0} g/kg', fmt1(v.pPerKg)) : ''}</span></div>
      {/* against about 0.4 g/kg, read like a macro bar's "value / goal" */}
      <div><b>{v.pb != null ? fmtInt(v.pb) : '—'}{v.pbTarget ? <span className="dim"> / {v.pbTarget}</span> : null}</b><span>{tg('protein at breakfast, g')}</span></div>
    </div>
    <div className="dim small" style={{ marginTop: 8 }}>{tg('A day counts once two meals of it are logged.')}</div>
  </div>
}

/** On the paused food card: what a calibration that ended found, and the calories it points to. */
export function CalibrationSummary({ S }) {
  const r = S.nutri?.calib?.result
  if (!r) return null
  const days = S.nutri.calib.days
  const est = maintenanceEstimate(S)
  const make = () => {
    update(s => { setKcalGoal(s, est.kcal, todayISO(), weightKgOf(s)) })
    toast(tg('Calorie goal set'))
  }
  const same = est && Number(S.nutri?.goals?.kcal) === est.kcal
  return <div style={{ marginBottom: 12 }}>
    <div style={{ fontWeight: 600 }}>{tg('Calibration over: {0} of {1} days logged', r.logged, days)}</div>
    {r.logged > 0 && <div className="small muted" style={{ marginTop: 2 }}>{tg('{0} kcal a day · protein {1} g · at breakfast {2} g', fmtInt(r.kcal), fmtInt(r.p), fmtInt(r.pb))}</div>}
    {est && <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>
      {est.inside
        ? tg('On {0} kcal your weight moved {1} a week, inside the corridor: that is your number.', fmtInt(est.eaten), pctText(est.rate))
        : tg('On {0} kcal your weight moved {1} a week. For the corridor, about {2} kcal.', fmtInt(est.eaten), pctText(est.rate), fmtInt(est.kcal))}
    </div>}
    {est && !same && <Button size="sm" icon="target" style={{ marginTop: 8 }} onClick={make}>{tg('Make it my goal')}</Button>}
  </div>
}
