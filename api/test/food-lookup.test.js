/* jobs.foodLookup end to end against a local OpenAI-compatible endpoint: the gates (consent,
 * one at a time, the daily budget), the answer path, and what it does with a bad answer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { tempData, writeState, sampleState } from './helpers.mjs';

const dir = tempData();
process.env.COACH_FOOD_DAILY = '3';
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');

let reply = null, delay = 0, calls = 0, lastBody = null;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    calls++;
    lastBody = body ? JSON.parse(body) : null;
    setTimeout(() => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: 'stop' }] }));
    }, delay);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

cfg.reset();
cfg.save({ enabled: true, provider: 'compatible', auth: {}, models: { compatible: 'm' }, providerOptions: { compatible: { baseUrl: base } }, boundUid: {} });

const good = { coach_contract: 1, found: true, name: 'Draniki', kcal: 210, p: 4, f: 12, c: 22, srv: 70, confidence: 'typical', note: 'Typical recipe.' };

test.after(() => server.close());

test('refused without the Coach consent — that is where the payer is disclosed', async () => {
  writeState(dir, 'u-none', { ...sampleState(), coach: {} });
  await assert.rejects(jobs.foodLookup('u-none', { query: 'draniki' }), e => e.code === 'consent');
  assert.equal(calls, 0);
});

test('a lookup sends only the query and the language, and returns the checked food', async () => {
  writeState(dir, 'u1', sampleState());
  reply = good;
  const r = await jobs.foodLookup('u1', { query: 'драники', lang: 'ru' });
  assert.deepEqual(r, { ok: true, web: false, food: { name: 'Draniki', kcal: 210, p: 4, f: 12, c: 22, srv: 70, confidence: 'typical', note: 'Typical recipe.' } });
  const sent = JSON.stringify(lastBody);
  assert.ok(sent.includes('драники'));
  assert.ok(!sent.includes('Full body A'), 'no training data rides along');
});

test('an answer out of shape is reported, not passed on', async () => {
  reply = { ...good, kcal: 2000 };
  const r = await jobs.foodLookup('u1', { query: 'draniki' });
  assert.equal(r.ok, false);
  assert.equal(r.errorClass, 'unusable');
});

test('one lookup per profile at a time, and a daily budget', async () => {
  writeState(dir, 'u2', sampleState());
  reply = good; delay = 150;
  const first = jobs.foodLookup('u2', { query: 'a food' });
  await assert.rejects(jobs.foodLookup('u2', { query: 'another' }), e => e.code === 'busy');
  await first;
  delay = 0;
  await jobs.foodLookup('u2', { query: 'two' });
  await jobs.foodLookup('u2', { query: 'three' });
  await assert.rejects(jobs.foodLookup('u2', { query: 'four' }), e => e.code === 'cap');
});

test('a too-short query is not sent at all', async () => {
  const before = calls;
  assert.deepEqual(await jobs.foodLookup('u1', { query: ' x ' }), { ok: false, errorClass: 'empty' });
  assert.equal(calls, before);
});
