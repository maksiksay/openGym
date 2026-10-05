/* Codex signed in with a ChatGPT account: the CLI's login cache is the credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tempData } from './helpers.mjs';

tempData();
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-auth-'));
process.env.COACH_CREDENTIAL_DIR = home;
process.env.COACH_PROXY = 'http://host.docker.internal:1087';
const cfg = await import('../coach/config.js');

const fresh = () => { cfg.reset(); cfg.save({ enabled: true, provider: 'codex', auth: {}, models: {}, providerOptions: {}, boundUid: {}, authMode: 'instance' }); };
const login = path.join(home, 'auth.json');

test('without a login cache Codex is not connected', () => {
  fs.rmSync(login, { force: true });
  fresh();
  assert.equal(cfg.isConnected(), false);
  assert.equal(cfg.credentialFor('u1').ok, false);
});

test('with one it is, as a personal credential that binds to the first profile', () => {
  fs.writeFileSync(login, '{"tokens":{}}');
  fresh();
  assert.equal(cfg.isConnected(), true);
  const c = cfg.credentialFor('u1');
  assert.equal(c.ok, true);
  assert.equal(c.type, 'chatgpt-cli');
  cfg.bindInstanceCredential('u1');
  assert.equal(cfg.boundUidFor(), 'u1');
  assert.equal(cfg.credentialFor('u2').reason, 'shared-account');
});

test('jobs get CODEX_HOME and the owner\'s proxy, nothing else from the server', () => {
  fresh();
  const env = cfg.jobEnv('/tmp/job', cfg.credentialFor('u1'));
  assert.equal(env.CODEX_HOME, home);
  assert.equal(env.HTTPS_PROXY, 'http://host.docker.internal:1087');
  assert.equal(env.CODEX_API_KEY, undefined);
});

test('an API key filed for Codex still wins over the cache', () => {
  fresh();
  cfg.saveAuth('codex', { type: 'apikey', data: cfg.encrypt({ token: 'sk-x' }) });
  const c = cfg.credentialFor('u1');
  assert.equal(c.type, 'apikey');
  assert.equal(cfg.jobEnv('/tmp/job', c).CODEX_API_KEY, 'sk-x');
});
