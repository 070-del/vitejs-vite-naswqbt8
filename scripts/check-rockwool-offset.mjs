import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from '@babel/parser';
import {transformSync} from 'esbuild';
const original=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
function load(source){
  const ast=parse(source,{sourceType:'module',plugins:['jsx']});
  const declarations=ast.program.body.filter(node=>node.type==='FunctionDeclaration' || node.type==='VariableDeclaration').map(node=>source.slice(node.start,node.end)).join('\n');
  return runInNewContext(transformSync(declarations,{loader:'jsx'}).code+'\n({getVerticalBoardStraddleOffset,getBoardGridStart,makeShape,getVerticalResultBarDimensionTexts})');
}
const after=load(original);
const base={barPitch:364,barW:1820,centerBarType:'single',verticalCenterBarType:'double'};
const straddle={...base,verticalCenterBarType:'single'};
assert.equal(after.getVerticalBoardStraddleOffset(base,'rockWool'),0);
assert.equal(after.getVerticalBoardStraddleOffset(straddle,'rockWool'),150);
const shape=after.makeShape([{x:0,y:0},{x:2000,y:0},{x:2000,y:1900},{x:3400,y:1900},{x:3400,y:0},{x:5600,y:0},{x:5600,y:5800},{x:0,y:5800}]);
const dims={A:2000,B:1900,C:1400,D:2100,E:2200,F:6000,G:5600,H:5800};
assert.match(after.getVerticalResultBarDimensionTexts(dims,shape,base,'rockWool')[0],/3000mm/);
assert.match(after.getVerticalResultBarDimensionTexts(dims,shape,straddle,'rockWool')[0],/2850mm/);
for(const axis of ['V','H']){
  const box={minX:0,minY:0,maxX:6000,maxY:6000};
  const size=axis==='V'?{width:300,height:600}:{width:600,height:300};
  const center=after.getBoardGridStart(box,axis,size,[],base,'rockWool');
  const shifted=after.getBoardGridStart(box,axis,size,[],straddle,'rockWool');
  const along=axis==='V'?'y':'x',cross=axis==='V'?'x':'y';
  assert.equal(shifted[along]-center[along],-150);
  assert.equal(shifted[cross],center[cross]);
}
for(const [settings,offset] of [[straddle,227.5],[{barPitch:227,barW:455,verticalCenterBarType:'single'},227.5],[{barPitch:303,barW:910,verticalCenterBarType:'single'},455]]){
  assert.equal(after.getVerticalBoardStraddleOffset(settings,'board'),offset);
}
console.log('Rock wool vertical offset passed: 3000 -> 2850mm, both layout axes shift 150mm, horizontal alignment and other board offsets unchanged.');
