import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '');
const { code } = await transform(source, { loader: 'jsx', format: 'cjs' });
const context = { module: { exports: {} }, React, useMemo: React.useMemo, useId: React.useId };
vm.runInNewContext(code + '\nthis.api = { CleanShape, makeShape, getBoardLabelFontSize };', context);
const { CleanShape, makeShape, getBoardLabelFontSize } = context.api;
const shape = makeShape([{x:0,y:0},{x:10000,y:0},{x:10000,y:20000},{x:0,y:20000}]);
const dims = { A:10000, B:20000, C:10000, D:20000 };
const settings = { barPitch:303, barW:1820, barType:'3×6ボード' };
function render(scale, boards, config = settings, boardLayer = 'board', horizontal = false) {
  const roomDims = horizontal ? {A:20000,B:10000,C:20000,D:10000} : dims;
  return renderToStaticMarkup(React.createElement(CleanShape, {
    shape, dims:roomDims, settings:config, small:true, showValues:true,
    showBoardLayout:boards, boardLayer,
    showBoltDots:!boards, showChannelLines:!boards, showBarLines:!boards,
    showBarDimensionLabels:false, diagramView:{scale,x:0,y:0,viewportWidth:330}
  }));
}
const count = (markup, tag) => [...markup.matchAll(new RegExp(`<${tag}\\b`, 'g'))].length;
for (const [config, layer] of [[settings, 'board'], [{barPitch:364,barW:1820,barType:'岩綿'}, 'rockWool']]) {
  for (const horizontal of [false, true]) {
  const overview = render(1, true, config, layer, horizontal);
  const detail = render(16, true, config, layer, horizontal);
  assert.equal(count(overview,'rect'), count(detail,'rect'), 'Zoom must preserve all board pieces');
  const numbers = markup => [...markup.matchAll(/data-board-number="(\d+)"/g)].map(match => Number(match[1]));
  const labels = numbers(overview);
  assert.equal(labels.length, count(overview,'rect'), 'Every board piece must have a number at 100%');
  assert.deepEqual(numbers(detail), labels, 'Zoom must keep every number, including offcuts');
  const unique = [...new Set(labels)].sort((a,b) => a-b);
  assert.ok(unique.at(-1) >= 121);
  assert.deepEqual(unique, Array.from({length:unique.at(-1)}, (_, i) => i+1), 'Numbering must not stop at 99');
  assert.match(detail, /viewBox="131.25 103.125 17.5 13.75"/);
  assert.match(detail, /vector-effect="non-scaling-stroke"/);
  }
}
const overview = render(1, false);
const detail = render(16, false);
assert.equal(count(overview,'circle'), count(detail,'circle'));
assert.equal(count(overview,'line'), count(detail,'line'));
assert.match(detail, /r="0.125"/);
const tile = {boardNo:123,usedRect:{width:5,height:4}};
assert.ok(getBoardLabelFontSize(tile,1,true) > 0);
const font = getBoardLabelFontSize(tile,16,true);
assert.ok(font > 0 && font * 2.45 <= 5 + 1e-9 && font <= 4 * 0.6);
assert.ok(getBoardLabelFontSize({...tile,usedRect:{width:0.001,height:4}},16,true) > 0);
console.log('PASS: 10m x 20m overview/detail, board/rock-wool labels, vector strokes and unchanged geometry.');
