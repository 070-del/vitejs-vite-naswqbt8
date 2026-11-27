import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transform} from 'esbuild';
import {createHash} from 'node:crypto';
import * as finish from '../src/finish-board-offcuts.mjs';
import * as materials from '../src/material-stock.mjs';
import {getBoardLabelRegions} from '../src/board-labels.mjs';

const src = new URL('../src/App.jsx', import.meta.url);
async function load(url) {
  const source = readFileSync(url,'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
  const {code} = await transform(source, {loader:'jsx',format:'cjs'});
  const context = {module:{exports:{}},...finish,...materials,getBoardLabelRegions};
  vm.runInNewContext(code+'\nthis.api={makeBoardLayout,makeBoardResult,makeShape,makeMaterialResults,makeBarPlan,closePolygon,pointInPolygon,getBoardLabelPoint};', context);
  return context.api;
}
const api = await load(src);
const baseBoardHashes=JSON.parse(readFileSync(new URL('./fixtures/base-board-1.6.json',import.meta.url),'utf8'));
const rect = (w,h) => [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
const eps = 0.005;
const required = (left,right,top,bottom) => ({left,right,top,bottom});

// The user's exact example, in each orientation and for all three finishes.
for (const [short,long] of [[455,910],[910,910],[300,600]]) {
  for (const axis of ['H','V']) {
    const vertical = axis === 'V';
    const size = {width:vertical?short:long,height:vertical?long:short};
    const source = finish.makeFinishBoardSource(size,1);
    const first = {x:0,y:0,width:vertical?short:100,height:vertical?100:short};
    const stock = [];
    finish.addFinishBoardOffcuts(stock,source,first);
    // The same end cannot be taken again, nor rotated to another wall.
    assert.equal(finish.findFinishBoardStock(stock,first.width,first.height,required(true,true,true,true)),null);
    const sameEnd = vertical ? required(true,true,true,false) : required(true,false,true,true);
    assert.equal(finish.findFinishBoardStock(stock,first.width,first.height,sameEnd),null);
    const opposite = vertical ? required(true,true,false,true) : required(false,true,true,true);
    const second = finish.findFinishBoardStock(stock,first.width,first.height,opposite);
    assert.ok(second,'Opposite 100mm end must fit');
    assert.equal(second.piece.boardNo,1);
    assert.equal(vertical ? second.usedRect.y : second.usedRect.x,long-200);
    stock.splice(second.index,1);
    finish.addFinishBoardOffcuts(stock,second.piece,second.usedRect);
    assert.equal(stock.length,0,'Middle strip must not be reusable');
  }
}
// Small original end strips must not disappear under the old 180mm cutoff.
const small = [];
finish.addFinishBoardOffcuts(small,finish.makeFinishBoardSource({width:455,height:910},1),{x:0,y:0,width:455,height:810});
assert.ok(finish.findFinishBoardStock(small,455,100,required(true,true,false,true)));

// Corner end caps must not also leave a full-height lateral strip for reuse.
const cornerStock=[];
finish.addFinishBoardOffcuts(cornerStock,finish.makeFinishBoardSource({width:455,height:910},1),{x:232.5,y:810,width:222.5,height:100});
assert.equal(finish.findFinishBoardStock(cornerStock,222.5,910,required(true,false,true,true)),null);
const oppositeCorner=finish.findFinishBoardStock(cornerStock,222.5,100,required(false,true,true,false));
assert.ok(oppositeCorner);
cornerStock.splice(oppositeCorner.index,1);
finish.addFinishBoardOffcuts(cornerStock,oppositeCorner.piece,oppositeCorner.usedRect);
assert.equal(cornerStock.length,0,'No third use of a sheet after both ends');

const configs = [
  {name:'1.5×3ジプトーン',barPitch:227,barW:455,barType:'1.5×3ジプトーン',short:455,long:910,layer:'board'},
  {name:'3×3ジプトーン',barPitch:303,barW:910,barType:'3×3ジプトーン',short:910,long:910,layer:'board'},
  {name:'岩綿',barPitch:364,barW:1820,barType:'岩綿',short:300,long:600,layer:'rockWool'},
];
const notch = [{x:0,y:0},{x:2000,y:0},{x:2000,y:2300},{x:3900,y:2300},{x:3900,y:700},{x:6000,y:700},{x:6000,y:5200},{x:0,y:5200}];
function verify(points, axis, config) {
  const layout = api.makeBoardLayout(points,axis,config,config.layer);
  const polygon = api.closePolygon(points);
  const size = {width:axis==='V'?config.short:config.long,height:axis==='V'?config.long:config.short};
  const sheets = new Map();
  let area = 0;
  for (const t of layout.tiles) {
    const s=t.sourceRect;
    assert.ok(s && s.width>0 && s.height>0);
    assert.ok(s.x>=-eps && s.y>=-eps && s.x+s.width<=size.width+eps && s.y+s.height<=size.height+eps,'Cut exceeds original sheet');
    const e=t.requiredFactoryEdges;
    for (const [edge,actual,expected] of [['left',s.x,0],['right',s.x+s.width,size.width],['top',s.y,0],['bottom',s.y+s.height,size.height]]) {
      if(e[edge]) assert.ok(Math.abs(actual-expected)<eps,`Board ${t.boardNo} lost its ${edge} edge`);
    }
    const previous=sheets.get(t.boardNo)||[];
    assert.ok(previous.length<2,`Board ${t.boardNo} is used beyond its two ends`);
    for(const p of previous){
      const w=Math.min(p.x+p.width,s.x+s.width)-Math.max(p.x,s.x);
      const h=Math.min(p.y+p.height,s.y+s.height)-Math.max(p.y,s.y);
      assert.ok(w<eps || h<eps,'Two pieces overlap on the same sheet');
    }
    previous.push(s); sheets.set(t.boardNo,previous); area+=t.insideArea;
    for(const region of getBoardLabelRegions(t,polygon,api.pointInPolygon)){
      const point=api.getBoardLabelPoint(region,polygon);
      assert.ok(point && api.pointInPolygon(point,polygon),'Missing number in a visible piece');
      assert.equal(region.boardNo,t.boardNo);
    }
  }
  const polygonArea=Math.abs(polygon.slice(0,-1).reduce((sum,p,i)=>sum+p.x*polygon[i+1].y-polygon[i+1].x*p.y,0))/2;
  assert.ok(Math.abs(area-polygonArea)<0.1,'Board coverage changed');
  assert.equal(sheets.size,layout.newBoardCount);
  assert.equal(Math.max(...sheets.keys()),layout.newBoardCount);
  assert.equal(api.makeBoardResult(points,config,axis,config.layer),`${layout.newBoardCount} 枚`);
  return layout;
}
let cases=0;
for(const config of configs) for(const axis of ['H','V']) for(const centerBarType of ['double','single']) for(const verticalCenterBarType of ['double','single']) for(const squareBoardPattern of ['straight','brick']) {
  const settings={...config,centerBarType,verticalCenterBarType,squareBoardPattern};
  for(const points of [rect(1820,2020),rect(3000,4000),notch,notch.map(p=>({x:p.y,y:p.x})),rect(103.5,45.5)]){
    verify(points,axis,settings); cases++;
  }
}
const serializeLayout=layout=>JSON.stringify({...layout,tiles:layout.tiles.map(t=>({...t,usedRect:{x:t.usedRect.x,y:t.usedRect.y,width:t.usedRect.width,height:t.usedRect.height}}))});
const reported=verify(rect(1810,2020),'V',{...configs[0],centerBarType:'single',verticalCenterBarType:'double'});
const rightSide=reported.tiles.filter(t=>Math.abs(t.usedRect.x+t.usedRect.width-1810)<eps).sort((a,b)=>a.y-b.y);
assert.equal(rightSide[1].usedHeight,910);
assert.notEqual(rightSide[1].boardNo,1,'Right second piece cannot reuse corner board 1');
assert.equal(reported.tiles.filter(t=>t.boardNo===1).length,2);
for(const settings of [{barPitch:303,barW:1820},{barPitch:364,barW:1820}]) for(const axis of ['H','V']){
  assert.equal(createHash('sha256').update(serializeLayout(api.makeBoardLayout(notch,axis,settings,'board'))).digest('hex'),baseBoardHashes[`${settings.barPitch}-${axis}`],'Base-board calculation changed');
}
const comparisons=[];
for(const config of configs){
  const points=rect(1820,2020);
  const shape=api.makeShape(points);
  const dims={A:1820,B:2020,C:1820,D:2020};
  const axis=api.makeBarPlan(points,config).barAxis;
  const layout=verify(points,axis,config);
  const result=api.makeMaterialResults(dims,config,shape).find(item=>item.name===config.name);
  assert.ok(result && Number.parseInt(result.value,10)===layout.newBoardCount,'Result count differs from diagram');
  comparisons.push({name:config.name,new:layout.newBoardCount,axis});
}
console.log(`PASS: exact end/middle examples, ${cases} layouts, preserved edges/orientation, non-overlapping source cuts, coverage, counts/labels, and unchanged base boards.`,comparisons);
