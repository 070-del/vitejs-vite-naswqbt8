import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from '@babel/parser';

const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const declaration=ast.program.body.find(node=>node.type==='FunctionDeclaration' && node.id.name==='formatSheetBundle');
assert.ok(declaration);
const format=runInNewContext(source.slice(declaration.start,declaration.end)+'\nformatSheetBundle');
for(const [count,expected] of [[0,'0枚'],[1,'1枚'],[17,'17枚'],[18,'1坪'],[19,'1坪+1枚'],[178,'9坪+16枚'],[180,'10坪']]){
  assert.equal(format(count,18),expected);
}
assert.equal(format(17,8),'2坪+1枚');
for(const [count,size,expected] of [[145,8,'(145枚)18坪＋1枚'],[30,4,'(30枚)7坪＋2枚'],[32,4,'(32枚)8坪'],[7,8,'(7枚)7枚'],[3,4,'(3枚)3枚'],[178,18,'(178枚)9坪＋16枚']]){
  assert.equal(`(${count}枚)${format(count,size).replace('+','＋')}`,expected);
}
console.log('Rock wool display passed: 18 sheets per tsubo, partial and exact bundles, existing formatter unchanged.');
