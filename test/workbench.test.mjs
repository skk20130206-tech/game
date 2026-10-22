import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Game,BUILDINGS,XP_REWARDS}=require('../game/core.js');
const prepared=()=>{const g=new Game();g.state.player={x:600,y:600,angle:0};g.world().nodes=[];g.state.inventory={...BUILDINGS.workbench.cost};return g;};

test('workbench construction charges once, awards building XP and survives save reload with other buildings',()=>{
 const g=prepared();g.world().buildings.push({id:'old-home',type:'habitat',x:-600,y:-600});
 assert.ok(g.build('workbench',650,600).ok);assert.deepEqual(g.state.inventory,{iron:0,crystal:0,biomass:0});assert.equal(g.levelInfo().xp,XP_REWARDS.build);
 assert.equal(g.build('workbench',650,600).ok,false);assert.equal(g.levelInfo().xp,XP_REWARDS.build);
 const restored=new Game(g.snapshot()),b=restored.world().buildings.find(v=>v.type==='workbench');
 assert.deepEqual(restored.world().buildings.map(v=>v.type),['habitat','workbench']);assert.equal(b.x,650);
 assert.ok(restored.interact(b.id).ok);assert.ok(restored.events.some(e=>e.type==='building-menu'&&e.id===b.id));
 restored.state.inventory={iron:30,crystal:30,biomass:30};const materials={...restored.state.inventory};
 assert.equal(restored.useBuilding(b.id,'upgrade').ok,false);assert.deepEqual(restored.state.inventory,materials);
});

test('workbench rejects insufficient materials, invalid locations, busy state and training without spending',()=>{
 for(const reason of ['materials','far','ship','overlap','paused','space','cinematic','training']){
  const g=prepared();let x=650,y=600;
  if(reason==='materials')g.state.inventory.crystal--;
  if(reason==='far')x=1200;
  if(reason==='ship'){g.state.player={x:90,y:100,angle:0};x=80;y=80;}
  if(reason==='overlap')g.world().buildings.push({type:'habitat',x,y});
  if(reason==='paused')g.paused=true;
  if(reason==='space')g.state.mode='space';
  if(reason==='cinematic')g.state.probeQuest.stage='malfunction';
  if(reason==='training'){g.state.training=true;g.trainingStep=3;x=450;y=500;}
  const materials={...g.state.inventory},count=g.world().buildings.length;
  assert.equal(g.build('workbench',x,y).ok,false,reason);assert.deepEqual(g.state.inventory,materials,reason);assert.equal(g.world().buildings.length,count,reason);assert.equal(g.levelInfo().xp,0,reason);
 }
});
