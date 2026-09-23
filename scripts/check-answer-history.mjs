import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '');
const { code } = await transform(source, { loader: 'jsx', format: 'cjs' });
let displayState = { status: 'ready', entries: [] };
const context = {
  module: { exports: {} }, React,
  useState: initial => [initial?.status ? displayState : initial, () => {}],
  useEffect() {}, useId: () => 'history-heading',
};
vm.runInNewContext(code + '\nthis.api = { normalizeAnswerHistory, AnswerHistory, answerHistoryStorageKey };', context);
const { normalizeAnswerHistory, AnswerHistory, answerHistoryStorageKey } = context.api;
assert.ok(!answerHistoryStorageKey.startsWith('ceiling-'), 'Answer history must not appear in saved calculation data');

const input = [
  { question: ' Earlier question ', answeredAt: '2026-09-20T08:30:00Z' },
  { question: 'Latest <question>', answeredAt: '2026-09-23T09:00:00Z' },
  null, {}, { question: ' ', answeredAt: '2026-09-23' },
  { question: 'Invalid date', answeredAt: 'invalid' },
  { question: 'No answer yet' },
];
const before = JSON.stringify(input);
const entries = normalizeAnswerHistory(input);
assert.equal(entries.length, 2);
assert.equal(entries[0].question, 'Latest <question>');
assert.equal(entries[1].question, 'Earlier question');
assert.equal(JSON.stringify(input), before, 'Reading history must not mutate stored data');
assert.throws(() => normalizeAnswerHistory({}), /Invalid answer history/);
assert.equal(normalizeAnswerHistory([]).length, 0);

const render = state => {
  displayState = state;
  return renderToStaticMarkup(React.createElement(AnswerHistory));
};
const populated = render({ status: 'ready', entries });
assert.equal((populated.match(/<li>/g) || []).length, 2);
assert.ok(populated.indexOf('Latest &lt;question&gt;') < populated.indexOf('Earlier question'));
assert.ok(populated.includes('dateTime="2026-09-23T09:00:00.000Z"'));
assert.ok(render({ status: 'ready', entries: [] }).includes('回答履歴はまだありません。'));
assert.ok(render({ status: 'loading', entries: [] }).includes('aria-busy="true"'));
const failed = render({ status: 'error', entries: [] });
assert.ok(failed.includes('再読み込み'));
assert.ok(!failed.includes('回答履歴はまだありません。'));
console.log('PASS: newest-first answer history, invalid record handling, empty/loading/error states, and escaped question text.');
