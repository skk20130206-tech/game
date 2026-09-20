import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {loadWorker} from '../scripts/load-worker.mjs';
const require=createRequire(import.meta.url);
const {Game}=require('../game/core.js'),{Animator,DURATIONS,mesh}=require('../game/player-rig.js'),{Tutorial}=require('../game/tutorial.js');

test('only successful actions animate; mining rewards and save compatibility stay intact',()=>{
  const g=new Game(),n=g.world().nodes[0];g.state.player={x:n.x-65,y:n.y,angle:2};g.events=[];
  assert.equal(g.interact(n.id).ok,true);let action=g.events.find(e=>e.type==='player-action');
  assert.equal(action.kind,'mine');assert.equal(action.targetId,n.id);assert.equal(action.x,n.x);assert.equal(g.state.player.angle,0);
  g.events=[];assert.equal(g.interact(n.id).ok,false);assert.equal(g.events.some(e=>e.type==='player-action'),false);
  g.state.player.x=-1600;g.cooldown=0;assert.equal(g.interact(n.id).ok,false);assert.equal(g.events.some(e=>e.type==='player-action'),false);
  g.state.player={x:600,y:450,angle:0};g.world().nodes=[];g.state.inventory={iron:30,crystal:10,biomass:20};
  g.build('habitat',700,450);action=g.events.filter(e=>e.type==='player-action').at(-1);assert.equal(action.kind,'build');assert.equal(action.buildingType,'habitat');
  assert.equal(g.state.inventory.iron,18);const restored=new Game(g.snapshot());assert.equal(restored.state.stats.buildings,1);assert.equal('animation' in restored.state,false);
});

test('pet, feed, building and scanner gestures keep their individual meaning and costs',()=>{
  const g=new Game(),c=g.world().creatures[0];g.state.player={x:c.x-40,y:c.y,angle:0};g.befriend(c);g.events=[];
  assert.ok(g.careForCreature(c.id,'pet').ok);assert.equal(g.events.find(e=>e.type==='player-action').kind,'pet');
  g.events=[];const biomass=g.state.inventory.biomass;assert.ok(g.careForCreature(c.id,'feed').ok);assert.equal(g.state.inventory.biomass,biomass-2);assert.equal(g.events.find(e=>e.type==='player-action').kind,'feed');
  g.events=[];g.paused=true;assert.equal(g.scan().ok,false);assert.equal(g.events.length,0);g.paused=false;
  g.scan();assert.equal(g.events.find(e=>e.type==='player-action').kind,'scan');
  g.events=[];g.scan();assert.equal(g.events.some(e=>e.type==='player-action'),false);
});

test('16-bone mesh, interrupted animations, pause and recovery remain finite and bounded',()=>{
  const data=mesh();assert.equal(data.length%(6*8),0);assert.ok(data.every(Number.isFinite));
  for(let i=0;i<data.length;i+=8){assert.ok(data[i+5]>=0&&data[i+5]<16);assert.ok(data[i+6]>=0&&data[i+6]<16);assert.ok(data[i+7]>=0&&data[i+7]<=1);}
  const g=new Game(),rig=new Animator(),poses=new Set();
  for(const [kind,duration] of Object.entries(DURATIONS)){
    rig.reset();rig.start({kind,x:g.state.player.x+70,y:g.state.player.y});
    for(let t=0;t<duration;t+=1/60){rig.evaluate(1/60,g,.7);assert.ok(rig.palette.every(Number.isFinite));assert.ok(rig.hand.every(v=>Math.abs(v)<130));}
    rig.start({kind,x:g.state.player.x-70,y:g.state.player.y});rig.evaluate(.1,g,.7);poses.add(Array.from(rig.angles).map(v=>v.toFixed(3)).join(','));
    g.paused=true;const before=Array.from(rig.palette),age=rig.action.age;rig.evaluate(.1,g,.7);assert.deepEqual(Array.from(rig.palette),before);assert.equal(rig.action.age,age);g.paused=false;
    for(let i=0;i<25;i++)rig.evaluate(.1,g,.7);assert.equal(rig.action,null);
  }
  assert.ok(poses.size>=10,'different actions must produce visibly different poses');
  rig.start({kind:'mine',x:0,y:0});g.state.mode='space';rig.evaluate(.1,g);assert.equal(rig.action,null);
});

test('tutorial uses real movement and actions, persists, and ignores teleports or solar construction',()=>{
  const g=new Game(),t=new Tutorial();t.tick(g);g.state.player.x+=1000;t.tick(g);assert.equal(t.walked,0);
  for(let i=0;i<30;i++){g.state.player.x+=2;t.tick(g);}assert.equal(t.step,1);
  t.event({type:'effect',kind:'mine'});assert.equal(t.step,1);t.event({type:'effect',kind:'break'});assert.equal(t.step,2);
  t.event({type:'player-action',kind:'scan'});t.event({type:'player-action',kind:'build',buildingType:'solar'});assert.equal(t.step,3);
  t.event({type:'player-action',kind:'greet'});t.event({type:'player-action',kind:'build',buildingType:'habitat'});assert.equal(t.active,false);
  assert.equal(new Tutorial(t.snapshot()).step,5);assert.equal(new Tutorial({skipped:true}).active,false);
});

test('Worker serves original-reference texture and standalone build embeds the same texture',async()=>{
  const worker=await loadWorker(),response=await worker.fetch(new Request('https://game.test/assets/player-k17.webp?v=20260919'));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
  const original=await readFile(new URL('../assets/player-k17.webp',import.meta.url));assert.deepEqual(Buffer.from(await response.arrayBuffer()),original);
  const preview=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.ok(preview.includes('data:image/webp;base64,'+original.toString('base64')));
  const health=await(await worker.fetch(new Request('https://game.test/health'))).json();assert.equal(health.playerRigBones,16);assert.equal(health.interactionAnimations,true);assert.equal(health.tutorial,true);
});
