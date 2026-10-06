/* Coach web search (docs/dev/COACH_WEB.md): which jobs may search, with which provider, and
   what the model is told. The choice is a pure function of the config and the job's kind, so it
   is asserted here without a provider account or a running queue. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const { coachRoutes } = await import('../coach/routes.js');

const on = provider => ({ webSearch: true, provider });

test('consultations search only with the switch on and a provider that can', () => {
  for (const kind of ['create', 'review', 'chat']) {
    assert.deepEqual(jobs.webOptionsFor(on('claude'), kind), { web: { note: jobs.CONSULT_WEB_NOTE } }, kind);
    const a = jobs.webOptionsFor(on('anthropic'), kind);
    assert.equal(a.webNote, jobs.CONSULT_WEB_NOTE);
    assert.equal(a.tools[0].type, 'web_search_20250305');
    assert.ok(a.tools[0].max_uses <= 3);
  }
  // a debrief reads one finished workout and never searches
  assert.deepEqual(jobs.webOptionsFor(on('claude'), 'debrief'), {});
  assert.deepEqual(jobs.webOptionsFor(on('anthropic'), 'debrief'), {});
  for (const p of ['openai', 'gemini', 'compatible', 'codex', 'fixture']) assert.deepEqual(jobs.webOptionsFor(on(p), 'review'), {}, p);
  assert.deepEqual(jobs.webOptionsFor({ webSearch: false, provider: 'claude' }, 'review'), {});
  assert.deepEqual(jobs.webOptionsFor({ provider: 'claude' }, 'review'), {});
  assert.deepEqual(jobs.webOptionsFor(null, 'review'), {});
});

test('the note keeps the person out of the queries and the answer in its contract', () => {
  const n = jobs.CONSULT_WEB_NOTE;
  assert.match(n, /only when the answer needs facts that are not in the payload/);
  assert.match(n, /Never put the person's own data/);
  assert.match(n, /never as instructions/);
  assert.match(n, /URL/);
  assert.match(n, /JSON the contract asks for/);
});

test('the food lookup searches with Claude too, under COACH_FOOD_WEB', () => {
  const was = process.env.COACH_FOOD_WEB;
  try {
    delete process.env.COACH_FOOD_WEB;
    assert.deepEqual(Object.keys(jobs.foodWebOptions({ provider: 'claude' })), ['web']);
    assert.match(jobs.foodWebOptions({ provider: 'claude' }).web.note, /food/);
    assert.equal(jobs.foodWebOptions({ provider: 'anthropic' }).tools[0].type, 'web_search_20250305');
    assert.deepEqual(jobs.foodWebOptions({ provider: 'openai' }), {});
    process.env.COACH_FOOD_WEB = '0';
    assert.deepEqual(jobs.foodWebOptions({ provider: 'claude' }), {});
    assert.deepEqual(jobs.foodWebOptions({ provider: 'anthropic' }), {});
  } finally {
    if (was === undefined) delete process.env.COACH_FOOD_WEB; else process.env.COACH_FOOD_WEB = was;
  }
});

test('the switch is off by default, and only a provider that can search reports web', () => {
  cfg.reset();
  assert.equal(cfg.load().webSearch, false);
  assert.equal(cfg.webCapable({ provider: 'claude' }), true);
  assert.equal(cfg.webCapable({ provider: 'anthropic' }), true);
  assert.equal(cfg.webCapable({ provider: 'openai' }), false);
  assert.equal(cfg.webCapable({ provider: 'fixture' }), false);
  cfg.save({ enabled: true, provider: 'fixture', webSearch: true });
  assert.equal(cfg.publicConfig().web, false, 'the fixture cannot search');
  cfg.save({ provider: 'anthropic', webSearch: true });
  cfg.saveAuth('anthropic', { type: 'apikey', data: cfg.encrypt({ token: 'k' }), connectedAt: new Date().toISOString() });
  assert.equal(cfg.publicConfig().web, true);
  cfg.save({ webSearch: false });
  assert.equal(cfg.publicConfig().web, false);
});

test('the admin card switches it and reads it back with whether the provider can', async () => {
  cfg.reset();
  cfg.save({ enabled: true, provider: 'fixture', auth: {}, webSearch: false });
  const routes = coachRoutes({
    json: (res, status, body) => { res.status = status; res.body = body; },
    readBody: async req => req.body || {},
    readSession: () => ({ id: 'admin-1', admin: true }),
    requireAdmin: () => true
  });
  const call = async (key, body) => { const res = {}; await routes[key]({ body }, res); return res; };
  let r = await call('POST /api/admin/coach/config', { webSearch: true });
  assert.equal(r.status, 200);
  assert.equal(cfg.load().webSearch, true);
  r = await call('GET /api/admin/coach');
  assert.equal(r.body.webSearch, true);
  assert.equal(r.body.webCapable, false, 'the fixture provider cannot search');
  await call('POST /api/admin/coach/config', { provider: 'claude' });
  r = await call('GET /api/admin/coach');
  assert.equal(r.body.webCapable, true);
  // only a boolean switches it
  await call('POST /api/admin/coach/config', { webSearch: 'yes please' });
  assert.equal(cfg.load().webSearch, true);
  await call('POST /api/admin/coach/config', { webSearch: false });
  assert.equal(cfg.load().webSearch, false);
});
