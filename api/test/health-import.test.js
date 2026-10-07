/* Steps and sleep from Apple Health (docs/dev/HEALTH_IMPORT.md): the import key, which can do one
   thing and is never a session, and the import, which writes days of the health log the way a
   phone would merge them. The routes run on a real server.js in a child, like the password suite. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import {
  BACKFILL_MAX_DAYS, IMPORT_KEY_PREFIX, applyHealthImport, createImportKey, hashImportKey, importKeyStatus,
  noteImport, revokeImportKey, userOfImportKey,
} from '../health-import.js';

const iso = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test('a key is random, kept only as a hash, one per profile, and found by its owner only', () => {
  const db = {};
  const { key } = createImportKey(db, 'u1', 1000);
  assert.ok(key.startsWith(IMPORT_KEY_PREFIX) && key.length > 30);
  assert.equal(db.importKeys.length, 1);
  assert.equal(db.importKeys[0].h, hashImportKey(key));
  assert.ok(!JSON.stringify(db).includes(key));
  assert.equal(userOfImportKey(db, key), 'u1');
  assert.equal(userOfImportKey(db, key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A')), null);
  assert.equal(userOfImportKey(db, 'not-a-key'), null);
  assert.equal(userOfImportKey(db, IMPORT_KEY_PREFIX + 'x'.repeat(200)), null);
  const second = createImportKey(db, 'u1', 2000).key;
  assert.equal(db.importKeys.length, 1, 'a new key replaces the old one');
  assert.equal(userOfImportKey(db, key), null);
  assert.equal(userOfImportKey(db, second), 'u1');
  createImportKey(db, 'u2');
  assert.deepEqual(importKeyStatus(db, 'u1'), { exists: true, created: 2000, lastUsed: null, last: null });
  noteImport(db, 'u1', [{ d: '2026-10-07', steps: 8123 }], 3000);
  assert.deepEqual(importKeyStatus(db, 'u1').last, [{ d: '2026-10-07', steps: 8123 }]);
  assert.equal(revokeImportKey(db, 'u1'), true);
  assert.equal(revokeImportKey(db, 'u1'), false);
  assert.deepEqual(importKeyStatus(db, 'u1'), { exists: false });
  assert.equal(userOfImportKey(db, second), null);
  assert.equal(db.importKeys.length, 1, 'the other profile keeps its key');
});

test('the morning import: yesterday\'s steps, and the night that ended today', () => {
  const S = { health: [{ d: iso(-1), energy: 4, t: 1 }, { d: iso(-3), sleep: 6, t: 1 }] };
  const now = Date.now();
  const r = applyHealthImport(S, { today: iso(0), steps: 8123, sleep: 7.3 }, now);
  assert.deepEqual(r, { ok: true, wrote: [{ d: iso(-1), steps: 8123 }, { d: iso(0), sleep: 7.25 }] });
  assert.deepEqual(S.health, [
    { d: iso(-3), sleep: 6, t: 1 },
    { d: iso(-1), energy: 4, t: now, steps: 8123 },
    { d: iso(0), sleep: 7.25, t: now },
  ]);
});

test('numbers as a phone in a Russian locale sends them, and sleep in minutes', () => {
  const S = {};
  assert.deepEqual(applyHealthImport(S, { today: iso(0), steps: '8 123', sleep: '7,25' }).wrote, [{ d: iso(-1), steps: 8123 }, { d: iso(0), sleep: 7.25 }]);
  assert.deepEqual(applyHealthImport(S, { today: iso(0), steps: '8 124' }).wrote, [{ d: iso(-1), steps: 8124 }]);
  assert.deepEqual(applyHealthImport(S, { today: iso(0), sleepMinutes: 445 }).wrote, [{ d: iso(0), sleep: 7.5 }]);
})

test('refuses what is not a day of the log, rather than clamping it', () => {
  const S = { health: [] };
  const bad = body => applyHealthImport(S, body).error;
  assert.match(bad({ today: iso(0), steps: 250000 }), /steps must be between 0 and 200000/);
  assert.match(bad({ today: iso(0), sleep: 25 }), /sleep must be between 0 and 16/);
  assert.match(bad({ today: iso(0), steps: 'many' }), /steps must be a number/);
  assert.match(bad({ today: iso(0) }), /nothing to write/);
  assert.match(bad({ steps: 100 }), /today must be/);
  assert.match(bad({ today: '2026-02-30', steps: 100 }), /today must be/);
  assert.match(bad({ today: iso(-5), steps: 100 }), /too far/);
  assert.match(bad(null), /JSON object/);
  assert.match(bad([1]), /JSON object/);
  assert.deepEqual(S.health, [], 'nothing written by a refusal');
});

test('a backfill of several days, within its limits', () => {
  const S = {};
  const r = applyHealthImport(S, { days: [{ d: iso(-3), steps: 9000, sleep: '6,5' }, { d: iso(-2), sleepMinutes: 420 }] });
  assert.deepEqual(r.wrote, [{ d: iso(-3), steps: 9000 }, { d: iso(-3), sleep: 6.5 }, { d: iso(-2), sleep: 7 }]);
  assert.deepEqual(S.health.map(e => [e.d, e.steps, e.sleep]), [[iso(-3), 9000, 6.5], [iso(-2), undefined, 7]]);
  assert.match(applyHealthImport({}, { days: [] }).error, /1 to 14/);
  assert.match(applyHealthImport({}, { days: Array.from({ length: BACKFILL_MAX_DAYS + 1 }, (_, i) => ({ d: iso(-i - 1), steps: 1 })) }).error, /1 to 14/);
  assert.match(applyHealthImport({}, { days: [{ d: iso(-90), steps: 1 }] }).error, /within the last 60 days/);
  assert.match(applyHealthImport({}, { days: [{ d: 'yesterday', steps: 1 }] }).error, /days\[0\]\.d/);
});

/* ---------- the routes, on a real server ---------- */

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ORIGIN = 'http://localhost:8080';
const mintSession = (uid, sv = 0) => {
  const payload = `${uid}:${Date.now() + 86400000}:${sv}`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};

async function startServer(t, { state = { _rev: 3, health: [{ d: iso(-1), energy: 4, t: 1 }] } } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-import-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: [{ id: 'u1', name: 'Ana', created: new Date().toISOString() }], creds: [], subs: [], invites: [] }));
  if (state) fs.writeFileSync(path.join(dataDir, 'state-u1.json'), JSON.stringify(state));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', TRUST_PROXY: '1', INVITE_ONLY: '', ADMIN_UIDS: '', AUDIT_LOG: '1' }
  });
  const h = { log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  const cookie = `gymsid=${mintSession('u1')}`;
  // The app, from its own page.
  h.app = async (method, p, body) => {
    const r = await fetch(api + p, { method, headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', Cookie: cookie }, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  // A Shortcuts automation: no cookie, no origin, the key in the header.
  h.shortcut = async (key, body, ip = '198.51.100.7') => {
    const r = await fetch(api + '/api/health/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Forwarded-For': ip }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  h.raw = (p, headers) => fetch(api + p, { headers }).then(r => r.status);
  h.state = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state-u1.json'), 'utf8'));
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  h.audit = () => { try { return fs.readFileSync(path.join(dataDir, 'audit.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } };
  return h;
}

test('the profile makes a key, the phone imports with it, and the revision moves', async t => {
  const h = await startServer(t);
  assert.deepEqual(await h.app('GET', '/api/health/import-key'), { status: 200, body: { exists: false, url: ORIGIN + '/api/health/import' } });
  const made = await h.app('POST', '/api/health/import-key');
  assert.equal(made.status, 200);
  assert.ok(made.body.key.startsWith(IMPORT_KEY_PREFIX));
  assert.equal(made.body.url, ORIGIN + '/api/health/import');
  assert.ok(!JSON.stringify(h.db()).includes(made.body.key), 'only its hash is kept');
  assert.ok(h.audit().some(e => e.ev === 'auth.import.create' && e.uid === 'u1'));

  const r = await h.shortcut(made.body.key, { today: iso(0), steps: '8 123', sleep: '7,25' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, wrote: [{ d: iso(-1), steps: 8123 }, { d: iso(0), sleep: 7.25 }], rev: 4 });
  const S = h.state();
  assert.equal(S._rev, 4);
  assert.deepEqual(S.health.find(e => e.d === iso(-1)), { d: iso(-1), energy: 4, t: S.health.find(e => e.d === iso(-1)).t, steps: 8123 });
  assert.equal((await h.app('GET', '/api/data/rev')).body.rev, 4, 'the phone sees the new revision');
  const status = (await h.app('GET', '/api/health/import-key')).body;
  assert.ok(status.lastUsed > 0);
  assert.deepEqual(status.last, r.body.wrote);
});

test('a wrong key is refused, and a key is never a session', async t => {
  const h = await startServer(t);
  const { key } = (await h.app('POST', '/api/health/import-key')).body;
  assert.equal((await h.shortcut(IMPORT_KEY_PREFIX + 'wrong', { today: iso(0), steps: 1 })).status, 401);
  assert.equal((await h.shortcut('', { today: iso(0), steps: 1 })).status, 401);
  assert.equal(await h.raw('/api/me', { Authorization: `Bearer ${key}` }), 401);
  assert.equal(await h.raw('/api/data', { Authorization: `Bearer ${key}` }), 401);
  const bad = await h.shortcut(key, { today: iso(0), sleep: 30 });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /sleep must be between/);
  assert.equal(h.state()._rev, 3, 'nothing written by a refusal');
});

test('a key turned off stops working, and so does a profile with its health log switched off', async t => {
  const h = await startServer(t);
  const { key } = (await h.app('POST', '/api/health/import-key')).body;
  assert.equal((await h.app('DELETE', '/api/health/import-key')).status, 200);
  assert.ok(h.audit().some(e => e.ev === 'auth.import.revoke'));
  assert.equal((await h.shortcut(key, { today: iso(0), steps: 1 })).status, 401);

  const off = await startServer(t, { state: { _rev: 1, healthOn: false } });
  const k2 = (await off.app('POST', '/api/health/import-key')).body.key;
  const r = await off.shortcut(k2, { today: iso(0), steps: 1 });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /switched off/);
});

test('thirty imports an hour per key, then a pause', async t => {
  const h = await startServer(t);
  const { key } = (await h.app('POST', '/api/health/import-key')).body;
  for (let i = 0; i < 30; i++) assert.equal((await h.shortcut(key, { today: iso(0), steps: 100 + i }, '198.51.100.' + (10 + i))).status, 200);
  const over = await h.shortcut(key, { today: iso(0), steps: 1 }, '198.51.100.99');
  assert.equal(over.status, 429);
});
