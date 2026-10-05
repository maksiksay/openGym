/* The food lookup's contract: what is sent, and what an answer has to be before the person sees it. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildFoodPrompt, validateFood, cleanQuery, FOOD_QUERY_MAX } = await import('../coach/core/food.js');
const { anthropicSpec } = await import('../coach/core/adapters/anthropic.js');

const good = { coach_contract: 1, found: true, name: 'Творог 5%', brand: 'Савушкин', kcal: 121, p: 17, f: 5, c: 1.8, srv: 180, confidence: 'label', note: 'С этикетки.' };

test('the prompt carries the query and the language and nothing else', () => {
  const p = buildFoodPrompt('  творог\nСавушкин   5% ', 'ru');
  const payload = JSON.parse(p.user.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.deepEqual(payload, { coach_contract: 1, task: 'food', meta: { lang: 'ru' }, query: 'творог Савушкин 5%' });
  assert.match(p.system, /per 100 g/);
});

test('the query is one bounded line', () => {
  assert.equal(cleanQuery('a\r\n\tb'), 'a b');
  assert.equal(cleanQuery('x'.repeat(500)).length, FOOD_QUERY_MAX);
});

test('a well-formed answer becomes a food', () => {
  const r = validateFood(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.food, { name: 'Творог 5%', brand: 'Савушкин', kcal: 121, p: 17, f: 5, c: 1.8, srv: 180, confidence: 'label', note: 'С этикетки.' });
});

test('numbers as strings are read, extras are dropped', () => {
  const r = validateFood({ ...good, kcal: '121', evil: '<script>' });
  assert.equal(r.ok, true);
  assert.equal(r.food.kcal, 121);
  assert.equal('evil' in r.food, false);
});

test('not found is an answer, not an error', () => {
  assert.deepEqual(validateFood({ found: false, note: 'Уточни, что за блюдо.' }), { ok: true, found: false, note: 'Уточни, что за блюдо.' });
});

test('out-of-range, inconsistent or incomplete answers are refused', () => {
  assert.equal(validateFood({ ...good, kcal: 1200 }).ok, false);
  assert.equal(validateFood({ ...good, p: 60, f: 30, c: 20, kcal: 590 }).ok, false);        // > 100 g of macros
  assert.equal(validateFood({ ...good, kcal: 500 }).ok, false);                             // far above 4·17 + 9·5 + 4·1.8
  assert.equal(validateFood({ ...good, kcal: 60 }).ok, false);                              // below the macros is never right
  assert.equal(validateFood({ ...good, confidence: 'sure' }).ok, false);
  assert.equal(validateFood({ ...good, name: '' }).ok, false);
  assert.equal(validateFood({ ...good, found: 'yes' }).ok, false);
  assert.equal(validateFood({ ...good, coach_contract: 2 }).ok, false);
  assert.equal(validateFood(null).ok, false);
  assert.equal(validateFood([]).ok, false);
});

test('an absurd portion is left out rather than kept', () => {
  assert.equal('srv' in validateFood({ ...good, srv: 99999 }).food, false);
});

test('the Anthropic body carries server tools only when asked, and says so in the system block', () => {
  const plain = anthropicSpec.body({ model: 'm', prompt: 'u', system: 's', maxTokens: 10 });
  assert.equal('tools' in plain, false);
  assert.doesNotMatch(plain.system[0].text, /web search/);
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  const web = anthropicSpec.body({ model: 'm', prompt: 'u', system: 's', tools, maxTokens: 10 });
  assert.deepEqual(web.tools, tools);
  assert.match(web.system[0].text, /web search tool is available/);
});

test('with web search, the answer is the text after the last search result', () => {
  const data = {
    stop_reason: 'end_turn',
    content: [
      { type: 'text', text: 'Let me look that up.' },
      { type: 'server_tool_use', id: 'x', name: 'web_search', input: { query: 'q' } },
      { type: 'web_search_tool_result', tool_use_id: 'x', content: [] },
      { type: 'text', text: '{"found":false,' },
      { type: 'text', text: '"note":"n"}' }
    ]
  };
  assert.equal(anthropicSpec.readText(data).text, '{"found":false,"note":"n"}');
  assert.equal(anthropicSpec.readText({ content: [{ type: 'text', text: 'plain' }] }).text, 'plain');
});

test('alcohol carries energy the macros do not show, and is accepted', () => {
  const beer = { found: true, name: 'Пиво светлое', kcal: 43, p: 0.5, f: 0, c: 3.6, confidence: 'typical', note: '' };
  assert.equal(validateFood(beer).ok, true);
  assert.equal(validateFood({ ...beer, name: 'Водка', kcal: 235, p: 0, c: 0.1 }).ok, true);
});
