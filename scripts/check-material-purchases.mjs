import assert from 'node:assert/strict';
import {planMaterialPurchases,withStockResults,planStock} from '../src/material-stock.mjs';
const sample={stockLength:5000,groups:[
  {count:9,pieces:[3000]},
  {count:1,pieces:[3300]},
  {count:3,pieces:[1250,4535]},
]};
const original=JSON.stringify(sample);
const purchase=planMaterialPurchases(sample);
assert.equal(purchase.count,13);
assert.equal(purchase.stockCuts.filter(cut=>cut.pieces.length===2).length,3);
assert.deepEqual(purchase.stockCuts.flatMap(cut=>cut.pieces).sort((a,b)=>a-b),sample.groups.flatMap(group=>Array.from({length:group.count},()=>group.pieces).flat()).sort((a,b)=>a-b));
for(const cut of purchase.stockCuts){
  assert.ok(cut.remaining>=0);
  assert.equal(cut.pieces.reduce((sum,piece)=>sum+piece,0)+cut.remaining,5000);
}
assert.equal(JSON.stringify(sample),original);
assert.equal(planMaterialPurchases({stockLength:5005,groups:[{count:2,pieces:[2502.5]}]}).count,1);
assert.equal(planMaterialPurchases({stockLength:5000,groups:[{count:2,pieces:[2502.5]}]}).count,2);
assert.equal(planMaterialPurchases({stockLength:5000,groups:[]}).count,0);
assert.equal(planMaterialPurchases({stockLength:5000,groups:[{count:0,pieces:[3000]}]}).count,0);
assert.equal(planMaterialPurchases({...sample,error:'割付不可'}),null);
assert.equal(planMaterialPurchases({stockLength:4000,groups:[{count:1,pieces:[4500]}]}),null);
const results=[{name:'Cチャンネル',value:'3000 × 9本　3300 × 1本　5800 × 3本'},{name:'ダブルバー',value:'2500 × 1本'},{name:'シングルバー',value:'2500 × 1本'},{name:'シングルクリップ',value:'1 コ'}];
const output=withStockResults(results,{channelStockLength:5000});
assert.equal(output[0].stockPlan.purchaseCount,13);
assert.equal(output[1].stockPlan.purchaseCount,1);
assert.equal(output[2].stockPlan.purchaseCount,1);
assert.equal(output.find(item=>item.name==='チャンネルジョイント').value,'3 コ');
// Three 1785mm cuts use two 4m stocks; the thirteen longer cuts use one each.
assert.equal(withStockResults(results,{channelStockLength:4000})[0].stockPlan.purchaseCount,15);
assert.equal(planMaterialPurchases(planStock('3000 × 2本',5000)).count,2);
assert.equal(planMaterialPurchases(planStock('2000 × 2本',5000)).count,1);
console.log('Purchase totals passed: 13-stock example, cut conservation, leftover discard, physical 5005mm, separate materials, custom stock lengths, zero and infeasible plans.');
