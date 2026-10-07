// Steps and sleep from Apple Health, in Settings (docs/dev/HEALTH_IMPORT.md): the import key —
// made, shown once, turned off — the last import, and how to build the Shortcut that sends them.
import { useEffect, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { copyText } from '../lib/clipboard.js'
import { th, nSteps } from '../lib/health-i18n.js'
import { fmtDate } from '../lib/format.js'
import { dateLocale } from '../lib/i18n.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'
import { Button, Row } from './ui.jsx'

const toast = m => useUI.getState().toast(m)
const hm = h => { const m = Math.round(Number(h) * 60); return th('{0} h {1} min', Math.floor(m / 60), m % 60) }
const at = ms => new Date(ms).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** What the last import wrote, in a line: "8,123 steps · slept 7 h 15 min". */
export function lastImportText(last) {
  const parts = []
  for (const w of last || []) {
    if (w.steps != null) parts.push(nSteps(w.steps))
    if (w.sleep != null) parts.push(th('slept {0}', hm(w.sleep)))
  }
  return parts.join(' · ')
}

async function copy(text) { toast((await copyText(text)) ? th('Copied') : th('Could not copy')) }

export default function HealthImport() {
  const [st, setSt] = useState(null)        // the key's state, from the server
  const [fresh, setFresh] = useState(null)  // { key, url }, right after it was made: shown once
  const [busy, setBusy] = useState(false)
  const load = () => api('/api/health/import-key').then(setSt).catch(() => setSt({ failed: true }))
  useEffect(() => { load() }, [])

  const make = async () => {
    setBusy(true)
    try {
      const r = await api('/api/health/import-key', { method: 'POST', body: '{}' })
      setFresh({ key: r.key, url: r.url })
      setSt(r)
    } catch (e) { toast(e.message || th('Could not make a key')) }
    setBusy(false)
  }
  const renew = () => confirmSheet({
    title: th('Make a new key?'), message: th('The Shortcut with the old key stops working until you put the new one in.'),
    confirmText: th('New key'), onConfirm: make
  })
  const off = () => confirmSheet({
    title: th('Turn the import off?'), message: th('The key stops working. Steps and sleep already imported stay in your log.'),
    confirmText: th('Turn off'), danger: true,
    onConfirm: async () => {
      try { await api('/api/health/import-key', { method: 'DELETE' }); setFresh(null); load() } catch (e) { toast(e.message) }
    }
  })

  const status = !st ? '…'
    : st.failed ? th('The server could not be reached.')
      : !st.exists ? th('Off')
        : st.lastUsed ? th('Last import {0}: {1}', at(st.lastUsed), lastImportText(st.last))
          : th('Key made {0} · nothing imported yet', fmtDate(new Date(st.created).toISOString().slice(0, 10), true))
  const url = fresh?.url || st?.url || ''
  return <>
    <Row icon="download" iconTint="var(--pink, #ff375f)" title={th('Steps and sleep from Apple Health')} subtitle={status} />
    {fresh && <div className="himp-key">
      <div className="small muted">{th('The address')}</div>
      <div className="himp-v"><code>{fresh.url}</code><button className="iconbtn" aria-label={th('Copy the address')} onClick={() => copy(fresh.url)}><Icon name="clipboard" /></button></div>
      <div className="small muted" style={{ marginTop: 8 }}>{th('The key — shown only now')}</div>
      <div className="himp-v"><code>{fresh.key}</code><button className="iconbtn" aria-label={th('Copy the key')} onClick={() => copy(fresh.key)}><Icon name="clipboard" /></button></div>
    </div>}
    <div className="himp-actions">
      {st && !st.failed && !st.exists && <Button size="sm" variant="primary" icon="key" disabled={busy} onClick={make}>{th('Make a key')}</Button>}
      {st?.exists && <Button size="sm" icon="key" disabled={busy} onClick={renew}>{th('New key')}</Button>}
      <Button size="sm" icon="info" onClick={() => recipeSheet(url, fresh?.key)}>{th('How to set up the Shortcut')}</Button>
      {st?.exists && <Button size="sm" variant="ghost" className="dim" onClick={off}>{th('Turn off')}</Button>}
    </div>
  </>
}

/* ---------------------------------- the recipe ---------------------------------- */

function Recipe({ url, keyText }) {
  const step = (n, title, body) => <div className="himp-step"><span className="himp-n">{n}</span><div><b>{title}</b><div className="small muted">{body}</div></div></div>
  return <>
    <h3>{th('The Shortcut, step by step')}</h3>
    <p className="small muted">{th('Once, in the Shortcuts app on the iPhone. Then it runs by itself every morning: yesterday\'s steps and last night\'s sleep.')}</p>
    {step(1, th('A new shortcut'), th('Shortcuts → + → name it "openGym: steps and sleep".'))}
    {step(2, th('Yesterday\'s steps'), th('Find Health Samples: type Steps, Start Date is yesterday. Then Calculate Statistics: Sum.'))}
    {step(3, th('Last night\'s sleep'), th('Find Health Samples: type Sleep Analysis, Start Date is in the last 1 day, Value is not In Bed and not Awake. Then Get Details of Health Samples: Duration, Calculate Statistics: Sum, and Convert Measurement to hours.'))}
    {step(4, th('Today\'s date'), th('Current Date → Format Date: Custom, yyyy-MM-dd.'))}
    {step(5, th('Sending it'), <>
      {th('Get Contents of URL: the address below, method POST. Header Authorization with the value "Bearer " and the key. Request body JSON: today (Text) = the date, steps (Number) = the steps, sleep (Number) = the sleep.')}
      <div className="himp-v" style={{ marginTop: 6 }}><code>{url || '…'}</code>{url && <button className="iconbtn" aria-label={th('Copy the address')} onClick={() => copy(url)}><Icon name="clipboard" /></button>}</div>
      {keyText && <div className="himp-v"><code>{'Bearer ' + keyText}</code><button className="iconbtn" aria-label={th('Copy the key')} onClick={() => copy('Bearer ' + keyText)}><Icon name="clipboard" /></button></div>}
    </>)}
    {step(6, th('Check it'), th('Add Show Result and run the shortcut once: the answer lists what was written. If sleep came out in minutes, send it as sleepMinutes instead of sleep.'))}
    {step(7, th('Every morning'), th('Automation → + → Time of Day, 09:00, daily → Run Immediately → Run Shortcut: the one above.'))}
    {step(8, th('Reaching the server'), th('The phone has to reach this server when the automation runs: keep Tailscale connected, or turn on its VPN On Demand.'))}
  </>
}
export const recipeSheet = (url, keyText) => useUI.getState().openSheet(() => <Recipe url={url} keyText={keyText} />)
