// Progress photos (docs/dev/PROGRESS_PHOTOS.md): every photo kept with a logged workout, newest day
// first, and two of them compared — side by side, or laid over each other under a slider — with the
// weight and waist of their days. The files are the workouts' own (components/WorkoutMedia.jsx):
// on this device and the person's own server, never in a Coach payload, MCP or a plan file.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtDate, fmtNum } from '../lib/format.js'
import { bodyOn, comparison, photoDays, photoWorkouts, progressPhotos } from '../lib/progress-photos.js'
import { tpr, nDays, nPhotos } from '../lib/progress-i18n.js'
import WorkoutMediaSection, { openWorkoutMediaViewer } from '../components/WorkoutMedia.jsx'
import { CustomThumb, useMediaUrl } from '../components/CustomMedia.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'

const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmtNum(Math.abs(n))
// Photos span months and years: a date always says which.
const day = d => fmtDate(d, false, true)
const approx = exact => (exact ? '' : '≈')

/** "≈72.4 kg · 81 cm" — the weight and the waist that stand for a day, when there are any. */
function bodyLine(S, d, { labels = false } = {}) {
  const b = bodyOn(S, d)
  return [
    b.weight ? (labels ? tpr('Weight') + ' ' : '') + approx(b.weight.exact) + fmtNum(b.weight.w) + ' ' + (S.unit || 'kg') : null,
    b.waist ? (labels ? tpr('Waist') + ' ' : '') + approx(b.waist.exact) + fmtNum(b.waist.cm) + ' ' + tpr('cm') : null,
  ].filter(Boolean).join(' · ')
}

// One photo at full size, from the local store (or the person's own server, signed in).
function Photo({ m, alt }) {
  const u = useMediaUrl(m)
  return u.url
    ? <img className="pp-img" decoding="async" draggable={false} src={u.url} alt={alt} />
    : <button type="button" className="pp-img pp-wait" onClick={() => u.load?.()} aria-label={alt}><Icon name="image" /></button>
}

function Compare({ S, A, B, picking, setPicking, mode, setMode, pos, setPos }) {
  const c = comparison(S, A, B)
  const summary = [
    nDays(c.days),
    c.weight != null ? signed(c.weight) + ' ' + (S.unit || 'kg') : null,
    c.waist != null ? tpr('{0} cm waist', signed(c.waist)) : null,
  ].filter(Boolean).join(' · ')
  const side = (p, k) => <div className="pp-side">
    <div className="pp-date">{day(p.d)}</div>
    <div className="small muted">{bodyLine(S, p.d, { labels: true })}</div>
    <Button size="sm" variant={picking === k ? 'primary' : 'plain'} onClick={() => setPicking(picking === k ? null : k)}>{tpr('Change')}</Button>
  </div>
  return <div className="card pp-compare">
    <Segmented value={mode} onChange={setMode} options={[{ value: 'side', label: tpr('Side by side') }, { value: 'slider', label: tpr('Slider') }]} />
    {mode === 'side'
      ? <div className="pp-pair">
          <div className="pp-frame"><Photo m={A.ref} alt={tpr('Photo of {0}', day(A.d))} /></div>
          <div className="pp-frame"><Photo m={B.ref} alt={tpr('Photo of {0}', day(B.d))} /></div>
        </div>
      : <>
          <div className="pp-slider">
            <div className="pp-frame"><Photo m={A.ref} alt={tpr('Photo of {0}', day(A.d))} /></div>
            <div className="pp-frame pp-top" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}><Photo m={B.ref} alt={tpr('Photo of {0}', day(B.d))} /></div>
            <div className="pp-line" style={{ left: pos + '%' }} />
          </div>
          <input className="pp-range" type="range" min="0" max="100" value={pos} aria-label={tpr('Slider')} onChange={e => setPos(Number(e.target.value))} />
        </>}
    <div className="pp-pair pp-sides">{side(A, 0)}{side(B, 1)}</div>
    {picking != null && <div className="small dim" style={{ marginTop: 6 }}>{tpr('Tap the photo for this side in the feed below.')}</div>}
    <div className="pp-sum">{summary}</div>
  </div>
}

// Adding photos from here: a workout first, since a photo is kept with one.
function PickWorkout() {
  const S = useStore(s => s.S)
  const rows = photoWorkouts(S, 10)
  return <>
    <h3>{tpr('Which workout?')}</h3>
    {rows.length
      ? <div className="flist">{rows.map((r, i) => <button key={r.w.id || r.d + i} className="frow" onClick={() => openWorkoutPhotos(r.w)}>
          <span className="frow-m"><span className="frow-t">{r.name || t('Workout')}</span><span className="frow-s">{fmtDate(r.d, true)}</span></span>
          <span className="frow-v">{r.photos ? nPhotos(r.photos) : ''}</span>
        </button>)}</div>
      : <div className="muted small">{tpr('Photos are kept with a workout. Log one first.')}</div>}
  </>
}
const openWorkoutPhotos = w => useUI.getState().openSheet(() => <>
  <h3 style={{ marginBottom: 2 }}>{w.name || t('Workout')}</h3>
  <div className="muted small" style={{ marginBottom: 8 }}>{fmtDate(w.d, true)}</div>
  <WorkoutMediaSection w={w} hint />
</>)
export const addPhotosSheet = () => useUI.getState().openSheet(() => <PickWorkout />)

export default function Progress() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const photos = useMemo(() => progressPhotos(S), [S.workouts])
  const days = useMemo(() => photoDays(photos), [photos])
  const [comparing, setComparing] = useState(false)
  const [pair, setPair] = useState(null)        // the two keys chosen, when not the defaults
  const [picking, setPicking] = useState(null)  // the side a tap in the feed goes to: 0 | 1
  const [mode, setMode] = useState('side')
  const [pos, setPos] = useState(50)
  const byKey = new Map(photos.map(p => [p.key, p]))
  // The first photo and the latest, unless a side was changed.
  const keys = pair && pair.every(k => byKey.has(k)) ? pair : photos.length >= 2 ? [photos[photos.length - 1].key, photos[0].key] : null
  const A = keys && byKey.get(keys[0])
  const B = keys && byKey.get(keys[1])
  const tap = p => {
    if (comparing && picking != null && keys) {
      const next = [...keys]
      next[picking] = p.key
      setPair(next)
      setPicking(null)
      return
    }
    openWorkoutMediaViewer(p.w, p.i)
  }

  return <div className="narrow">
    <div className="hdr">
      <div className="row" style={{ gap: 8 }}>
        <button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
        <div><h1>{tpr('Progress photos')}</h1>{photos.length > 0 && <div className="sub">{nPhotos(photos.length)}</div>}</div>
      </div>
      <button className="iconbtn" onClick={addPhotosSheet} aria-label={tpr('Add photos')}><Icon name="plus" /></button>
    </div>

    {!photos.length && <div className="card">
      <h2 style={{ marginTop: 0 }}>{tpr('No progress photos yet')}</h2>
      <div className="muted small" style={{ marginBottom: 10 }}>{tpr('Keep a photo with a workout — on the finish screen, in a workout in History, or with Add photos here. Photos stay on this device and your own server.')}</div>
      <Button variant="primary" icon="plus" onClick={addPhotosSheet}>{tpr('Add photos')}</Button>
    </div>}

    {photos.length >= 2 && (comparing
      ? <>
          <div className="row between" style={{ margin: '4px 2px 8px' }}>
            <h2 style={{ margin: 0 }}>{tpr('Compare')}</h2>
            <Button size="sm" variant="ghost" onClick={() => { setComparing(false); setPicking(null) }}>{tpr('Done')}</Button>
          </div>
          <Compare S={S} A={A} B={B} picking={picking} setPicking={setPicking} mode={mode} setMode={setMode} pos={pos} setPos={setPos} />
        </>
      : <Button icon="chart" onClick={() => setComparing(true)} style={{ marginBottom: 12 }}>{tpr('Compare')}</Button>)}

    {days.map(group => <div key={group.d} className="pp-day">
      <div className="pp-dayh"><b>{day(group.d)}</b>{bodyLine(S, group.d) && <span className="muted"> · {bodyLine(S, group.d)}</span>}</div>
      <div className="pp-grid">{group.photos.map(p => <button key={p.key} type="button"
        className={'pp-item' + (comparing && keys && keys.includes(p.key) ? ' on' : '') + (comparing && picking != null ? ' picking' : '')}
        aria-label={tpr('Photo of {0}', day(p.d))} onClick={() => tap(p)}>
        <CustomThumb ex={{ custom: true, media: p.ref }} />
      </button>)}</div>
    </div>)}
  </div>
}
