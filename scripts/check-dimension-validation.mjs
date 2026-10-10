import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import[\s\S]*?;\r?\n/gm, ''), { loader: 'jsx', format: 'cjs' });
const context = { module: { exports: {} } };
vm.runInNewContext(code + '\nthis.api = { getDimensionError, autoFillDims };', context);
const { getDimensionError } = context.api;

function room(points) {
  const dims = {};
  const edges = points.map(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    const axis = x === nextX ? 'V' : 'H';
    const delta = axis === 'H' ? nextX - x : nextY - y;
    const key = String.fromCharCode(65 + i);
    dims[key] = String(Math.abs(delta));
    return { key, axis, sign: Math.sign(delta) };
  });
  return { dims, edges };
}

const rectangle = room([[0,0],[20000,0],[20000,10000],[0,10000]]);
assert.equal(getDimensionError(rectangle.dims, rectangle.edges), '');
const closureMessage = '斜めの辺は表示できません（B：5,000mm ／ D：10,000mm）';
assert.equal(getDimensionError({...rectangle.dims, B:'5000'}, rectangle.edges), closureMessage);
assert.equal(getDimensionError({...rectangle.dims, C:'19000'}, rectangle.edges), '斜めの辺は表示できません（A：20,000mm ／ C：19,000mm）');
assert.equal(getDimensionError({...rectangle.dims, B:'5000', C:'19000'}, rectangle.edges), '斜めの辺は表示できません（A：20,000mm ／ C：19,000mm、B：5,000mm ／ D：10,000mm）');
assert.equal(getDimensionError({...rectangle.dims, D:'10001'}, rectangle.edges), '斜めの辺は表示できません（B：10,000mm ／ D：10,001mm）');
for (const invalid of ['', '0', '-1', 'Infinity', 'NaN', '1.5', '999999999999999999999']) {
  assert.match(getDimensionError({...rectangle.dims, A:invalid}, rectangle.edges), /A辺に有効な寸法/);
}

const validShapes = [
  [[0,0],[6000,0],[6000,2000],[2000,2000],[2000,6000],[0,6000]],
  [[0,0],[6000,0],[6000,6000],[4000,6000],[4000,2000],[2000,2000],[2000,6000],[0,6000]],
  [[0,0],[6000,0],[6000,6000],[3001,6000],[3001,1],[3000,1],[3000,6000],[0,6000]],
];
for (const points of validShapes) {
  for (const ordered of [points, points.slice().reverse()]) {
    const valid = room(ordered);
    assert.equal(getDimensionError(valid.dims, valid.edges), '');
  }
}
for (const points of [
  [[0,0],[6000,0],[6000,4000],[2000,4000],[2000,-2000],[4000,-2000],[4000,6000],[0,6000]],
  [[0,0],[6000,0],[6000,6000],[4000,6000],[4000,0],[2000,0],[2000,6000],[0,6000]],
  [[0,0],[6000,0],[3000,0],[3000,4000],[0,4000]],
]) {
  const invalid = room(points);
  assert.match(getDimensionError(invalid.dims, invalid.edges), /交差、または重なっています/);
}

// Exercise the actual navigation handler, including autofill and its early return.
context.shape = { edges: rectangle.edges };
let page;
let alert;
let haptics;
context.setDims = () => {};
context.setPage = value => { page = value; };
context.showAlert = message => { alert = message; };
context.successHaptic = () => { haptics++; };
const start = source.indexOf('  const goToResults =');
const end = source.indexOf('  const results =', start);
assert.ok(start >= 0 && end > start);
vm.runInNewContext(source.slice(start, end) + '\nthis.goToResults = goToResults;', context);
function submit(dims) {
  context.dims = dims;
  page = 2;
  alert = '';
  haptics = 0;
  context.goToResults();
}
submit({...rectangle.dims, B:'5000'});
assert.equal(page, 2);
assert.equal(haptics, 0);
assert.equal(alert, closureMessage);
submit({...rectangle.dims, B:'', D:''});
assert.equal(page, 2);
assert.match(alert, /未入力/);
submit({...rectangle.dims, D:''});
assert.equal(page, 3, 'A missing opposite side should still autofill');
assert.equal(haptics, 1);
submit(rectangle.dims);
assert.equal(page, 3, 'Corrected dimensions must allow calculation');
assert.equal(alert, '');

const changeStart = source.indexOf('  const changeDim =');
assert.ok(changeStart >= 0 && changeStart < start);
vm.runInNewContext(source.slice(changeStart, start) + '\nthis.changeDim = changeDim; this.runAutoFill = runAutoFill;', context);
context.setDims = update => { context.dims = typeof update === 'function' ? update(context.dims) : update; };
for (const [key, opposite] of [['A','C'], ['C','A'], ['B','D'], ['D','B']]) {
  context.dims = {...rectangle.dims};
  for (const value of ['1','16','160','1600']) {
    context.changeDim(key, value);
    assert.equal(context.dims[key], value);
    assert.equal(context.dims[opposite], value, 'Opposite side must update before blur');
    for (const other of Object.keys(rectangle.dims).filter(edge => edge !== key && edge !== opposite)) {
      assert.equal(context.dims[other], rectangle.dims[other], 'Perpendicular sides must not change');
    }
  }
  context.runAutoFill();
  assert.equal(context.dims[opposite], '1600');
  submit({...context.dims});
  assert.equal(page, 3, 'An edited rectangle should calculate without a mismatch alert');
  assert.equal(alert, '');
}
context.dims = {};
context.changeDim('B', '4000');
assert.equal(context.dims.D, '4000', 'New dimensions should immediately fill the opposite side');
assert.equal(context.dims.A, undefined);
context.changeDim('B', '');
assert.equal(context.dims.B, '', 'Clearing an input must remain possible');
assert.equal(context.dims.D, '4000', 'An incomplete entry must not erase a valid opposite side');
context.changeDim('B', '999999999999999999999');
assert.equal(context.dims.D, '4000', 'Invalid numbers must not propagate');
const lRoom = room(validShapes[0]);
context.shape = {edges:lRoom.edges};
context.dims = {...lRoom.dims};
context.changeDim('C', '4500');
assert.equal(context.dims.A, '6500', 'The unique opposite side must equal the sum of stepped sides');
assert.equal(getDimensionError(context.dims,lRoom.edges), '');
context.changeDim('A', '7000');
assert.equal(context.dims.C, '4500');
assert.equal(context.dims.E, lRoom.dims.E, 'Ambiguous opposite sides must not be arbitrarily overwritten');
assert.match(getDimensionError(context.dims,lRoom.edges), /斜めの辺/);
console.log('PASS: dimension closure, intersections, overlaps, concave rooms, autofill and result navigation.');
console.log('PASS: live opposite-side updates in both directions, partial input and unambiguous stepped sides.');
