import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from '@babel/parser';
import {transformSync} from 'esbuild';
import {getBoardLabelRegions} from '../src/board-labels.mjs';
const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const declarations=ast.program.body.filter(node=>node.type==='FunctionDeclaration' || node.type==='VariableDeclaration').map(node=>source.slice(node.start,node.end)).join('\n');
const geometry=runInNewContext(transformSync(declarations,{loader:'jsx'}).code+'\n({makeBoardLayout,pointInPolygon,closePolygon,getBoardLabelPoint,getBoardLabelFontSize})');
const shape=[{x:0,y:200},{x:2000,y:200},{x:2000,y:2100},{x:3600,y:2100},{x:3600,y:0},{x:5600,y:0},{x:5600,y:6000},{x:0,y:6000}];
const polygon=geometry.closePolygon(shape);
const plan=geometry.makeBoardLayout(shape,'V',{barPitch:364,barW:1820});
const snapshot=()=>JSON.stringify({...plan,tiles:plan.tiles.map(tile=>({...tile,usedRect:{x:tile.usedRect.x,y:tile.usedRect.y,width:tile.usedRect.width,height:tile.usedRect.height}}))});
const original=snapshot();
assert.equal(plan.newBoardCount,22);
for(const number of [8,9]){
  const tile=plan.tiles.find(tile=>tile.boardNo===number);
  const regions=getBoardLabelRegions(tile,polygon,geometry.pointInPolygon);
  assert.equal(regions.length,2);
  const right=regions.find(region=>region.usedRect.x===3600);
  assert.ok(right);
  assert.equal(right.boardNo,number);
  assert.equal(right.usedRect.width,40);
  assert.equal(right.usedRect.height,910);
}
const labels=plan.tiles.flatMap(tile=>getBoardLabelRegions(tile,polygon,geometry.pointInPolygon));
assert.equal(labels.length,plan.tiles.length+2);
assert.equal(snapshot(),original);
for(const label of labels){
  const point=geometry.getBoardLabelPoint(label,polygon);
  assert.ok(geometry.pointInPolygon(point,polygon));
  assert.ok(geometry.getBoardLabelFontSize(label,1,false)>0);
}
const rectangle=[{x:0,y:0},{x:1820,y:0},{x:1820,y:910},{x:0,y:910},{x:0,y:0}];
const full={x:0,y:0,width:1820,height:910,boardNo:100};
assert.equal(getBoardLabelRegions(full,rectangle,geometry.pointInPolygon).length,1);
assert.equal(getBoardLabelRegions({...full,x:2000},rectangle,geometry.pointInPolygon).length,0);
const rotated=polygon.map(p=>({x:p.y,y:p.x}));
const tile=plan.tiles.find(tile=>tile.boardNo===8);
assert.equal(getBoardLabelRegions({...tile,x:tile.y,y:tile.x,width:tile.height,height:tile.width},rotated,geometry.pointInPolygon).length,2);
console.log('Board labels passed: two disconnected 40mm strips get labels 8/9, every label is inside its component, 22 sheets unchanged, normal tiles, 3-digit labels, and rotated geometry.');
