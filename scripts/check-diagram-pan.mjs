import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import vm from 'node:vm';
import {transform} from 'esbuild';

const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
const {code}=await transform(source,{loader:'jsx',format:'cjs'});
const hooks=[],effects=[],cleanups=[],listeners=new Map();
let cursor=0;
const node={
  getBoundingClientRect:()=>({left:0,top:0,width:300,height:220}),
  setPointerCapture:()=>{},
  addEventListener:(name,callback,options)=>listeners.set(name,{callback,options}),
  removeEventListener:name=>listeners.delete(name),
};
const context={
  module:{exports:{}},React,Date,Minus:'minus',Plus:'plus',RotateCcw:'reset',
  ResizeObserver:class {observe(){} disconnect(){}},
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],value=>{hooks[i]=value;}];},
  useRef(initial){const i=cursor++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},
  useEffect(effect){const i=cursor++;if(!(i in hooks)){hooks[i]=true;effects.push(effect);}},
};
vm.runInNewContext(code+'\nthis.api={ZoomableDiagram,getDiagramGestureView};',context);
const {ZoomableDiagram,getDiagramGestureView}=context.api;
let viewport,toolbar,view;
function render(){
  cursor=0;
  const tree=ZoomableDiagram({children:v=>v});
  [viewport,toolbar]=tree.props.children;
  viewport.props.ref.current=node;
  view=viewport.props.children.props.children;
  for(const effect of effects.splice(0))cleanups.push(effect());
}
function pointer(name,id,x,y){viewport.props[name]({pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,currentTarget:node,type:({onPointerUp:'pointerup',onPointerCancel:'pointercancel',onLostPointerCapture:'lostpointercapture'})[name]||name});render();}
function press(label){const button=toolbar.props.children.find(item=>item.props['aria-label']===label);assert.ok(button);button.props.onClick();render();}
function clickBlocked(){let blocked=false;viewport.props.onClickCapture({stopPropagation(){blocked=true;},preventDefault(){}});return blocked;}
render();render();
assert.equal(view.scale,1);
press('図形を拡大');press('図形を拡大');
assert.equal(view.scale,2.25);
pointer('onPointerDown',1,100,100);pointer('onPointerMove',1,140,120);
assert.equal(view.scale,2.25);assert.equal(view.x,40);assert.equal(view.y,20);
assert.ok(clickBlocked(),'Panning must not change the diagram layer');
// Adding a finger and spreading/closing it cannot change the scale.
pointer('onPointerDown',2,200,100);pointer('onPointerMove',2,280,100);
assert.equal(view.scale,2.25);
pointer('onPointerMove',2,160,100);assert.equal(view.scale,2.25);
const beforeLift={...view};
pointer('onPointerUp',2,160,100);
assert.equal(view.x,beforeLift.x);assert.equal(view.y,beforeLift.y);
pointer('onPointerMove',1,150,125);
assert.equal(view.x,beforeLift.x+10);assert.equal(view.y,beforeLift.y+5);assert.equal(view.scale,2.25);
// Toolbar changes rebase an ongoing drag instead of restoring its old zoom.
press('図形を縮小');assert.equal(view.scale,1.5);
pointer('onPointerMove',1,151,126);assert.equal(view.scale,1.5);
press('図形を全体表示に戻す');
assert.equal(view.scale,1);assert.ok(view.x===0 && view.y===0);
pointer('onPointerMove',1,160,130);assert.equal(view.scale,1);assert.ok(view.x===0 && view.y===0);
pointer('onPointerUp',1,160,130);
press('図形を拡大');
pointer('onPointerDown',3,150,100);pointer('onPointerMove',3,151,101);pointer('onPointerUp',3,151,101);
assert.ok(clickBlocked(),'Even a tiny touch at zoom must not reset the layer');
pointer('onPointerDown',4,150,100);pointer('onPointerCancel',4,150,100);
assert.ok(clickBlocked(),'Cancelled gestures must not switch layers');
for(const [name,{callback,options}] of listeners){
  let prevented=false;callback({cancelable:true,preventDefault(){prevented=true;}});
  assert.equal(options.passive,false);assert.ok(prevented,`${name} must not trigger native zoom`);
}
assert.equal(listeners.size,4);
for(const scale of [1,1.5,2.25,16]){
  const base={scale,x:0,y:0};
  for(const current of [[{x:50,y:50},{x:250,y:150}],[{x:140,y:100},{x:160,y:100}]]){
    const next=getDiagramGestureView(base,[{x:100,y:100},{x:200,y:100}],current,300,220);
    assert.equal(next.scale,scale);
  }
}
cleanups.forEach(cleanup=>cleanup?.());assert.equal(listeners.size,0);
console.log('PASS: one/two-finger pan without scaling, finger handoff, small-drag/cancel click suppression, +/- zoom, reset during drag, and scoped native gesture prevention/cleanup.');
