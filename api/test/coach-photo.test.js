/* A photo sent with a chat message (docs/dev/COACH_VOICE_PHOTO.md): read off its bytes, sent only
   to a provider that can see it and only with the consent that names photos, handed to the
   provider beside the prompt, and written nowhere. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const jobs = await import('../coach/jobs.js');
const payload = await import('../coach/core/payload.js');
const { cleanPhoto, PHOTO_MAX_BYTES } = await import('../coach/photo.js');
const { coachRoutes } = await import('../coach/routes.js');
const { forcePrivilegeVerdict } = await import('../coach/adapters/spawn.js');
const { promptWithImage } = await import('../coach/adapters/claude.js');
const { anthropicSpec } = await import('../coach/core/adapters/anthropic.js');
const ADAPTERS = (await import('../coach/adapters/index.js')).default;

cfg.save({ enabled: true, provider: 'fixture' });
forcePrivilegeVerdict({ ok: true, dropped: false, why: 'pinned by the test suite' });

// The bytes a JPEG, a PNG and a GIF start with, and a tail of something that is not a picture.
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF-test-photo-bytes')]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const gif = Buffer.from('GIF89a-not-a-photo-we-take');
const b64 = buf => buf.toString('base64');
const consent = version => ({ ...sampleState().coach, consent: { agreedAt: new Date().toISOString(), version } });

async function settle(uid, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (!jobs.status(uid).job) return jobs.status(uid);
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error('job never finished');
}
function routes(uid) {
  return coachRoutes({
    json: (res, status, body) => { res.status = status; res.body = body; },
    readBody: async req => req.body || {},
    readSession: () => ({ id: uid }),
    requireAdmin: () => false,
  });
}
const everyFile = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? everyFile(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('a photo is what its bytes say, never what it claims, and only a JPEG, PNG or WebP', () => {
  assert.deepEqual(cleanPhoto({ type: 'image/png', data: b64(jpeg) }), { ok: true, photo: { mediaType: 'image/jpeg', data: b64(jpeg) } });
  assert.equal(cleanPhoto({ data: b64(png) }).photo.mediaType, 'image/png');
  assert.equal(cleanPhoto({ type: 'image/gif', data: b64(gif) }).ok, false);
  assert.equal(cleanPhoto({ data: b64(Buffer.from('just some text here')) }).ok, false);
  assert.equal(cleanPhoto({ data: 'not base64 at all!' }).ok, false);
  assert.equal(cleanPhoto({ data: '' }).ok, false);
  assert.equal(cleanPhoto('a string').ok, false);
  assert.equal(cleanPhoto(null).ok, false);
  const big = b64(Buffer.concat([jpeg, Buffer.alloc(PHOTO_MAX_BYTES)]));
  assert.match(cleanPhoto({ data: big }).error, /larger than 1.5 MB/);
});

test('the providers that can see a photo are the ones whose adapters take one', () => {
  for (const [id, adapter] of Object.entries(ADAPTERS)) {
    assert.equal(cfg.VISION_PROVIDERS.has(id), adapter.vision === true, id);
  }
  assert.equal(cfg.publicConfig().vision, true, 'the fixture can, so the chat offers the camera');
});

test('photos are a consent category of their own', () => {
  assert.ok(payload.DATA_CATEGORIES.includes('photos'));
  assert.equal(payload.PHOTO_CONSENT_VERSION, 3);
});

test('the payload says only that there is a photo', () => {
  const p = payload.build(sampleState(), { handle: 'h', kind: 'chat', message: 'What is this?', photo: true });
  assert.equal(p.photo, true);
  assert.equal('photo' in payload.build(sampleState(), { handle: 'h', kind: 'chat', message: 'Hi' }), false);
  assert.equal('photo' in payload.build(sampleState(), { handle: 'h', kind: 'review', photo: true }), false);
});

test('Claude gets the photo and the prompt as one streamed user message', async () => {
  const out = [];
  for await (const m of promptWithImage('the prompt', { mediaType: 'image/jpeg', data: 'QUJD' })) out.push(m);
  assert.deepEqual(out, [{
    type: 'user', session_id: '', parent_tool_use_id: null,
    message: { role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } },
      { type: 'text', text: 'the prompt' },
    ] },
  }]);
});

test('Anthropic gets an image block before the text, and plain text without a photo', () => {
  const withPhoto = anthropicSpec.body({ model: 'm', prompt: 'the prompt', system: 'rules', image: { mediaType: 'image/webp', data: 'QUJD' }, maxTokens: 10 });
  assert.deepEqual(withPhoto.messages, [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'QUJD' } },
    { type: 'text', text: 'the prompt' },
  ] }]);
  const without = anthropicSpec.body({ model: 'm', prompt: 'the prompt', system: 'rules', maxTokens: 10 });
  assert.deepEqual(without.messages, [{ role: 'user', content: 'the prompt' }]);
});

test('a provider that cannot see photos never gets one, whatever reaches its adapter', async () => {
  const seen = [];
  const fakeFetch = async (url, init) => {
    seen.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] }), { status: 200 });
  };
  await ADAPTERS.openai.invoke({ cfg: {}, prompt: 'p', system: 's', image: { mediaType: 'image/jpeg', data: 'QUJD' }, env: { OPENAI_API_KEY: 'k' }, model: 'm', fetch: fakeFetch });
  assert.ok(!JSON.stringify(seen).includes('QUJD'));
});

test('a photo goes with a chat message, comes back as a meal, and is written nowhere', async () => {
  const uid = 'u-photo';
  writeState(DIR, uid, sampleState({ coach: consent(3) }));
  const marker = b64(Buffer.concat([jpeg, Buffer.from('a-photo-that-must-not-be-kept')]));
  const res = {};
  await routes(uid)['POST /api/coach/chat']({ body: { message: '', photo: { type: 'image/jpeg', data: marker }, lang: 'ru' } }, res);
  assert.equal(res.status, 202, JSON.stringify(res.body));
  const s = await settle(uid);
  assert.equal(s.last.outcome, 'meal');
  assert.equal(s.last.reading, 'Read off the photo; the portions are my guess.');
  for (const f of everyFile(DIR)) assert.ok(!fs.readFileSync(f, 'latin1').includes(marker.slice(0, 40)), `the photo is in ${path.relative(DIR, f)}`);
});

test('a photo waits for the consent that names photos', async () => {
  const uid = 'u-photo-consent';
  writeState(DIR, uid, sampleState({ coach: consent(2) }));
  const res = {};
  await routes(uid)['POST /api/coach/chat']({ body: { message: 'What is on this plate?', photo: { data: b64(jpeg) } } }, res);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'photoconsent');
  const text = {};
  await routes(uid)['POST /api/coach/chat']({ body: { message: 'Without a photo, then' } }, text);
  assert.equal(text.status, 202, 'a message alone needs nothing new');
  await settle(uid);
});

test('a broken photo is refused before any job, and a message without text needs its photo', async () => {
  const uid = 'u-photo-bad';
  writeState(DIR, uid, sampleState({ coach: consent(3) }));
  const bad = {};
  await routes(uid)['POST /api/coach/chat']({ body: { message: 'Look', photo: { type: 'image/jpeg', data: b64(gif) } } }, bad);
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /JPEG, PNG or WebP/);
  const empty = {};
  await routes(uid)['POST /api/coach/chat']({ body: { message: '  ' } }, empty);
  assert.equal(empty.status, 400);
  assert.equal(jobs.status(uid).job, null);
});

test('a provider without sight refuses a photo at the door', async () => {
  const uid = 'u-photo-blind';
  writeState(DIR, uid, sampleState({ coach: consent(3) }));
  cfg.save({ provider: 'compatible', providerOptions: { compatible: { baseUrl: 'http://ollama.test:11434' } }, models: { compatible: 'm' } });
  try {
    assert.equal(cfg.publicConfig()?.vision, false);
    assert.throws(() => jobs.enqueue(uid, { kind: 'chat', message: 'Look', photo: { mediaType: 'image/jpeg', data: b64(jpeg) } }), e => e.code === 'novision');
  } finally {
    cfg.save({ provider: 'fixture' });
  }
});
