// Sheets of the health & nutrition module: the daily check-in, adding food (recent, own and
// built-in foods, Open Food Facts by name or barcode, a quick entry), a portion, a food of one's
// own, a logged row, and the goals. The Health screen (views/Health.jsx) and the Home card open
// them; the data rules are in lib/health.js and lib/nutrition.js.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { todayISO, fmtDate, uid } from './lib/format.js'
import { dateLocale, getLang, baseLang } from './lib/i18n.js'
import { th } from './lib/health-i18n.js'
import { healthOn, setHealth } from './lib/health.js'
import {
  SLOTS, SLOT_NAMES, portion, mealRow, repeatRow, quickRow, recentFoods, searchFoods, validFood,
  suggestGoals, kcalOf, ACTIVITY, slotForHour,
} from './lib/nutrition.js'
import { BASE_FOODS, BASE_BY_ID, baseName, baseAsFood } from './lib/foods-base.js'
import { lookupBarcode, searchProducts, cleanCode, productUrl } from './lib/off.js'
import { decodeProductCode, decodeProductFile } from './lib/barcode-web.js'
import { convertBodyWeight } from './lib/units.js'
import { lookupFood } from './lib/coach-api.js'
import { coachAvailable } from './lib/coach.js'
import { DEMO } from './lib/demo.js'
import { MOBILE } from './lib/mobile.js'
import { lastBW } from './lib/history.js'
import Icon from './components/Icon.jsx'
import { Button, Stepper, Segmented, SearchField, TextField, TextArea, NumberField } from './components/ui.jsx'

const update = (...a) => useStore.getState().update(...a)
const ui = () => useUI.getState()
const toast = m => ui().toast(m)
const lang = () => baseLang(getLang())

export const fmtInt = n => Math.round(Number(n) || 0).toLocaleString(dateLocale())
export const fmt1 = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })
/** "Б 31 · Ж 3,6 · У 0" — the macros in one line. */
export const macroLine = x => `${th('P')} ${fmt1(x.p)} · ${th('F')} ${fmt1(x.f)} · ${th('C')} ${fmt1(x.c)}`

/* ============================ check-in ============================ */

const SCALE_WORDS = {
  sq: ['Very poor', 'Poor', 'OK', 'Good', 'Great'],
  energy: ['Drained', 'Low', 'Normal', 'Good', 'Full of it'],
  stress: ['Calm', 'Low', 'Some', 'High', 'Very high'],
}

// Five numbered buttons; tapping the chosen one again clears it — a scale nobody answered stays
// unanswered rather than defaulting to the middle.
function Scale5({ field, value, onChange }) {
  return <div className="hscale" role="group">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} className={'hscale-b' + (value === n ? ' on' : '')} aria-pressed={value === n}
        onClick={() => onChange(value === n ? null : n)}>
        <b>{n}</b><span>{th(SCALE_WORDS[field][n - 1])}</span>
      </button>
    ))}
  </div>
}

function CheckInSheet({ d, close }) {
  const st = useStore(s => s.S)
  const cur = healthOn(st.health, d) || {}
  const initial = useMemo(() => ({
    sleep: cur.sleep ?? null, sq: cur.sq ?? null, energy: cur.energy ?? null, stress: cur.stress ?? null,
    steps: cur.steps ?? null, waist: cur.waist ?? null, note: cur.note ?? '',
  }), [])   // eslint-disable-line react-hooks/exhaustive-deps -- the day as the sheet opened on it
  const [v, setV] = useState(initial)
  const [more, setMore] = useState(cur.steps != null || cur.waist != null || !!cur.note)
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  // Only what was touched is written: an untouched field keeps whatever the other device or the
  // last edit put there, and nothing the person did not enter is stored as if they had.
  const save = () => {
    const patch = Object.fromEntries(Object.entries(v).filter(([k, x]) => (x ?? '') !== (initial[k] ?? '')))
    if (Object.keys(patch).length) update(s => { setHealth(s, d, patch) })
    close()
    toast(th('Saved'))
  }
  const remove = () => { update(s => { s.health = (s.health || []).filter(e => e.d !== d) }); close() }
  return <>
    <h3>{d === todayISO() ? th('How are you today?') : th('Check-in for {0}', fmtDate(d, true))}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{th('A few taps — a week of these says more than any one night.')}</div>

    <h4 className="sec">{th('Sleep last night')}</h4>
    {v.sleep == null
      ? <Button icon="moon" onClick={() => set('sleep', 7.5)}>{th('Enter hours slept')}</Button>
      : <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}><Stepper value={v.sleep} step={0.5} min={0} max={16} unit={th('h')} onChange={x => set('sleep', x)} /></div>
          <button className="iconbtn" aria-label={th('Clear')} onClick={() => set('sleep', null)}><Icon name="xmark" /></button>
        </div>}
    <h4 className="sec">{th('Sleep quality')}</h4>
    <Scale5 field="sq" value={v.sq} onChange={x => set('sq', x)} />
    <h4 className="sec">{th('Energy')}</h4>
    <Scale5 field="energy" value={v.energy} onChange={x => set('energy', x)} />
    <h4 className="sec">{th('Stress')}</h4>
    <Scale5 field="stress" value={v.stress} onChange={x => set('stress', x)} />

    {!more
      ? <Button variant="ghost" size="sm" icon="plus" onClick={() => setMore(true)} style={{ marginTop: 8 }}>{th('Steps, waist, note')}</Button>
      : <>
          <div className="grid2" style={{ marginTop: 12 }}>
            <label className="hfield"><span>{th('Steps')}</span>
              <NumberField className="field" value={v.steps} nullable decimal={false} onChange={x => set('steps', x)} placeholder="8000" /></label>
            <label className="hfield"><span>{th('Waist, cm')}</span>
              <NumberField className="field" value={v.waist} nullable onChange={x => set('waist', x)} placeholder="82" /></label>
          </div>
          <label className="hfield" style={{ marginTop: 10 }}><span>{th('Note')}</span>
            <TextArea rows={2} value={v.note} maxLength={500} onChange={e => set('note', e.target.value)} placeholder={th('Anything worth remembering')} /></label>
        </>}

    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{th('Save')}</Button>
    {cur.d && <><div style={{ height: 6 }} /><Button variant="ghost" className="dim" icon="trash" onClick={remove}>{th('Clear this day')}</Button></>}
  </>
}
export const checkInSheet = (d = todayISO()) => ui().openSheet(close => <CheckInSheet d={d} close={close} />)

/* ============================ food search ============================ */

// One line of a food list: name, brand, and what 100 g (or the logged portion) carries.
function FoodRow({ title, sub, right, onClick }) {
  return <button className="frow" onClick={onClick}>
    <span className="frow-m"><span className="frow-t">{title}</span>{sub && <span className="frow-s">{sub}</span>}</span>
    {right && <span className="frow-v">{right}</span>}
    <Icon name="plus" className="frow-c" />
  </button>
}

const per100 = f => `${fmtInt(f.kcal)} ${th('kcal')} · ${macroLine(f)} ${th('per 100 g')}`

function AddFoodSheet({ d, slot: slot0, close }) {
  const st = useStore(s => s.S)
  const [slot, setSlot] = useState(slot0 || (d === todayISO() ? slotForHour(new Date().getHours()) : 'l'))
  const [q, setQ] = useState('')
  const [online, setOnline] = useState({ state: 'idle', items: [] })   // idle | busy | done | error
  const l = lang()
  const recent = useMemo(() => recentFoods(st.meals, 25), [st.meals])
  const local = useMemo(() => (q.trim() ? searchFoods(q, { own: st.foods, base: BASE_FOODS, nameOf: f => baseName(f, l) }) : []), [q, st.foods, l])
  useEffect(() => { setOnline({ state: 'idle', items: [] }) }, [q])

  const after = () => close()
  const pickOwn = f => portionSheet({ food: f, fid: 'o:' + f.id, src: f.src === 'off' ? 'off' : 'own', d, slot, onDone: after })
  const pickBase = f => portionSheet({ food: baseAsFood(f, l), unit: f.u, fid: 'b:' + f.id, src: 'base', d, slot, onDone: after })
  const pickOff = f => portionSheet({ food: f, d, slot, src: 'off', fromOff: true, onDone: after })
  const pickRecent = m => {
    // A recent row whose food is still known opens on that food (its label may have been
    // corrected since); one that is not repeats the row's own numbers.
    if (m.fid?.startsWith('b:') && BASE_BY_ID.has(m.fid.slice(2))) return pickBase(BASE_BY_ID.get(m.fid.slice(2)))
    const own = m.fid?.startsWith('o:') && (st.foods || []).find(f => f.id === m.fid.slice(2))
    if (own) return portionSheet({ food: own, fid: m.fid, src: m.src, d, slot, g: m.g, onDone: after })
    if (!(m.g > 0)) {
      update(s => { s.meals = [...(s.meals || []), repeatRow(m, { d, slot, id: uid() })] })
      toast(th('Added: {0}', m.name)); close(); return
    }
    const k = 100 / m.g
    portionSheet({ food: { name: m.name, kcal: m.kcal * k, p: m.p * k, f: m.f * k, c: m.c * k }, fid: m.fid, src: m.src, d, slot, g: m.g, onDone: after })
  }
  const searchOnline = async () => {
    setOnline({ state: 'busy', items: [] })
    try { setOnline({ state: 'done', items: await searchProducts(q, { lang: l }) }) }
    catch (e) { setOnline({ state: 'error', items: [] }) }
  }

  return <>
    <h3 style={{ marginBottom: 10 }}>{th('Add food')}{d !== todayISO() ? ' · ' + fmtDate(d, true) : ''}</h3>
    <Segmented value={slot} onChange={setSlot} options={SLOTS.map(s => ({ value: s, label: th(SLOT_NAMES[s]) }))} />
    <div style={{ height: 10 }} />
    <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder={th('Search foods')} autoFocus={false} />
    <div className="row" style={{ gap: 8, margin: '10px 0 4px', flexWrap: 'wrap' }}>
      <Button size="sm" icon="camera" onClick={() => barcodeSheet({ d, slot, onDone: after })}>{th('Barcode')}</Button>
      <Button size="sm" icon="bolt" onClick={() => quickSheet({ d, slot, onDone: after })}>{th('Quick entry')}</Button>
      <Button size="sm" icon="plus" onClick={() => foodFormSheet({ initial: { name: q }, onSaved: f => pickOwn(f) })}>{th('New food')}</Button>
    </div>

    {!q.trim() && <>
      <h4 className="sec">{th('Recent')}</h4>
      {recent.length
        ? <div className="flist">{recent.map(m => <FoodRow key={m.id} title={m.name}
            sub={m.g > 0 ? `${fmtInt(m.g)} ${th('g')} · ${macroLine(m)}` : macroLine(m)} right={`${fmtInt(m.kcal)} ${th('kcal')}`} onClick={() => pickRecent(m)} />)}</div>
        : <div className="muted small">{th('Nothing logged yet. Search above — basics like buckwheat, eggs or cottage cheese are built in — or scan a barcode.')}</div>}
      {(st.foods || []).length > 0 && <>
        <h4 className="sec">{th('My foods')}</h4>
        <div className="flist">{[...st.foods].sort((a, b) => String(a.name).localeCompare(String(b.name), dateLocale())).map(f =>
          <FoodRow key={f.id} title={f.name} sub={(f.brand ? f.brand + ' · ' : '') + per100(f)} onClick={() => pickOwn(f)} />)}</div>
      </>}
    </>}

    {!!q.trim() && <>
      {local.length > 0 && <div className="flist" style={{ marginTop: 8 }}>{local.map(r => r.kind === 'own'
        ? <FoodRow key={r.key} title={r.food.name} sub={(r.food.brand ? r.food.brand + ' · ' : '') + per100(r.food)} onClick={() => pickOwn(r.food)} />
        : <FoodRow key={r.key} title={baseName(r.food, l)} sub={per100(r.food)} onClick={() => pickBase(r.food)} />)}</div>}
      {!local.length && <div className="muted small" style={{ margin: '10px 2px' }}>{th('Not among your foods or the basics.')}</div>}
      <h4 className="sec">{th('Open Food Facts')}</h4>
      {online.state === 'idle' && <Button size="sm" icon="globe" onClick={searchOnline}>{th('Search packaged products online')}</Button>}
      {online.state === 'busy' && <div className="muted small">{th('Searching…')}</div>}
      {online.state === 'error' && <div className="muted small">{th('Open Food Facts could not be reached. Check the connection and try again.')}</div>}
      {online.state === 'done' && (online.items.length
        ? <div className="flist">{online.items.map((f, i) => <FoodRow key={(f.code || '') + i} title={f.name} sub={(f.brand ? f.brand + ' · ' : '') + per100(f)} onClick={() => pickOff(f)} />)}</div>
        : <div className="muted small">{th('Nothing found there either — add it as a new food from the label.')}</div>)}
      {online.state !== 'idle' && <div className="dim small" style={{ marginTop: 6 }}>{th('Product data: Open Food Facts, openfoodfacts.org (ODbL).')}</div>}
      <AiFoodSection q={q} onPick={f => foodFormSheet({ initial: { ...f, src: 'ai' }, note: aiNote(f), onSaved: x => pickOwn(x) })} />
    </>}
  </>
}
const CONF_LABEL = { label: 'From the label', typical: 'Typical values', estimate: 'Rough estimate' }
const aiNote = f => [th('Found by the AI ({0}). Check the numbers against the package before saving.', th(CONF_LABEL[f.confidence] || 'Rough estimate').toLowerCase()), f.note].filter(Boolean).join(' ')

// The last resort, when nothing in the app or in Open Food Facts knows the food: the AI Coach's
// provider is asked for it (POST /api/coach/food). What comes back is a candidate, shown with how
// sure the model is; it becomes one of the person's foods only through the form, where every
// number is in front of them before it is saved.
function AiFoodSection({ q, onPick }) {
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const [st, setSt] = useState({ state: 'idle' })   // idle | busy | done | none | error
  useEffect(() => { setSt({ state: 'idle' }) }, [q])
  const can = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode }) && !DEMO && !(MOBILE && coachMode === 'byok')
  const ask = async () => {
    setSt({ state: 'busy' })
    try {
      const r = await lookupFood(q)
      if (r?.ok && r.food) setSt({ state: 'done', food: r.food, web: !!r.web })
      else if (r?.ok && r.found === false) setSt({ state: 'none', note: r.note })
      else setSt({ state: 'error', code: r?.errorClass })
    } catch (e) {
      setSt({ state: 'error', msg: e?.data?.code === 'consent' ? th('Open Plan → Coach once and agree to it — then the AI can look foods up.') : (e?.data?.error || e?.message) })
    }
  }
  return <>
    <h4 className="sec">{th('AI search')}</h4>
    {!can && <div className="muted small">{th('Not found anywhere? With the AI Coach set up on your server, the AI can look the food up for you.')}</div>}
    {can && st.state === 'idle' && <Button size="sm" icon="sparkles" onClick={ask}>{th('Find it with AI')}</Button>}
    {can && st.state === 'busy' && <div className="muted small">{th('The AI is looking it up — this can take up to a minute…')}</div>}
    {can && st.state === 'none' && <div className="muted small">{st.note || th('The AI could not tell what food this is. Add a brand, a variant or what is in it.')}</div>}
    {can && st.state === 'error' && <div className="muted small">{st.msg || th('The AI lookup did not work this time. Try again, or add the food by hand.')}</div>}
    {can && st.state === 'done' && <div className="card" style={{ background: 'var(--surface-2)', marginTop: 4 }}>
      <div className="row between" style={{ gap: 8 }}>
        <b>{st.food.name}</b>
        <span className={'tag' + (st.food.confidence === 'label' ? ' acc' : '')}>{th(CONF_LABEL[st.food.confidence] || 'Rough estimate')}</span>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>{(st.food.brand ? st.food.brand + ' · ' : '') + per100(st.food)}</div>
      {st.food.note && <div className="small" style={{ marginTop: 6 }}>{st.food.note}</div>}
      {st.web && <div className="dim small" style={{ marginTop: 4 }}>{th('Web search was available to the AI for this answer.')}</div>}
      <div style={{ height: 10 }} />
      <Button size="sm" variant="primary" icon="check" onClick={() => onPick(st.food)}>{th('Check and save')}</Button>
    </div>}
  </>
}

export const addFoodSheet = (opts = {}) => ui().openSheet(close => <AddFoodSheet d={opts.d || todayISO()} slot={opts.slot} close={close} />)

/* ============================ portion ============================ */

// Save a product found on Open Food Facts into the person's foods, once per barcode, so the next
// time it is a local, offline pick. Returns the stored food.
function keepOffFood(s, f) {
  s.foods = Array.isArray(s.foods) ? s.foods : []
  const have = f.code
    ? s.foods.find(x => x.code === f.code)
    : s.foods.find(x => x.src === 'off' && !x.code && x.name === f.name && (x.brand || '') === (f.brand || ''))
  if (have) return have
  const food = { id: uid(), t: Date.now(), name: f.name, ...(f.brand ? { brand: f.brand } : {}), ...(f.code ? { code: f.code } : {}),
    kcal: f.kcal, p: f.p, f: f.f, c: f.c, ...(f.srv ? { srv: f.srv } : {}), src: 'off' }
  s.foods.push(food)
  return food
}

function PortionSheet({ food, unit, fid, src, d, slot, g: g0, fromOff, onDone, close }) {
  const srv = unit?.[0] || food.srv || null
  const [g, setG] = useState(g0 || srv || 100)
  const now = portion(food, g)
  const presets = [...new Set([srv, 50, 100, 150, 200, 250, 300].filter(x => x > 0))].slice(0, 6)
  const add = () => {
    if (!(g > 0)) { toast(th('Enter the grams')); return }
    update(s => {
      let id = fid, source = src
      if (fromOff) { const kept = keepOffFood(s, food); id = 'o:' + kept.id; source = 'off' }
      s.meals = [...(s.meals || []), mealRow({ food, g, d, slot, fid: id, src: source, id: uid() })]
    })
    close()
    if (onDone) onDone()
    toast(th('Added: {0}', food.name))
  }
  return <>
    <h3 style={{ marginBottom: 2 }}>{food.name}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{(food.brand ? food.brand + ' · ' : '') + per100(food)}</div>
    <Stepper value={g} step={10} min={0} max={3000} unit={th('g')} decimal={false} onChange={setG} />
    <div className="chips" style={{ margin: '10px 0' }}>
      {presets.map(x => <button key={x} className={'chip' + (x === g ? ' on' : '')} onClick={() => setG(x)}>
        {x === srv && unit ? unit[1][lang()] || unit[1].en : `${x} ${th('g')}`}
      </button>)}
    </div>
    <div className="hsum">
      <div><b>{fmtInt(now.kcal)}</b><span>{th('kcal')}</span></div>
      <div><b>{fmt1(now.p)}</b><span>{th('Protein')}</span></div>
      <div><b>{fmt1(now.f)}</b><span>{th('Fat')}</span></div>
      <div><b>{fmt1(now.c)}</b><span>{th('Carbs')}</span></div>
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={add}>{th('Add to {0}', th(SLOT_NAMES[slot]).toLowerCase())}</Button>
  </>
}
export const portionSheet = opts => ui().openSheet(close => <PortionSheet {...opts} close={close} />)

/* ============================ a food of one's own ============================ */

function FoodFormSheet({ initial = {}, note, onSaved, close }) {
  const [f, setF] = useState(() => ({ name: initial.name || '', brand: initial.brand || '', code: initial.code || '',
    kcal: initial.kcal ?? null, p: initial.p ?? null, f: initial.f ?? null, c: initial.c ?? null, srv: initial.srv ?? null }))
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const implied = kcalOf(f)
  const save = () => {
    const kcal = f.kcal == null || f.kcal === 0 ? implied : f.kcal
    const food = { name: f.name.trim().slice(0, 120), kcal, p: f.p || 0, f: f.f || 0, c: f.c || 0 }
    if (!validFood(food)) { toast(th('Give it a name and the values per 100 g')); return }
    let saved = null
    update(s => {
      s.foods = Array.isArray(s.foods) ? s.foods : []
      const existing = initial.id && s.foods.find(x => x.id === initial.id)
      const row = { ...(existing || { id: uid(), src: initial.src === 'ai' ? 'ai' : 'own' }), ...food, t: Date.now() }
      if (f.brand.trim()) row.brand = f.brand.trim().slice(0, 60); else delete row.brand
      const code = cleanCode(f.code); if (code) row.code = code; else delete row.code
      if (f.srv > 0) row.srv = Math.round(f.srv); else delete row.srv
      // Replaced, not merged into: a brand or barcode cleared in the form has to be gone.
      if (existing) s.foods = s.foods.map(x => (x === existing ? row : x)); else s.foods.push(row)
      saved = { ...row }
    })
    close()
    if (onSaved) onSaved(saved); else toast(th('Saved'))
  }
  const remove = () => { update(s => { s.foods = (s.foods || []).filter(x => x.id !== initial.id) }); close() }
  return <>
    <h3>{initial.id ? th('Edit food') : th('New food')}</h3>
    {note && <div className="muted small" style={{ marginBottom: 10 }}>{note}</div>}
    <label className="hfield"><span>{th('Name')}</span><TextField value={f.name} onChange={e => set('name', e.target.value)} placeholder={th('e.g. Cottage cheese 5% Savushkin')} /></label>
    <div className="grid2" style={{ marginTop: 10 }}>
      <label className="hfield"><span>{th('Brand')}</span><TextField value={f.brand} onChange={e => set('brand', e.target.value)} /></label>
      <label className="hfield"><span>{th('Barcode')}</span><TextField value={f.code} inputMode="numeric" onChange={e => set('code', e.target.value)} /></label>
    </div>
    <h4 className="sec">{th('Per 100 g, from the label')}</h4>
    <div className="grid2">
      <label className="hfield"><span>{th('kcal')}</span><NumberField className="field" value={f.kcal} nullable onChange={v => set('kcal', v)} placeholder={implied ? String(implied) : ''} /></label>
      <label className="hfield"><span>{th('Protein, g')}</span><NumberField className="field" value={f.p} nullable onChange={v => set('p', v)} /></label>
      <label className="hfield"><span>{th('Fat, g')}</span><NumberField className="field" value={f.f} nullable onChange={v => set('f', v)} /></label>
      <label className="hfield"><span>{th('Carbs, g')}</span><NumberField className="field" value={f.c} nullable onChange={v => set('c', v)} /></label>
    </div>
    <label className="hfield" style={{ marginTop: 10 }}><span>{th('Usual portion, g (optional)')}</span><NumberField className="field" value={f.srv} nullable decimal={false} onChange={v => set('srv', v)} /></label>
    <div className="dim small" style={{ marginTop: 6 }}>{th('Leave kcal empty to work it out from the macros.')}</div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{th('Save')}</Button>
    {initial.id && <><div style={{ height: 6 }} /><Button variant="ghost" className="dim" icon="trash" onClick={remove}>{th('Delete food')}</Button></>}
  </>
}
export const foodFormSheet = (opts = {}) => ui().openSheet(close => <FoodFormSheet {...opts} close={close} />)

/* ============================ quick entry ============================ */

function QuickSheet({ d, slot, onDone, close }) {
  const [v, setV] = useState({ name: '', kcal: null, p: null, f: null, c: null })
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const save = () => {
    const name = v.name.trim() || th('Quick entry')
    if (!(v.kcal > 0) && !(v.p > 0 || v.f > 0 || v.c > 0)) { toast(th('Enter at least the calories')); return }
    update(s => { s.meals = [...(s.meals || []), quickRow({ ...v, name, d, slot, id: uid() })] })
    close(); if (onDone) onDone()
    toast(th('Added: {0}', name))
  }
  return <>
    <h3>{th('Quick entry')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{th('For a meal out or anything without a label: the totals as eaten, as best you can tell.')}</div>
    <label className="hfield"><span>{th('What was it')}</span><TextField value={v.name} onChange={e => set('name', e.target.value)} placeholder={th('e.g. Business lunch')} /></label>
    <div className="grid2" style={{ marginTop: 10 }}>
      <label className="hfield"><span>{th('kcal')}</span><NumberField className="field" value={v.kcal} nullable decimal={false} onChange={x => set('kcal', x)} /></label>
      <label className="hfield"><span>{th('Protein, g')}</span><NumberField className="field" value={v.p} nullable onChange={x => set('p', x)} /></label>
      <label className="hfield"><span>{th('Fat, g')}</span><NumberField className="field" value={v.f} nullable onChange={x => set('f', x)} /></label>
      <label className="hfield"><span>{th('Carbs, g')}</span><NumberField className="field" value={v.c} nullable onChange={x => set('c', x)} /></label>
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{th('Add')}</Button>
  </>
}
export const quickSheet = opts => ui().openSheet(close => <QuickSheet {...opts} close={close} />)

/* ============================ a logged row ============================ */

function MealRowSheet({ row, close }) {
  const [g, setG] = useState(row.g || 0)
  const [slot, setSlot] = useState(row.slot)
  const scaled = row.g > 0 ? { kcal: Math.round(row.kcal * g / row.g), p: row.p * g / row.g, f: row.f * g / row.g, c: row.c * g / row.g } : row
  const save = () => {
    update(s => {
      const m = (s.meals || []).find(x => x.id === row.id)
      if (!m) return
      if (row.g > 0 && g > 0 && g !== row.g) {
        const k = g / row.g
        m.kcal = Math.round(m.kcal * k); m.p = Math.round(m.p * k * 10) / 10; m.f = Math.round(m.f * k * 10) / 10; m.c = Math.round(m.c * k * 10) / 10
        m.g = Math.round(g)
      }
      m.slot = slot
      m.t = Date.now()
    })
    close()
  }
  const remove = () => { update(s => { s.meals = (s.meals || []).filter(x => x.id !== row.id) }); close() }
  return <>
    <h3 style={{ marginBottom: 2 }}>{row.name}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{fmtDate(row.d, true)}</div>
    <Segmented value={slot} onChange={setSlot} options={SLOTS.map(s => ({ value: s, label: th(SLOT_NAMES[s]) }))} />
    {row.g > 0 && <><div style={{ height: 12 }} /><Stepper value={g} step={10} min={0} max={3000} unit={th('g')} decimal={false} onChange={setG} /></>}
    <div className="hsum" style={{ marginTop: 12 }}>
      <div><b>{fmtInt(scaled.kcal)}</b><span>{th('kcal')}</span></div>
      <div><b>{fmt1(scaled.p)}</b><span>{th('Protein')}</span></div>
      <div><b>{fmt1(scaled.f)}</b><span>{th('Fat')}</span></div>
      <div><b>{fmt1(scaled.c)}</b><span>{th('Carbs')}</span></div>
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{th('Save')}</Button>
    <div style={{ height: 6 }} />
    <Button variant="ghost" className="dim" icon="trash" onClick={remove} style={{ color: 'var(--red)' }}>{th('Remove')}</Button>
  </>
}
export const mealRowSheet = row => ui().openSheet(close => <MealRowSheet row={row} close={close} />)

/* ============================ barcode ============================ */

// The camera for a product barcode. Same shape as components/CameraScan.jsx (the gym card's QR
// scanner), with the retail decoder; a photo and typing the digits are the fallbacks.
function ProductScan({ onCode, close }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('')
  // The handler through a ref: the effect below owns the camera, and restarting it whenever the
  // sheet re-renders (a toast, a timer tick) would blink the stream off and on.
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  useEffect(() => {
    let stream = null, timer = null, done = false
    const stop = () => { done = true; if (timer) clearTimeout(timer); if (stream) stream.getTracks().forEach(tr => tr.stop()) }
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError('unavailable'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      } catch (e) { setError(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable'); return }
      if (done) { stream.getTracks().forEach(tr => tr.stop()); return }
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      try { await v.play() } catch (e) { /* the loop waits for frames */ }
      const tick = async () => {
        if (done) return
        if (v.readyState >= 2) {
          let code = null
          try { code = await decodeProductCode(v) } catch (e) { /* keep trying */ }
          if (code && !done) { stop(); onCodeRef.current(code); return }
        }
        timer = setTimeout(tick, 250)
      }
      tick()
    })()
    return stop
  }, [])
  const onFile = async ev => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    const code = await decodeProductFile(file).catch(() => null)
    if (code) onCode(code); else toast(th('No barcode found in that picture'))
  }
  return <>
    <h3>{th('Scan a barcode')}</h3>
    {error
      ? <div className="muted small" style={{ marginBottom: 12 }}>{error === 'denied' ? th('Camera access was denied — allow it in Settings, or take a photo or type the digits.') : th('No live camera here — take a photo of the barcode or type the digits.')}</div>
      : <div className="cam-wrap wide"><video ref={videoRef} playsInline muted autoPlay /><div className="cam-line" aria-hidden="true" /></div>}
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <Button size="sm" icon="image" onClick={() => fileRef.current?.click()}>{th('Photo')}</Button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <TextField value={typed} inputMode="numeric" placeholder={th('Digits under the barcode')} onChange={e => setTyped(e.target.value)} />
      <Button size="sm" onClick={() => { const c = cleanCode(typed); if (c) onCode(c); else toast(th('That is not a product barcode')) }}>{th('Find')}</Button>
    </div>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{th('Cancel')}</Button>
  </>
}

export function barcodeSheet({ d, slot, onDone }) {
  const h = ui().openSheet(close => <ProductScan close={close} onCode={async raw => {
    const code = cleanCode(raw) || raw
    close()
    const st = useStore.getState().S
    const own = (st.foods || []).find(f => f.code && cleanCode(f.code) === code)
    if (own) { portionSheet({ food: own, fid: 'o:' + own.id, src: own.src || 'own', d, slot, onDone }); return }
    toast(th('Looking up {0}…', code))
    let r
    try { r = await lookupBarcode(code, { lang: lang() }) }
    catch (e) {
      foodFormSheet({ initial: { code }, note: th('Open Food Facts could not be reached. Enter the label by hand — it is saved for next time.'),
        onSaved: f => portionSheet({ food: f, fid: 'o:' + f.id, src: 'own', d, slot, onDone }) })
      return
    }
    if (r.missing || r.incomplete) {
      foodFormSheet({ initial: { code, name: r.name || '' },
        note: r.incomplete ? th('Open Food Facts knows this product but not its nutrition. Enter it from the label — it is saved for next time.')
          : th('This product is not in Open Food Facts yet. Enter it from the label — it is saved for next time. You can also add it for everyone at {0}', productUrl(code)),
        onSaved: f => portionSheet({ food: f, fid: 'o:' + f.id, src: 'own', d, slot, onDone }) })
      return
    }
    portionSheet({ food: r, d, slot, fromOff: true, onDone })
  }} />)
  return h
}

/* ============================ goals ============================ */

function GoalsSheet({ close }) {
  const st = useStore(s => s.S)
  const nutri = st.nutri || {}
  const g0 = nutri.goals || {}
  const [g, setG] = useState({ kcal: g0.kcal ?? null, p: g0.p ?? null, f: g0.f ?? null, c: g0.c ?? null })
  const bw = lastBW(st)
  const bwKg = bw ? Math.round(convertBodyWeight(bw.w, st.unit, 'kg') * 10) / 10 : null
  const b0 = nutri.body || {}
  const [b, setB] = useState({ sex: b0.sex || (st.body === 'female' ? 'female' : 'male'), age: b0.age ?? null, heightCm: b0.heightCm ?? null,
    weightKg: bwKg ?? b0.weightKg ?? null, activity: b0.activity ?? 1.55, goal: b0.goal || 'keep' })
  const [calc, setCalc] = useState(!nutri.goals)
  const sugg = suggestGoals(b)
  const set = (k, v) => setG(o => ({ ...o, [k]: v }))
  const setBody = (k, v) => setB(o => ({ ...o, [k]: v }))
  const save = () => {
    const goals = Object.fromEntries(['kcal', 'p', 'f', 'c'].map(k => [k, g[k] > 0 ? Math.round(g[k]) : null]))
    update(s => { s.nutri = { ...(s.nutri || {}), goals: Object.values(goals).some(Boolean) ? goals : null, body: b } })
    close(); toast(th('Goals saved'))
  }
  return <>
    <h3>{th('Daily goals')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{th('The screen reads them as a weekly average. One day over or under is just a day.')}</div>
    <div className="grid2">
      <label className="hfield"><span>{th('kcal')}</span><NumberField className="field" value={g.kcal} nullable decimal={false} onChange={v => set('kcal', v)} /></label>
      <label className="hfield"><span>{th('Protein, g')}</span><NumberField className="field" value={g.p} nullable decimal={false} onChange={v => set('p', v)} /></label>
      <label className="hfield"><span>{th('Fat, g')}</span><NumberField className="field" value={g.f} nullable decimal={false} onChange={v => set('f', v)} /></label>
      <label className="hfield"><span>{th('Carbs, g')}</span><NumberField className="field" value={g.c} nullable decimal={false} onChange={v => set('c', v)} /></label>
    </div>
    {!calc
      ? <Button size="sm" variant="ghost" icon="sparkles" style={{ marginTop: 8 }} onClick={() => setCalc(true)}>{th('Work them out for me')}</Button>
      : <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
          <Segmented value={b.sex} onChange={v => setBody('sex', v)} options={[{ value: 'male', label: th('Male') }, { value: 'female', label: th('Female') }]} />
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="hfield"><span>{th('Age')}</span><NumberField className="field" value={b.age} nullable decimal={false} onChange={v => setBody('age', v)} /></label>
            <label className="hfield"><span>{th('Height, cm')}</span><NumberField className="field" value={b.heightCm} nullable decimal={false} onChange={v => setBody('heightCm', v)} /></label>
            <label className="hfield"><span>{th('Weight, kg')}</span><NumberField className="field" value={b.weightKg} nullable onChange={v => setBody('weightKg', v)} /></label>
          </div>
          <h4 className="sec">{th('Activity')}</h4>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {ACTIVITY.map(a => <button key={a.k} className={'chip' + (b.activity === a.k ? ' on' : '')} onClick={() => setBody('activity', a.k)}>{th(a.label)}</button>)}
          </div>
          <h4 className="sec">{th('Goal')}</h4>
          <Segmented value={b.goal} onChange={v => setBody('goal', v)} options={[{ value: 'lose', label: th('Lose fat') }, { value: 'keep', label: th('Maintain') }, { value: 'gain', label: th('Gain muscle') }]} />
          {sugg
            ? <>
                <div className="hsum" style={{ marginTop: 12 }}>
                  <div><b>{fmtInt(sugg.kcal)}</b><span>{th('kcal')}</span></div>
                  <div><b>{sugg.p}</b><span>{th('Protein')}</span></div>
                  <div><b>{sugg.f}</b><span>{th('Fat')}</span></div>
                  <div><b>{sugg.c}</b><span>{th('Carbs')}</span></div>
                </div>
                <div className="dim small" style={{ marginTop: 6 }}>{th('Mifflin–St Jeor, protein 1.8 g per kg. A starting point: adjust after 2–3 weeks by how your weekly average weight moves.')}</div>
                <div style={{ height: 8 }} />
                <Button size="sm" onClick={() => setG({ ...sugg })}>{th('Use these')}</Button>
              </>
            : <div className="muted small" style={{ marginTop: 10 }}>{th('Enter age, height and weight.')}</div>}
        </div>}
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{th('Save')}</Button>
  </>
}
export const goalsSheet = () => ui().openSheet(close => <GoalsSheet close={close} />)
