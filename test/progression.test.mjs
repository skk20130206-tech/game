import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Game,PLANETS,SHIP_TIERS,XP_REWARDS,MAX_LEVEL,xpForLevel,levelProgress}=require('../game/core.js');
const {TrainingSession}=require('../game/tutorial.js');
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.round(seconds*60);i++)g.tick(1/60,input);};
const funded=()=>{const g=new Game();g.state.progression.xp=xpForLevel(10);g.state.inventory={iron:300,crystal:200,biomass:100};return g;};

test('XP crosses multiple levels, caps at 20, and ignores invalid gains',()=>{
  const g=new Game();assert.equal(g.levelInfo().level,1);
  g.awardXp(99,'test');assert.equal(g.levelInfo().level,1);assert.equal(g.levelInfo().remaining,1);
  g.awardXp(151,'test');assert.equal(g.levelInfo().level,3);assert.equal(g.levelInfo().current,0);
  assert.deepEqual(g.events.filter(e=>e.type==='level-up').map(e=>e.level),[2,3]);
  for(const amount of [NaN,Infinity,-100,0])g.awardXp(amount,'invalid');assert.equal(g.levelInfo().xp,250);
  g.awardXp(999999,'test');assert.equal(g.levelInfo().level,MAX_LEVEL);assert.equal(g.levelInfo().percent,100);assert.equal(g.levelInfo().remaining,0);
  const loaded=new Game(g.snapshot());assert.deepEqual(loaded.levelInfo(),g.levelInfo());
  assert.equal(loaded.events.filter(e=>e.type==='level-up').length,0);
  assert.deepEqual(g.events.filter(e=>e.type==='level-up').map(e=>e.level),Array.from({length:19},(_,i)=>i+2));
  g.events=[];g.awardXp(100,'already max');assert.equal(g.events.filter(e=>e.type==='level-up').length,0);
  assert.equal(levelProgress(NaN).level,1);
});

test('actual gathering, discovery, building, ruins and quest completion award XP only when successful',()=>{
  const g=new Game(),n=g.world().nodes.find(n=>n.type==='iron');g.collectStarterTools();g.state.player={x:n.x-55,y:n.y,angle:0};
  g.equipTool('axe');assert.equal(g.interact(n.id).ok,false);assert.equal(g.levelInfo().xp,0);
  g.equipTool('pickaxe');for(let i=0;i<n.maxHp;i++){g.cooldown=0;g.interact(n.id);tick(g,.8);}
  assert.equal(g.levelInfo().xp,XP_REWARDS.mine);g.cooldown=0;g.interact(n.id);assert.equal(g.levelInfo().xp,12);
  const c=g.world().creatures[0];g.discover(c.species);g.discover(c.species);g.befriend(c);g.befriend(c);
  assert.equal(g.levelInfo().xp,12+25+15);
  const r=g.world().relics[0];g.state.player={x:r.x,y:r.y,angle:0};g.studyRelic(r.id);g.studyRelic(r.id);assert.equal(g.levelInfo().xp,112);
  const b=new Game();b.state.player={x:600,y:600,angle:0};b.world().nodes=[];assert.equal(b.build('habitat',650,600).ok,false);assert.equal(b.levelInfo().xp,0);
  b.state.inventory={iron:12,biomass:8,crystal:0};assert.ok(b.build('habitat',650,600).ok);assert.equal(b.levelInfo().xp,35);assert.equal(b.build('habitat',650,600).ok,false);assert.equal(b.levelInfo().xp,35);
  b.state.probeQuest={stage:'repairing',age:0};b.finishProbeScene();b.finishProbeScene();assert.equal(b.levelInfo().xp,155);
  const resumed=new Game(b.snapshot());resumed.finishProbeScene();assert.equal(resumed.levelInfo().xp,155);
});

test('upgrades enforce level, cost, location, expected tier and busy state without partial deductions',()=>{
  const g=funded(),inventory={...g.state.inventory};g.state.progression.xp=0;
  assert.equal(g.upgradeShip(1).ok,false);assert.deepEqual(g.state.inventory,inventory);
  g.state.progression.xp=xpForLevel(3);g.state.player.x=500;assert.equal(g.upgradeShip(1).ok,false);
  g.state.player={x:90,y:100,angle:0};g.state.inventory.crystal=7;assert.equal(g.upgradeShip(1).ok,false);assert.equal(g.state.inventory.iron,300);
  g.state.inventory={...inventory};g.paused=true;assert.equal(g.upgradeShip(1).ok,false);g.paused=false;
  g.startFlight('launch');assert.equal(g.upgradeShip(1).ok,false);g.state.flight=null;
  g.state.mode='space';assert.equal(g.upgradeShip(1).ok,false);g.state.mode='surface';
  g.state.probeQuest.stage='malfunction';assert.equal(g.upgradeShip(1).ok,false);g.state.probeQuest.stage='available';
  assert.equal(g.upgradeShip(2).ok,false);assert.deepEqual(g.state.inventory,inventory);
  assert.ok(g.upgradeShip(1).ok);assert.equal(g.state.progression.shipTier,1);
  for(const [r,n]of Object.entries(SHIP_TIERS[1].cost))assert.equal(g.state.inventory[r],inventory[r]-n);
  const after={...g.state.inventory};assert.equal(g.upgradeShip(1).ok,false);assert.equal(g.upgradeShip(2).ok,false);assert.deepEqual(g.state.inventory,after);
  g.state.progression.xp=xpForLevel(10);assert.ok(g.upgradeShip(2).ok);assert.ok(g.upgradeShip(3).ok);assert.equal(g.upgradeShip(4).ok,false);assert.equal(g.shipUpgradeStatus().max,true);
  assert.equal(new Game(g.snapshot()).state.progression.shipTier,3);
});

test('ship upgrades change actual speed and fuel use; direct landing cannot bypass locked routes',()=>{
  const base=new Game(),fast=funded();fast.upgradeShip(1);
  for(const g of [base,fast]){g.state.mode='space';g.state.ship={x:0,y:0,angle:0};tick(g,1,{right:true});}
  assert.ok(fast.state.ship.x>base.state.ship.x*1.14);assert.ok(fast.state.fuel>base.state.fuel);
  const g=funded();g.state.mode='space';const originalFuel=g.state.fuel;
  assert.equal(g.warp('nix').ok,false);assert.equal(g.state.fuel,originalFuel);assert.equal(g.travel,null);
  const target=PLANETS.find(p=>p.id==='nix');g.state.ship={x:target.x,y:target.y+target.r+65,angle:0};assert.equal(g.land('nix').ok,false);assert.equal(g.state.mode,'space');
  g.state.mode='surface';g.upgradeShip(1);g.state.mode='space';assert.ok(g.warp('nix').ok);assert.equal(g.state.fuel,84);g.finishTravel();assert.ok(g.land('nix').ok);
  assert.equal(g.levelInfo().xp,xpForLevel(10));tick(g,3);assert.equal(g.levelInfo().xp,xpForLevel(10)+80);
  g.launch();tick(g,3);g.warp('nix');g.finishTravel();g.land('nix');tick(g,3);assert.equal(g.levelInfo().xp,xpForLevel(10)+80);
  assert.equal(g.planetAccess('ember').ok,false);g.state.visited.push('ember');assert.equal(g.planetAccess('ember').ok,true);
});

test('old saves receive progression once, preserve distant bases and routes, and reject malformed new values',()=>{
  const old=new Game().snapshot();delete old.progression;
  old.stats.mined=10;old.discovered=['mossling'];old.met=['mossling'];old.visited=['verdant','prisma'];old.planet='prisma';old.inventory.biomass=22;
  old.worlds.prisma=new Game().makeWorld(PLANETS.find(p=>p.id==='prisma'));old.worlds.prisma.buildings.push({type:'habitat',x:600,y:600,level:2});old.probeQuest.stage='complete';
  const g=new Game(old);assert.equal(g.levelInfo().xp,120+25+15+80+35+120);assert.equal(g.state.progression.shipTier,3);assert.equal(g.world().buildings.length,1);assert.equal(g.state.inventory.biomass,22);
  assert.deepEqual(new Game(g.snapshot()).state.progression,g.state.progression);
  old.progression={xp:Infinity,shipTier:Infinity};const bad=new Game(old);assert.equal(bad.levelInfo().xp,0);assert.equal(bad.state.progression.shipTier,0);assert.equal(bad.planetAccess('prisma').ok,true);
});

test('training cannot farm XP or upgrade ships and all practice routes remain usable',()=>{
  const main=funded().snapshot(),session=new TrainingSession(main,{version:2,active:true,game:new Game().snapshot()}),g=new Game(session.state);
  g.awardXp(500,'practice');g.discover('mossling');g.befriend(g.world().creatures[0]);assert.equal(g.levelInfo().xp,0);assert.equal(g.upgradeShip(1).ok,false);
  for(const p of PLANETS)assert.equal(g.planetAccess(p.id).ok,true);
  session.tutorial.done.fill(true);assert.deepEqual(session.destination(g),main);
  const freshman=new TrainingSession(null,null);freshman.tutorial.done.fill(true);assert.deepEqual(freshman.destination(new Game(freshman.state)).progression,{xp:0,shipTier:0});
});
