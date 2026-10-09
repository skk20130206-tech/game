import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Game,PLANETS,TOOLS,RESOURCE_TOOLS,FLIGHT_DURATION}=require('../game/core.js');
const {TrainingSession}=require('../game/tutorial.js');
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.tick(1/60,input);};

test('each resource rejects bare hands and every wrong tool; the matching owned tool awards once',()=>{
  for(const [resource,required] of Object.entries(RESOURCE_TOOLS)){
    const g=new Game(),node=g.world().nodes.find(n=>n.type===resource);g.world().nodes=[node];g.world().creatures=[];
    g.state.player={x:node.x-65,y:node.y,angle:0};
    assert.equal(g.equipTool(required).ok,false);
    assert.equal(g.interact(node.id).requiredTool,required);
    tick(g,1.2,{interact:true});
    assert.equal(node.hp,node.maxHp);assert.equal(g.state.inventory[resource],0);assert.equal(g.beam,null);
    // Even a stale equipped slot cannot bypass ownership.
    g.state.equippedTool=required;g.cooldown=0;assert.equal(g.interact(node.id).ok,false);assert.equal(node.hp,node.maxHp);
    g.state.player={x:90,y:100,angle:0};assert.ok(g.collectStarterTools().ok);
    g.state.player={x:node.x-65,y:node.y,angle:0};
    for(const id of Object.keys(TOOLS).filter(id=>id!==required)){
      assert.ok(g.equipTool(id).ok);g.cooldown=0;assert.equal(g.interact(node.id).ok,false);tick(g,.8,{interact:true});
      assert.equal(node.hp,node.maxHp);assert.equal(g.state.stats.mined,0);
    }
    assert.ok(g.equipTool(required).ok);tick(g,3,{interact:true});
    assert.equal(node.hp,0);assert.equal(g.state.inventory[resource],resource==='iron'?6:resource==='biomass'?5:4);
    assert.equal(g.state.stats.mined,1);assert.equal(g.events.filter(e=>e.kind==='break').length,1);
  }
});

test('starter tools require proximity, cannot duplicate, and survive saves and legacy migration',()=>{
  const g=new Game();g.state.player={x:700,y:500,angle:0};assert.equal(g.collectStarterTools().ok,false);assert.deepEqual(g.state.tools,[]);
  g.state.player={x:90,y:90,angle:0};assert.equal(g.collectStarterTools().added.length,3);assert.equal(g.collectStarterTools().added.length,0);
  g.equipTool('sword');const loaded=new Game(g.snapshot());assert.deepEqual(loaded.state.tools,Object.keys(TOOLS));assert.equal(loaded.state.equippedTool,'sword');
  const old=g.snapshot();delete old.tools;delete old.equippedTool;const legacy=new Game(old);assert.deepEqual(legacy.state.tools,Object.keys(TOOLS));assert.equal(legacy.state.equippedTool,'pickaxe');
  old.tools=['axe','axe','invalid','constructor'];old.equippedTool='sword';const clean=new Game(old);assert.deepEqual(clean.state.tools,['axe']);assert.equal(clean.state.equippedTool,null);
  old.tools=[];old.equippedTool='pickaxe';assert.deepEqual(new Game(old).state.tools,[]);assert.equal(new Game(old).state.equippedTool,null);
});

test('Lumi gives a tool kit once and new graduates keep their equipment',()=>{
  const session=new TrainingSession(null,null),g=new Game(session.state),npc=g.trainingNpc();session.tutorial.sync(g);
  assert.deepEqual(g.state.tools,[]);g.state.player={x:npc.x-60,y:npc.y,angle:0};g.interact(npc.id);
  assert.equal(g.state.tools.length,3);assert.equal(g.state.equippedTool,'pickaxe');g.interact(npc.id);assert.equal(g.state.tools.length,3);
  session.tutorial.done[0]=true;g.equipTool('axe');assert.equal(session.tutorial.guide(g).action,'equip');assert.equal(session.tutorial.guide(g).tool,'pickaxe');
  session.tutorial.done.fill(true);const main=new Game(session.destination(g));assert.deepEqual(main.state.tools,g.state.tools);assert.equal(main.state.equippedTool,'axe');
});

test('launch runs over time, blocks other actions, pauses, and resumes after saving',()=>{
  const g=new Game();g.collectStarterTools();g.events=[];const player={...g.state.player};
  assert.ok(g.launch().ok);assert.equal(g.state.mode,'surface');assert.equal(g.flight.kind,'launch');assert.equal(g.events.some(e=>e.type==='launch'),false);
  for(const action of ['launch','land','interact','scan','refuel'])assert.equal(g[action]().ok,false,action);
  assert.equal(g.warp('solara').ok,false);assert.equal(g.equipTool('axe').ok,false);assert.equal(g.collectStarterTools().ok,false);assert.equal(g.build('habitat',400,400).ok,false);
  tick(g,.7,{right:true,interact:true});assert.deepEqual(g.state.player,player);assert.equal(g.state.fuel,100);
  const age=g.flight.age;g.paused=true;tick(g,1);assert.equal(g.flight.age,age);
  const resumed=new Game(g.snapshot());assert.equal(resumed.flight.age,age);tick(resumed,FLIGHT_DURATION);
  assert.equal(resumed.flight,null);assert.equal(resumed.state.mode,'space');assert.equal(resumed.events.filter(e=>e.type==='launch').length,1);
  const x=resumed.state.ship.x;tick(resumed,.5,{right:true});assert.ok(resumed.state.ship.x>x);assert.ok(resumed.state.fuel<100);
});

test('landing defers discovery and completion until touchdown, including reload midway',()=>{
  const g=new Game(),target=PLANETS[1];g.launch();tick(g,3);g.warp(target.id);tick(g,2.5);g.events=[];
  assert.ok(g.land(target.id).ok);assert.equal(g.flight.kind,'land');assert.equal(g.state.mode,'surface');assert.equal(g.state.visited.includes(target.id),false);
  assert.equal(g.events.some(e=>e.type==='land'||e.type==='planet-discovery'),false);tick(g,1);
  const resumed=new Game(g.snapshot());assert.equal(resumed.state.visited.includes(target.id),false);tick(resumed,3);
  assert.equal(resumed.flight,null);assert.equal(resumed.state.planet,target.id);assert.equal(resumed.state.visited.includes(target.id),true);
  assert.equal(resumed.events.filter(e=>e.type==='land').length,1);assert.equal(resumed.events.filter(e=>e.type==='planet-discovery').length,1);
  assert.ok(resumed.launch().ok);tick(resumed,3);assert.equal(resumed.state.mode,'space');
});

test('invalid saved flight cannot strand the player in a transition',()=>{
  const saved=new Game().snapshot();saved.flight={kind:'launch',age:NaN,planet:'verdant'};assert.equal(new Game(saved).flight,null);
  saved.flight={kind:'land',age:1,planet:'solara'};assert.equal(new Game(saved).flight,null);
  saved.flight={kind:'launch',age:10000,planet:'verdant'};const loaded=new Game(saved);tick(loaded,.1);assert.equal(loaded.flight,null);assert.equal(loaded.state.mode,'space');
});
