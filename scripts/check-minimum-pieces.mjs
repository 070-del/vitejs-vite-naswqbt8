import assert from 'node:assert/strict';
import {staggeredPieces,planStock,planStaggeredChannels,planStaggeredBars,formatMaterialValue,withStockResults,hasNonZeroQuantity} from '../src/material-stock.mjs';

const line=(row,length,start=0)=>({a:{x:start,y:row*303},b:{x:start+length,y:row*303}});
const channels=planStaggeredChannels({channelAxis:'H',channelLines:Array.from({length:5},(_,i)=>line(i,5800))},{channelStockLength:5000});
assert.deepEqual(channels.runs.map(run=>run.pieces),[[1250,4535],[4535,1250],[1250,4535],[4535,1250],[1250,4535]]);
assert.equal(channels.joints,5);
assert.equal(formatMaterialValue({name:'Cチャンネル',stockPlan:channels}),'(5800)1250.4535 × 5本');
const bars=planStaggeredBars({barAxis:'H',doubleLines:[line(0,5800)],singleLines:[line(1,5800)]});
assert.deepEqual(bars['ダブルバー'].runs[0].pieces,[1250,4550]);
assert.deepEqual(bars['シングルバー'].runs[0].pieces,[4550,1250]);
assert.deepEqual(planStock('5800 × 5本',5000,{jointAllowance:15}).groups[0].pieces,[1250,4535]);
assert.deepEqual(staggeredPieces(6265,5000,0,0,[],{jointAllowance:15}),[5000,1250]);
assert.deepEqual(staggeredPieces(1250,5000,0),[1250]);
assert.deepEqual(staggeredPieces(785,5000,0),[785]);

for(const stock of [1500,2000,3000,4000,5000,5005]){
  for(const allowance of [0,15]){
    for(const length of [stock+1,stock+15,stock+785,stock+1249,stock+1250,stock+1265,stock*2,stock*2+1,stock*3+785,15000]){
      const count=Math.ceil((length+allowance)/(stock+allowance));
      const feasible=length-(count-1)*allowance>=1250*count;
      let previous=[];
      for(let row=0;row<4;row++){
        const start=row===2?500:0;
        if(!feasible){
          assert.throws(()=>staggeredPieces(length,stock,row,start,previous,{jointAllowance:allowance}),/割付不可/);
          continue;
        }
        const physical=length-(count-1)*allowance;
        const fixed=physical===count*1250 ? 1250 : physical===count*stock ? stock : null;
        const noExtraPiece=length-count*allowance<(count+1)*1250;
        if(fixed && noExtraPiece && Array.from({length:count-1},(_,i)=>start+(i+1)*fixed+i*allowance+allowance/2).some(joint=>previous.some(other=>Math.abs(joint-other)<0.000001))){
          assert.throws(()=>staggeredPieces(length,stock,row,start,previous,{jointAllowance:allowance}),/隣の継ぎ目/);
          break;
        }
        let pieces;
        assert.doesNotThrow(()=>{pieces=staggeredPieces(length,stock,row,start,previous,{jointAllowance:allowance});},JSON.stringify({stock,allowance,length,row,start,previous}));
        assert.ok(pieces.every(piece=>piece>=1250 && piece<=stock),JSON.stringify({stock,length,pieces}));
        assert.ok(Math.abs(pieces.reduce((sum,piece)=>sum+piece,0)+(pieces.length-1)*allowance-length)<0.000001);
        let position=start;
        const joints=pieces.slice(0,-1).map(piece=>{position+=piece;const joint=position+allowance/2;position+=allowance;return joint;});
        assert.ok(joints.every(joint=>previous.every(other=>Math.abs(joint-other)>0.000001)));
        previous=joints;
      }
    }
  }
}

const base=[{name:'Cチャンネル',value:'2200 × 1本'},{name:'シングルクリップ',value:'1 コ'}];
for(const stock of [1000,2000]){
  const result=withStockResults(base,{channelStockLength:stock},undefined,{channelAxis:'H',channelLines:[line(0,2200)]});
  assert.match(formatMaterialValue(result[0]),/割付不可/);
  assert.equal(hasNonZeroQuantity(result[0]),true);
  assert.equal(result.find(item=>item.name==='チャンネルジョイント').value,'算出不可');
  assert.ok(planStock('2200 × 1本',stock,{jointAllowance:15}).error);
}
console.log('Minimum joined cuts passed: 5800mm examples, 1250mm boundary, alternating joints, allowances, stock limits, standalone pieces and infeasible-layout handling.');
