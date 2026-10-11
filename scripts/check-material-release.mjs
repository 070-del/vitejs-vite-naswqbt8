import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as icons from 'lucide-react';
import {transform} from 'esbuild';
import * as stock from '../src/material-stock.mjs';
import {getBoardLabelRegions} from '../src/board-labels.mjs';

const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
const {code}=await transform(source,{loader:'jsx',format:'cjs'});
const context={module:{exports:{}},React,useMemo:React.useMemo,useId:React.useId,...icons,...stock,getBoardLabelRegions};
vm.runInNewContext(code+'\nthis.api={makeShape,makeMaterialResults,makeBarPlan,formatDisplayedResultValue,getMaterialSettingText,SavedRoomDetail};',context);
const api=context.api;
const shape=api.makeShape([{x:0,y:0},{x:2100,y:0},{x:2100,y:1900},{x:3800,y:1900},{x:3800,y:0},{x:6000,y:0},{x:6000,y:10400},{x:0,y:10400}]);
const dims={A:2100,B:1900,C:1700,D:1500,E:2200,F:10000,G:6000,H:10400};
const settings={barPitch:227,barW:455,barType:'1.5×3ジプトーン',centerBarType:'single',verticalCenterBarType:'single',channelStockLength:5000,doubleBarStockLength:5000,singleBarStockLength:5000,boltMemoMm:650};
const results=api.makeMaterialResults(dims,settings,shape);
assert.equal(results.find(item=>item.category==='board').value,'145 枚');
assert.equal(api.formatDisplayedResultValue(results.find(item=>item.category==='board')),'(145枚)18坪＋1枚');
assert.equal(results.find(item=>item.name==='カラービス').value,'2030 発');
assert.equal(results.find(item=>item.name==='ダブルバー').stockPlan.purchaseCount,34);
assert.equal(results.find(item=>item.name==='チャンネルジョイント').value,'11 コ');
assert.equal(api.getMaterialSettingText(results.find(item=>item.name==='ボルト'),settings),'650mm');
for(const [name,count,text] of [['3×3ジプトーン',30,'(30枚)7坪＋2枚'],['岩綿',178,'(178枚)9坪＋16枚'],['3×6ボード',22,'22 枚']]){
  assert.equal(api.formatDisplayedResultValue({name,value:`${count} 枚`}),text);
}
const square=api.makeMaterialResults(dims,{...settings,barPitch:303,barW:910,barType:'3×3ジプトーン'},shape);
assert.equal(parseInt(square.find(item=>item.name==='カラービス').value),parseInt(square.find(item=>item.category==='board').value)*18);
const custom=api.makeMaterialResults(dims,{...settings,screwsPerSheet:20},shape);
assert.equal(custom.find(item=>item.name==='カラービス').value,'2900 発');

const room=JSON.parse(JSON.stringify({name:'Release regression',shape,dims,settings,results,materialResultsVersion:2}));
const html=renderToStaticMarkup(React.createElement(api.SavedRoomDetail,{room,onClose(){},onRename(){}}));
for(const text of ['(145枚)18坪＋1枚','2030 発','カラービス','650mm','計34本','チャンネルジョイント']) assert.ok(html.includes(text),text);
assert.deepEqual(room.results,JSON.parse(JSON.stringify(results)));
const legacy=renderToStaticMarkup(React.createElement(api.SavedRoomDetail,{room:{name:'Legacy',results:[{name:'ボード',value:'9 枚',category:'board'},{name:'ビス',value:'72 発'}]},onClose(){},onRename(){}}));
assert.ok(legacy.includes('72 発'),'Legacy saved screw count must not change');

const notch=[{x:0,y:200},{x:2000,y:200},{x:2000,y:1700},{x:3300,y:1700},{x:3300,y:0},{x:5300,y:0},{x:5300,y:6000},{x:0,y:6000}];
for(const [mode,expected] of [['double',5],['single',6]]){
  const plan=api.makeBarPlan(notch,{barPitch:227,barW:455,centerBarType:mode});
  assert.equal(plan.doubleLines.filter(line=>Math.round(Math.hypot(line.b.x-line.a.x,line.b.y-line.a.y))===5800).length,expected);
}
console.log('PASS: adopted 145-sheet calculation, material totals, defaults/custom screws, bundle displays, saved detail roundtrip, legacy counts and centered-bar regressions.');
