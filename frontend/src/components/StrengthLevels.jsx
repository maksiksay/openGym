// Strength levels in Stats (docs/dev/STRENGTH_LEVELS.md): each lift with a standard trained lately,
// its level, a bar to the next one, and a sheet with the five thresholds at this body weight.
import { useMemo } from 'react'
import { useUI } from '../store/useUI.js'
import { EXIDX } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import { fmtDate, fmtNum } from '../lib/format.js'
import { LEVELS, LEVEL_PCT, bodyweightOn, strengthLevels } from '../lib/strength-levels.js'
import { STANDARDS_SOURCE } from '../lib/strength-standards.js'
import { tlv, levelName, amountText, toNextText } from '../lib/level-i18n.js'
import { bwSheet } from '../sheets.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

const nameOf = (S, id) => exerciseNameFor(EXIDX[id] || (S.customEx || []).find(e => String(e?.id) === String(id)) || { n: String(id) })

/** Five segments, filled to the level, the next one filled as far as it has come. */
export function LevelBar({ r }) {
  return <div className="level-bar" aria-hidden="true">
    {LEVELS.map((_, i) => <i key={i} className={'l' + i + (i <= r.level ? ' on' : '')}>
      {i === r.level + 1 && <b style={{ width: Math.round(r.toward * 100) + '%' }} />}
    </i>)}
  </div>
}

function LevelRow({ S, r }) {
  return <div className="level-row" {...tappable(() => levelSheet(S, r))}>
    <div className="level-top">
      <span className="level-n">{nameOf(S, r.exId)}</span>
      <span className={'level-badge l' + Math.max(0, r.level) + (r.level < 0 ? ' none' : '')}>{levelName(r.level)}</span>
    </div>
    <LevelBar r={r} />
    <div className="muted small">{toNextText(r, S.unit || 'kg')}</div>
  </div>
}

export default function StrengthLevelsCard({ S }) {
  const bw = bodyweightOn(S)
  const rows = useMemo(() => strengthLevels(S), [S.workouts, S.bodyweight, S.body, S.unit])
  const unit = S.unit || 'kg'
  return <div className="card levels-card">
    <div className="row between" style={{ alignItems: 'baseline', gap: 10 }}>
      <h2 style={{ margin: 0 }}>{tlv('Strength levels')}</h2>
      {bw && <span className="muted small">{tlv('Body weight {0} · {1}', `${fmtNum(bw.w)} ${unit}`, tlv(S.body === 'female' ? 'woman' : 'man'))}</span>}
    </div>
    {!bw ? <>
      <p className="muted small" style={{ margin: '8px 0 10px' }}>{tlv('Levels are read against your body weight. Log it once to see them.')}</p>
      <Button size="sm" icon="plus" onClick={() => bwSheet()}>{tlv('Log weight')}</Button>
    </> : !rows.length
      ? <p className="muted small" style={{ margin: '8px 0 0' }}>{tlv('Levels exist for the bench press, the squat, the deadlift, overhead presses, rows, curls, the leg press, pulldowns, pull-ups, chin-ups, dips and push-ups. A lift shows here once you have trained it in the last twelve weeks.')}</p>
      : <div className="level-rows">{rows.map(r => <LevelRow key={r.exId} S={S} r={r} />)}</div>}
    <div className="muted small levels-src">{tlv('Standards: Strength Level, fitted to your body weight. Approximate.')}</div>
  </div>
}

function LevelDetail({ S, r }) {
  const unit = S.unit || 'kg'
  const m = r.measure
  const measure = r.reps
    ? tlv('{0} on {1}', amountText(m.value, true), fmtDate(r.date, true))
    : `${tlv('≈1RM {0}', amountText(m.value, false, unit))} · ${tlv('from {0} on {1}', `${fmtNum(m.w)} ${unit} × ${m.r}`, fmtDate(r.date, true))}`
  return <>
    <h3 className="level-title">{nameOf(S, r.exId)}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{tlv('Your best in the last twelve weeks')}: {measure}{r.perHand ? ` · ${tlv('per dumbbell')}` : ''}</div>
    <div className={'level-badge big l' + Math.max(0, r.level) + (r.level < 0 ? ' none' : '')}>{levelName(r.level)}</div>
    <LevelBar r={r} />
    <div className="muted small" style={{ margin: '6px 0 16px' }}>{toNextText(r, unit)}</div>
    <h4 className="sec">{tlv('At your body weight ({0})', `${fmtNum(r.bw.w)} ${unit}`)}</h4>
    <div className="level-table">
      {LEVELS.map((_, i) => <div key={i} className={'level-trow' + (i <= r.level ? ' on' : '') + (i === r.level ? ' here' : '')}>
        <span className={'level-dot l' + i} />
        <span className="grow level-tname">{levelName(i)}<span className="muted small">{tlv('Stronger than {0}% of lifters', LEVEL_PCT[i])}</span></span>
        <span className="level-tv">{amountText(r.thresholds[i], r.reps, unit)}</span>
        {i === r.level ? <span className="level-you">{tlv('you')}</span> : i < r.level ? <Icon name="check" /> : <span className="level-you" />}
      </div>)}
    </div>
    <p className="muted small" style={{ marginTop: 14 }}>
      {tlv('Standards: Strength Level, fitted to your body weight. Approximate.')}{' '}
      <a href={STANDARDS_SOURCE.url} target="_blank" rel="noopener noreferrer">{STANDARDS_SOURCE.name}</a>
    </p>
  </>
}
export const levelSheet = (S, r) => useUI.getState().openSheet(() => <LevelDetail S={S} r={r} />)
