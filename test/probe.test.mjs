import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Game,PROBE,probePose}=require('../game/core.js');
require('../game/portraits.js');
const {drawProbe}=require('../game/renderer-2d.js');
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.tick(1/60,input);};

test('legacy saves gain the mission without losing inventory, buildings or progress; training remains separate',()=>{
  const old=new Game().snapshot();delete old.probeQuest;old.inventory.iron=40;
  old.worlds.verdant.buildings.push({id:'home',type:'habitat',x:500,y:500});
  const g=new Game(old);assert.equal(g.state.probeQuest.stage,'available');assert.equal(g.state.inventory.iron,40);assert.equal(g.world().buildings.length,1);
  old.training=true;const training=new Game(old);assert.equal(training.questNpc(),null);assert.equal(training.probeEntity(),null);assert.equal(training.startProbeQuest().ok,false);
});

test('Lumi and probe are real nearby interactables with distance and planet checks',()=>{
  const g=new Game();g.state.player={x:170,y:-120,angle:0};
  assert.ok(g.interact('lumi-field').ok);assert.ok(g.events.some(e=>e.type==='probe-menu'));assert.equal(g.state.tools.length,3);
  g.state.player={x:PROBE.x,y:PROBE.y+60,angle:0};assert.ok(g.interact(PROBE.id).ok);
  g.state.player.x+=600;assert.equal(g.interact(PROBE.id).ok,false);
  g.state.planet='nix';assert.equal(g.startProbeQuest().ok,false);assert.equal(g.interact('lumi-field').ok,false);
});

test('malfunction animation pauses, survives reload, blocks actions and finishes once',()=>{
  const g=new Game();g.state.oxygen=50;assert.ok(g.startProbeQuest().ok);const position={...g.state.player};
  tick(g,2,{right:true,interact:true});assert.deepEqual(g.state.player,position);assert.equal(g.state.oxygen,50);
  for(const action of ['launch','scan','refuel','interact'])assert.equal(g[action]().ok,false,action);
  assert.equal(g.build('habitat',300,300).ok,false);assert.equal(g.startProbeQuest().ok,false);
  const age=g.state.probeQuest.age;g.paused=true;tick(g,2);assert.equal(g.state.probeQuest.age,age);
  const resumed=new Game(g.snapshot());assert.equal(resumed.state.probeQuest.age,age);tick(resumed,6);
  assert.equal(resumed.state.probeQuest.stage,'collecting');assert.equal(resumed.events.filter(e=>e.type==='probe-update').length,1);
  assert.equal(resumed.finishProbeScene().ok,false);assert.equal(resumed.probeSignal(),null);
});

test('repair requires all materials at the probe, consumes once, resumes and unlocks a real Solara relic',()=>{
  const g=new Game();g.startProbeQuest();g.finishProbeScene();g.state.player={x:PROBE.x,y:PROBE.y+70,angle:0};
  g.state.inventory={iron:18,biomass:9,crystal:4};assert.equal(g.repairProbe().ok,false);assert.equal(g.state.inventory.iron,18);
  g.state.inventory.biomass=10;g.state.player.x+=600;assert.equal(g.repairProbe().ok,false);g.state.player.x-=600;
  assert.ok(g.repairProbe().ok);assert.deepEqual(g.state.inventory,{iron:0,biomass:0,crystal:0});assert.equal(g.repairProbe().ok,false);
  tick(g,2);const resumed=new Game(g.snapshot());tick(resumed,3);assert.equal(resumed.state.probeQuest.stage,'complete');
  assert.deepEqual(resumed.state.inventory,{iron:0,biomass:0,crystal:0});assert.equal(resumed.probeSignal().id,'solara-relic-0');
  const restored=new Game(resumed.snapshot());assert.equal(restored.probeSignal().id,'solara-relic-0');assert.equal(restored.repairProbe().ok,false);
  restored.state.planet='solara';const target=restored.probeSignal();restored.state.player={x:target.x+25,y:target.y,angle:0};
  assert.ok(restored.studyRelic(target.id).ok);assert.equal(restored.studyRelic(target.id).ok,false);
});

test('skipping a scene preserves the same quest result and does not charge twice',()=>{
  const g=new Game();g.startProbeQuest();assert.ok(g.finishProbeScene().ok);assert.equal(g.state.probeQuest.stage,'collecting');
  g.state.player={x:PROBE.x,y:PROBE.y+70,angle:0};g.state.inventory={...PROBE.cost};g.repairProbe();g.finishProbeScene();
  assert.equal(g.state.probeQuest.stage,'complete');assert.equal(g.finishProbeScene().ok,false);assert.equal(g.state.inventory.iron,0);
});

test('probe art has distinct powered, failing, broken and repaired poses and draws finite coordinates',()=>{
  assert.equal(probePose('malfunction',0).damage,0);assert.equal(probePose('malfunction',3).sparks,true);
  assert.equal(probePose('malfunction',6).damage,1);assert.ok(probePose('collecting').smoke>0);
  assert.ok(probePose('repairing',1).damage>probePose('repairing',4).damage);assert.equal(probePose('complete').online,true);
  const gradient={addColorStop(){}};const c=new Proxy({},{get:(_,key)=>(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),key);return String(key).startsWith('create')?gradient:undefined;},set:()=>true});
  for(const stage of ['available','malfunction','collecting','repairing','complete'])for(let age=0;age<=7;age+=.25)for(const effects of [true,false])drawProbe(c,{stage,age},age,effects);
});
