import assert from 'node:assert/strict';
import {staggeredPieces,planStaggeredBars,planStaggeredChannels,withStockResults,formatMaterialValue,hasNonZeroQuantity,getMaterialStockSpec} from '../src/material-stock.mjs';

assert.deepEqual(staggeredPieces(7200,5000,0),[5000,2200]);
assert.deepEqual(staggeredPieces(7200,5000,1),[2200,5000]);
assert.deepEqual(staggeredPieces(10000,5000,0),[2500,5000,2500]);
assert.deepEqual(staggeredPieces(10000,5000,1),[5000,5000]);
assert.deepEqual(staggeredPieces(5000,5000,0),[5000]);

const line=(row,length,start=0)=>({a:{x:start,y:row*303},b:{x:start+length,y:row*303}});
const geometry={barAxis:'H',doubleLines:[line(0,10000),line(3,10000)],singleLines:[line(1,10000),line(2,10000)]};
const plans=planStaggeredBars(geometry);
assert.deepEqual(plans['ダブルバー'].runs.map(run=>run.pieces),[[2500,5005,2495],[5005,4995]]);
assert.deepEqual(plans['シングルバー'].runs.map(run=>run.pieces),[[5005,4995],[2500,5005,2495]]);
assert.equal(plans['ダブルバー'].joints,3);
assert.equal(plans['シングルバー'].joints,3);

function checkPlan(plan,settings={}){
  const result=planStaggeredBars(plan,settings);
  for(const value of Object.values(result)) assert.ok(!value.error,value.error);
  const runs=Object.values(result).flatMap(value=>value.runs).sort((a,b)=>a.rowIndex-b.rowIndex);
  for(const run of runs){
    assert.equal(run.pieces.reduce((a,b)=>a+b,0),run.length);
    assert.ok(run.pieces.every(piece=>piece>0 && piece<=result[run.name].stockLength && (run.pieces.length===1 || piece>=1250)));
    for(const previous of runs.filter(other=>other.rowIndex===run.rowIndex-1)){
      assert.ok(run.jointPositions.every(position=>previous.jointPositions.every(value=>Math.abs(position-value)>0.000001)));
    }
  }
  for(const value of Object.values(result)){
    assert.equal(value.groups.reduce((sum,group)=>sum+group.count,0),value.runs.length);
    assert.equal(value.joints,value.runs.reduce((sum,run)=>sum+run.pieces.length-1,0));
  }
}
checkPlan(geometry);
const vertical={...geometry,barAxis:'V',doubleLines:geometry.doubleLines.map(swap),singleLines:geometry.singleLines.map(swap)};
function swap(value){return {a:{x:value.a.y,y:value.a.x},b:{x:value.b.y,y:value.b.x}};}
checkPlan(vertical);
// Separate spans at one cross-axis position must share the same row phase.
checkPlan({barAxis:'H',doubleLines:[line(0,10000),line(2,7500,2500)],singleLines:[line(1,5000),line(1,6000,6500),line(3,10000)]});
for(const length of [4000,5000,7000,7200,10000,12000,15000]){
  for(const stock of [3000,3600,4000,5000,7000]){
    checkPlan({barAxis:'H',doubleLines:[line(0,length),line(3,length,stock/2)],singleLines:[line(1,length,1000),line(2,length)]},{doubleBarStockLength:stock,singleBarStockLength:5000});
  }
}
const base=[{name:'Cチャンネル',value:'10000 × 2本'},{name:'ダブルバー',value:'10000 × 2本'},{name:'シングルバー',value:'10000 × 2本'},{name:'シングルクリップ',value:'0 コ'}];
const combined=withStockResults(base,{},geometry);
assert.equal(combined.find(item=>item.name==='ダブルジョイント').value,'3 コ');
assert.equal(formatMaterialValue(combined[1]),'(10000)2500.5005.2495 × 1本　(10000)5005.4995 × 1本');
for(const value of ['0 コ','0 本','0 枚','0 発','0 g','0.00 坪 0.00 ㎡','7000 × 0本','0']) assert.equal(hasNonZeroQuantity({value}),false,value);
for(const value of ['1 コ','7000 × 0本　3000 × 2本','0.001 kg','0.00 坪 0.01 ㎡','寸法未入力']) assert.equal(hasNonZeroQuantity({value}),true,value);
assert.ok(!combined.filter(hasNonZeroQuantity).some(item=>item.name==='シングルクリップ'));
console.log('Staggering passed: requested patterns, global mixed-bar order, both axes, disconnected spans, shifted outlines, differing stock lengths, totals and zero-item filtering.');

const channels={channelAxis:'H',channelLines:[line(2,8000),line(0,8000),line(1,8000)]};
const channelPlan=planStaggeredChannels(channels);
assert.deepEqual(channelPlan.runs.map(run=>run.pieces),[[1985,4000,1985],[4000,3985],[1985,4000,1985]]);
assert.equal(channelPlan.joints,5);
assert.equal(channelPlan.groups.reduce((sum,group)=>sum+group.count,0),3);
assert.deepEqual(planStaggeredChannels({channelAxis:'V',channelLines:channels.channelLines.map(swap)}).runs.map(run=>run.pieces),channelPlan.runs.map(run=>run.pieces));
const sevenMetres=planStaggeredChannels({channelAxis:'H',channelLines:[line(0,7000),line(1,7000)]});
assert.deepEqual(sevenMetres.runs.map(run=>run.pieces),[[4000,2985],[2985,4000]]);
const fiveMetreStock=planStaggeredChannels({channelAxis:'H',channelLines:[line(0,10000),line(1,10000)]},{channelStockLength:5000});
assert.deepEqual(fiveMetreStock.runs.map(run=>run.pieces),[[2485,5000,2485],[5000,4985]]);
const channelResults=withStockResults(base,{},geometry,channels);
assert.equal(channelResults.find(item=>item.name==='チャンネルジョイント').value,'5 コ');
assert.equal(formatMaterialValue(channelResults[0]),'(8000)1985.4000.1985 × 2本　(8000)4000.3985 × 1本');
assert.equal(planStaggeredChannels({channelAxis:'H',channelLines:[line(0,3000)]}).joints,0);
console.log('Channels passed: default 4m, custom 5m, reversed runs, exact multiples, both axes, physical sorting and joint totals.');

assert.equal(getMaterialStockSpec('ダブルバー').stockLength,5005);
assert.equal(getMaterialStockSpec('シングルバー',{singleBarStockLength:5005}).stockLength,5005);
assert.equal(getMaterialStockSpec('ダブルバー',{doubleBarStockLength:4000}).stockLength,4000);
assert.equal(getMaterialStockSpec('Cチャンネル',{channelStockLength:5000}).stockLength,5000);
const actualBars=planStaggeredBars({barAxis:'H',doubleLines:[line(0,7000),line(2,5005)],singleLines:[line(1,7000)]});
assert.deepEqual(actualBars['ダブルバー'].runs[0].pieces,[5005,1995]);
assert.deepEqual(actualBars['シングルバー'].runs[0].pieces,[1995,5005]);
assert.deepEqual(actualBars['ダブルバー'].runs[1].pieces,[5005]);

for(const stock of [2000,3500,4000,5000]){
  for(const length of [3000,4000,4001,4015,5000,7000,8000,8015,8016,8020,10000,12000,15000]){
    const result=planStaggeredChannels({channelAxis:'H',channelLines:[line(0,length),line(1,length),line(2,length,500)]},{channelStockLength:stock});
    assert.ok(!result.error,result.error);
    for(const [index,run] of result.runs.entries()){
      const total=run.pieces.reduce((sum,piece)=>sum+piece,0)+(run.pieces.length-1)*15;
      assert.ok(Math.abs(total-length)<0.000001,`${length}: ${run.pieces}`);
      assert.ok(run.pieces.every(piece=>piece>0 && piece<=stock && (run.pieces.length===1 || piece>=1250)));
      if(index) assert.ok(run.jointPositions.every(position=>result.runs[index-1].jointPositions.every(other=>Math.abs(position-other)>0.000001)));
    }
    assert.equal(result.joints,result.runs.reduce((sum,run)=>sum+run.pieces.length-1,0));
  }
}
console.log('Actual dimensions passed: 5005mm bars, nominal/custom lengths, 15mm per channel joint, positive cuts, no joint allowance on unjoined stock and assembled length conservation.');

const sample={name:'Cチャンネル',stockPlan:{groups:[
  {length:3000,pieces:[3000],count:4},
  {length:3300,pieces:[3300],count:1},
  {length:5800,pieces:[1785,4000],count:3},
  {length:5800,pieces:[4000,1785],count:2},
]}};
const original=JSON.stringify(sample);
assert.equal(formatMaterialValue(sample),'3000 × 4本　3300 × 1本　(5800)4000.1785 × 5本');
assert.equal(JSON.stringify(sample),original);
assert.equal(formatMaterialValue({...sample,name:'シングルバー'}),'3000 × 4本　3300 × 1本　(5800)4000.1785 × 5本');
assert.equal(formatMaterialValue({name:'Cチャンネル',stockPlan:{groups:[
  {length:7000,pieces:[4000,2985],count:2},
  {length:7000,pieces:[1985,3000,1985],count:1},
]}}),'(7000)4000.2985 × 2本　(7000)1985.3000.1985 × 1本');
for(const name of ['ダブルバー','シングルバー']){
  const item={name,stockPlan:{groups:[
    {length:5800,pieces:[1250,4550],count:1},
    {length:5800,pieces:[4550,1250],count:5},
    {length:10000,pieces:[2500,5005,2495],count:2},
    {length:10000,pieces:[2495,5005,2500],count:3},
    {length:10000,pieces:[5005,4995],count:1},
  ]}};
  const before=JSON.stringify(item);
  assert.equal(formatMaterialValue(item),'(5800)1250.4550 × 6本　(10000)2500.5005.2495 × 5本　(10000)5005.4995 × 1本');
  assert.equal(JSON.stringify(item),before);
}
console.log('Material display grouping passed: reversed bar/channel cuts combine, different cuts remain separate, and physical plans stay unchanged.');
