/* The language check (docs/dev/COACH_QUALITY.md): the slips a reader notices in an answer, found
 * without asking a model. Each one names its fragment, because the one extra round tells the model
 * exactly what to fix and nothing else. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { languageIssues, answerTexts } = await import('../coach/core/lang-check.js');

const has = (issues, fragment) => issues.some(i => i.includes(fragment));

test('a word that mixes two alphabets is a slip', () => {
  const issues = languageIssues('не содержит ни одного зафиксированного подхida или показателя', 'ru');
  assert.equal(issues.length, 1);
  assert.ok(has(issues, 'подхida'));
});

test('a lowercase Latin word inside a Russian sentence is a slip', () => {
  const issues = languageIssues('По расписанию на сегодня stoit тренировка «Спина и бицепс».', 'ru');
  assert.equal(issues.length, 1);
  assert.ok(has(issues, 'stoit'));
});

test('a Latin name in parentheses, in quotes, or an allowed term is not', () => {
  assert.deepEqual(languageIssues('Жим штанги лёжа (barbell bench press) — 3 подхода по 8.', 'ru'), []);
  assert.deepEqual(languageIssues('Нажми «Start» внизу, потом «Resume».', 'ru'), []);
  assert.deepEqual(languageIssues('Последний подход был на RIR 2, а 1RM вырос до 80 kg.', 'ru'), []);
  assert.deepEqual(languageIssues('Оценка rir у последнего подхода решает шаг.', 'ru'), []);
  assert.deepEqual(languageIssues('Шаги приходят из Apple Health, а план живёт в openGym.', 'ru'), []);
  assert.deepEqual(languageIssues('Сделай 3x8 с весом 60.', 'ru'), []);
});

test('a Latin word at the edge of a sentence is left alone', () => {
  assert.deepEqual(languageIssues('ok, тогда завтра.', 'ru'), []);
});

test('backticks and internal identifiers are slips in any language', () => {
  const ru = languageIssues('В `aggregates` пусто, а `adherence.sessionsInWindow` = 0.', 'ru');
  assert.ok(has(ru, 'aggregates'));
  assert.ok(has(ru, 'adherence.sessionsInWindow'));
  const bare = languageIssues('Пока sessionsInWindow равно нулю.', 'ru');
  assert.ok(has(bare, 'sessionsInWindow'));
  const en = languageIssues('Your window.workouts list is empty and foodTracking is off.', 'en');
  assert.ok(has(en, 'window.workouts'));
  assert.ok(has(en, 'foodTracking'));
  const snake = languageIssues('The field sessions_in_window says so.', 'en');
  assert.ok(has(snake, 'sessions_in_window'));
});

test('links to sources, and a domain named on its own, are not slips', () => {
  const answer = 'Поешь за час до зала.\n\nImpact of Fasted State on Adaptations — https://journals.humankinetics.com/view/journals/ijsnem/35/4/article-p291.xml\n' +
    'Protein targets — https://www.marylandtrimclinic.com/blog/body_recomposition_101\nПодробнее на pubmed.ncbi.nlm.nih.gov и www.bodyspec.com.';
  assert.deepEqual(languageIssues(answer, 'ru'), []);
});

test('a plain answer in English, or e.g. and i.e., is clean', () => {
  assert.deepEqual(languageIssues('Your bench has stalled for three sessions; take 10 % off, e.g. 55 kg, i.e. one step back.', 'en'), []);
});

test('another script is read the same way', () => {
  assert.ok(has(languageIssues('오늘 stoit 운동이 있습니다', 'ko'), 'stoit'));
  assert.ok(has(languageIssues('Сьогодні stoit тренування', 'uk-UA'), 'stoit'));
  assert.deepEqual(languageIssues('Сьогодні тренування спини.', 'uk'), []);
});

test('each fragment is named once, and the list is bounded', () => {
  const issues = languageIssues('и stoit и stoit и stoit и', 'ru');
  assert.equal(issues.length, 1);
  const many = languageIssues(Array.from({ length: 30 }, (_, i) => `и word${'abcdefghijklmnopqrstuvwxyz'[i % 26]}x и`).join(' '), 'ru');
  assert.ok(many.length <= 8);
});

test('the human-readable text of an answer is what gets read', () => {
  const texts = answerTexts({
    ok: true,
    reading: 'один',
    result: {
      summary: 'два',
      changes: [{ type: 'set-reps', why: 'три', target: { routineId: 'r1' } }],
      notes: ['четыре'],
      bundle: { routines: [{ id: 'r1', name: 'Верх A', ex: [{ id: '0025' }] }] }
    },
    log: { text: 'пять', kind: 'weight' },
    meal: { text: 'шесть', items: [{ name: 'овсянка' }] }
  });
  assert.deepEqual(texts.sort(), ['два', 'один', 'пять', 'три', 'четыре', 'шесть'].sort());
});
