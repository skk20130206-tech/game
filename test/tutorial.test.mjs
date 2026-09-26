import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadWorker } from '../scripts/load-worker.mjs';
const require=createRequire(import.meta.url);
const {Game,PLANETS}=require('../game/core.js');
const {Tutorial}=require('../game/tutorial.js');
const drain=(g,t)=>{while(g.events.length)t.event(g.events.shift(),g);};
const walk=(g,t,seconds)=>{for(let i=0;i<seconds*60;i++){g.tick(1/60,{right:true});t.tick(g);drain(g,t);}};
const mine=(g,t,n)=>{g.state.player={x:n.x-65,y:n.y,angle:0};while(n.hp>0){g.cooldown=0;assert.ok(g.interact(n.id).ok);drain(g,t);}};

test('new explorer completes all seven steps through actual game actions',()=>{
  const g=new Game(),t=new Tutorial();
  walk(g,t,2);assert.equal(t.step,1);
  const iron=g.world().nodes.filter(n=>n.type==='iron');mine(g,t,iron[0]);assert.equal(t.step,2);
  assert.ok(g.scan().ok);drain(g,t);assert.equal(t.step,3);
  mine(g,t,iron[1]);for(const n of g.world().nodes.filter(n=>n.type==='biomass').slice(0,2))mine(g,t,n);
  let site;for(let x=250;x<1200&&!site;x+=50)for(let y=250;y<1200&&!site;y+=50){g.state.player={x:x-90,y,angle:0};if(g.canPlace('habitat',x,y).ok)site={x,y};}
  assert.ok(site);assert.ok(g.build('habitat',site.x,site.y).ok);drain(g,t);assert.equal(t.step,4);
  const c=g.world().creatures[0];g.state.player={x:c.x-60,y:c.y,angle:0};g.cooldown=0;assert.ok(g.interact(c.id).ok);drain(g,t);assert.equal(t.step,5);
  g.state.player={x:90,y:90,angle:0};assert.ok(g.launch().ok);drain(g,t);assert.equal(t.step,6);
  const other=PLANETS.find(p=>p.id!==g.state.planet);assert.ok(g.warp(other.id).ok);g.finishTravel();assert.ok(g.land(other.id).ok);drain(g,t);
  assert.equal(t.complete,true);assert.equal(t.active,false);assert.deepEqual(t.done,Array(7).fill(true));
});

test('failed actions, mining hits, upgrades and guide effects do not pass tutorial steps',()=>{
  const g=new Game(),t=new Tutorial(),n=g.world().nodes.find(n=>n.type==='iron');
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
  const g=new Game(),t=new Tutorial();g.launch();drain(g,t);
  const p=g.planet();g.state.ship={x:p.x,y:p.y+p.r+65,altitude:0};g.land();drain(g,t);assert.equal(t.done[6],false);
  g.launch();drain(g,t);const resumed=new Tutorial(t.snapshot());
  const target=PLANETS.find(p=>p.id!==g.state.planet);g.warp(target.id);g.finishTravel();g.land(target.id);drain(g,resumed);assert.equal(resumed.done[6],true);
});

test('guide finds needed resources, offers building only with funds, and recovers from early launch',()=>{
  const g=new Game(),t=new Tutorial({done:[true,true,true]});
  assert.equal(t.guide(g).action,'mark');assert.ok(g.world().nodes.some(n=>n.type==='iron'&&n.x===t.guide(g).target.x));
  g.state.inventory.iron=12;assert.ok(g.world().nodes.some(n=>n.type==='biomass'&&n.x===t.guide(g).target.x));
  g.state.inventory.biomass=8;assert.equal(t.guide(g).action,'build');
  g.launch();drain(g,t);assert.equal(t.guide(g).action,'map');
  const p=g.planet();g.state.ship={x:p.x,y:p.y+p.r+65,altitude:0};assert.equal(t.guide(g).action,'land');
  g.warp(PLANETS[1].id);assert.equal(t.guide(g).action,null);
});

test('deployed Worker includes tutorial controller and uses only the 2D player renderer',async()=>{
  const worker=await loadWorker();const html=await (await worker.fetch(new Request('https://test.local/play'))).text();
  assert.match(html,/id="tutorial-card"/);assert.match(html,/root\.OrbitTutorial=\{Tutorial,STEPS\}/);assert.match(html,/튜토리얼 다시 시작/);
  assert.doesNotMatch(html,/<script src="tutorial\.js"/);assert.doesNotMatch(html,/OrbitPlayerRig|Orbit3D|player-k17\.webp/);
  const health=await (await worker.fetch(new Request('https://test.local/health'))).json();assert.equal(health.ok,true);assert.equal(health.tutorialSteps,7);
});
