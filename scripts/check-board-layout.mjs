import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

// Execute the actual application calculations without mounting React/native APIs.
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '');
const { code } = await transform(source, { loader: 'jsx', format: 'cjs' });
const context = { module: { exports: {} } };
vm.runInNewContext(code + '\nthis.api = { formatGlueAmount, usesCenteredBoardLayout, makeLegacyV38BarPlan, constrainDiagramView, getDiagramGestureView, makeBoardLayout, makeBarPlan, makeShape, getVerticalResultBarDimensionTexts, getResultBarDimensionTexts, makeBoardResult, getBoardLabelPoint, pointInPolygon, makeResults, finalizeResultList, getResultDiagramPages, formatSheetBundle };', context);
const api = context.api;
const points = [{x:0,y:0},{x:2000,y:0},{x:2000,y:2300},{x:3900,y:2300},{x:3900,y:700},{x:6000,y:700},{x:6000,y:5200},{x:0,y:5200},{x:0,y:0}];
const dims = {A:2000,B:2300,C:1900,D:1600,E:2100,F:4500,G:6000,H:5200};
const settings = { barPitch:227, barW:455, barType:'1.5×3ジプトーン', centerBarType:'double' };
const shape = api.makeShape(points.slice(0,-1));

function verify(polygon, axis, config, expectedArea, layer = 'board') {
  const layout = api.makeBoardLayout(polygon, axis, config, layer);
  const area = layout.tiles.reduce((sum, tile) => sum + tile.insideArea, 0);
  assert.ok(Math.abs(area - expectedArea) < 0.01, `Uncovered area: ${expectedArea - area}`);
  const used = new Map();
  for (const tile of layout.tiles) {
    assert.ok(tile.boardNo > 0);
    const label = api.getBoardLabelPoint(tile, polygon);
    assert.ok(label && api.pointInPolygon(label, polygon), 'Missing/interior label');
    used.set(tile.boardNo, (used.get(tile.boardNo) || 0) + tile.usedWidth * tile.usedHeight);
  }
  const sheetArea = layer === 'rockWool' ? 300 * 600 : config.barW === 455 ? 455 * 910 : config.barW === 910 ? 910 * 910 : 910 * 1820;
  for (const [no, area] of used) assert.ok(area <= sheetArea + 0.01, `Board ${no} over-allocated: ${area}`);
  assert.equal(used.size, layout.newBoardCount);
  const text = api.makeBoardResult(polygon, config, axis, layer);
  assert.ok(text.startsWith(`${layout.newBoardCount} 枚`));
  return layout;
}

for (const axis of ['H', 'V']) {
  for (const centerBarType of ['double', 'single']) {
    verify(points, axis, {...settings, centerBarType}, 6000*5200 - 1900*2300 - 2100*700);
    // Includes an 85mm terminal board and the previously missing 455mm starting board.
    const rect = [{x:0,y:0},{x:6000,y:0},{x:6000,y:5200},{x:0,y:5200},{x:0,y:0}];
    verify(rect, axis, {...settings, centerBarType}, 6000*5200);
  }
}
// Very narrow edges must not disappear through the former area/sample threshold.
verify([{x:0,y:0},{x:1830,y:0},{x:1830,y:1820},{x:0,y:1820},{x:0,y:0}], 'H', {barPitch:303,barW:1820},1830*1820);
const vertical = Array.from(api.getVerticalResultBarDimensionTexts(dims, shape, settings));
assert.deepEqual(vertical, ['縦端部→中心 3000mm','縦端部→2本目W 725mm / 270mm']);
assert.ok(api.getResultBarDimensionTexts(dims,shape,settings).every(text => text.startsWith('横端部')));
for (const axis of ['H', 'V']) {
  for (const centerBarType of ['double', 'single']) {
    const cross = {...settings, centerBarType};
    const split = verify(points, axis, {...cross, verticalCenterBarType:'double'}, 6000*5200 - 1900*2300 - 2100*700);
    const straddle = verify(points, axis, {...cross, verticalCenterBarType:'single'}, 6000*5200 - 1900*2300 - 2100*700);
    const across = axis === 'H' ? 'y' : 'x';
    const along = axis === 'H' ? 'x' : 'y';
    assert.equal(split.tiles[0][across], straddle.tiles[0][across], 'Vertical toggle moved W-bar axis');
    assert.notEqual(split.tiles[0][along], straddle.tiles[0][along], 'Vertical toggle did not change board joints');
    assert.equal(((straddle.tiles[0][along] - split.tiles[0][along]) % 910 + 910) % 910, 910 - 227.5, 'Vertical straddle must offset joints by 227.5mm');
    assert.deepEqual(api.makeBarPlan(points, {...cross,verticalCenterBarType:'double'}), api.makeBarPlan(points, {...cross,verticalCenterBarType:'single'}), 'Vertical toggle changed horizontal framing');
    assert.deepEqual(api.getResultBarDimensionTexts(dims,shape,{...cross,verticalCenterBarType:'double'}), api.getResultBarDimensionTexts(dims,shape,{...cross,verticalCenterBarType:'single'}));
  }
}
assert.deepEqual(Array.from(api.getVerticalResultBarDimensionTexts(dims, shape, {...settings, verticalCenterBarType:'single'})), ['縦端部→中心 3000mm','縦端部→2本目W 497.5mm / 42.5mm']);
const squareSettings = {barPitch:303,barW:910,barType:'3×3ジプトーン',centerBarType:'double'};
const squareRoom = [{x:0,y:0},{x:1820,y:0},{x:1820,y:1820},{x:0,y:1820},{x:0,y:0}];
assert.equal(api.makeBoardResult(squareRoom,settings,'H'),'8 枚（1坪）','1.5×3 gypsum must use 8 sheets per tsubo');
assert.equal(api.formatSheetBundle(9,8),'1坪+1枚');
assert.equal(api.formatSheetBundle(5,4),'1坪+1枚');
for (const axis of ['H','V']) {
  const exact = verify(squareRoom, axis, squareSettings,1820*1820);
  assert.equal(exact.newBoardCount,4);
  assert.equal(exact.tiles.length,4);
  assert.ok(exact.tiles.every(tile => tile.width === 910 && tile.height === 910),'3×3 must use 910×910 boards');
  assert.equal(api.makeBoardResult(squareRoom,squareSettings,axis),'4 枚（1坪）');
  const brick = verify(squareRoom,axis,{...squareSettings,squareBoardPattern:'brick'},1820*1820);
  const crossKey = axis === 'H' ? 'y' : 'x';
  const alongKey = axis === 'H' ? 'x' : 'y';
  for (const squareBoardPattern of [undefined,'straight','brick']) {
    const config = {...squareSettings,squareBoardPattern};
    const centered = api.makeBoardLayout(squareRoom,axis,{...config,verticalCenterBarType:'double'});
    const shifted = api.makeBoardLayout(squareRoom,axis,{...config,verticalCenterBarType:'single'});
    assert.equal(centered.tiles[0][alongKey] - shifted.tiles[0][alongKey],squareBoardPattern === 'brick' ? 227.5 : 455,'3×3 vertical straddle offset must follow the laying pattern');
  }
  const rows = [...new Set(brick.tiles.map(tile=>tile[crossKey]))].sort((a,b)=>a-b);
  const rowStarts = rows.map(row=>Math.min(...brick.tiles.filter(tile=>tile[crossKey]===row).map(tile=>tile[alongKey])));
  assert.equal(Math.abs(rowStarts[1]-rowStarts[0]) % 910,455,'3×3 brick rows must stagger by half a sheet');
  for (const centerBarType of ['double','single']) {
    for (const verticalCenterBarType of ['double','single']) {
      verify(points,axis,{...squareSettings,centerBarType,verticalCenterBarType},6000*5200-1900*2300-2100*700);
      verify(points,axis,{...squareSettings,centerBarType,verticalCenterBarType,squareBoardPattern:'brick'},6000*5200-1900*2300-2100*700);
    }
  }
}
assert.deepEqual(Array.from(api.getVerticalResultBarDimensionTexts(dims,shape,{...squareSettings,verticalCenterBarType:'single'})),['縦端部→中心 3000mm','縦端部→2本目W 725mm']);
console.log('PASS: full coverage, sheet capacity, numbering/count, independent horizontal/vertical modes in both axes, G/2 and terminal dimensions.');

const rockSettings = {barPitch:364,barW:1820,barType:'岩綿'};
const tsuboRoom = [{x:0,y:0},{x:1800,y:0},{x:1800,y:1800},{x:0,y:1800},{x:0,y:0}];
assert.deepEqual(Array.from(api.getResultDiagramPages(rockSettings)),['下地','ボード','岩綿']);
assert.equal(api.getResultDiagramPages(settings).length,2);
assert.equal(api.getResultDiagramPages(squareSettings).length,2);
assert.equal(api.formatSheetBundle(18,18),'1坪');
assert.equal(api.formatSheetBundle(19,18),'1坪+1枚');
for (const axis of ['H','V']) {
  const rock = verify(tsuboRoom,axis,rockSettings,1800*1800,'rockWool');
  assert.equal(rock.newBoardCount,18);
  assert.equal(api.makeBoardResult(tsuboRoom,rockSettings,axis,'rockWool'),'18 枚（1坪）');
  const across = axis === 'H' ? 'y' : 'x';
  const along = axis === 'H' ? 'x' : 'y';
  const rows = [...new Set(rock.tiles.map(tile=>tile[across]))].sort((a,b)=>a-b);
  const starts = rows.map(row=>Math.min(...rock.tiles.filter(tile=>tile[across]===row).map(tile=>tile[along])));
  assert.equal(Math.abs(starts[1]-starts[0]),300);
  assert.ok(rock.tiles.every(tile=>tile.width<= (axis==='H'?600:300) && tile.height<= (axis==='H'?300:600)));
  verify(points,axis,rockSettings,6000*5200-1900*2300-2100*700,'rockWool');
  for (const layer of ['board','rockWool']) {
    const centered = api.makeBoardLayout(points,axis,{...rockSettings,centerBarType:'double',verticalCenterBarType:'double'},layer);
    const horizontalShift = api.makeBoardLayout(points,axis,{...rockSettings,centerBarType:'single',verticalCenterBarType:'double'},layer);
    const verticalShift = api.makeBoardLayout(points,axis,{...rockSettings,centerBarType:'double',verticalCenterBarType:'single'},layer);
    if (layer === 'board') {
      assert.deepEqual(centered,horizontalShift,'Rock-wool horizontal mode must not affect base boards');
      assert.deepEqual(centered,verticalShift,'Rock-wool vertical mode must not affect base boards');
      assert.equal(centered.tiles[0].x,0,'Base board must start at the left edge');
      assert.equal(centered.tiles[0].y,0,'Base board must start at the top edge');
    } else {
      assert.notEqual(centered.tiles[0][across],horizontalShift.tiles[0][across],'Rock-wool horizontal toggle must move joints');
      assert.equal(centered.tiles[0][along],horizontalShift.tiles[0][along],'Rock-wool horizontal toggle must not move vertical origin');
      assert.notEqual(centered.tiles[0][along],verticalShift.tiles[0][along],'Rock-wool vertical toggle must move joints');
      assert.equal(centered.tiles[0][across],verticalShift.tiles[0][across],'Rock-wool vertical toggle must not move horizontal origin');
    }
    if (layer === 'rockWool') {
      assert.equal(((verticalShift.tiles[0][along]-centered.tiles[0][along]) % 600+600)%600,450,'Rock-wool vertical straddle must offset joints by minus 150mm');
      const alongCenter = axis === 'H' ? 3000 : 2600;
      assert.ok(verticalShift.tiles.some(tile=>Math.abs(tile[along]-(alongCenter-150))<0.001),'Rock-wool must have a joint 150mm before the vertical center');
      assert.ok(!verticalShift.tiles.some(tile=>Math.abs(tile[along]-alongCenter)<0.001),'Vertical straddle must not retain a joint on the center');
      const center = axis === 'H' ? 2600 : 3000;
      const crossSize = axis === 'H' ? 'height' : 'width';
      assert.ok(centered.tiles.some(tile=>Math.abs(tile[across]-center)<0.001),'Rock-wool split must put a joint exactly on room center');
      assert.ok(horizontalShift.tiles.some(tile=>tile[crossSize]===300 && Math.abs(tile[across]+150-center)<0.001),'Rock-wool straddle must center its 300mm edge on room center');
      assert.ok(!horizontalShift.tiles.some(tile=>Math.abs(tile[across]-center)<0.001),'Straddle must not leave a joint on room center');
    }
    for (const centerBarType of ['double','single']) {
      for (const verticalCenterBarType of ['double','single']) {
        verify(points,axis,{...rockSettings,centerBarType,verticalCenterBarType},6000*5200-1900*2300-2100*700,layer);
      }
    }
  }
  const board = verify(points,axis,rockSettings,6000*5200-1900*2300-2100*700);
  assert.ok(board.tiles.some(tile=>tile.width * tile.height === 910*1820));
  // Small rock-wool panels easily exceed the former 600-tile truncation.
  const large = [{x:0,y:0},{x:12000,y:0},{x:12000,y:18000},{x:0,y:18000},{x:0,y:0}];
  assert.ok(verify(large,axis,rockSettings,12000*18000,'rockWool').tiles.length>600);
}
const materialResults = api.makeResults(dims,rockSettings,shape);
assert.equal(api.usesCenteredBoardLayout(rockSettings,'board'),false);
assert.equal(api.usesCenteredBoardLayout(rockSettings,'rockWool'),true);
assert.equal(api.getResultBarDimensionTexts(dims,shape,rockSettings,'board').length,0);
assert.equal(api.getVerticalResultBarDimensionTexts(dims,shape,rockSettings,'board').length,0);
assert.deepEqual(Array.from(api.getResultBarDimensionTexts(dims,shape,{...rockSettings,centerBarType:'double'},'rockWool')),['横端部→中心 2600mm','横端部→2本目W 200mm']);
assert.deepEqual(Array.from(api.getResultBarDimensionTexts(dims,shape,{...rockSettings,centerBarType:'single'},'rockWool')),['横端部→中心 2450mm','横端部→2本目W 50mm']);
assert.equal(api.getVerticalResultBarDimensionTexts(dims,shape,{...rockSettings,verticalCenterBarType:'single'},'rockWool')[0],'縦端部→中心 2850mm');
assert.equal(api.getVerticalResultBarDimensionTexts(dims,shape,{...rockSettings,verticalCenterBarType:'double'},'rockWool')[0],'縦端部→中心 3000mm');
// Keep terminal dimensions in actual row order and linked to the 150mm joint shift.
for (const centerBarType of ['double','single']) {
  const ordered = [];
  for (const verticalCenterBarType of ['double','single']) {
    const config = {...rockSettings,centerBarType,verticalCenterBarType};
    const plan = api.makeBarPlan(points,config);
    const layout = api.makeBoardLayout(points,plan.barAxis,config,'rockWool');
    const isVertical = plan.barAxis === 'V';
    const end = isVertical ? 5200 : 6000;
    const sizes = [...new Set(layout.tiles.filter(({usedRect:r}) =>
      Math.abs((isVertical ? r.y+r.height : r.x+r.width)-end)<0.01
    ).map(t=>isVertical?t.usedHeight:t.usedWidth))];
    const text = api.getVerticalResultBarDimensionTexts(dims,shape,config,'rockWool')[1];
    assert.equal(text,`縦端部→2本目W ${sizes.map(size=>`${size}mm`).join(' / ')}`);
    ordered.push(text);
  }
  assert.notEqual(ordered[0],ordered[1],'Rock-wool vertical toggle must update terminal dimensions');
}
assert.equal(api.getVerticalResultBarDimensionTexts(dims,shape,{...rockSettings,centerBarType:'double',verticalCenterBarType:'single'},'rockWool')[1],'縦端部→2本目W 150mm / 450mm');
assert.deepEqual(Array.from(materialResults.slice(-3),item=>item.name),['ビス','ピン','しろのり']);
const rockCount=parseInt(materialResults.find(item=>item.name==='岩綿').value,10);
assert.equal(materialResults.find(item=>item.name==='ピン').value,`${rockCount*25} 発`);
assert.equal(materialResults.find(item=>item.name==='しろのり').value,api.formatGlueAmount(rockCount*30));
for (const [grams,expected] of [[0,'0 g'],[1530,'1530 g'],[3000,'3000 g（1袋）'],[4530,'4530 g（1袋+1530g）'],[6000,'6000 g（2袋）'],[7530,'7530 g（2袋+1530g）']]) {
  assert.equal(api.formatGlueAmount(grams),expected);
}
const glueExample = api.finalizeResultList(materialResults.map(item=>item.name==='岩綿'?{...item,value:'151 枚（8坪+7枚）'}:item));
assert.equal(glueExample.find(item=>item.name==='しろのり').value,'4530 g（1袋+1530g）');
for (const centerBarType of ['double','single']) {
  for (const verticalCenterBarType of ['double','single']) {
    const result=api.makeResults(dims,{...rockSettings,centerBarType,verticalCenterBarType},shape);
    const config={...rockSettings,centerBarType,verticalCenterBarType};
    for (const polygon of [points,points.map(({x,y})=>({x:y,y:x}))]) {
      assert.deepEqual(api.makeBarPlan(polygon,config),api.makeLegacyV38BarPlan(polygon,364,1820),'364 framing must retain the original edge-based plan');
    }
    const baseMaterials = list => list.filter(item=>!['岩綿','ピン','しろのり'].includes(item.name)).map(({name,value})=>({name,value}));
    assert.deepEqual(baseMaterials(result),baseMaterials(materialResults),'Rock-wool controls must not change framing, base board or screw quantities');
    const count=parseInt(result.find(item=>item.name==='岩綿').value,10);
    for (const values of [result,api.finalizeResultList(result)]) {
      assert.equal(values.find(item=>item.name==='ピン').value,`${count*25} 発`);
      assert.equal(values.find(item=>item.name==='しろのり').value,api.formatGlueAmount(count*30));
    }
  }
}
assert.deepEqual(Array.from(api.finalizeResultList(materialResults).slice(-2),item=>item.name),['ピン','しろのり']);
assert.ok(!api.makeResults(dims,squareSettings,shape).some(item=>item.name==='ピン'||item.name==='しろのり'));
assert.equal(api.getResultBarDimensionTexts(dims,shape,{...settings,centerBarType:'single'})[0],'横端部→中心 2372.5mm');
assert.equal(api.getResultBarDimensionTexts(dims,shape,rockSettings,'rockWool').length,2);
assert.notDeepEqual(api.getResultBarDimensionTexts(dims,shape,rockSettings,'rockWool'),api.getResultBarDimensionTexts(dims,shape,{...rockSettings,centerBarType:'single'},'rockWool'));
assert.notDeepEqual(api.getVerticalResultBarDimensionTexts(dims,shape,rockSettings,'board'),api.getVerticalResultBarDimensionTexts(dims,shape,rockSettings,'rockWool'),'Dimensions must describe the currently displayed layer');
const base = materialResults.find(item=>item.name==='ボード');
const finish = materialResults.find(item=>item.name==='岩綿');
const barAxis = api.makeBarPlan(points,rockSettings).barAxis;
assert.equal(base.value,api.makeBoardResult(points,rockSettings,barAxis));
assert.equal(finish.value,api.makeBoardResult(points,rockSettings,barAxis,'rockWool'));
assert.equal(api.finalizeResultList(materialResults).find(item=>item.name==='岩綿').value,finish.value,'Saved/shared results must keep both layers');
assert.ok(!api.makeResults(dims,squareSettings,shape).some(item=>item.category==='finishBoard'));
console.log('PASS: 364 pitch has three pages, separate 910×1820 and 300×600 layers, 300mm brick offset, 18 sheets/tsubo, retained results, and coverage above 600 pieces.');

const startView={scale:1,x:0,y:0};
const pinch=api.getDiagramGestureView(startView,[{x:100,y:100},{x:200,y:100}],[{x:50,y:100},{x:250,y:100}],300,200);
assert.equal(pinch.scale,2);
assert.equal(pinch.x,0);
assert.equal(pinch.y,0);
const offCenter=api.getDiagramGestureView(startView,[{x:50,y:50},{x:150,y:50}],[{x:0,y:50},{x:200,y:50}],300,200);
assert.equal(offCenter.x,50,'Pinch must retain the point under its midpoint');
assert.equal(offCenter.y,50);
const pan=api.getDiagramGestureView(pinch,[{x:150,y:100}],[{x:180,y:120}],300,200);
assert.equal(pan.x,30);
assert.equal(pan.y,20);
const bounded=api.constrainDiagramView({scale:10,x:2000,y:-2000},300,200);
assert.equal(bounded.scale,4); assert.equal(bounded.x,450); assert.equal(bounded.y,-300);
const reset=api.constrainDiagramView({scale:0.5,x:200,y:300},300,200);
assert.equal(reset.scale,1); assert.ok(reset.x===0 && reset.y===0);
console.log('PASS: diagram-only pinch scaling, focal point, panning, zoom limits, and reset.');
