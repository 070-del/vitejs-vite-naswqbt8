import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the actual pointer handlers against a canvas double.
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const getPoint =');
const end = source.indexOf('  const aiCleanShape =', start);
assert.ok(start >= 0 && end > start);
const captures = new Set();
const segments = [];
let from;
let to;
const ctx = {
  setTransform() {},
  clearRect() { segments.length = 0; },
  beginPath() {},
  moveTo(x, y) { from = { x, y }; },
  lineTo(x, y) { to = { x, y }; },
  stroke() { segments.push({ from, to }); },
};
const canvas = {
  width: 400,
  height: 600,
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  getContext: () => ctx,
  setPointerCapture: id => captures.add(id),
  hasPointerCapture: id => captures.has(id),
  releasePointerCapture: id => captures.delete(id),
};
const context = {
  canvasRef: { current: canvas },
  drawingPointerId: { current: null },
  pointsRef: { current: [] },
  ensureCanvasSize() {},
  window: { devicePixelRatio: 2 },
  distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
};
vm.runInNewContext(source.slice(start, end) + '\nthis.api = { startDraw, draw, endDraw, clearCanvas };', context);
const { startDraw, draw, endDraw, clearCanvas } = context.api;
const event = (pointerId, x, y, extra = {}) => ({
  pointerId, clientX: x, clientY: y, isPrimary: true, button: 0,
  currentTarget: canvas, preventDefault() {}, ...extra,
});

startDraw(event(1, 20, 20));
draw(event(1, 100, 20));
assert.equal(segments.length, 1);
startDraw(event(2, 200, 200, { isPrimary: false }));
draw(event(2, 250, 250));
endDraw(event(2, 250, 250));
assert.equal(segments.length, 1, 'A second finger must not change the stroke');
draw(event(1, 100, 100));
endDraw(event(1, 100, 100));
assert.equal(segments.length, 2);
draw(event(1, 200, 200));
assert.equal(segments.length, 2, 'Lifting the pointer must end the stroke');

startDraw(event(3, 200, 200));
assert.equal(segments.length, 0, 'A new stroke must erase the previous drawing');
assert.equal(context.pointsRef.current.length, 1);
draw(event(3, 300, 200));
assert.equal(segments.length, 1);
assert.equal(segments[0].from.x, 200);
endDraw(event(3, 300, 200));
assert.equal(captures.size, 0);

startDraw(event(4, 10, 10, { button: 2 }));
assert.equal(segments.length, 1, 'Right-click must preserve the drawing');
startDraw(event(5, 20, 20));
draw(event(5, 100, 20));
clearCanvas();
assert.equal(segments.length, 0);
assert.equal(context.pointsRef.current.length, 0);
assert.equal(captures.size, 0);
draw(event(5, 200, 20));
assert.equal(segments.length, 0, 'Clear must cancel any active stroke');

console.log('PASS: one-stroke replacement, single-pointer ownership, release, right-click, and clear.');

// Exercise the actual resize handler with the same drawing canvas double.
const resizeStart = source.indexOf('    const applyCanvasSize =');
const resizeEnd = source.indexOf('    applyCanvasSize();', resizeStart);
assert.ok(resizeStart >= 0 && resizeEnd > resizeStart);
let bounds = { width: 400, height: 600 };
canvas.getBoundingClientRect = () => bounds;
const resizeContext = {
  canvas,
  window: { devicePixelRatio: 2 },
  canvasReady: { current: false },
  canvasDisplaySize: { current: { width: 200, height: 300 } },
  pointsRef: { current: [{ x: 20, y: 30 }, { x: 100, y: 150 }] },
};
vm.runInNewContext(source.slice(resizeStart, resizeEnd) + '\nthis.resize = applyCanvasSize;', resizeContext);
resizeContext.resize();
assert.equal(canvas.width, 800);
assert.equal(canvas.height, 1200);
assert.equal(resizeContext.canvasReady.current, true);
assert.equal(resizeContext.pointsRef.current[0].x, 40);
assert.equal(resizeContext.pointsRef.current[1].y, 300);
assert.equal(segments.length, 1, 'Resizing must redraw the existing stroke');
resizeContext.resize();
assert.equal(segments.length, 1, 'Repeated sizing must not rescale the stroke');
bounds = { width: 200, height: 300 };
resizeContext.resize();
assert.equal(resizeContext.pointsRef.current[0].x, 20);
assert.equal(resizeContext.pointsRef.current[1].y, 150);
canvas.width = 1;
canvas.height = 1;
resizeContext.resize();
assert.equal(resizeContext.pointsRef.current[1].x, 100, 'Returning to the page must preserve the stroke coordinates');
assert.equal(segments.length, 3, 'Returning to the drawing page must redraw the stroke');
console.log('PASS: responsive canvas resizing, repeated sizing, and stroke restoration after navigation.');
