import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadWorker } from '../scripts/load-worker.mjs';
const require=createRequire(import.meta.url);
const {Game,PLANETS,RESOURCE_TOOLS}=require('../game/core.js');
const {Tutorial,TrainingSession}=require('../game/tutorial.js');
const drain=(g,t)=>{while(g.events.length)t.event(g.events.shift(),g);};
const walk=(g,t,seconds)=>{for(let i=0;i<seconds*60;i++){g.tick(1/60,{right:true});t.tick(g);drain(g,t);}};
const finishFlight=g=>{for(let i=0;i<170;i++)g.tick(1/60);};
const mine=(g,t,n)=>{assert.ok(g.equipTool(RESOURCE_TOOLS[n.type]).ok);g.state.player={x:n.x-65,y:n.y,angle:0};while(n.hp>0){g.cooldown=0;assert.ok(g.interact(n.id).ok);drain(g,t);}};

test('station survives reload, supports NPC dialogue, and exits to the normal world',()=>{
  const session=new TrainingSession(null,null),g=new Game(session.state);
  assert.equal(g.state.training,true);assert.equal(g.world().nodes.length,5);assert.equal(g.world().relics.length,0);
  const npc=g.trainingNpc();assert.equal(npc.name,'교관 루미');assert.equal(g.interact(npc.id).ok,false);
  g.state.player={x:npc.x+25,y:npc.y,angle:0};assert.equal(g.nearest().kind,'npc');
  assert.equal(g.interact().type,'instructor');assert.ok(g.events.some(e=>e.type==='instructor'));
  drain(g,session.tutorial);assert.equal(session.tutorial.done[4],false);
  const resumed=new TrainingSession(null,session.snapshot(g)),restored=new Game(resumed.state);
  assert.equal(restored.state.training,true);assert.ok(restored.trainingNpc());
  resumed.tutorial.done.fill(true);const main=new Game(resumed.destination(restored));
  assert.equal(main.state.training,false);assert.equal(main.trainingNpc(),null);assert.equal(main.world().nodes.length,146);
});

test('first-time training resumes its own world and cannot enter main before completion',()=>{
  const session=new TrainingSession(null,null),g=new Game(session.state);
  assert.equal(session.active,true);assert.equal(session.destination(g),null);
  walk(g,session.tutorial,.5);assert.equal(session.tutorial.step,0);
  const npc=g.trainingNpc();g.state.player={x:npc.x-60,y:npc.y,angle:0};g.interact(npc.id);drain(g,session.tutorial);
  mine(g,session.tutorial,g.world().nodes.find(n=>n.type==='iron'));
  const resumed=new TrainingSession(null,JSON.parse(JSON.stringify(session.snapshot(g))));
  assert.equal(resumed.tutorial.step,2);assert.equal(resumed.state.inventory.iron,6);
  resumed.tutorial.done.fill(true);const main=resumed.destination(new Game(resumed.state));
  assert.equal(main.inventory.iron,12);assert.equal(main.inventory.biomass,8);assert.equal(main.inventory.crystal,4);assert.equal(main.worlds.verdant.buildings.length,0);resumed.finish();
  const nextVisit=new TrainingSession(main,{version:1,active:false});
  assert.equal(nextVisit.active,false);assert.equal(nextVisit.tutorial.dismissed,true);
});

test('replaying training preserves the existing main expedition across reload and completion',()=>{
  const original=new Game();original.state.inventory.iron=57;original.state.met=['mossling'];
  const main=original.snapshot(),before=JSON.stringify(main);
  assert.equal(new TrainingSession(main,null).active,false);
  const practice=new Game(),session=new TrainingSession(main,{version:1,active:true,game:practice.snapshot()});
  practice.state.inventory.iron=2;session.tutorial.done.fill(true);
  const resumed=new TrainingSession(main,session.snapshot(practice));
  assert.equal(resumed.active,true);assert.equal(resumed.tutorial.complete,true);
  assert.equal(resumed.destination(practice).inventory.iron,57);
  assert.equal(JSON.stringify(main),before);
});

test('new explorer completes all seven steps through actual game actions',()=>{
  const g=new Game(),t=new Tutorial();g.collectStarterTools();
  walk(g,t,2);assert.equal(t.step,1);
  const iron=g.world().nodes.filter(n=>n.type==='iron');mine(g,t,iron[0]);assert.equal(t.step,2);
  assert.ok(g.scan().ok);drain(g,t);assert.equal(t.step,3);
  mine(g,t,iron[1]);for(const n of g.world().nodes.filter(n=>n.type==='biomass').slice(0,2))mine(g,t,n);
  let site;for(let x=250;x<1200&&!site;x+=50)for(let y=250;y<1200&&!site;y+=50){g.state.player={x:x-90,y,angle:0};if(g.canPlace('habitat',x,y).ok)site={x,y};}
  assert.ok(site);assert.ok(g.build('habitat',site.x,site.y).ok);drain(g,t);assert.equal(t.step,4);
  const c=g.world().creatures[0];g.state.player={x:c.x-60,y:c.y,angle:0};g.cooldown=0;assert.ok(g.interact(c.id).ok);drain(g,t);assert.equal(t.step,5);
  g.state.player={x:90,y:90,angle:0};assert.ok(g.launch().ok);assert.equal(t.step,5);finishFlight(g);drain(g,t);assert.equal(t.step,6);
  const other=PLANETS.find(p=>p.id!==g.state.planet);assert.ok(g.warp(other.id).ok);g.finishTravel();assert.ok(g.land(other.id).ok);assert.equal(t.complete,false);finishFlight(g);drain(g,t);
  assert.equal(t.complete,true);assert.equal(t.active,false);assert.deepEqual(t.done,Array(7).fill(true));
});

test('academy course requires meeting Lumi, supplies materials once, and completes all seven actions',()=>{
  const session=new TrainingSession(null,null),g=new Game(session.state),t=session.tutorial;t.sync(g);
  assert.equal(g.launch().ok,false);assert.equal(g.scan().ok,false);
  const iron=g.world().nodes.find(n=>n.type==='iron');g.state.player={x:iron.x-65,y:iron.y,angle:0};assert.equal(g.interact(iron.id).ok,false);
  const npc=g.trainingNpc();g.state.player={x:npc.x-60,y:npc.y,angle:0};g.interact(npc.id);drain(g,t);assert.equal(t.step,1);
  mine(g,t,iron);assert.equal(t.step,2);assert.equal(g.launch().ok,false);
  g.scan();drain(g,t);assert.equal(t.step,3);assert.equal(g.state.inventory.iron,12);assert.equal(g.state.inventory.biomass,8);
  g.scanCooldown=0;g.scan();drain(g,t);assert.equal(g.state.inventory.iron,12);
  const resumed=new TrainingSession(null,session.snapshot(g)),loaded=new Game(resumed.state);resumed.tutorial.sync(loaded);
  assert.equal(loaded.world().nodes.find(n=>n.id===iron.id).hp,0);assert.equal(loaded.trainingStep,3);
  g.state.player={x:450,y:370,angle:0};assert.equal(t.guide(g).action,'build');
  assert.equal(g.build('habitat',100,370).ok,false);assert.ok(g.build('habitat',450,480).ok);drain(g,t);assert.equal(t.step,4);
  const c=g.world().creatures[0];g.state.player={x:c.x+60,y:c.y,angle:0};g.cooldown=0;g.interact(c.id);drain(g,t);assert.equal(t.step,5);
  g.state.player={x:90,y:90,angle:0};assert.ok(g.launch().ok);assert.equal(t.step,5);finishFlight(g);drain(g,t);assert.equal(t.step,6);
  assert.ok(g.warp('solara').ok);g.finishTravel();assert.ok(g.land('solara').ok);assert.equal(t.complete,false);finishFlight(g);drain(g,t);assert.equal(t.complete,true);
  const main=new Game(session.destination(g));assert.equal(main.trainingNpc(),null);assert.equal(main.state.planet,'verdant');assert.equal(main.world().buildings.length,0);
});

test('academy deck confines movement, supplies oxygen and migrates the old layout',()=>{
  const old=new Game().snapshot();old.training=true;old.player={x:1500,y:1500,angle:0};
  const session=new TrainingSession(null,{version:1,active:true,game:old,tutorial:{done:[true,true]}}),g=new Game(session.state);
  assert.equal(g.state.player.x,-610);assert.equal(session.tutorial.step,2);assert.equal(g.world().nodes.length,5);
  g.state.player={x:739,y:659,angle:0};g.state.oxygen=20;
  for(let i=0;i<300;i++)g.tick(1/60,{right:true,down:true});
  assert.ok(g.state.player.x<=740&&g.state.player.y<=660);assert.equal(g.state.oxygen,100);
  assert.ok(g.world().nodes.every(n=>n.id.startsWith('training-v2-')));
});

test('failed actions, mining hits, upgrades and guide effects do not pass tutorial steps',()=>{
  const g=new Game(),t=new Tutorial(),n=g.world().nodes.find(n=>n.type==='iron');g.collectStarterTools();
  g.state.player={x:n.x-65,y:n.y,angle:0};g.interact(n.id);drain(g,t);assert.equal(t.done[1],false);
  g.paused=true;g.scan();g.build('habitat',400,400);drain(g,t);assert.equal(t.done[2],false);assert.equal(t.done[3],false);
  t.event({type:'effect',kind:'scan',x:20,y:30},g);t.event({type:'effect',kind:'build',x:20,y:30},g);
  assert.equal(t.done[2],false);assert.equal(t.done[3],false);
  g.paused=false;g.state.mode='space';g.scan();drain(g,t);assert.equal(t.done[2],false);
});

test('movement ignores teleportation and pauses and resumes saved progress',()=>{
  const g=new Game(),t=new Tutorial();walk(g,t,.2);const before=t.walked;
  g.state.player.x+=900;t.tick(g);assert.equal(t.walked,before);
  g.paused=true;t.tick(g);g.state.player.x+=50;g.paused=false;t.tick(g);assert.equal(t.walked,before);
  const restored=new Tutorial(JSON.parse(JSON.stringify(t.snapshot())));walk(g,restored,2);assert.equal(restored.done[0],true);
  restored.skipped=true;const skipped=new Tutorial(restored.snapshot());assert.equal(skipped.active,false);
  const old=skipped.walked;walk(g,skipped,2);assert.equal(skipped.walked,old);
  assert.equal(new Tutorial().step,0);assert.equal(new Tutorial({walked:Infinity}).walked,0);
});

test('same-planet landing is not a new-planet completion; flight progress survives reload',()=>{
  const g=new Game(),t=new Tutorial();g.launch();finishFlight(g);drain(g,t);
  const p=g.planet();g.state.ship={x:p.x,y:p.y+p.r+65,altitude:0};g.land();finishFlight(g);drain(g,t);assert.equal(t.done[6],false);
  g.launch();finishFlight(g);drain(g,t);const resumed=new Tutorial(t.snapshot());
  const target=PLANETS.find(p=>p.id!==g.state.planet);g.warp(target.id);g.finishTravel();g.land(target.id);finishFlight(g);drain(g,resumed);assert.equal(resumed.done[6],true);
});

test('guide finds needed resources, offers building only with funds, and recovers from early launch',()=>{
  const g=new Game(),t=new Tutorial({done:[true,true,true]});g.collectStarterTools();
  assert.equal(t.guide(g).action,'mark');assert.ok(g.world().nodes.some(n=>n.type==='iron'&&n.x===t.guide(g).target.x));
  g.state.inventory.iron=12;assert.equal(t.guide(g).action,'equip');assert.equal(t.guide(g).tool,'axe');g.equipTool('axe');assert.ok(g.world().nodes.some(n=>n.type==='biomass'&&n.x===t.guide(g).target.x));
  g.state.inventory.biomass=8;assert.equal(t.guide(g).action,'build');
  g.launch();finishFlight(g);drain(g,t);assert.equal(t.guide(g).action,'map');
  const p=g.planet();g.state.ship={x:p.x,y:p.y+p.r+65,altitude:0};assert.equal(t.guide(g).action,'land');
  g.warp(PLANETS[1].id);assert.equal(t.guide(g).action,null);
});

test('deployed Worker includes tutorial controller and uses only the 2D player renderer',async()=>{
  const worker=await loadWorker();const html=await (await worker.fetch(new Request('https://test.local/play'))).text();
  assert.match(html,/id="tutorial-card"/);assert.match(html,/root\.OrbitTutorial=\{Tutorial,STEPS,TrainingSession\}/);assert.match(html,/튜토리얼 다시 시작/);
  assert.doesNotMatch(html,/<script src="tutorial\.js"/);assert.doesNotMatch(html,/OrbitPlayerRig|Orbit3D|player-k17\.webp/);
  const health=await (await worker.fetch(new Request('https://test.local/health'))).json();assert.equal(health.ok,true);assert.equal(health.tutorialSteps,7);
});

test('goal navigation reaches Lumi and then the ore without sticking on the ship',()=>{
 const session=new TrainingSession(null,null),g=new Game(session.state),t=session.tutorial;t.sync(g);
 const npc=g.trainingNpc();g.pendingInteraction=npc.id;g.moveTarget={x:npc.x,y:npc.y};
 for(let i=0;i<300;i++){g.tick(1/60);t.tick(g);drain(g,t);}assert.equal(t.step,1);
 const ore=g.world().nodes.find(n=>n.type==='iron');g.pendingInteraction=ore.id;g.moveTarget={x:ore.x,y:ore.y};
 for(let i=0;i<600;i++){g.tick(1/60);t.tick(g);drain(g,t);}assert.ok(ore.hp<ore.maxHp);assert.equal(g.pendingInteraction,null);
});
